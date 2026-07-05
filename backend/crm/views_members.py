from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from crm.models import Card, BoardMember, User, Notification
from crm.serializers import CardSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.utils import broadcast_to_board, send_notification_to_user, log_activity
from crm.permissions import user_can_access_board


class AddCardMemberView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, card_id):
        """Add a member to a card"""
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board
        user_id = request.data.get('user_id')

        # Check if requester has access to the board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        # ── H-2 FIX: use the full permission check (workspace membership + board overrides)
        # instead of querying the BoardMember table directly. This correctly handles
        # users who have access via workspace membership but have no BoardMember row.
        user = get_object_or_404(User, id=user_id)
        if not user_can_access_board(user, board, min_role='VIEWER'):
            return Response({'error': 'User does not have access to this board'}, status=400)

        # Add member to card
        card.members.add(user)
        
        # ── H-1 FIX: Log activity for member assignment
        log_activity(
            board=board,
            user=request.user,
            action_type='member_added',
            description=f'added {user.username} to "{card.title}"',
            card=card,
            metadata={'member_id': user.id, 'member_name': user.username}
        )
        
        serializer = CardSerializer(card)
        
        # Create notification for the assigned user (if not assigning themselves)
        if user.id != request.user.id:
            notification = Notification.objects.create(
                user=user,
                card=card,
                notification_type='card_assigned',
                message=f'{request.user.username} assigned you to "{card.title}"',
                link=f'/card/{card.id}'
            )
            
            # Send WebSocket notification
            send_notification_to_user(user.id, {
                'id': notification.id,
                'type': 'card_assigned',
                'message': notification.message,
                'card_id': card.id,
                'card_title': card.title,
                'created_at': notification.created_at.isoformat(),
                'read': False
            })
        
        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'member_added', {
            'card_id': card.id,
            'card': serializer.data,
            'member_id': user.id,
            'member_name': user.username,
            'user_id': request.user.id
        })
        
        return Response(serializer.data)


class RemoveCardMemberView(APIView):
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, card_id):
        """Remove a member from a card"""
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board
        user_id = request.data.get('user_id')

        # Check if requester has access to the board
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)

        user = get_object_or_404(User, id=user_id)
        
        # Remove member from card
        card.members.remove(user)
        
        # ── H-1 FIX: Log activity for member removal
        log_activity(
            board=board,
            user=request.user,
            action_type='member_removed',
            description=f'removed {user.username} from "{card.title}"',
            card=card,
            metadata={'member_id': user.id, 'member_name': user.username}
        )
        
        serializer = CardSerializer(card)
        
        # Broadcast WebSocket event
        broadcast_to_board(board.id, 'member_removed', {
            'card_id': card.id,
            'card': serializer.data,
            'member_id': user.id,
            'member_name': user.username,
            'user_id': request.user.id
        })
        
        return Response(serializer.data)
