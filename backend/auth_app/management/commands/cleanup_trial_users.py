from django.core.management.base import BaseCommand
from django.utils import timezone
from auth_app.models import CustomUser, Notification

class Command(BaseCommand):
    help = 'Cleans up trial users who have exceeded trial period or upload limit'

    def handle(self, *args, **kwargs):
        pending_users = CustomUser.objects.filter(validation_status='pending')
        for user in pending_users:
            if user.is_trial_expired():
                Notification.objects.create(
                    user=user,
                    message="Your trial period has expired or upload limit reached.",
                    notification_type='not_approved'
                )
                user.delete()
                self.stdout.write(self.style.SUCCESS(f'Deleted trial user: {user.email}'))