from django.urls import path
from .views import DicomConversionView  # Import the view
from . import views

urlpatterns = [
    path("convert-dicom/", DicomConversionView.as_view(), name="convert-dicom"),
    path('process-dicom/<str:patient_id>/', views.ProcessDicomView.as_view(), name='process-dicom'),
    path('delete-processed-image/<int:image_id>/', views.DeleteProcessedImageView.as_view(), name='delete-processed-image'),
    path('save-approval-status/', views.SaveApprovalStatusView.as_view(), name='save-approval-status'),
]