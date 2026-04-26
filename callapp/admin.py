from django.contrib import admin

from .models import Channel, Friendship, Message, Server, User

# Register your models here.
admin.site.register([User, Server, Channel, Message, Friendship])
