from django.shortcuts import render, redirect
from .models import Server, Channel, Message
from .forms import CustomUserCreationForm
from django.contrib.auth.forms import AuthenticationForm

def index(request):
    return render(request, "index.html")

def server(request, id):
    server = Server.objects.get(id=id)
    context = {"current_server": server}
    return render(request, "channels.html", context)

def channel(request, id):
    channel = Channel.objects.get(id=id)
    context = {"current_channel": channel}
    if request.META.get("HTTP_HX_REQUEST"):
        return render(request, "messages.html", context)
    else:
        return redirect("/")
    
def login(request):
    form = AuthenticationForm(request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            login(request, form.ger_user())
            return redirect(to="/")
    context = {"form": form}
    template = (
        "login.html"
        if request.META.get("HTTP_HX_REQUEST")
        else "login.html"
    )
    return render(request, template, context)

def register(request):
    form = CustomUserCreationForm(request.POST or None)
    if request.method == "POST":
        if form.is_valid():
            login(request, form.ger_user())
            return redirect(to="/")
    context = {"form": form}
    template = (
        "register.html"
        if request.META.get("HTTP_HX_REQUEST")
        else "register.html"
    )
    return render(request, template, context)