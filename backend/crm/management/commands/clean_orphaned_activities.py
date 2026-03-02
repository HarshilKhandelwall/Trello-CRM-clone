from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Clean up orphaned activity records that reference deleted cards or lists'

    def handle(self, *args, **options):
        self.stdout.write('Starting to clean up orphaned activities...')
        
        with connection.cursor() as cursor:
            # Find orphaned activities with invalid card references
            cursor.execute("""
                SELECT a.id, a.card_id
                FROM crm_activity a
                LEFT JOIN crm_card c ON a.card_id = c.id
                WHERE a.card_id IS NOT NULL AND c.id IS NULL
            """)
            
            orphaned_cards = cursor.fetchall()
            
            # Find orphaned activities with invalid list references
            cursor.execute("""
                SELECT a.id, a.list_id
                FROM crm_activity a
                LEFT JOIN crm_list l ON a.list_id = l.id
                WHERE a.list_id IS NOT NULL AND l.id IS NULL
            """)
            
            orphaned_lists = cursor.fetchall()
            
            total_deleted = 0
            
            if orphaned_cards:
                self.stdout.write(
                    self.style.WARNING(
                        f'Found {len(orphaned_cards)} activities with orphaned card references'
                    )
                )
                
                for activity_id, card_id in orphaned_cards:
                    self.stdout.write(f'Deleting activity {activity_id} (card_id: {card_id})')
                    cursor.execute("DELETE FROM crm_activity WHERE id = %s", [activity_id])
                    total_deleted += 1
            
            if orphaned_lists:
                self.stdout.write(
                    self.style.WARNING(
                        f'Found {len(orphaned_lists)} activities with orphaned list references'
                    )
                )
                
                for activity_id, list_id in orphaned_lists:
                    self.stdout.write(f'Deleting activity {activity_id} (list_id: {list_id})')
                    cursor.execute("DELETE FROM crm_activity WHERE id = %s", [activity_id])
                    total_deleted += 1
            
            if total_deleted > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Successfully deleted {total_deleted} orphaned activities'
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS('No orphaned activities found')
                )

