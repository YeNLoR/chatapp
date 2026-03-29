from django.contrib import admin
from .models import User, Server, Channel, Message
# Register your models here.
admin.site.register([User, Server, Channel, Message])