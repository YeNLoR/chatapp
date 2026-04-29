from django import forms
from django.contrib.auth.forms import UserCreationForm

from . import models


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = models.User
        fields = ["username"]


class ServerForm(forms.ModelForm):
    class Meta:
        model = models.Server
        fields = ["name"]


class ChannelForm(forms.ModelForm):
    class Meta:
        model = models.Channel
        fields = ["name"]


class MessageForm(forms.ModelForm):
    class Meta:
        model = models.Message
        fields = ["message"]
