from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("server/<int:id>/", views.server, name="server"),
    path("channel/<int:id>/", views.channel, name="channel"),
    path("login/", views.login_view, name="login"),
    path("register/", views.register, name="register"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
