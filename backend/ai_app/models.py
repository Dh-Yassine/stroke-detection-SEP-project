# C:\Users\asus\Documents\Projects\Strok project\backend\ai_app\models.py
import os
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from auth_app.models import CustomUser

class DicomUpload(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='dicom_uploads')
    sequence_type = models.CharField(max_length=50)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dicom_uploads'

class Patient(models.Model):
    doctor = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ai_patients')
    specialty = models.CharField(max_length=255)  # Matches doctor's specialty
    created_at = models.DateTimeField(auto_now_add=True)
    dossier_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    # Other fields (e.g., name, condition)

    def __str__(self):
        return f"Patient {self.dossier_id or self.id}"

class AIReport(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='reports')
    created_at = models.DateTimeField(auto_now_add=True)
    report_data = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Report for {self.patient} on {self.created_at}"

@receiver(post_save, sender=Patient)
def generate_patient_id(sender, instance, created, **kwargs):
    if created and not instance.dossier_id:
        # Get the latest DicomUpload for the doctor
        latest_upload = DicomUpload.objects.filter(user=instance.doctor).order_by('-created_at').first()
        maladie = latest_upload.sequence_type if latest_upload else 'unknown'
        # Format created_at as YYYYMMDDHHMMSS
        created_at_str = instance.created_at.strftime('%Y%m%d%H%M%S')
        # Generate dossier_id: id_maladie_created_at
        dossier_id = f"{instance.id}_{maladie}_{created_at_str}"
        
        # Ensure uniqueness (handle rare collisions)
        counter = 1
        base_dossier_id = dossier_id
        while Patient.objects.filter(dossier_id=dossier_id).exclude(id=instance.id).exists():
            dossier_id = f"{base_dossier_id}_{counter}"
            counter += 1
        
        instance.dossier_id = dossier_id
        instance.save(update_fields=['dossier_id'])

def processed_image_upload_to(instance, filename):
    """
    Specifies the upload path for processed images, organizing them by patient ID.
    """
    patient_id_str = 'unknown'
    if instance.patient:
        patient_id_str = str(instance.patient.id)
    
    return os.path.join('processed_images', patient_id_str, filename)

class DicomFile(models.Model):
    patient = models.ForeignKey('auth_app.Patient', on_delete=models.CASCADE, related_name='dicom_files')
    file = models.FileField(upload_to='dicoms/')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        
    def __str__(self):
        return f"DICOM file for Patient {self.patient.dossier_id}"

class ProcessedImage(models.Model):
    patient = models.ForeignKey('auth_app.Patient', on_delete=models.CASCADE, related_name='processed_images')
    original_dicom = models.ForeignKey(DicomFile, on_delete=models.CASCADE)
    processed_image = models.ImageField(upload_to=processed_image_upload_to)
    slice_number = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['slice_number']
        
    def __str__(self):
        return f"Processed Image {self.slice_number} for Patient {self.patient.dossier_id}"