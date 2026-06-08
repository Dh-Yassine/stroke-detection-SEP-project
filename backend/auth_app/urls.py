# C:\Users\asus\Documents\Projects\Strok project\backend\auth_app\urls.py
from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, NotificationListView, UserStatusView,
    PendingUsersView, ApproveUserView, RejectUserView, DashboardView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('user-status/', UserStatusView.as_view(), name='user-status'),
    path('pending-users/', PendingUsersView.as_view(), name='pending-users'),
    path('approve-user/<int:user_id>/', ApproveUserView.as_view(), name='approve-user'),
    path('reject-user/<int:user_id>/', RejectUserView.as_view(), name='reject-user'),
    path('admin/dashboard/', DashboardView.as_view(), name='admin-dashboard'),
]