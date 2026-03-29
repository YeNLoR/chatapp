from django.contrib.auth import get_user_model
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    avatar = models.ImageField(upload_to="avatars/", default="stand.png")

class Server(models.Model):
    name = models.CharField(max_length=100)
    img = models.ImageField(upload_to="servers/", default="el_bug50.png")
    users = models.ManyToManyField(User, related_name="servers")

class Channel(models.Model):
    name = models.CharField(max_length=200)
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name="channels")

class Message(models.Model):
    channel = models.ForeignKey(Channel, on_delete=models.CASCADE, related_name="messages")
    message = models.TextField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages")
