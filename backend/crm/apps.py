from django.apps import AppConfig


class CrmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'crm'

    def ready(self):
        """
        Start the notification scheduler when Django starts.
        This runs automatically - no manual intervention needed.
        """
        # Import signals to register them
        import crm.signals
        
        import os
        # Only run scheduler in the main process, not in reloader
        if os.environ.get('RUN_MAIN') == 'true':
            from crm.scheduler import start_scheduler
            start_scheduler()
