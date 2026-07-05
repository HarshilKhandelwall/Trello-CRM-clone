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


class BoardMembersView(APIView):
    """
    GET: List all members of a board
    POST: Add a new member to the board
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, board_id):
        """List all board members"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user has access to this board
        from crm.permissions import user_can_access_board
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response(
                {'error': 'You do not have access to this board'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from crm.permissions import get_effective_board_members
        effective = get_effective_board_members(board)
        data = []
        for em in effective:
            user = em['user']
            data.append({
                'id': em['id'],
                'role': em['role'],
                'added_at': em['added_at'].isoformat() if em['added_at'] else None,
                'added_by_username': em['added_by_username'],
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name
                }
            })
        return Response(data)
    
    def post(self, request, board_id):
        """Add a new member to the board"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if user is an admin or owner
        from crm.permissions import get_user_board_role
        user_role = get_user_board_role(request.user, board)
        if user_role not in ['ADMIN', 'OWNER']:
            return Response(
                {'error': 'Only admins can add members'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get user to add
        user_id = request.data.get('user_id')
        role = request.data.get('role', 'EDITOR')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user_to_add = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if user is already a member
        if BoardMember.objects.filter(board=board, user=user_to_add).exists():
            return Response(
                {'error': 'User is already a member of this board'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create board member
        board_member = BoardMember.objects.create(
            board=board,
            user=user_to_add,
            role=role,
            added_by=request.user
        )
        
        # Broadcast via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'member_added',
                'member': BoardMemberSerializer(board_member).data
            }
        )
        
        serializer = BoardMemberSerializer(board_member)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BoardMemberDetailView(APIView):
    """
    PATCH: Update member role
    DELETE: Remove member from board
    """
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, board_id, user_id):
        """Update member role"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if requester is an admin
        from crm.permissions import get_user_board_role
        user_role = get_user_board_role(request.user, board)
        if user_role not in ['ADMIN', 'OWNER']:
            return Response(
                {'error': 'Only admins can change member roles'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update role
        new_role = request.data.get('role')
        if new_role not in ['ADMIN', 'EDITOR', 'VIEWER']:
            return Response(
                {'error': 'Invalid role'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get or create board override role
        member, created = BoardMember.objects.get_or_create(
            board=board,
            user_id=user_id,
            defaults={'role': new_role, 'added_by': request.user}
        )
        
        if not created:
            # Prevent removing the last admin
            if member.role == 'ADMIN' and new_role != 'ADMIN':
                admin_count = BoardMember.objects.filter(board=board, role='ADMIN').count()
                if admin_count <= 1:
                    return Response(
                        {'error': 'Cannot change role of the last admin'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            member.role = new_role
            member.save()

        
        # Broadcast via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'member_role_changed',
                'member': BoardMemberSerializer(member).data
            }
        )
        
        serializer = BoardMemberSerializer(member)
        return Response(serializer.data)
    
    def delete(self, request, board_id, user_id):
        """Remove member from board"""
        board = get_object_or_404(Board, id=board_id)
        
        # Check if requester is an admin
        from crm.permissions import get_user_board_role
        user_role = get_user_board_role(request.user, board)
        if user_role not in ['ADMIN', 'OWNER']:
            return Response(
                {'error': 'Only admins can remove members'},
                status=status.HTTP_403_FORBIDDEN
            )
        

        # Get member to remove
        try:
            member = BoardMember.objects.get(board=board, user_id=user_id)
        except BoardMember.DoesNotExist:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Prevent removing the last admin
        if member.role == 'ADMIN':
            admin_count = BoardMember.objects.filter(board=board, role='ADMIN').count()
            if admin_count <= 1:
                return Response(
                    {'error': 'Cannot remove the last admin'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        member_data = BoardMemberSerializer(member).data
        member.delete()
        
        # Broadcast via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'member_removed',
                'member': member_data
            }
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSearchView(APIView):
    """Search for users to invite to board"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Search users by username or email"""
        query = request.query_params.get('q', '').strip()
        board_id = request.query_params.get('board_id')
        
        if not query or len(query) < 2:
            return Response([])
        
        # Search users
        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query)
        )
        
        # ── M-1 FIX: Restrict user search to shared workspaces for multi-tenant isolation
        if not request.user.is_superuser:
            shared_workspaces = request.user.workspace_memberships.values_list('workspace_id', flat=True)
            users = users.filter(workspace_memberships__workspace_id__in=shared_workspaces).distinct()
            
        users = users.exclude(id=request.user.id)[:10]
        
        # Exclude users already on the board
        if board_id:
            existing_member_ids = BoardMember.objects.filter(
                board_id=board_id
            ).values_list('user_id', flat=True)
            users = users.exclude(id__in=existing_member_ids)
        
        serializer = UserSearchSerializer(users, many=True)
        return Response(serializer.data)
