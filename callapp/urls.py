from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("profile/", views.profile, name="profile"),
    path("channel/<int:server_id>/", views.server_view, name="server"),
    path(
        "channel/<int:server_id>/<int:channel_id>/", views.channel_view, name="channel"
    ),
    path(
        "channel/<int:server_id>/<int:channel_id>/message/",
        views.message,
        name="message",
    ),
    path("createserver/", views.create_server, name="createserver"),
    path(
        "channel/<int:server_id>/createchannel/",
        views.create_channel,
        name="createchannel",
    ),
    path(
        "channel/<int:server_id>/<int:channel_id>/createchannel/",
        views.create_channel,
        name="createchannel",
    ),
    path("login/", views.login_view, name="login"),
    path("register/", views.register, name="register"),
    path("<str:room_name>/", views.room, name="room"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
