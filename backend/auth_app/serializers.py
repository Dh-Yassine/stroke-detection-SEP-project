# C:\Users\asus\Documents\Projects\Strok project\backend\auth_app\serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import CustomUser, Notification
import re
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('id', 'name', 'surname', 'email', 'affiliation', 'phone_number', 'specialty', 'title', 'validation_status')

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ('id', 'message', 'notification_type', 'created_at', 'is_read')
        read_only_fields = ('id', 'message', 'notification_type', 'created_at')

    def update(self, instance, validated_data):
        instance.is_read = validated_data.get('is_read', instance.is_read)
        instance.save()
        return instance

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    password2 = serializers.CharField(write_only=True, required=True)
    specialty = serializers.ChoiceField(
        choices=[('Doctor', 'Doctor'), ('Admin', 'Admin'), ('Other', 'Other')],
        required=True
    )

    class Meta:
        model = CustomUser
        fields = ('name', 'surname', 'email', 'affiliation', 'phone_number', 'specialty', 'title', 'password', 'password2')
        extra_kwargs = {
            'email': {'required': True},
            'name': {'required': True},
            'surname': {'required': True},
            'affiliation': {'required': True},
            'phone_number': {'required': True},
            'specialty': {'required': True},
            'title': {'required': True}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password2": "Password fields didn't match."})
        
        if len(attrs.get("password", "")) < 8:
            raise serializers.ValidationError({"password": "Password must be at least 8 characters."})
        
        if len(attrs.get("name", "")) < 2:
            raise serializers.ValidationError({"name": "Name must be at least 2 characters."})
        
        if len(attrs.get("surname", "")) < 2:
            raise serializers.ValidationError({"surname": "Surname must be at least 2 characters."})
        
        if not attrs.get("affiliation"):
            raise serializers.ValidationError({"affiliation": "Affiliation is required."})
        
        if not re.match(r'^\+?\d{7,15}$', attrs.get("phone_number", "")):
            raise serializers.ValidationError({"phone_number": "Phone number must be 7-15 digits."})

        if CustomUser.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "This email is already registered."})

        if attrs['specialty'] == 'Admin' and CustomUser.objects.filter(specialty='Admin').exists():
            raise serializers.ValidationError({"specialty": "An Admin user already exists. Only one Admin is allowed."})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        is_admin = validated_data['specialty'] == 'Admin'
        user = CustomUser.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            name=validated_data['name'],
            surname=validated_data['surname'],
            affiliation=validated_data['affiliation'],
            phone_number=validated_data['phone_number'],
            specialty=validated_data['specialty'],
            title=validated_data['title'],
            is_staff=is_admin,
            validation_status='approved' if is_admin else 'pending',
            trial_start=None if is_admin else timezone.now(),
            upload_count=0
        )

        if not is_admin:
            Notification.objects.create(
                user=user,
                message="Your registration has been sent to the admin for validation.",
                notification_type='registration_sent'
            )

        if not is_admin:
            try:
                admin = CustomUser.objects.get(specialty='Admin')
                Notification.objects.create(
                    user=admin,
                    message=f"New user registration: {user.name} {user.surname} ({user.email}) awaits validation.",
                    notification_type='new_user'
                )
            except CustomUser.DoesNotExist:
                logger.warning("No admin user found to send registration notification.")

        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        
        if email and password:
            user = authenticate(request=self.context.get('request'), email=email, password=password)
            if not user:
                raise serializers.ValidationError("Unable to log in with provided credentials.", code='authorization')
        else:
            raise serializers.ValidationError("Must include 'email' and 'password'.", code='authorization')
            
        attrs['user'] = user
        return attrs