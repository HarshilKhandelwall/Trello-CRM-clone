"""
Scheduled tasks for CRM automation
"""
from datetime import datetime, timedelta
from django.utils import timezone
from crm.models import Card, Board, List
from crm.utils import log_activity, broadcast_to_board
from crm.serializers import CardSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)


def move_old_leads_task():
    """
    Move cards older than 30 days (from creation date) to the Old Leads board
    within the same workspace. Runs daily.
    """
    logger.info('Starting move_old_leads_task...')
    
    # Calculate the cutoff date (30 days ago from now)
    cutoff_date = timezone.now() - timedelta(days=30)
    
    # Find all cards created more than 30 days ago that are not archived
    old_cards = Card.objects.filter(
        created_at__lt=cutoff_date,
        archived=False
    ).select_related('list__board__workspace')
    
    moved_count = 0
    skipped_count = 0
    channel_layer = get_channel_layer()
    
    for card in old_cards:
        try:
            # Get the card's workspace
            workspace = card.list.board.workspace
            
            # Find the Old Leads board in the same workspace
            try:
                old_leads_board = Board.objects.get(
                    workspace=workspace,
                    name='Old Leads'
                )
            except Board.DoesNotExist:
                logger.warning(
                    f'No Old Leads board found for workspace "{workspace.name}". '
                    f'Skipping card "{card.title}"'
                )
                skipped_count += 1
                continue
            
            # Check if card is already in Old Leads board
            if card.list.board.id == old_leads_board.id:
                logger.debug(f'Card "{card.title}" already in Old Leads board. Skipping.')
                skipped_count += 1
                continue
            
            # Find the "Archived Leads" list in the Old Leads board
            try:
                archived_list = List.objects.filter(
                    board=old_leads_board
                ).first()
                
                if not archived_list:
                    # Create the list if it doesn't exist
                    archived_list = List.objects.create(
                        name='Archived Leads',
                        board=old_leads_board,
                        position=0
                    )
                    logger.info(f'Created Archived Leads list for workspace "{workspace.name}"')
            except Exception as e:
                logger.error(f'Error finding/creating archived list: {e}')
                skipped_count += 1
                continue
            
            # Store original board and list info
            original_board = card.list.board
            original_list = card.list
            
            # Move the card to the Old Leads board
            card.list = archived_list
            card.save()
            
            # Log activity on source board
            log_activity(
                board=original_board,
                user=None,  # System task
                action_type='card_moved',
                description=f'moved "{card.title}" to board "{old_leads_board.name}" automatically (older than 30 days)',
                metadata={'to_board_id': old_leads_board.id, 'to_list_id': archived_list.id}
            )
            
            # Broadcast on source board (card removed)
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'board_{original_board.id}',
                    {
                        'type': 'card_deleted',
                        'card_id': card.id,
                        'list_id': original_list.id,
                        'user_id': None,
                        'username': 'System',
                    }
                )
            
            # Log activity on destination board
            log_activity(
                board=old_leads_board,
                user=None,  # System task
                action_type='card_created',
                description=f'moved "{card.title}" from board "{original_board.name}" automatically (older than 30 days)',
                card=card,
                list_obj=archived_list,
                metadata={'from_board_id': original_board.id}
            )
            
            # Broadcast on destination board (card added)
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f'board_{old_leads_board.id}',
                    {
                        'type': 'card_created',
                        'card_data': CardSerializer(card).data,
                        'list_id': archived_list.id,
                        'user_id': None,
                        'username': 'System',
                    }
                )
            
            logger.info(
                f'Moved card "{card.title}" from "{original_board.name}/{original_list.name}" '
                f'to Old Leads/Archived Leads (due date: {card.due_at})'
            )
            moved_count += 1
            
        except Exception as e:
            logger.error(f'Error moving card "{card.title}": {e}')
            skipped_count += 1
            continue
    
    # Log summary
    logger.info(f'=== move_old_leads_task Summary ===')
    logger.info(f'Moved: {moved_count} cards')
    logger.info(f'Skipped: {skipped_count} cards')
    logger.info(f'Total processed: {old_cards.count()} cards')
    
    return {
        'moved': moved_count,
        'skipped': skipped_count,
        'total': old_cards.count()
    }


def cleanup_old_notifications_task():
    """
    Delete notifications older than 30 days to prevent unbounded database growth.
    This resolves the M-7 audit finding without breaking the frontend's hard-capped UI array.
    """
    from crm.models import Notification
    cutoff_date = timezone.now() - timedelta(days=30)
    
    old_notifications = Notification.objects.filter(created_at__lt=cutoff_date)
    count = old_notifications.count()
    
    if count > 0:
        logger.info(f"Cleaning up {count} notifications older than 30 days...")
        old_notifications.delete()
        logger.info(f"Successfully deleted {count} old notifications.")
    else:
        logger.debug("No old notifications to clean up.")
    
    return {'deleted': count}

