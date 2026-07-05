"""
Utility functions for the CRM app.
"""
from crm.models import Activity


def log_activity(board, user, action_type, description, card=None, list_obj=None, metadata=None):
    """
    Helper function to log board activities.
    
    Args:
        board: Board instance
        user: User who performed the action
        action_type: Type of action (from Activity.ACTION_TYPES)
        description: Human-readable description of the action
        card: Optional Card instance
        list_obj: Optional List instance
        metadata: Optional dict with additional data
    
    Returns:
        Activity instance
    """
    meta = metadata or {}
    
    # ── L-2 FIX: Always store card title and list name in metadata 
    # to preserve history even if the card/list is deleted (FK SET_NULL)
    if card and 'card_title' not in meta:
        meta['card_title'] = card.title
    if list_obj and 'list_name' not in meta:
        meta['list_name'] = list_obj.name

    activity = Activity.objects.create(
        board=board,
        user=user,
        action_type=action_type,
        card=card,
        list=list_obj,
        description=description,
        metadata=meta
    )
    return activity


def broadcast_to_board(board_id, event_type, data):
    """
    Helper function to broadcast WebSocket events to a board.
    
    Args:
        board_id: ID of the board
        event_type: Type of event (e.g., 'card_created', 'list_updated')
        data: Data to send with the event
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'board_{board_id}',
                {
                    'type': event_type,
                    'action': event_type,
                    'data': data
                }
            )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to broadcast to board {board_id}: {e}')


def send_notification_to_user(user_id, notification_data):
    """
    Send a notification to a specific user via WebSocket.
    
    Args:
        user_id: The ID of the user to notify
        notification_data: Dictionary containing notification details:
            - id: Notification ID
            - type: Notification type (e.g., 'card_assigned', 'comment_added')
            - message: Notification message
            - card_id: Related card ID (optional)
            - card_title: Related card title (optional)
            - created_at: ISO timestamp
            - read: Boolean indicating if notification is read
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'user_{user_id}',
                {
                    'type': 'notify',
                    'data': notification_data
                }
            )
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Sent notification to user {user_id}: {notification_data.get('message', '')}")
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to send notification to user {user_id}: {e}')
