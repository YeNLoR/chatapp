from . import forms


def form(request):
    server_form = forms.ServerForm(request.POST)
    channel_form = forms.ChannelForm(request.POST)
    return {"server_form": server_form, "channel_form": channel_form}
