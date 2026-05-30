import os
from pathlib import Path

from dotenv import load_dotenv

from .base import BASE_DIR

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ["DJANGO_SECRET"]
DEBUG = False
ALLOWED_HOSTS = [os.environ["DOMAIN"]]
CSRF_TRUSTED_ORIGINS = [f"https://{os.environ['DOMAIN']}"]
STATIC_URL = "/static/"
STATIC_ROOT = os.environ.get("STATIC_DIR")
MEDIA_URL = "/media/"
MEDIA_ROOT = os.environ.get("MEDIA_DIR")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [("redis", 6379)],
        },
    },
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://redis:6379",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SOCKET_TIMEOUT": 5.0,
            "SOCKET_CONNECT_TIMEOUT": 5.0,
            "CONNECTION_POOL_KWARGS": {
                "retry_on_timeout": True,
                "max_connections": 20,
            },
        },
    }
}
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ["POSTGRES_PASSWORD"],
        "HOST": "postgresql",
        "PORT": "5432",
    }
}
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
