import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer

from .models import auth_consumer


class ChatConsumer(WebsocketConsumer):
    def connect(self):
        self.user = self.scope["user"]
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        if not auth_consumer(self.room_name, self.user):
            self.send("no")
            self.close()
            return
        self.room_group_name = f"chat_{self.room_name}"
        async_to_sync(self.channel_layer.group_add)(
            self.room_group_name, self.channel_name
        )
        self.accept()

    def disconnect(self, close_code):
        async_to_sync(self.channel_layer.group_discard)(
            self.room_group_name, self.channel_name
        )

    def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json.get("message", "blank")
        user = self.scope["user"]
        if user.is_authenticated:
            username = user.username
            src = user.avatar.url
        else:
            username = "Anonymous"
            src = "/media/el_bug50.png"
        async_to_sync(self.channel_layer.group_send)(
            self.room_group_name,
            {
                "type": "chat.message",
                "message": message,
                "username": username,
                "src": src,
            },
        )

    def chat_message(self, event):
        message = event["message"]
        username = event["username"]
        avatar = event["src"]
        self.send(
            text_data=json.dumps(
                {"message": message, "username": username, "avatar": avatar}
            )
        )
