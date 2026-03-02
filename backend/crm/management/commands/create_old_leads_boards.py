from django.core.management.base import BaseCommand
from crm.models import Workspace, Board, List, BoardMember


class Command(BaseCommand):
    help = 'Create "Old Leads" boards for existing workspaces that don\'t have one'

    def handle(self, *args, **options):
        self.stdout.write('Starting to create Old Leads boards...')
        
        # Get all workspaces
        workspaces = Workspace.objects.all()
        created_count = 0
        skipped_count = 0
        
        for workspace in workspaces:
            # Check if workspace already has an "Old Leads" board
            if Board.objects.filter(workspace=workspace, name='Old Leads').exists():
                self.stdout.write(
                    self.style.WARNING(
                        f'Workspace "{workspace.name}" already has an Old Leads board. Skipping.'
                    )
                )
                skipped_count += 1
                continue
            
            # Create Old Leads board
            old_leads_board = Board.objects.create(
                name='Old Leads',
                workspace=workspace,
                created_by=workspace.created_by,
                background_type='color',
                background_value='#5E6C84'  # Gray color
            )
            
            # Add workspace creator as board member
            BoardMember.objects.create(
                board=old_leads_board,
                user=workspace.created_by,
                role='admin'
            )
            
            # Create default list
            List.objects.create(
                name='Archived Leads',
                board=old_leads_board,
                position=0
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Created Old Leads board for workspace "{workspace.name}"'
                )
            )
            created_count += 1
        
        # Summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'=== Summary ==='))
        self.stdout.write(self.style.SUCCESS(f'Created: {created_count} Old Leads boards'))
        self.stdout.write(self.style.WARNING(f'Skipped: {skipped_count} workspaces (already had Old Leads board)'))
        self.stdout.write(self.style.SUCCESS(f'Total workspaces processed: {workspaces.count()}'))
