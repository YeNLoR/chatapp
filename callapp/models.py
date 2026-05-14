from uuid import uuid7

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Exists, OuterRef


class User(AbstractUser):
    avatar = models.ImageField(upload_to="avatars/", default="stand.png")
    friends = models.ManyToManyField(
        "self",
        through="Friendship",
        symmetrical=False,
    )


class Friendship(models.Model):
    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_requests"
    )
    to_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="received_requests"
    )
    status = models.CharField(max_length=20, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("from_user", "to_user")


class Server(models.Model):
    name = models.CharField(max_length=100)
    img = models.ImageField(upload_to="servers/", default="el_bug50.png")
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    users = models.ManyToManyField(User, related_name="servers")
    invite = models.CharField(null=True, blank=True, default=uuid7)
    is_dm = models.BooleanField(default=False)

    @classmethod
    def get_dm_server(cls, user1, user2):
        server_name = f"dm_{min(user1.id, user2.id)}_{max(user1.id, user2.id)}"
        server, created = cls.objects.get_or_create(
            name=server_name, is_dm=True, defaults={"invite": None}
        )
        if created:
            server.users.add(user1, user2)
        channel, _ = Channel.objects.get_or_create(name="direct", server=server)
        return server, channel


class Channel(models.Model):
    name = models.CharField(max_length=200)
    server = models.ForeignKey(
        Server, on_delete=models.CASCADE, related_name="channels"
    )


def auth_consumer(channel_id, user):
    server = (
        Server.objects.filter(channels__id=channel_id)
        .annotate(is_in=Exists(Server.objects.filter(id=OuterRef("id"), users=user)))
        .first()
    )
    if server:
        if server.is_in:
            return True
    return False


class Message(models.Model):
    channel = models.ForeignKey(
        Channel, on_delete=models.CASCADE, related_name="messages"
    )
    message = models.TextField()
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="messages")
