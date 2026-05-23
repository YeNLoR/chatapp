import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.core.cache import cache

from .models import auth_consumer

example = {
    "server_id": {
        "voice_channel_id": {"username": {"name": "username", "avatar": "avatar_url"}}
    }
}


def vc_add_user(server_id, channel_id, username, avatar):
    key = f"voice:{server_id}"
    data = cache.get(key) or {}
    if channel_id not in data:
        data[channel_id] = {}

    data[channel_id][username] = {"avatar": avatar}
    cache.set(key, data, timeout=None)


def vc_remove_user(server_id, channel_id, username):
    key = f"voice:{server_id}"
    data = cache.get(key) or {}
    data.get(channel_id, {}).pop(username, None)
    cache.set(key, data, timeout=None)


def get_vc_users(server_id, channel_id):
    data = cache.get(f"voice:{server_id}") or {}
    return data.get(channel_id, {})


def get_server_vc(server_id):
    data = cache.get(f"voice:{server_id}") or {}
    data["type"] = "vc.state"
    return data


class RoomConsumer(WebsocketConsumer):
    def connect(self) -> None:
        self.user = self.scope.get("user")
        self.user_groups = []
        self.server_view_group = None
        self.voice_channel_group = None
        self.text_channel_group = None
        if self.user and self.user.is_authenticated:
            self.user_groups = [
                f"user_{self.user.id}",
            ]
            servers = self.user.servers.only("id").all()
            for server in servers:
                self.user_groups.append(f"server_{server.id}")
            for group in self.user_groups:
                async_to_sync(self.channel_layer.group_add)(group, self.channel_name)
            self.accept()
            return
        self.close()
        return

    def disconnect(self, code: int) -> None:
        for group in self.user_groups:
            async_to_sync(self.channel_layer.group_discard)(group, self.channel_name)
        self.text_channel_leave()
        self.voice_channel_leave()
        self.server_view_leave()

    def receive(
        self, text_data: str | None = None, bytes_data: bytes | None = None
    ) -> None:
        if text_data:
            data = json.loads(text_data)
            if not data.get("type"):
                return
            handlers = {
                "server_view.join": self.server_view_join,
                "server_view.leave": self.server_view_leave,
                "text_channel.join": self.text_channel_join,
                "text_channel.leave": self.text_channel_leave,
                "voice_channel.join": self.voice_channel_join,
                "voice_channel.call": self.voice_channel_call,
                "voice_channel.leave": self.voice_channel_leave,
            }
            handler = handlers.get(data["type"])
            if handler:
                handler(data)

    def server_view_join(self, data):
        self.server_view_leave(data)
        self.server_view_group = "server_view" + data["server_id"]
        async_to_sync(self.channel_layer.group_add)(
            self.server_view_group, self.channel_name
        )
        self.send(json.dumps(get_server_vc(self.server_view_group)))

    def server_view_leave(self, data=None):
        if self.server_view_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.server_view_group, self.channel_name
            )
        self.server_view_group = None

    def text_channel_join(self, data):
        self.text_channel_leave(data)
        if auth_consumer(data["text_channel"], self.user, "text"):
            self.text_channel_group = "channel_" + data["text_channel"]
            async_to_sync(self.channel_layer.group_add)(
                self.text_channel_group, self.channel_name
            )

    def text_channel_leave(self, data=None):
        if self.text_channel_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.text_channel_group, self.channel_name
            )
        self.text_channel_group = None

    def text_channel_message(self, event):
        message = event["message"]
        username = event["username"]
        avatar = event["src"]
        self.send(
            text_data=json.dumps(
                {
                    "type": "new_message",
                    "message": message,
                    "username": username,
                    "avatar": avatar,
                }
            )
        )

    def voice_channel_join(self, data):
        self.voice_channel_leave(data)
        if auth_consumer(data["voice_channel"], self.user, "voice"):
            self.voice_channel_group = "voicechannel_" + data["voice_channel"]
            async_to_sync(self.channel_layer.group_add)(
                self.voice_channel_group, self.channel_name
            )

    def voice_channel_call(self, data):
        if self.voice_channel_group:
            async_to_sync(self.channel_layer.group_send)(
                self.voice_channel_group,
                {
                    "type": "call.broadcast_joined",
                    "user_id": self.user.id,
                    "username": self.user.username,
                    "avatar": self.user.avatar.url,
                    "peer_id": data["peer_id"],
                },
            )
            vc_add_user(
                self.server_view_group,
                self.voice_channel_group,
                self.user.username,
                self.user.avatar.url,
            )
            if self.server_view_group:
                async_to_sync(self.channel_layer.group_send)(
                    self.server_view_group,
                    {
                        "type": "vc.joined",
                        "channel_id": self.voice_channel_group,
                        "username": self.user.username,
                        "avatar": self.user.avatar.url,
                    },
                )

    def voice_channel_leave(self, data=None):
        if self.voice_channel_group:
            async_to_sync(self.channel_layer.group_send)(
                self.voice_channel_group,
                {
                    "type": "call.broadcast_left",
                    "user_id": self.user.id,
                },
            )
            if self.server_view_group:
                async_to_sync(self.channel_layer.group_send)(
                    self.server_view_group,
                    {
                        "type": "vc.left",
                        "channel_id": self.voice_channel_group,
                        "username": self.user.username,
                        "avatar": self.user.avatar.url,
                    },
                )
            async_to_sync(self.channel_layer.group_discard)(
                self.voice_channel_group, self.channel_name
            )
            vc_remove_user(
                self.server_view_group, self.voice_channel_group, self.user.username
            )

        self.voice_channel_group = None

    def call_broadcast_joined(self, event):
        self.send(text_data=json.dumps(event))

    def call_broadcast_left(self, event):
        self.send(text_data=json.dumps(event))

    def vc_joined(self, event):
        self.send(text_data=json.dumps(event))

    def vc_left(self, event):
        self.send(text_data=json.dumps(event))
