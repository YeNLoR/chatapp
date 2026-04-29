from django.contrib.auth.forms import AuthenticationForm

from . import forms


def form(request):
    server_form = forms.ServerForm(request.POST)
    channel_form = forms.ChannelForm(request.POST)
    register_form = forms.CustomUserCreationForm(request.POST)
    login_form = AuthenticationForm(request.POST)
    return {
        "server_form": server_form,
        "channel_form": channel_form,
        "register_form": register_form,
        "login_form": login_form,
    }
