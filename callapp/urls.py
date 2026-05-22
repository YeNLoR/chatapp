from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("notifications/", views.notifications, name="notifications"),
    path(
        "profile/friendship-request/",
        views.friendship_request,
        name="friendship-request",
    ),
    path(
        "profile/friendship-response/",
        views.friendship_response,
        name="friendship-response",
    ),
    path("createserver/", views.create_server, name="createserver"),
    path("joinserver/", views.join_server, name="joinserver"),
    path("channel/friends/", views.profile, name="profile"),
    path("channel/<int:server_id>/", views.server_view, name="server"),
    path(
        "channel/<int:server_id>/createchannel/",
        views.create_channel,
        name="createchannel",
    ),
    path(
        "channel/<int:server_id>/createvoicechannel/",
        views.create_voice_channel,
        name="create_voice_channel",
    ),
    path(
        "channel/<int:server_id>/delete/",
        views.delete_server,
        name="deleteserver",
    ),
    path(
        "channel/friends/<int:channel_id>/", views.channel_view, name="friend_channel"
    ),
    path(
        "channel/<int:server_id>/<int:channel_id>/", views.channel_view, name="channel"
    ),
    path(
        "channel/<int:server_id>/<int:channel_id>/delete/",
        views.delete_channel,
        name="deletechannel",
    ),
    path(
        "channel/friends/<int:channel_id>/message/",
        views.message,
        name="friend_message",
    ),
    path(
        "channel/<int:server_id>/<int:channel_id>/message/",
        views.message,
        name="message",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
