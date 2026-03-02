from django.core.management.base import BaseCommand
from crm.models import Workspace, WorkspaceMember


class Command(BaseCommand):
    help = 'Populate WorkspaceMember for existing workspaces (make creators OWNER)'

    def handle(self, *args, **options):
        self.stdout.write('Starting to populate workspace members...')
        
        workspaces = Workspace.objects.all()
        created_count = 0
        skipped_count = 0
        
        for workspace in workspaces:
            # Check if the creator is already a member
            if WorkspaceMember.objects.filter(workspace=workspace, user=workspace.created_by).exists():
                self.stdout.write(self.style.WARNING(f'Skipped workspace "{workspace.name}" - creator already a member'))
                skipped_count += 1
                continue
            
            # Create WorkspaceMember entry for the workspace creator as OWNER
            WorkspaceMember.objects.create(
                workspace=workspace,
                user=workspace.created_by,
                role='OWNER',
                added_by=workspace.created_by  # Creator added themselves
            )
            
            self.stdout.write(self.style.SUCCESS(f'Created OWNER membership for "{workspace.name}"'))
            created_count += 1
        
        self.stdout.write('')
        self.stdout.write('=' * 30)
        self.stdout.write(self.style.SUCCESS(f'Created: {created_count} workspace memberships'))
        self.stdout.write(self.style.WARNING(f'Skipped: {skipped_count} workspaces'))
        self.stdout.write(f'Total workspaces processed: {workspaces.count()}')
        self.stdout.write('=' * 30)
