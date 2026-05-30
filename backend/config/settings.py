import os
from pathlib import Path
from urllib.parse import parse_qsl, urlparse


BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent

def _load_env_file(env_path, override_keys=False):
    if env_path.exists():
        with env_path.open() as env_file:
            for line in env_file:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if override_keys or key not in os.environ:
                    os.environ[key] = value


# Load environment variables from root/backend env files if present.
_load_env_file(ROOT_DIR / ".env")
_load_env_file(BASE_DIR / ".env")
_load_env_file(BASE_DIR / ".env.mpesa", override_keys=True)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-pos-secret-key-change-in-production")
DEBUG = os.getenv("DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = os.getenv(
    "ALLOWED_HOSTS",
    ".vercel.app,helena-temporarily-mumbai-authentic.trycloudflare.com,127.0.0.1,localhost,192.168.0.101",
).split(",")

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CSRF_TRUSTED_ORIGINS",
        "https://*.vercel.app,https://helena-temporarily-mumbai-authentic.trycloudflare.com,http://192.168.0.101:5173,http://127.0.0.1:5173,http://localhost:5173",
    ).split(",")
    if origin.strip()
]
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "pos",
    "inventory",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "config.middleware.DevCorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

WSGI_APPLICATION = "config.wsgi.application"

def _database_from_url(database_url):
    parsed = urlparse(database_url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("DATABASE_URL must use postgres:// or postgresql://")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": parsed.username or "",
        "PASSWORD": parsed.password or "",
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        "OPTIONS": dict(parse_qsl(parsed.query, keep_blank_values=True)),
    }


DATABASE_URL = os.getenv("DATABASE_URL")
DATABASES = {
    "default": _database_from_url(DATABASE_URL) if DATABASE_URL else {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "pos.sqlite3",
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "False").lower() in ("1", "true", "yes")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", str(not DEBUG)).lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE = os.getenv("CSRF_COOKIE_SECURE", str(not DEBUG)).lower() in ("1", "true", "yes")
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "pos.authentication.POSBearerAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "pos.pagination.StandardResultsSetPagination",
    "PAGE_SIZE": 50,
}

POS_AUTH_TOKEN_MAX_AGE = 60 * 60

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "console": {
            "format": "%(asctime)s %(levelname)s %(name)s: %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "console",
        },
    },
    "loggers": {
        "pos.utils.mpesa": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "pos.views": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
