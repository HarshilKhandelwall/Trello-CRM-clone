"""
Scheduled tasks for CRM automation
"""
from datetime import datetime, timedelta
from django.utils import timezone
from crm.models import Card, Board, List
import logging

logger = logging.getLogger(__name__)


def move_old_leads_task():
    """
    Move cards with due dates older than 30 days to the Old Leads board
    within the same workspace. Runs daily.
    """
    logger.info('Starting move_old_leads_task...')
    
    # Calculate the cutoff date (30 days ago)
    cutoff_date = timezone.now() - timedelta(days=30)
    
    # Find all cards with due dates older than 30 days
    old_cards = Card.objects.filter(
        due_at__isnull=False,
        due_at__lt=cutoff_date
    ).select_related('list__board__workspace')
    
    moved_count = 0
    skipped_count = 0
    
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
            
            # Store original board name for logging
            original_board_name = card.list.board.name
            original_list_name = card.list.name
            
            # Move the card to the Old Leads board
            card.list = archived_list
            card.save()
            
            logger.info(
                f'Moved card "{card.title}" from "{original_board_name}/{original_list_name}" '
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
