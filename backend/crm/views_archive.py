"""
Views for card archiving functionality.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.utils import timezone
from crm.models import Card, Board, BoardMember
from crm.serializers import CardSerializer
from crm.auth import CsrfExemptSessionAuthentication
from crm.utils import log_activity
from crm.permissions import user_can_access_board


class ArchiveCardView(APIView):
    """Archive a card"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board
        list_id = card.list.id
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Archive the card
        card.archived = True
        card.archived_at = timezone.now()
        card.archived_by = request.user
        card.save()
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='card_archived',
            description=f'archived "{card.title}"',
            card=card
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_archived',
                'card_id': card.id,
                'list_id': list_id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(CardSerializer(card).data)


class RestoreCardView(APIView):
    """Restore an archived card"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, card_id):
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        card = get_object_or_404(Card, id=card_id)
        board = card.list.board
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='EDITOR'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Restore the card
        card.archived = False
        card.archived_at = None
        card.archived_by = None
        card.save()
        
        # Log activity
        log_activity(
            board=board,
            user=request.user,
            action_type='card_restored',
            description=f'restored "{card.title}"',
            card=card
        )
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board.id}',
            {
                'type': 'card_restored',
                'card_data': CardSerializer(card).data,
                'list_id': card.list.id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(CardSerializer(card).data)


class ArchivedCardsView(APIView):
    """Get all archived cards for a board"""
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request, board_id):
        board = get_object_or_404(Board, id=board_id)
        
        # Check permissions
        if not user_can_access_board(request.user, board, min_role='VIEWER'):
            return Response({'error': 'forbidden'}, status=403)
        
        # Get archived cards
        archived_cards = Card.objects.filter(
            list__board=board,
            archived=True
        ).select_related('list', 'created_by', 'archived_by').order_by('-archived_at')
        
        serializer = CardSerializer(archived_cards, many=True)
        return Response(serializer.data)
