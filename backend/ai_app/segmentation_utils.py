import os
import numpy as np
import SimpleITK as sitk
import tensorflow as tf
from tensorflow.keras.models import load_model
from django.conf import settings
from auth_app.models import Patient
from scipy.ndimage import zoom
from PIL import Image

def dice_coef(y_true, y_pred, smooth=1):
    y_true_f = tf.cast(y_true, tf.float32)
    y_pred_f = tf.cast(y_pred, tf.float32)
    intersection = tf.reduce_sum(y_true_f * y_pred_f)
    return (2. * intersection + smooth) / (tf.reduce_sum(y_true_f) + tf.reduce_sum(y_pred_f) + smooth)

def recall(y_true, y_pred):
    y_true_f = tf.cast(y_true, tf.float32)
    y_pred_f = tf.cast(y_pred > 0.5, tf.float32)
    true_positives = tf.reduce_sum(y_true_f * y_pred_f)
    possible_positives = tf.reduce_sum(y_true_f)
    return true_positives / (possible_positives + tf.keras.backend.epsilon())

def weighted_binary_crossentropy(y_true, y_pred):
    y_true = tf.cast(y_true, tf.float32)
    y_pred = tf.clip_by_value(y_pred, tf.keras.backend.epsilon(), 1 - tf.keras.backend.epsilon())
    bce = - (y_true * tf.math.log(y_pred) + (1.0 - y_true) * tf.math.log(1.0 - y_pred))
    weights = y_true * 10.0 + (1.0 - y_true) * 1.0
    return tf.reduce_mean(bce * weights)

from pathlib import Path

def _models_dir():
    env_dir = os.environ.get('ML_MODELS_DIR')
    if env_dir:
        return Path(env_dir)
    return Path(settings.BASE_DIR).parent / 'models'

def _load_segmentation_model():
    model_path = _models_dir() / 'concat_unet_patches_v2_withoutblack.keras'
    if not model_path.exists():
        raise FileNotFoundError(
            f'Model file not found at {model_path}. '
            'Place the .keras file in the models/ folder (see models/README.md).'
        )
    return load_model(str(model_path), custom_objects={
        'dice_coef': dice_coef,
        'recall': recall,
        'weighted_binary_crossentropy': weighted_binary_crossentropy
    })

_segmentation_model = None

def _get_segmentation_model():
    global _segmentation_model
    if _segmentation_model is None:
        _segmentation_model = _load_segmentation_model()
    return _segmentation_model

def split_into_patches_with_overlap(image, patch_height, patch_width, stride_height, stride_width):
    height, width = image.shape[1], image.shape[2]
    patches = []
    patch_positions = []
    for i in range(0, height - patch_height + 1, stride_height):
        for j in range(0, width - patch_width + 1, stride_width):
            patch = image[0, i:i+patch_height, j:j+patch_width, 0]
            patch = patch[..., np.newaxis]
            patches.append(patch)
            patch_positions.append((i, j))
    patches = np.array(patches)
    return patches, patch_positions

def reconstruct_from_patches(patches, original_shape, patch_height, patch_width, stride_height, stride_width, patch_positions):
    height, width = original_shape[1], original_shape[2]
    reconstructed = np.zeros((height, width), dtype=np.float32)
    weights = np.zeros((height, width), dtype=np.float32)
    for idx, (i, j) in enumerate(patch_positions):
        patch_slice = patches[idx, :, :, 0]
        reconstructed[i:i+patch_height, j:j+patch_width] += patch_slice
        weights[i:i+patch_height, j:j+patch_width] += 1
    reconstructed /= np.maximum(weights, 1e-8)
    return reconstructed

def segment_lesions(image_path, patient_id, slice_number):
    try:
        # Read the processed PNG image which is the output of the first model
        image = sitk.ReadImage(image_path)
        img_array = sitk.GetArrayFromImage(image)

        # The model expects a 2D grayscale image. If it's read as RGB, take one channel.
        if img_array.ndim == 3:
            img_array = img_array[:, :, 0]

        # Verify shape
        expected_shape = (176, 208)
        if img_array.shape != expected_shape:
            raise ValueError(f"Image must be of size {expected_shape}, but it is {img_array.shape}")

        # Normalize the image array to the 0-1 range for the model
        img_array = img_array.astype(np.float32) / 255.0

        # Add batch and channel dimensions for model input
        img_array = img_array[np.newaxis, ..., np.newaxis]

        # Use the segmentation model to predict the mask
        patch_height, patch_width = 88, 104
        stride_height, stride_width = 44, 52
        patches, patch_positions = split_into_patches_with_overlap(img_array, patch_height, patch_width, stride_height, stride_width)
        predicted_patches = _get_segmentation_model().predict(patches, batch_size=1, verbose=0)
        mask = reconstruct_from_patches(predicted_patches, img_array.shape, patch_height, patch_width, stride_height, stride_width, patch_positions)
        mask = (mask > 0.5).astype(np.uint8)

        # The patient_id parameter holds the dossier_id from the view
        try:
            patient = Patient.objects.get(dossier_id=patient_id)
            dossier_id = patient.dossier_id
        except Patient.DoesNotExist:
            raise Exception(f"Patient with dossier_id {patient_id} not found.")

        mask_dir = os.path.join(settings.MEDIA_ROOT, 'mask', str(dossier_id))
        os.makedirs(mask_dir, exist_ok=True)

        # Save the mask as a NIfTI file for records
        nifti_filename = f"slice_{slice_number:03d}.nii.gz"
        nifti_path = os.path.join(mask_dir, nifti_filename)
        mask_nifti = sitk.GetImageFromArray(mask)
        sitk.WriteImage(mask_nifti, nifti_path, True)

        # Save a visual PNG of the mask for the frontend
        mask_png_array = mask * 255
        png_image = Image.fromarray(mask_png_array.astype(np.uint8))
        png_filename = f"mask_slice_{slice_number:03d}.png"
        png_path = os.path.join(mask_dir, png_filename)
        png_image.save(png_path)

        # Return the URL for the mask PNG
        mask_url = f"{settings.MEDIA_URL}mask/{dossier_id}/{png_filename}"
        return mask_url
    except Exception as e:
        raise Exception(f"Erreur lors de la segmentation: {str(e)}") 