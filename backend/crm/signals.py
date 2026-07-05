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


# Redundant signal handlers (log_card_deletion, log_card_member_change, log_list_activity, log_list_deletion, log_comment_activity, log_comment_deletion)
# have been removed because these events are already logged and processed directly in their respective views
# to preserve the user context and prevent duplicate database/notification rows.


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
