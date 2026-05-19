from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# Security & environment configuration
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-secret-key')
DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() == 'true'

_default_allowed_hosts = 'localhost,127.0.0.1', 'trello-crm-clone.onrender.com'
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('DJANGO_ALLOWED_HOSTS', _default_allowed_hosts).split(',')
    if host.strip()
]

INSTALLED_APPS = [
    'daphne',  # Must be first for ASGI support
    'corsheaders',
    'channels',
    'crm',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'whitenoise.runserver_nostatic',  # Serve static via whitenoise in dev too
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Must be right after SecurityMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOW_CREDENTIALS = True
_default_cors_origins = 'http://localhost:3000,http://localhost:8000'
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get('DJANGO_CORS_ALLOWED_ORIGINS', _default_cors_origins).split(',')
    if origin.strip()
]
# Expose the CSRF token header so the frontend can read it even cross-origin
CORS_EXPOSE_HEADERS = ['X-CSRFToken']

# ── CSRF ──────────────────────────────────────────────────────────────────────
_extra_csrf = os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '')
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS + [
    o.strip() for o in _extra_csrf.split(',') if o.strip()
]
# Must be False so JavaScript (on a different port in dev) can read the cookie
CSRF_COOKIE_HTTPONLY = False
# 'Lax' works for same-domain different-port requests in development
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_NAME = 'csrftoken'

# ── Session ───────────────────────────────────────────────────────────────────
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True

# ── Behind Nginx proxy ────────────────────────────────────────────────────────
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

ROOT_URLCONF = 'config.urls'

# React build directory (frontend/build/)
REACT_BUILD_DIR = BASE_DIR.parent / 'frontend' / 'build'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        # Serve React's index.html as a Django template for the SPA catch-all
        'DIRS': [REACT_BUILD_DIR],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': os.environ.get('DJANGO_DB_ENGINE', 'django.db.backends.sqlite3'),
        'NAME': os.environ.get('DJANGO_DB_NAME', BASE_DIR / 'db.sqlite3'),
        'USER': os.environ.get('DJANGO_DB_USER', ''),
        'PASSWORD': os.environ.get('DJANGO_DB_PASSWORD', ''),
        'HOST': os.environ.get('DJANGO_DB_HOST', ''),
        'PORT': os.environ.get('DJANGO_DB_PORT', ''),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
# Where `collectstatic` places all gathered static files
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Include React's built static assets so collectstatic picks them up
STATICFILES_DIRS = [
    REACT_BUILD_DIR / 'static',
] if REACT_BUILD_DIR.exists() else []
# WhiteNoise compression + caching for production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Channels configuration
if os.environ.get('DJANGO_CHANNEL_BACKEND', 'memory') == 'redis':
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [os.environ.get('DJANGO_REDIS_URL', 'redis://localhost:6379/0')],
            },
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
