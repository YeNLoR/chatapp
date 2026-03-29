from django.shortcuts import render
from .models import Server, Channel, Message

def index(request):
    return render(request, "index.html")

def server(request, id):
    server = Server.objects.get(id=id)
    context = {"current_server": server}
    return render(request, "channels.html", context)

def channel(request, id):
    channel = Channel.objects.get(id=id)
    context = {"current_channel": channel}
    return render(request, "messages.html", context)
