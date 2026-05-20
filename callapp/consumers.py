import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer

from .models import auth_consumer


class RoomConsumer(WebsocketConsumer):
    def connect(self) -> None:
        self.user = self.scope.get("user")
        self.user_groups = []
        self.voice_channel_group = None
        self.text_channel_group = None
        self.permitted_channels = []
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
        if self.text_channel_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.text_channel_group, self.channel_name
            )
        if self.voice_channel_group:
            async_to_sync(self.channel_layer.group_send)(
                self.voice_channel_group,
                {
                    "type": "call.broadcast_left",
                    "user_id": self.user.id,
                },
            )
            async_to_sync(self.channel_layer.group_discard)(
                self.voice_channel_group, self.channel_name
            )

    def receive(
        self, text_data: str | None = None, bytes_data: bytes | None = None
    ) -> None:
        if text_data:
            data = json.loads(text_data)
            if not data.get("type"):
                return
            handlers = {
                "text_channel.join": self.text_channel_join,
                "text_channel.leave": self.text_channel_leave,
                "voice_channel.join": self.voice_channel_join,
                "voice_channel.call": self.voice_channel_call,
                "voice_channel.leave": self.voice_channel_leave,
            }
            handler = handlers.get(data["type"])
            if handler:
                handler(data)

    def text_channel_join(self, data):
        if self.text_channel_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.text_channel_group, self.channel_name
            )
        self.text_channel_group = data["text_channel"]
        async_to_sync(self.channel_layer.group_add)(
            self.text_channel_group, self.channel_name
        )

    def text_channel_leave(self, data):
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
        if self.voice_channel_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.voice_channel_group, self.channel_name
            )
            async_to_sync(self.channel_layer.group_send)(
                self.voice_channel_group,
                {
                    "type": "call.broadcast_left",
                    "user_id": self.user.id,
                },
            )
        self.voice_channel_group = data["voice_channel"]
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
                    "peer_id": data["peer_id"],
                },
            )

    def voice_channel_leave(self, data):
        if self.voice_channel_group:
            async_to_sync(self.channel_layer.group_discard)(
                self.voice_channel_group, self.channel_name
            )
            async_to_sync(self.channel_layer.group_send)(
                self.voice_channel_group,
                {
                    "type": "call.broadcast_left",
                    "user_id": self.user.id,
                },
            )
        self.voice_channel_group = None

    def call_broadcast_joined(self, event):
        self.send(text_data=json.dumps(event))

    def call_broadcast_left(self, event):
        self.send(text_data=json.dumps(event))
