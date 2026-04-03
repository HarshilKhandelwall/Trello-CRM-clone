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
        # RUN_MAIN='true' is set ONLY by Django's dev `runserver` reloader to
        # identify the real worker process (vs. the file-watcher parent).
        # Daphne and other ASGI servers NEVER set RUN_MAIN, so the old guard
        # prevented the scheduler from ever starting in production.
        #
        # Logic:
        #   RUN_MAIN='true'  → runserver child process   → start
        #   RUN_MAIN not set → Daphne / Gunicorn / etc.  → start
        #   RUN_MAIN='false' → runserver parent/watcher   → skip (avoid double-start)
        run_main = os.environ.get('RUN_MAIN')
        if run_main != 'false':   # start for Daphne (None) and runserver child ('true')
            from crm.scheduler import start_scheduler
            start_scheduler()
