from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Board, BoardMember
from .serializers_members import BoardMemberSerializer, UserSearchSerializer
from crm.auth import CsrfExemptSessionAuthentication

User = get_user_model()

# Roles that grant admin-level control over the board
ADMIN_ROLES = {'ADMIN', 'OWNER'}


def _serialize_member_entry(em, requester_id):
    """Build the API shape for one effective-member dict."""
    user = em['user']
    return {
        'id': em['id'],
        'role': em['role'],
        'source': em.get('source', 'board'),   # 'workspace' | 'board'
        'added_at': em['added_at'].isoformat() if em['added_at'] else None,
        'added_by_username': em['added_by_username'],
        'is_me': user.id == requester_id,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        }
    }


class BoardMembersView(APIView):
    """
    GET: List all members of a board.
        Response shape: { members: [...], me: {...} }
        'me' is the requester's own entry (null if not found).
    POST: Add a new member to the board (ADMIN / OWNER only).
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, board_id):
        """List all board members, annotating the requester's own entry."""
        board = get_object_or_404(Board, id=board_id)

        from crm.permissions import user_can_access_board
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response(
                {'error': 'You do not have access to this board'},
                status=status.HTTP_403_FORBIDDEN
            )

        from crm.permissions import get_effective_board_members
        effective = get_effective_board_members(board)

        members = [_serialize_member_entry(em, request.user.id) for em in effective]
        me_entry = next((m for m in members if m['is_me']), None)

        return Response({'members': members, 'me': me_entry})

    def post(self, request, board_id):
        """Add a new member to the board (ADMIN / OWNER only)."""
        board = get_object_or_404(Board, id=board_id)

        from crm.permissions import get_user_board_role
        user_role = get_user_board_role(request.user, board)
        if user_role not in ADMIN_ROLES:
            return Response(
                {'error': 'Only admins can add members'},
                status=status.HTTP_403_FORBIDDEN
            )

        user_id = request.data.get('user_id')
        role = request.data.get('role', 'EDITOR')

        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        if role not in ('ADMIN', 'EDITOR', 'VIEWER'):
            return Response(
                {'error': 'Invalid role. Must be ADMIN, EDITOR, or VIEWER.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_to_add = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if BoardMember.objects.filter(board=board, user=user_to_add).exists():
            return Response(
                {'error': 'User is already a member of this board'},
                status=status.HTTP_400_BAD_REQUEST
            )

        board_member = BoardMember.objects.create(
            board=board,
            user=user_to_add,
            role=role,
            added_by=request.user
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {'type': 'member_added', 'member': BoardMemberSerializer(board_member).data}
        )

        return Response(BoardMemberSerializer(board_member).data, status=status.HTTP_201_CREATED)


class BoardMemberDetailView(APIView):
    """
    PATCH: Update member role (ADMIN / OWNER only).
    DELETE: Remove member (ADMIN / OWNER, or self-removal).
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, board_id, user_id):
        """Update a member's role."""
        board = get_object_or_404(Board, id=board_id)

        from crm.permissions import get_user_board_role
        requester_role = get_user_board_role(request.user, board)
        if requester_role not in ADMIN_ROLES:
            return Response(
                {'error': 'Only admins can change member roles'},
                status=status.HTTP_403_FORBIDDEN
            )

        new_role = request.data.get('role')
        if new_role not in ('ADMIN', 'EDITOR', 'VIEWER'):
            return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

        # Protect OWNER from being demoted
        try:
            existing = BoardMember.objects.get(board=board, user_id=user_id)
            if existing.role == 'OWNER':
                return Response(
                    {'error': "The board owner's role cannot be changed"},
                    status=status.HTTP_403_FORBIDDEN
                )
        except BoardMember.DoesNotExist:
            existing = None

        member, created = BoardMember.objects.get_or_create(
            board=board,
            user_id=user_id,
            defaults={'role': new_role, 'added_by': request.user}
        )

        if not created:
            # Prevent demoting the last admin
            if member.role in ADMIN_ROLES and new_role not in ADMIN_ROLES:
                admin_count = BoardMember.objects.filter(
                    board=board, role__in=['ADMIN', 'OWNER']
                ).count()
                if admin_count <= 1:
                    return Response(
                        {'error': 'Cannot demote the last admin/owner'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            member.role = new_role
            member.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {'type': 'member_role_changed', 'member': BoardMemberSerializer(member).data}
        )

        return Response(BoardMemberSerializer(member).data)

    def delete(self, request, board_id, user_id):
        """Remove a member from the board."""
        board = get_object_or_404(Board, id=board_id)

        from crm.permissions import get_user_board_role
        requester_role = get_user_board_role(request.user, board)
        is_self = str(request.user.id) == str(user_id)

        if not is_self and requester_role not in ADMIN_ROLES:
            return Response(
                {'error': 'Only admins can remove members'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            member = BoardMember.objects.get(board=board, user_id=user_id)
        except BoardMember.DoesNotExist:
            return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

        if member.role == 'OWNER':
            return Response(
                {'error': 'The board owner cannot be removed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if member.role == 'ADMIN':
            admin_count = BoardMember.objects.filter(
                board=board, role__in=['ADMIN', 'OWNER']
            ).count()
            if admin_count <= 1:
                return Response(
                    {'error': 'Cannot remove the last admin'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        member_data = BoardMemberSerializer(member).data
        member.delete()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {'type': 'member_removed', 'member': member_data}
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class BoardMemberLeaveView(APIView):
    """
    DELETE /api/boards/{board_id}/members/me/
    Allows the authenticated user to leave a board they are a direct member of.
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def delete(self, request, board_id):
        board = get_object_or_404(Board, id=board_id)

        try:
            member = BoardMember.objects.get(board=board, user=request.user)
        except BoardMember.DoesNotExist:
            return Response(
                {'error': 'You are not a direct member of this board'},
                status=status.HTTP_404_NOT_FOUND
            )

        if member.role == 'OWNER':
            return Response(
                {'error': 'Board owners cannot leave their own board'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if member.role == 'ADMIN':
            admin_count = BoardMember.objects.filter(
                board=board, role__in=['ADMIN', 'OWNER']
            ).count()
            if admin_count <= 1:
                return Response(
                    {'error': 'You are the last admin. Transfer admin rights before leaving.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        member.delete()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {'type': 'member_removed', 'user_id': request.user.id}
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSearchView(APIView):
    """Search for users to invite to a board."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        board_id = request.query_params.get('board_id')

        if not query or len(query) < 2:
            return Response([])

        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query),
            is_active=True
        ).exclude(id=request.user.id)

        if board_id:
            existing_member_ids = BoardMember.objects.filter(
                board_id=board_id
            ).values_list('user_id', flat=True)
            users = users.exclude(id__in=existing_member_ids)

        users = users.distinct()[:10]

        serializer = UserSearchSerializer(users, many=True)
        return Response(serializer.data)
