from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.db.models import Exists, OuterRef, Prefetch, Q
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import ChannelForm, CustomUserCreationForm, MessageForm, ServerForm
from .models import Channel, Friendship, Message, Server

User = get_user_model()


def index(request):
    return render(request, "index.html")


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


def login_view(request):
    form = AuthenticationForm(request, data=request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            login(request, form.get_user())
            return redirect(to="/")
        else:
            print("not valid")
    else:
        print("wrong method")


@login_required
@require_POST
def logout_view(request):
    logout(request)
    return redirect("/")


def profile(request):
    friend_list_filters = Q(
        sent_requests__to_user_id=request.user.id, sent_requests__status="accepted"
    ) | Q(
        received_requests__from_user_id=request.user.id,
        received_requests__status="accepted",
    )
    friend_list = User.objects.filter(friend_list_filters)
    context = {"friend_list": friend_list}
    template = (
        "profile.html#content"
        if request.META.get("HTTP_HX_REQUEST")
        else "profile.html"
    )
    return render(request, template, context)


@login_required
def notifications(request):
    notifs = User.objects.filter(
        sent_requests__to_user=request.user, sent_requests__status="pending"
    ).all()
    if notifs:
        return render(request, "notifs.html", {"notifs": notifs})
    else:
        return HttpResponse("Bildirim yok.")


@login_required
@require_POST
def friendship_request(request):
    username = request.POST.get("friend_username")
    is_friends_filter = Q(from_user_id=OuterRef("id"), to_user_id=request.user.id) | Q(
        from_user=request.user.id, to_user=OuterRef("id")
    )
    friend = (
        User.objects.filter(username=username)
        .annotate(is_friends=Exists(Friendship.objects.filter(is_friends_filter)))
        .first()
    )
    if not friend or friend.is_friends:
        return HttpResponse(status=400)
    Friendship.objects.create(from_user=request.user, to_user=friend)
    return redirect("profile")


@login_required
@require_POST
def friendship_response(request):
    username = request.POST.get("requester_username")
    action = request.POST.get("action")
    requester = get_object_or_404(User, username=username)
    friendship = Friendship.objects.filter(
        from_user=requester, to_user=request.user
    ).first()
    if not friendship:
        print("doesnt exist??", requester)
        return HttpResponse(status=404)
    if action == "accept":
        friendship.status = "accepted"
        friendship.save()
        return HttpResponseRedirect("/profile/")
    if action == "reject":
        friendship.delete()
        return HttpResponseRedirect("/profile/")


@login_required
@require_POST
def create_server(request):
    form = ServerForm(request.POST or None)
    if form.is_valid():
        server = form.save()
        server.users.add(request.user)
        return redirect(f"/channel/{server.id}")


def server_view(request, server_id):
    server = (
        Server.objects.filter(id=server_id)
        .annotate(
            is_in=Exists(Server.objects.filter(id=OuterRef("id"), users=request.user))
        )
        .first()
    )
    if not server_view or not server.is_in:
        return redirect("/")
    context = {"current_server": server}
    template = (
        "channels.html#content"
        if request.META.get("HTTP_HX_REQUEST")
        else "channels.html"
    )
    return render(request, template, context)


@login_required
@require_POST
def create_channel(request, server_id, channel_id=None):
    form = ChannelForm(request.POST or None)
    if form.is_valid():
        channel = form.save(commit=False)
        channel.server_id = server_id
        channel.save()
        return redirect(f"/channel/{server_id}/{channel.id}")


def channel_view(request, server_id, channel_id):
    form = MessageForm(request.POST or None)
    server = (
        None
        if request.META.get("HTTP_HX_REQUEST")
        else Server.objects.get(id=server_id)
    )
    channel = (
        Channel.objects.filter(id=channel_id)
        .annotate(
            is_in=Exists(
                Server.objects.filter(id=OuterRef("server_id"), users=request.user)
            )
        )
        .first()
    )
    if not channel or not channel.is_in:
        return redirect("/")
    context = {
        "current_server": server,
        "current_channel": channel,
        "message_form": form,
    }
    template = (
        "messages.html#content"
        if request.META.get("HTTP_HX_REQUEST")
        else "messages.html"
    )
    return render(request, template, context)


@login_required
@require_POST
def message(request, server_id, channel_id):
    form = MessageForm(request.POST or None)
    if form.is_valid():
        message = form.save(commit=False)
        message.channel_id = channel_id
        message.user_id = request.user.id
        message.save()
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{channel_id}",
            {
                "type": "chat.message",
                "message": message.message,
                "username": request.user.username,
                "src": request.user.avatar.url,
            },
        )
        return HttpResponse()
    print("hata")
    return HttpResponse()
