from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('crm.urls')),

    # ── SPA catch-all ──────────────────────────────────────────────────────────
    # Any URL that doesn't match an API route is handed to React's index.html,
    # so React Router can handle client-side routing (e.g. /board/3, /login).
    # This must be LAST so API routes above take priority.
    re_path(r'^(?!api/|admin/|media/|static/).*$',
            TemplateView.as_view(template_name='index.html'),
            name='react-spa'),
]

# Serve media files in all environments (Django handles it; WhiteNoise handles static)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
