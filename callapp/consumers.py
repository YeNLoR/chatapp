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
        data = json.loads(text_data)
        message = data.get("message", "blank")
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


class CallConsumer(WebsocketConsumer):
    def connect(self):
        self.user = self.scope["user"]
        if not self.user.is_authenticated:
            self.close()
            return

        self.user_group = f"user_{self.user.id}"
        async_to_sync(self.channel_layer.group_add)(self.user_group, self.channel_name)
        self.accept()

    def disconnect(self, close_code):
        async_to_sync(self.channel_layer.group_discard)(
            self.user_group, self.channel_name
        )

    def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get("type")

        handlers = {
            "call.offer": self.handle_offer,
            "call.answer": self.handle_answer,
            "call.reject": self.handle_reject,
            "call.end": self.handle_end,
        }

        handler = handlers.get(msg_type)
        if handler:
            handler(data)

    def handle_offer(self, data):
        target_group = f"user_{data['target_user_id']}"
        async_to_sync(self.channel_layer.group_send)(
            target_group,
            {
                "type": "call.signal",
                "signal_type": "call.offer",
                "from_user_id": self.user.id,
                "from_username": self.user.username,
                "peer_id": data["peer_id"],
            },
        )

    def handle_answer(self, data):
        target_group = f"user_{data['target_user_id']}"
        async_to_sync(self.channel_layer.group_send)(
            target_group,
            {
                "type": "call.signal",
                "signal_type": "call.answer",
                "peer_id": data["peer_id"],
            },
        )

    def handle_reject(self, data):
        target_group = f"user_{data['target_user_id']}"
        async_to_sync(self.channel_layer.group_send)(
            target_group,
            {
                "type": "call.signal",
                "signal_type": "call.reject",
            },
        )

    def handle_end(self, data):
        target_group = f"user_{data['target_user_id']}"
        async_to_sync(self.channel_layer.group_send)(
            target_group,
            {
                "type": "call.signal",
                "signal_type": "call.end",
            },
        )

    def call_signal(self, event):
        self.send(text_data=json.dumps(event))
