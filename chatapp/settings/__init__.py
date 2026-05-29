import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
from .base import *

env = os.environ.get("DJANGO_ENV", "development")
if env == "production":
    from .prod import *
