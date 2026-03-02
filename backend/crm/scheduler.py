from apscheduler.schedulers.background import BackgroundScheduler
from django.utils import timezone
from datetime import timedelta
from crm.models import Card, Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from crm.tasks import move_old_leads_task
import logging

logger = logging.getLogger(__name__)

channel_layer = get_channel_layer()
_scheduler = None  # Global reference

def send_notification_to_user(user_id, notification_data):
    """
    Send a notification to a specific user via WebSocket.
    """
    try:
        if channel_layer:
            group_name = f'user_{user_id}'
            logger.info(f"📤 Sending notification to group '{group_name}': {notification_data}")
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'notify',
                    'data': notification_data
                }
            )
            logger.info(f"✅ WebSocket notification sent to user {user_id}")
        else:
            logger.error("❌ Channel layer not available!")
    except Exception as e:
        logger.error(f"❌ Failed to send WebSocket notification: {e}", exc_info=True)




def scheduled_notification_task(card_id, notification_type, message):
    """
    Task to run at a specific scheduled time.
    """
    try:
        card = Card.objects.get(id=card_id)
        if card.archived:
            return

        target_users = list(card.members.all())
        if not target_users:
            target_users = [card.created_by]
            
        logger.info(f"Executing scheduled notification '{notification_type}' for card '{card.title}'")

        for user in target_users:
            # Check if recently notified to avoid spam (in case of overlap with poller)
            recent_exists = Notification.objects.filter(
                card=card,
                notification_type=notification_type,
                user=user,
                created_at__gte=timezone.now() - timedelta(minutes=5)
            ).exists()
            
            if not recent_exists:
                _create_and_send_notification(user, card, notification_type, message)

    except Card.DoesNotExist:
        logger.warning(f"Card {card_id} not found during scheduled task execution")
    except Exception as e:
        logger.error(f"Error in scheduled task for card {card_id}: {e}")

def update_card_schedule(card):
    """
    Schedule exact-time notifications for a card.
    """
    if not _scheduler or not card.due_at or card.archived:
        return

    # Clear existing jobs for this card
    job_ids = [f'due_soon_{card.id}', f'due_now_{card.id}', f'overdue_{card.id}']
    for job_id in job_ids:
        if _scheduler.get_job(job_id):
            _scheduler.remove_job(job_id)
            logger.info(f"Removed existing scheduled job: {job_id}")

    now = timezone.now()
    due_at = card.due_at

    # 1. 24 Hours Before (Due Soon)
    time_24h = due_at - timedelta(hours=24)
    if time_24h > now:
        _scheduler.add_job(
            scheduled_notification_task,
            'date',
            run_date=time_24h,
            args=[card.id, 'due_soon', f'Card "{card.title}" is due in 24 hours'],
            id=f'due_soon_{card.id}',
            replace_existing=True
        )
        logger.info(f"Scheduled 'due_soon' for card {card.id} at {time_24h}")

    # 2. 1 Hour Before (Due Now/Urgent)
    time_1h = due_at - timedelta(hours=1)
    if time_1h > now:
        _scheduler.add_job(
            scheduled_notification_task,
            'date',
            run_date=time_1h,
            args=[card.id, 'due_now', f'Card "{card.title}" is due in 1 hour'],
            id=f'due_now_{card.id}',
            replace_existing=True
        )
        logger.info(f"Scheduled 'due_now' for card {card.id} at {time_1h}")

    # 3. Exact Due Time (Overdue)
    if due_at > now:
        _scheduler.add_job(
            scheduled_notification_task,
            'date',
            run_date=due_at,
            args=[card.id, 'overdue', f'Card "{card.title}" is now overdue!'],
            id=f'overdue_{card.id}',
            replace_existing=True
        )
        logger.info(f"Scheduled 'overdue' for card {card.id} at {due_at}")


def check_due_dates():
    """
    Check all cards with due dates and create notifications.
    Runs automatically every 5 minutes.
    """
    logger.info("Running robust automatic due date check...")
    now = timezone.now()
    
    # Get all active cards with due dates
    # Exclude archived cards as they don't need notifications
    cards_with_due_dates = Card.objects.filter(
        due_at__isnull=False,
        archived=False
    ).select_related('created_by').prefetch_related('members')
    
    notifications_created = 0
    
    for card in cards_with_due_dates:
        try:
            # Determine target users (assigned members or creator if none)
            target_users = list(card.members.all())
            if not target_users:
                target_users = [card.created_by]

            time_until_due = card.due_at - now
            
            # 1. OVERDUE CHECK
            if card.due_at < now:
                # Check if we should send an overdue notification
                # Logic: Send if we haven't sent an 'overdue' notification 
                # SINCE the card became overdue (or within reasonable recent window)
                
                for user in target_users:
                    # Check if user already got overdue notification for this specific due date instance
                    # We look for notifications created after the due date
                    existing = Notification.objects.filter(
                        card=card,
                        notification_type='overdue',
                        user=user,
                        created_at__gte=card.due_at 
                    ).exists()
                    
                    if not existing:
                        _create_and_send_notification(
                            user, card, 'overdue', 
                            f'Card "{card.title}" is overdue since {card.due_at.strftime("%b %d, %H:%M")}'
                        )
                        notifications_created += 1
                continue

            # 2. DUE NOW CHECK (<= 1 hour)
            if timedelta(seconds=0) <= time_until_due <= timedelta(hours=1):
                for user in target_users:
                    # Check if we already sent 'due_now' notification in the last hour
                    # This prevents spamming every 5 minutes
                    existing = Notification.objects.filter(
                        card=card,
                        notification_type='due_now',
                        user=user,
                        created_at__gte=now - timedelta(hours=1, minutes=30)
                    ).exists()
                    
                    if not existing:
                        minutes_left = int(time_until_due.total_seconds() / 60)
                        _create_and_send_notification(
                            user, card, 'due_now',
                            f'Card "{card.title}" is due in {minutes_left} minutes'
                        )
                        notifications_created += 1

            # 3. DUE SOON CHECK (<= 24 hours)
            elif timedelta(hours=1) < time_until_due <= timedelta(hours=24):
                for user in target_users:
                    # Check if we already sent 'due_soon' notification in the last 24 hours
                    existing = Notification.objects.filter(
                        card=card,
                        notification_type='due_soon',
                        user=user,
                        created_at__gte=now - timedelta(hours=23)
                    ).exists()
                    
                    if not existing:
                        hours_until_due = int(time_until_due.total_seconds() / 3600)
                        _create_and_send_notification(
                            user, card, 'due_soon',
                            f'Card "{card.title}" is due in {hours_until_due} hours'
                        )
                        notifications_created += 1
                        
        except Exception as e:
            logger.error(f"Error processing notifications for card {card.id}: {e}")

    if notifications_created > 0:
        logger.info(f'Notification check complete. Created {notifications_created} new notifications.')


def _create_and_send_notification(user, card, type, message):
    """Helper to create DB notification and send WebSocket event"""
    try:
        notification = Notification.objects.create(
            user=user,
            card=card,
            notification_type=type,
            message=message,
            link=f'/card/{card.id}'
        )
        
        send_notification_to_user(user.id, {
            'id': notification.id,
            'notification_type': type,   # fixed: was 'type', frontend expects 'notification_type'
            'message': notification.message,
            'card': card.id,
            'card_id': card.id,
            'card_title': card.title,
            'created_at': notification.created_at.isoformat(),
            'read': False,
            'link': notification.link
        })
        logger.info(f'Created {type} notification for card: {card.title} -> User: {user.username}')
    except Exception as e:
        logger.error(f"Failed to create notification record: {e}")


def start_scheduler():
    """
    Start the background scheduler for automatic notification checks.
    Runs every 2 minutes.
    """
    global _scheduler
    scheduler = BackgroundScheduler()
    _scheduler = scheduler # Assign to global variable for runtime access
    
    # Add job to check due dates every 2 minutes (Safety Net)
    scheduler.add_job(
        check_due_dates,
        'interval',
        minutes=2,
        id='check_due_dates',
        replace_existing=True,
        max_instances=1
    )
    
    # Add daily task to move old leads at 2:30 AM
    scheduler.add_job(
        move_old_leads_task,
        'cron',
        hour=2,
        minute=30,
        id='move_old_leads_task'
    )
    
    try:
        scheduler.start()
        logger.info("Scheduler started successfully")
        logger.info("Notification scheduler started (Hybrid Mode: Event-Driven + Polling).")
        logger.info(f"Scheduled jobs: {[job.id for job in scheduler.get_jobs()]}")

        
        # Initial Population: Schedule jobs for all existing future due dates
        # This ensures persistence across server restarts
        try:
            future_cards = Card.objects.filter(due_at__gt=timezone.now(), archived=False)
            logger.info(f"Pre-scheduling notifications for {future_cards.count()} active cards...")
            for card in future_cards:
                update_card_schedule(card)
        except Exception as e:
            logger.error(f"Failed to pre-schedule existing cards: {e}")
            
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    # Run polling check once immediately on startup
    check_due_dates()
