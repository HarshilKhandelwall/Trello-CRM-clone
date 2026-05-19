from django.apps import AppConfig


class CrmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'crm'

        def ready(self):
        """
        Start the notification scheduler when Django starts.
        """
    
        # Import signals
        import crm.signals
    
        import os
        import sys
    
        # Skip scheduler during migrations
        if 'migrate' in sys.argv or 'makemigrations' in sys.argv:
            return
    
        # Prevent duplicate scheduler in Django dev server
        run_main = os.environ.get('RUN_MAIN')
    
        # Start for:
        # - Daphne/Gunicorn (RUN_MAIN=None)
        # - Django runserver child process (RUN_MAIN='true')
        # Skip:
        # - Django runserver parent process (RUN_MAIN='false')
        if run_main != 'false':
            from crm.scheduler import start_scheduler
            start_scheduler()
