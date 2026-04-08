from django.contrib.auth import login
from django.contrib.auth.forms import AuthenticationForm
from django.shortcuts import redirect, render

from .forms import CustomUserCreationForm, MessageForm
from .models import Channel, Message, Server


def index(request):
    return render(request, "index.html")


def server(request, server_id):
    server = Server.objects.get(id=server_id)
    context = {"current_server": server}
    template = "channels.html" if request.META.get("HTTP_HX_REQUEST") else "index.html"
    return render(request, template, context)


def channel(request, server_id, channel_id):
    form = MessageForm(request.POST or None)
    server = (
        None
        if request.META.get("HTTP_HX_REQUEST")
        else Server.objects.get(id=server_id)
    )
    channel = Channel.objects.get(id=channel_id)
    context = {
        "current_server": server,
        "current_channel": channel,
        "message_form": form,
    }
    template = "messages.html" if request.META.get("HTTP_HX_REQUEST") else "index.html"
    return render(request, template, context)


def login_view(request):
    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            login(request, form.get_user())
            return redirect(to="/")
    context = {"form": form}
    template = "login.html" if request.META.get("HTTP_HX_REQUEST") else "login.html"
    return render(request, template, context)


def register(request):
    form = CustomUserCreationForm(request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            form.save()
            return redirect(to="/login/")
    context = {"form": form}
    template = (
        "register.html" if request.META.get("HTTP_HX_REQUEST") else "register.html"
    )
    return render(request, template, context)


def profile(request):
    friend_list = request.user.friends.all()
    context = {"friend_list": friend_list}
    template = "profile.html" if request.META.get("HTTP_HX_REQUEST") else "index.html"
    return render(request, template, context)


def message(request, server_id, channel_id):
    form = MessageForm(request.POST or None)
    if form.is_valid():
        message = form.save(commit=False)
        message.channel_id = channel_id
        message.user_id = request.user.id
        message.save()
        return
    print("hata")
    return
