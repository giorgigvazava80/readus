"""
Django settings for core project.
"""

from datetime import timedelta
from pathlib import Path
import os
import warnings

import environ


env = environ.Env(
    DEBUG=(bool, False),
)

BASE_DIR = Path(__file__).resolve().parent.parent
environ.Env.read_env(os.path.join(BASE_DIR, ".env"))

# dj-rest-auth 7.x still reads deprecated allauth settings internally.
# Keep logs clean by filtering only those known deprecation warnings.
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    module=r"dj_rest_auth\.registration\.serializers",
    message=r"app_settings\.USERNAME_REQUIRED is deprecated.*",
)
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    module=r"dj_rest_auth\.registration\.serializers",
    message=r"app_settings\.EMAIL_REQUIRED is deprecated.*",
)

SECRET_KEY = env("SECRET_KEY", default="unsafe-dev-secret-key")
DEBUG = env("DEBUG")

ALLOWED_HOSTS = env.list(
    "DJANGO_ALLOWED_HOSTS",
    default=["*"],
)

CORS_ALLOW_ALL_ORIGINS = env.bool("CORS_ALLOW_ALL_ORIGINS", default=True)
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
)
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.facebook",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt",
    "corsheaders",
    "drf_yasg",
    "accounts",
    "content",
]

SITE_ID = env.int("SITE_ID", default=1)
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL", default="http://localhost:5173").rstrip("/")
SOCIAL_AUTH_GOOGLE_CALLBACK_URL = env("SOCIAL_AUTH_GOOGLE_CALLBACK_URL", default="").strip()
SOCIAL_AUTH_FACEBOOK_CALLBACK_URL = env("SOCIAL_AUTH_FACEBOOK_CALLBACK_URL", default="").strip()
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default=env("GOOGLE_CLIENT_ID", default="")).strip()
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default=env("GOOGLE_CLIENT_SECRET", default="")).strip()
GOOGLE_EMAIL_AUTHENTICATION = env.bool("GOOGLE_EMAIL_AUTHENTICATION", default=True)
GOOGLE_EMAIL_AUTHENTICATION_AUTO_CONNECT = env.bool(
    "GOOGLE_EMAIL_AUTHENTICATION_AUTO_CONNECT",
    default=True,
)
FACEBOOK_OAUTH_CLIENT_ID = env("FACEBOOK_OAUTH_CLIENT_ID", default=env("FACEBOOK_CLIENT_ID", default="")).strip()
FACEBOOK_OAUTH_CLIENT_SECRET = env("FACEBOOK_OAUTH_CLIENT_SECRET", default=env("FACEBOOK_CLIENT_SECRET", default="")).strip()

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

DATABASE_URL = env("DATABASE_URL", default="").strip()

if DATABASE_URL:
    DATABASES = {
        "default": env.db("DATABASE_URL"),
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", default="postgres"),
            "USER": env("DB_USER", default="postgres"),
            "PASSWORD": env("DB_PASSWORD", default="postgres"),
            "HOST": env("DB_HOST", default="postgres"),
            "PORT": env("DB_PORT", default="5432"),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = env("MEDIA_URL", default="/media/")
if not MEDIA_URL.endswith("/"):
    MEDIA_URL = f"{MEDIA_URL}/"

_media_root_env = env("MEDIA_ROOT", default="").strip()
if _media_root_env:
    _media_root_path = Path(_media_root_env)
    MEDIA_ROOT = _media_root_path if _media_root_path.is_absolute() else BASE_DIR / _media_root_path
else:
    MEDIA_ROOT = BASE_DIR / "media"

SERVE_MEDIA = env.bool("SERVE_MEDIA", default=True)

CACHE_URL = env("CACHE_URL", default="").strip()
CACHE_KEY_PREFIX = env("CACHE_KEY_PREFIX", default="readus")
CACHE_DEFAULT_TIMEOUT = env.int("CACHE_DEFAULT_TIMEOUT", default=300)
CACHE_TTL_PUBLIC_LIST = env.int("CACHE_TTL_PUBLIC_LIST", default=120)
CACHE_TTL_PUBLIC_DETAIL = env.int("CACHE_TTL_PUBLIC_DETAIL", default=300)

if CACHE_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": CACHE_URL,
            "KEY_PREFIX": CACHE_KEY_PREFIX,
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "readus-local-cache",
            "KEY_PREFIX": CACHE_KEY_PREFIX,
            "TIMEOUT": CACHE_DEFAULT_TIMEOUT,
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

ACCOUNT_LOGIN_METHODS = {"username", "email"}
ACCOUNT_SIGNUP_FIELDS = [
    "username*",
    "email*",
    "first_name*",
    "last_name*",
    "password1*",
    "password2*",
]
ACCOUNT_EMAIL_VERIFICATION = env(
    "ACCOUNT_EMAIL_VERIFICATION",
    default="none",
).strip().lower()
if ACCOUNT_EMAIL_VERIFICATION not in {"none", "optional", "mandatory"}:
    ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_CONFIRM_EMAIL_ON_GET = ACCOUNT_EMAIL_VERIFICATION != "none"
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = False
ACCOUNT_EMAIL_CONFIRMATION_AUTHENTICATED_REDIRECT_URL = f"{FRONTEND_BASE_URL}/dashboard"
ACCOUNT_EMAIL_CONFIRMATION_ANONYMOUS_REDIRECT_URL = f"{FRONTEND_BASE_URL}/dashboard"
ACCOUNT_ADAPTER = "accounts.adapters.ReadusAccountAdapter"
SOCIALACCOUNT_PROVIDERS = {
    "google": {
        "SCOPE": ["profile", "email"],
        "EMAIL_AUTHENTICATION": GOOGLE_EMAIL_AUTHENTICATION,
        "EMAIL_AUTHENTICATION_AUTO_CONNECT": GOOGLE_EMAIL_AUTHENTICATION_AUTO_CONNECT,
        **(
            {
                "APP": {
                    "client_id": GOOGLE_OAUTH_CLIENT_ID,
                    "secret": GOOGLE_OAUTH_CLIENT_SECRET,
                    "key": "",
                }
            }
            if GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET
            else {}
        ),
    },
    "facebook": {
        "METHOD": "oauth2",
        "SCOPE": ["email", "public_profile"],
        "FIELDS": ["id", "email", "first_name", "last_name", "name"],
        **(
            {
                "APP": {
                    "client_id": FACEBOOK_OAUTH_CLIENT_ID,
                    "secret": FACEBOOK_OAUTH_CLIENT_SECRET,
                    "key": "",
                }
            }
            if FACEBOOK_OAUTH_CLIENT_ID and FACEBOOK_OAUTH_CLIENT_SECRET
            else {}
        ),
    },
}

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)
EMAIL_HOST = env("EMAIL_HOST", default="smtp.mail.yahoo.com")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@example.com")
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT", default=30)
EMAIL_SEND_ASYNC = env.bool("EMAIL_SEND_ASYNC", default=not DEBUG)

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": env.int("API_PAGE_SIZE", default=20),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", default="60/min"),
        "user": env("THROTTLE_USER", default="180/min"),
    },
}

REST_AUTH_REGISTER_SERIALIZERS = {
    "REGISTER_SERIALIZER": "accounts.serializers.CustomRegisterSerializer",
}

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_HTTPONLY": False,
    "JWT_AUTH_COOKIE": "core-app-auth",
    "JWT_AUTH_REFRESH_COOKIE": "core-refresh-auth",
    "REGISTER_SERIALIZER": "accounts.serializers.CustomRegisterSerializer",
    "PASSWORD_RESET_SERIALIZER": "accounts.auth_serializers.FrontendPasswordResetSerializer",
    "PASSWORD_CHANGE_SERIALIZER": "accounts.auth_serializers.ProfileAwarePasswordChangeSerializer",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
}

SESSION_COOKIE_SECURE = env.bool("SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env.bool("CSRF_COOKIE_SECURE", default=not DEBUG)
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SWAGGER_SETTINGS = {
    "SECURITY_DEFINITIONS": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
        }
    }
}



