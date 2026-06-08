from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ('name', 'surname', 'email', 'affiliation', 'phone_number', 'specialty', 'title')

class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = CustomUser
        fields = ('name', 'surname', 'email', 'affiliation', 'phone_number', 'specialty', 'title')