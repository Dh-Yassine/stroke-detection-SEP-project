# C:\Users\asus\Documents\Projects\Strok project\backend\auth_app\views.py
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from .serializers import RegisterSerializer, LoginSerializer, NotificationSerializer, UserSerializer
from .models import CustomUser, Notification
from ai_app.models import AIReport, Patient
from django.db.models import Count
from datetime import datetime, timedelta

class RegisterView(GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = RefreshToken.for_user(user)
        data = serializer.data
        data["Tokens"] = {"refresh": str(token), "access": str(token.access_token)}
        return Response(data, status=status.HTTP_201_CREATED)

class LoginView(GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token = RefreshToken.for_user(user)
        data = serializer.data
        data["Tokens"] = {"refresh": str(token), "access": str(token.access_token)}
        return Response(data, status=status.HTTP_200_OK)

class LogoutView(GenericAPIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_400_BAD_REQUEST)

class NotificationListView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = NotificationSerializer

    def get(self, request, *args, **kwargs):
        notifications = Notification.objects.filter(user=request.user).order_by('-created_at')
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        notification_id = kwargs.get('pk')
        try:
            notification = Notification.objects.get(id=notification_id, user=request.user)
            serializer = self.get_serializer(notification, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({"error": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)

class UserStatusView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get(self, request, *args, **kwargs):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

class PendingUsersView(GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get(self, request, *args, **kwargs):
        if request.user.specialty != 'Admin':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        pending_users = CustomUser.objects.filter(validation_status='pending')
        serializer = self.get_serializer(pending_users, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class ApproveUserView(GenericAPIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, user_id, *args, **kwargs):
        if request.user.specialty != 'Admin':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
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
            return Response({"message": "User approved successfully."}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found or already processed."}, status=status.HTTP_404_NOT_FOUND)

class RejectUserView(GenericAPIView):
    permission_classes = (IsAuthenticated,)

    def post(self, request, user_id, *args, **kwargs):
        if request.user.specialty != 'Admin':
            return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)
        try:
            user = CustomUser.objects.get(id=user_id, validation_status='pending')
            Notification.objects.create(
                user=user,
                message="Your account has not been approved by the admin.",
                notification_type='not_approved'
            )
            user.delete()
            return Response({"message": "User rejected and deleted."}, status=status.HTTP_200_OK)
        except CustomUser.DoesNotExist:
            return Response({"error": "User not found or already processed."}, status=status.HTTP_404_NOT_FOUND)

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.specialty != 'Admin':
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        thirty_days_ago = datetime.now() - timedelta(days=30)
        active_users = CustomUser.objects.filter(last_login__gte=thirty_days_ago).count()
        total_patients = Patient.objects.count()
        report_trends = AIReport.objects.filter(
            created_at__gte=thirty_days_ago
        ).values('created_at__date').annotate(count=Count('id')).order_by('created_at__date')
        trial_users = CustomUser.objects.filter(is_trial=True).count()
        specialties = CustomUser.objects.values('specialty').annotate(count=Count('id'))
        
        data = {
            'active_users': active_users,
            'total_patients': total_patients,
            'report_trends': [
                {'created_at__date': str(item['created_at__date']), 'count': item['count']}
                for item in report_trends
            ],
            'trial_users': trial_users,
            'specialties': list(specialties),
        }
        return Response(data)