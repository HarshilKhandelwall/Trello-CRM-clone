from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from crm.models import Card, BoardMember, User, Notification
from crm.serializers import CardSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.utils import broadcast_to_board, send_notification_to_user
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

        # Check if user to be added is a board member
        user = get_object_or_404(User, id=user_id)
        if not BoardMember.objects.filter(board=board, user=user).exists():
            return Response({'error': 'User is not a board member'}, status=400)

        # Add member to card
        card.members.add(user)
        
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
