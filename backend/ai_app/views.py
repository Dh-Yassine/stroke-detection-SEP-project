import os
import logging
from pathlib import Path
import shutil
import pydicom
from pydicom.errors import InvalidDicomError
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from collections import defaultdict
from .conversion import anonymize_dicom_files, convert_to_nifti, convert_to_png
from .models import DicomUpload, ProcessedImage, DicomFile
from auth_app.models import Patient
from .skull_extraction import (
    load_skull_model,
    preprocess_image_for_skull_extraction,
    predict_skull_mask,
    convert_to_png as convert_skull_to_png
)
import cv2
import numpy as np
import SimpleITK as sitk
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from .segmentation_utils import segment_lesions

logger = logging.getLogger(__name__)

class DicomConversionView(APIView):
    def post(self, request):
        try:
            files = request.FILES.getlist('file')
            sequence = request.POST.get('sequenceType')
            form_data = {
                'folderNumber': request.POST.get('folderNumber', ''),
                'sequenceType': sequence,
                'age': request.POST.get('age', ''),
                'gender': request.POST.get('gender', ''),
                'bmi': request.POST.get('bmi', ''),
                'smokingStatus': request.POST.get('smokingStatus', ''),
                'avgGlucoseLevel': request.POST.get('avgGlucoseLevel', ''),
                'everMarried': request.POST.get('everMarried', ''),
                'heartDisease': request.POST.get('heartDisease', ''),
                'hypertension': request.POST.get('hypertension', ''),
                'residenceType': request.POST.get('residenceType', ''),
                'other': request.POST.get('other', '')
            }

            if not files or not sequence:
                return Response({'error': 'Files and sequence type are required'}, status=status.HTTP_400_BAD_REQUEST)

            filtered_files = []
            skipped_files = []
            skip_reasons = defaultdict(int)
            unique_descriptions = set()
            metadata_log = []

            for file in files:
                file_path = file.name
                try:
                    file.seek(0)
                    ds = pydicom.dcmread(file, force=True)
                    if not hasattr(ds, 'PixelData'):
                        skip_reasons['no_pixel_data'] += 1
                        skipped_files.append(file_path)
                        continue

                    series_description = str(ds.get('SeriesDescription', 'None')).upper()
                    unique_descriptions.add(series_description)
                    metadata_log.append({
                        'file': file_path,
                        'SeriesDescription': series_description,
                        'Modality': str(ds.get('Modality', 'Unknown')),
                        'SeriesInstanceUID': str(ds.get('SeriesInstanceUID', 'Unknown'))
                    })

                    if not any(term in series_description for term in [sequence.upper(), 'DWI', 'DIFFUSION']):
                        skip_reasons[f'sequence_mismatch_{series_description}'] += 1
                        skipped_files.append(file_path)
                        continue

                    filtered_files.append(file)

                except InvalidDicomError:
                    skip_reasons['invalid_dicom'] += 1
                    skipped_files.append(file_path)
                    continue
                except Exception as e:
                    skip_reasons[f'error_{str(e)[:50]}'] += 1
                    skipped_files.append(file_path)
                    continue

            if not filtered_files:
                error_msg = f"No valid DICOM files found for sequence '{sequence}'. Found SeriesDescriptions: {', '.join(unique_descriptions) or 'None'}."
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

            max_files = getattr(settings, 'DATA_UPLOAD_MAX_NUMBER_FILES', 5000)
            if len(filtered_files) > max_files:
                return Response(
                    {'error': f'Too many files uploaded. Maximum allowed is {max_files}.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with tempfile.TemporaryDirectory() as temp_dir:
                input_dir = os.path.join(temp_dir, 'input')
                anon_dir = os.path.join(temp_dir, 'anon')
                output_dir = os.path.join(temp_dir, 'output')
                os.makedirs(input_dir, exist_ok=True)

                for file in filtered_files:
                    file_name = file.name.replace('/', os.sep).replace('\\', os.sep)
                    file_path = os.path.join(input_dir, file_name)
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)
                    with open(file_path, 'wb') as f:
                        file.seek(0)
                        f.write(file.read())

                metadata, total_dicom, valid_dicom, invalid_dicom, series_groups, unique_descriptions, processed_files = anonymize_dicom_files(input_dir, anon_dir, sequence)
                if not metadata:
                    error_msg = f"No valid DICOM files found for sequence '{sequence}'. Attempted: {total_dicom} file(s), {invalid_dicom} skipped."
                    return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

                nifti_files, total_nifti, valid_nifti, invalid_nifti = convert_to_nifti(anon_dir, output_dir, series_groups)
                if not nifti_files:
                    return Response({'error': 'NIfTI conversion failed'}, status=status.HTTP_400_BAD_REQUEST)

                images, valid_images = convert_to_png(nifti_files, output_dir, metadata)
                if not images:
                    return Response({'error': 'PNG conversion failed'}, status=status.HTTP_400_BAD_REQUEST)

                response_data = {
                    'images': images,
                    'total_dicom': total_dicom,
                    'valid_dicom': valid_dicom,
                    'invalid_dicom': invalid_dicom,
                    'total_nifti': total_nifti,
                    'valid_nifti': valid_nifti,
                    'invalid_nifti': invalid_nifti,
                    'valid_images': valid_images,
                    'formData': form_data,
                    'processed_files': processed_files
                }

                # Save to database
                DicomUpload.objects.create(
                    user=request.user,
                    sequence_type=sequence,
                    metadata=response_data
                )

                return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class ProcessDicomView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, patient_id):
        try:
            # Try to get the patient, create if doesn't exist
            try:
                patient = Patient.objects.get(dossier_id=patient_id)
            except Patient.DoesNotExist:
                patient = Patient.objects.create(
                    dossier_id=patient_id,
                    user=request.user
                )
                logger.info(f'Created new patient with ID: {patient_id}')
            
            # Check if we have files in the request
            files = request.FILES.getlist('files')
            if files:
                for file in files:
                    dicom_file = DicomFile.objects.create(
                        patient=patient,
                        file=file
                    )
                    logger.info(f'Created DICOM file record: {dicom_file.file.name}')
            
            dicom_files = DicomFile.objects.filter(patient=patient).order_by('file')
            
            if not dicom_files.exists():
                return Response({
                    'success': False,
                    'error': 'No DICOM files found for this patient. Please upload DICOM files first.'
                }, status=status.HTTP_404_NOT_FOUND)
            
            models_dir = Path(os.environ.get('ML_MODELS_DIR', settings.BASE_DIR.parent / 'models'))
            model_path = models_dir / 'unet_brain_segmentation-cpu.keras'
            
            if not model_path.exists():
                logger.error(f'Model file not found at {model_path}')
                return Response({
                    'success': False,
                    'error': f'Model file not found at {model_path}. See models/README.md.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Load the model
            model = load_skull_model(str(model_path))
            
            # Process each DICOM file
            processed_images = []
            errors = []
            
            for idx, dicom_file in enumerate(dicom_files):
                try:
                    logger.info(f"Processing DICOM file {idx}: {dicom_file.file.name}")
                    
                    # Read DICOM file using SimpleITK
                    image = sitk.ReadImage(dicom_file.file.path)
                    image_array = sitk.GetArrayFromImage(image)
                    
                    logger.info(f'Original DICOM shape for file {idx}: {image_array.shape}')
                    
                    # Use the improved preprocessing function
                    processed_image = preprocess_image_for_skull_extraction(image_array)
                    
                    if processed_image is None:
                        logger.error(f'Failed to preprocess image {idx}')
                        errors.append(f'Failed to preprocess image {idx}')
                        continue
                    
                    logger.info(f'Preprocessed image shape: {processed_image.shape}')
                    
                    # Get skull mask
                    skull_mask = predict_skull_mask(processed_image, model)
                    logger.info(f'Skull mask shape: {skull_mask.shape}')
                    
                    # Apply mask to the preprocessed image
                    # Remove batch and channel dimensions
                    img_2d = np.squeeze(processed_image)  # Shape should be (176, 208)
                    
                    # Apply skull mask
                    result = img_2d * skull_mask
                    logger.info(f'Result shape after masking: {result.shape}')
                    
                    # Apply CLAHE for better contrast
                    try:
                        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                        result_uint8 = (result * 255).astype(np.uint8)
                        result = clahe.apply(result_uint8).astype(np.float32) / 255.0
                        logger.info('Applied CLAHE successfully')
                    except Exception as e:
                        logger.warning(f'CLAHE failed for image {idx}: {str(e)}')
                    
                    # Apply gamma correction
                    try:
                        result = np.power(result, 1.5)
                        logger.info('Applied gamma correction successfully')
                    except Exception as e:
                        logger.warning(f'Gamma correction failed for image {idx}: {str(e)}')
                    
                    # Save processed image
                    output_dir = os.path.join(settings.MEDIA_ROOT, 'processed_images', str(patient_id))
                    os.makedirs(output_dir, exist_ok=True)
                    output_path = os.path.join(output_dir, f'processed_{idx}.png')
                    
                    # Convert and save as PNG
                    saved_path = convert_skull_to_png(result, output_path)
                    
                    if saved_path is None:
                        logger.error(f'Failed to save PNG for image {idx}')
                        errors.append(f'Failed to save PNG for image {idx}')
                        continue
                    
                    # Create ProcessedImage record
                    # Make the path relative to MEDIA_ROOT for the FileField
                    relative_path = os.path.relpath(output_path, settings.MEDIA_ROOT)
                    
                    processed_image_record = ProcessedImage.objects.create(
                        patient=patient,
                        original_dicom=dicom_file,
                        processed_image=relative_path,
                        slice_number=idx
                    )
                    
                    # Validate that the URL was generated properly
                    image_url = processed_image_record.processed_image.url
                    if not image_url:
                        logger.error(f'Failed to generate URL for processed image {idx}')
                        errors.append(f'Failed to generate URL for image {idx}')
                        continue
                    
                    processed_images.append({
                        'id': processed_image_record.id,
                        'url': image_url,
                        'sequence_number': idx,
                        'original_shape': str(image_array.shape),
                        'processed_shape': str(result.shape)
                    })
                    
                    logger.info(f'Successfully processed image {idx} with URL: {image_url}')
                    
                except Exception as e:
                    logger.error(f'Error processing file {dicom_file.file.name}: {str(e)}')
                    errors.append(f'Error processing file {idx}: {str(e)}')
            
            if not processed_images:
                return Response({
                    'success': False,
                    'error': 'Failed to process any images',
                    'errors': errors
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response({
                'success': True,
                'processed_images': processed_images,
                'total_processed': len(processed_images),
                'total_attempted': len(dicom_files),
                'errors': errors if errors else None
            })
            
        except Exception as e:
            logger.error(f'Error in ProcessDicomView: {str(e)}')
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeleteProcessedImageView(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, image_id):
        try:
            # Get the processed image
            processed_image = get_object_or_404(ProcessedImage, id=image_id)
            
            # Check if user has permission (optional - you can add more specific checks)
            # For now, we'll allow any authenticated user to delete
            
            # Get the file path
            file_path = processed_image.processed_image.path
            
            # Delete the file from the filesystem
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f'Deleted file: {file_path}')
            
            # Delete the database record
            processed_image.delete()
            
            return Response({
                'success': True,
                'message': 'Processed image deleted successfully'
            })
            
        except Exception as e:
            logger.error(f'Error deleting processed image {image_id}: {str(e)}')
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SaveApprovalStatusView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            approved_images = request.data.get('approved_images', [])
            rejected_images = request.data.get('rejected_images', [])
            patient_id = request.data.get('patient_id')
            
            if not patient_id:
                return Response({
                    'success': False,
                    'error': 'Patient ID is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get the patient
            try:
                patient = Patient.objects.get(dossier_id=patient_id)
            except Patient.DoesNotExist:
                return Response({
                    'success': False,
                    'error': 'Patient not found'
                }, status=status.HTTP_404_NOT_FOUND)
            
            # Prepare results for frontend
            segmentation_results = []
            approved_count = 0
            for image_id in approved_images:
                try:
                    processed_image = ProcessedImage.objects.get(id=image_id, patient=patient)
                    logger.info(f'Image {image_id} approved for patient {patient_id}')
                    approved_count += 1

                    # Get processed image path and slice number
                    processed_path = processed_image.processed_image.path
                    slice_number = processed_image.slice_number

                    # Get original image (base64 or file path)
                    original_dicom = processed_image.original_dicom

                    # Generate mask using the processed (skull-stripped) image
                    mask_url = segment_lesions(processed_path, patient.dossier_id, slice_number)

                    segmentation_results.append({
                        'original': original_dicom.file.url if original_dicom else None,
                        'processed': processed_image.processed_image.url,
                        'mask': mask_url,
                        'slice_number': slice_number
                    })
                except ProcessedImage.DoesNotExist:
                    logger.warning(f'Processed image {image_id} not found')
                except Exception as e:
                    logger.error(f'Error generating mask for image {image_id}: {str(e)}')
            
            # For rejected images, they should already be deleted by the frontend
            rejected_count = 0
            for image_id in rejected_images:
                logger.info(f'Image {image_id} rejected for patient {patient_id}')
                rejected_count += 1
            
            return Response({
                'success': True,
                'message': f'Approval status saved successfully. Approved: {approved_count}, Rejected: {rejected_count}',
                'approved_count': approved_count,
                'rejected_count': rejected_count,
                'segmentation_results': segmentation_results
            })
            
        except Exception as e:
            logger.error(f'Error saving approval status: {str(e)}')
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)