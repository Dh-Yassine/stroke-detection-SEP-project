from django.contrib import admin
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from .models import CustomUser, Notification

class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['email', 'name', 'surname', 'specialty', 'validation_status', 'trial_start']
    list_filter = ['validation_status']
    actions = ['approve_users', 'reject_users']

    def approve_users(self, request, queryset):
        for user in queryset.filter(validation_status='pending'):
            user.validation_status = 'approved'
            user.trial_start = None
            user.upload_count = 0
            user.save()
            Notification.objects.create(
                user=user,
                message="Your account has been approved by the admin.",
                notification_type='approved'
            )
        self.message_user(request, "Selected users have been approved.")

    def reject_users(self, request, queryset):
        for user in queryset.filter(validation_status='pending'):
            Notification.objects.create(
                user=user,
                message="Your account has not been approved by the admin.",
                notification_type='not_approved'
            )
            user.delete()
        self.message_user(request, "Selected users have been rejected and deleted.")

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('pending-users/', self.admin_site.admin_view(self.pending_users_view), name='pending-users'),
            path('approve-user/<int:user_id>/', self.admin_site.admin_view(self.approve_user), name='approve-user'),
            path('reject-user/<int:user_id>/', self.admin_site.admin_view(self.reject_user), name='reject-user'),
        ]
        return custom_urls + urls

    def pending_users_view(self, request):
        pending_users = CustomUser.objects.filter(validation_status='pending')
        context = {
            'pending_users': pending_users,
            'title': 'Pending User Validations',
        }
        return render(request, 'admin/pending_users.html', context)

    def approve_user(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id, validation_status='pending')
            user.validation_status = 'approved'
            user.trial_start = None
            user.upload_count = 0
            user.save()
            Notification.objects.create(
                user=user,
                message="Your account has been approved by the admin.",
                notification_type='approved'
            )
            messages.success(request, f"User {user.email} has been approved.")
        except CustomUser.DoesNotExist:
            messages.error(request, "User not found or already processed.")
        return redirect('admin:pending-users')

    def reject_user(self, request, user_id):
        try:
            user = CustomUser.objects.get(id=user_id, validation_status='pending')
            Notification.objects.create(
                user=user,
                message="Your account has not been approved by the admin.",
                notification_type='not_approved'
            )
            user.delete()
            messages.success(request, f"User {user.email} has been rejected and deleted.")
        except CustomUser.DoesNotExist:
            messages.error(request, "User not found or already processed.")
        return redirect('admin:pending-users')
    
    

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Notification)