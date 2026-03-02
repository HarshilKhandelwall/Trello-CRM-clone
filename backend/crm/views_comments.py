from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from crm.models import Comment
from crm.serializers import CommentSerializer
from crm.utils import log_activity


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter comments by card if card_id is provided"""
        queryset = super().get_queryset()
        card_id = self.request.query_params.get('card_id')
        if card_id:
            queryset = queryset.filter(card_id=card_id)
        return queryset.order_by('-created_at')  # Newest first
    
    def create(self, request, *args, **kwargs):
        """Create a new comment"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from crm.models import Card, Notification
        from crm.utils import send_notification_to_user
        
        card_id = request.data.get('card_id')
        text = request.data.get('text')
        
        if not text or not text.strip():
            return Response(
                {'error': 'Comment text cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comment = Comment.objects.create(
            card_id=card_id,
            user=request.user,
            text=text.strip()
        )
        
        serializer = self.get_serializer(comment)
        
        # Log activity
        card = Card.objects.get(id=card_id)
        board = card.list.board
        log_activity(
            board=board,
            user=request.user,
            action_type='comment_added',
            description=f'commented on "{card.title}"',
            card=card
        )
        
        # Create notifications for card members (except the commenter)
        card_members = card.members.exclude(id=request.user.id)
        for member in card_members:
            notification = Notification.objects.create(
                user=member,
                card=card,
                notification_type='comment_added',
                message=f'{request.user.username} commented on "{card.title}"',
                link=f'/card/{card.id}'
            )
            
            # Send WebSocket notification
            send_notification_to_user(member.id, {
                'id': notification.id,
                'type': 'comment_added',
                'message': notification.message,
                'card_id': card.id,
                'card_title': card.title,
                'created_at': notification.created_at.isoformat(),
                'read': False
            })
        
        # Broadcast WebSocket event
        card = Card.objects.get(id=card_id)
        board_id = card.list.board.id
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'comment_added',
                'comment_data': serializer.data,
                'card_id': card_id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        """Update comment text (only by owner)"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        instance = self.get_object()
        
        # Check if user owns the comment
        if instance.user != request.user:
            return Response(
                {'error': 'You can only edit your own comments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        text = request.data.get('text', '').strip()
        if not text:
            return Response(
                {'error': 'Comment text cannot be empty'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        instance.text = text
        instance.save()
        
        serializer = self.get_serializer(instance)
        
        # Log activity
        board = instance.card.list.board
        log_activity(
            board=board,
            user=request.user,
            action_type='comment_updated',
            description=f'edited a comment on "{instance.card.title}"',
            card=instance.card
        )
        
        # Broadcast WebSocket event
        board_id = instance.card.list.board.id
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'comment_updated',
                'comment_data': serializer.data,
                'card_id': instance.card.id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Delete comment (only by owner)"""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        instance = self.get_object()
        
        # Check if user owns the comment
        if instance.user != request.user:
            return Response(
                {'error': 'You can only delete your own comments'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Store data before deletion
        board_id = instance.card.list.board.id
        board = instance.card.list.board
        card_id = instance.card.id
        card_title = instance.card.title
        comment_id = instance.id
        
        # Log activity before deletion
        log_activity(
            board=board,
            user=request.user,
            action_type='comment_deleted',
            description=f'deleted a comment on "{card_title}"',
            metadata={'comment_id': comment_id, 'card_id': card_id}
        )
        
        self.perform_destroy(instance)
        
        # Broadcast WebSocket event
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'board_{board_id}',
            {
                'type': 'comment_deleted',
                'comment_id': comment_id,
                'card_id': card_id,
                'user_id': request.user.id,
                'username': request.user.username
            }
        )
        
        return Response(status=status.HTTP_204_NO_CONTENT)

