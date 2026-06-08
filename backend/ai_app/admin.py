# C:\Users\asus\Documents\Projects\Strok project\backend\ai_app\admin.py
from django.contrib import admin
from .models import DicomUpload, Patient, AIReport

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ('dossier_id', 'doctor', 'specialty', 'created_at')
    readonly_fields = ('dossier_id', 'created_at')
    search_fields = ('dossier_id', 'doctor__email', 'specialty')
    list_filter = ('specialty', 'created_at')
    ordering = ('-created_at',)
    raw_id_fields = ('doctor',)

@admin.register(DicomUpload)
class DicomUploadAdmin(admin.ModelAdmin):
    list_display = ('user', 'sequence_type', 'created_at')
    search_fields = ('user__email', 'sequence_type')

@admin.register(AIReport)
class AIReportAdmin(admin.ModelAdmin):
    list_display = ('patient', 'created_at')
    search_fields = ('patient__patient_id',)