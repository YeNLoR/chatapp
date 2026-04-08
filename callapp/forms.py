from django import forms
from django.contrib.auth.forms import UserCreationForm

from . import models


class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = models.User
        fields = ["username"]


class MessageForm(forms.ModelForm):
    class Meta:
        model = models.Message
        fields = ["message"]
