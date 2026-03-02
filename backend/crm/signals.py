from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from django.utils import timezone
from crm.models import Card, List, Comment, Activity, ChecklistItem, Checklist, Notification
from crm.utils import send_notification_to_user
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# CARD SIGNALS - Track card lifecycle and changes
# ============================================================================

@receiver(post_save, sender=Card)
def log_card_activity(sender, instance, created, **kwargs):
    """
    Handles scheduling notifications when a card's due date is set or updated.
    NOTE: Activity logging for card_created is intentionally handled by the views
    (CreateCardView, CopyCardView, MoveCardToBoardView) to avoid duplicate records.
    """
    try:
        # Import inside function to avoid circular dependency
        from crm.scheduler import update_card_schedule

        # Schedule/reschedule due-date notifications whenever the card is saved
        if instance.due_at and not instance.archived:
            update_card_schedule(instance)

    except Exception as e:
        logger.error(f'Error in log_card_activity/schedule: {e}')


@receiver(post_delete, sender=Card)
def log_card_deletion(sender, instance, **kwargs):
    """Create activity record when card is deleted"""
    try:
        board = instance.list.board
        
        Activity.objects.create(
            board=board,
            user=None,  # Will be set in view
            action_type='card_deleted',
            list=instance.list,
            description=f'deleted {instance.title} from {instance.list.name}',
            metadata={'card_title': instance.title, 'list_name': instance.list.name}
        )
    except Exception as e:
        logger.error(f'Error in log_card_deletion: {e}')


@receiver(m2m_changed, sender=Card.members.through)
def log_card_member_change(sender, instance, action, pk_set, **kwargs):
    """Log when members are added or removed from cards"""
    if action not in ['post_add', 'post_remove']:
        return
    
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        board = instance.list.board
        
        if action == 'post_add':
            for user_id in pk_set:
                user = User.objects.get(id=user_id)
                Activity.objects.create(
                    board=board,
                    user=user,
                    action_type='member_added',
                    card=instance,
                    list=instance.list,
                    description=f'added {user.username} to {instance.title}',
                    metadata={'card_title': instance.title, 'member_name': user.username}
                )
                
                # Create and send notification
                try:
                    notification = Notification.objects.create(
                        user=user,
                        card=instance,
                        notification_type='card_assigned',
                        message=f'You were assigned to card "{instance.title}"',
                        link=f'/board/{board.id}'
                    )
                    
                    send_notification_to_user(user.id, {
                        'id': notification.id,
                        'notification_type': 'card_assigned',
                        'message': notification.message,
                        'card': instance.id,
                        'card_id': instance.id,
                        'card_title': instance.title,
                        'created_at': notification.created_at.isoformat(),
                        'read': False,
                        'link': notification.link
                    })
                except Exception as e:
                    logger.error(f'Error creating notification for member add: {e}')

        elif action == 'post_remove':
            for user_id in pk_set:
                user = User.objects.get(id=user_id)
                Activity.objects.create(
                    board=board,
                    user=user,
                    action_type='member_removed',
                    card=instance,
                    list=instance.list,
                    description=f'removed {user.username} from {instance.title}',
                    metadata={'card_title': instance.title, 'member_name': user.username}
                )
    except Exception as e:
        logger.error(f'Error in log_card_member_change: {e}')


# ============================================================================
# LIST SIGNALS - Track list lifecycle
# ============================================================================

@receiver(post_save, sender=List)
def log_list_activity(sender, instance, created, **kwargs):
    """Create activity record when list is created or updated"""
    try:
        board = instance.board
        
        if created:
            Activity.objects.create(
                board=board,
                user=None,  # Will be set in view
                action_type='list_created',
                list=instance,
                description=f'added list {instance.name}',
                metadata={'list_name': instance.name}
            )
    except Exception as e:
        logger.error(f'Error in log_list_activity: {e}')


@receiver(post_delete, sender=List)
def log_list_deletion(sender, instance, **kwargs):
    """Create activity record when list is deleted"""
    try:
        board = instance.board
        
        Activity.objects.create(
            board=board,
            user=None,
            action_type='list_deleted',
            description=f'deleted list {instance.name}',
            metadata={'list_name': instance.name}
        )
    except Exception as e:
        logger.error(f'Error in log_list_deletion: {e}')


# ============================================================================
# COMMENT SIGNALS - Track comments
# ============================================================================

@receiver(post_save, sender=Comment)
def log_comment_activity(sender, instance, created, **kwargs):
    """Create activity record when comment is added"""
    try:
        if created:
            board = instance.card.list.board
            
            Activity.objects.create(
                board=board,
                user=instance.user,
                action_type='comment_added',
                card=instance.card,
                list=instance.card.list,
                description=f'commented on {instance.card.title}',
                metadata={
                    'card_title': instance.card.title,
                    'comment_preview': instance.text[:50]
                }
            )
            
            # Notify card members (except the commenter)
            card_members = instance.card.members.all()
            for member in card_members:
                if member.id != instance.user.id:
                    try:
                        notification = Notification.objects.create(
                            user=member,
                            card=instance.card,
                            notification_type='comment_added',
                            message=f'{instance.user.username} commented on "{instance.card.title}"',
                            link=f'/board/{board.id}'
                        )
                        
                        send_notification_to_user(member.id, {
                            'id': notification.id,
                            'notification_type': 'comment_added',
                            'message': notification.message,
                            'card': instance.card.id,
                            'card_id': instance.card.id,
                            'card_title': instance.card.title,
                            'created_at': notification.created_at.isoformat(),
                            'read': False,
                            'link': notification.link
                        })
                    except Exception as e:
                        logger.error(f'Error creating notification for comment: {e}')

    except Exception as e:
        logger.error(f'Error in log_comment_activity: {e}')


@receiver(post_delete, sender=Comment)
def log_comment_deletion(sender, instance, **kwargs):
    """Create activity record when comment is deleted"""
    try:
        board = instance.card.list.board
        
        Activity.objects.create(
            board=board,
            user=instance.user,
            action_type='comment_deleted',
            card=instance.card,
            list=instance.card.list,
            description=f'deleted comment on {instance.card.title}',
            metadata={'card_title': instance.card.title}
        )
    except Exception as e:
        logger.error(f'Error in log_comment_deletion: {e}')


# ============================================================================
# CHECKLIST SIGNALS - Track checklist completion
# ============================================================================

@receiver(post_save, sender=ChecklistItem)
def log_checklist_item_completion(sender, instance, created, **kwargs):
    """Log when checklist item is completed"""
    if created or not instance.completed:
        return
    
    try:
        card = instance.checklist.card
        board = card.list.board
        
        # Check if all items in checklist are complete
        checklist = instance.checklist
        all_complete = all(item.completed for item in checklist.items.all())
        
        if all_complete:
            Activity.objects.create(
                board=board,
                user=None,
                action_type='checklist_item_completed',
                card=card,
                list=card.list,
                description=f'completed checklist "{checklist.name}" on "{card.title}"',
                metadata={
                    'card_title': card.title,
                    'checklist_name': checklist.name
                }
            )
    except Exception as e:
        logger.error(f'Error in log_checklist_item_completion: {e}')
