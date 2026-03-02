"""
Shared authentication helpers for CRM views.
"""
from rest_framework.authentication import SessionAuthentication


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Session authentication that skips CSRF enforcement.
    Used by views where the frontend sends its own CSRF token via
    the X-CSRFToken header (handled by the API client) rather than
    relying on Django's middleware cookie check.
    """
    def enforce_csrf(self, request):
        return
