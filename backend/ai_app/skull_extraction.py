import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
from scipy.ndimage import zoom
import cv2
import os
import SimpleITK as sitk
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

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

def combo_loss(y_true, y_pred):
    bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
    dice = 1 - dice_coef(y_true, y_pred)
    return bce + dice

def preprocess_image_for_skull_extraction(image_array, desired_shape=(176, 208)):
    """
    Preprocess image to match model input requirements
    """
    logger.info(f"Input image shape: {image_array.shape}")
    
    # Handle different input shapes
    if len(image_array.shape) == 3:
        # If it's (3, 512, 512) or similar, we need to handle it properly
        if image_array.shape[0] == 3:  # RGB channels first
            # Convert from RGB to grayscale by taking mean across channels
            image_array = np.mean(image_array, axis=0)
            logger.info(f"Converted RGB to grayscale, new shape: {image_array.shape}")
        elif image_array.shape[2] == 3:  # RGB channels last
            # Convert from RGB to grayscale
            image_array = np.mean(image_array, axis=2)
            logger.info(f"Converted RGB to grayscale, new shape: {image_array.shape}")
        else:
            # If it's a 3D volume, take the middle slice
            middle_slice = image_array.shape[0] // 2
            image_array = image_array[middle_slice]
            logger.info(f"Took middle slice from 3D volume, new shape: {image_array.shape}")
    
    # Ensure we have a 2D image at this point
    if len(image_array.shape) != 2:
        logger.error(f"Unexpected image shape after initial processing: {image_array.shape}")
        return None
    
    logger.info(f"Image shape before resizing: {image_array.shape}")
    
    # Resize to desired shape if needed
    if image_array.shape != desired_shape:
        zoom_factors = (desired_shape[0] / image_array.shape[0], desired_shape[1] / image_array.shape[1])
        image_array = zoom(image_array, zoom_factors, order=1, mode='nearest')
        logger.info(f"Resized image to: {image_array.shape} using zoom factors: {zoom_factors}")
    
    # Normalize to [0, 1]
    min_val, max_val = np.min(image_array), np.max(image_array)
    if max_val > min_val:
        image_array = (image_array - min_val) / (max_val - min_val)
        logger.info(f"Normalized image: min={np.min(image_array)}, max={np.max(image_array)}")
    else:
        logger.warning("Image has constant values, skipping normalization")
    
    # Add batch and channel dimensions: (1, height, width, 1)
    image_array = image_array[np.newaxis, ..., np.newaxis]
    logger.info(f"Final preprocessed shape: {image_array.shape}")
    
    return image_array

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

def predict_skull_mask(image, model):
    patch_height, patch_width = 88, 104
    stride_height, stride_width = 44, 52
    patches, patch_positions = split_into_patches_with_overlap(image, patch_height, patch_width, stride_height, stride_width)
    predicted_patches = model.predict(patches, batch_size=1, verbose=0)
    predicted_mask = reconstruct_from_patches(predicted_patches, image.shape, patch_height, patch_width, stride_height, stride_width, patch_positions)
    predicted_mask = (predicted_mask > 0.01).astype(np.float32)
    return predicted_mask

def load_skull_model(model_path):
    return load_model(model_path, custom_objects={
        'combo_loss': combo_loss,
        'dice_coef': dice_coef,
        'recall': recall
    })

def process_dicom_image(dicom_path, model_path):
    """
    Process a single DICOM image through the complete pipeline
    """
    try:
        # Load the model
        skull_model = load_skull_model(model_path)
        
        # Read DICOM
        if not os.path.exists(dicom_path):
            logger.error(f'DICOM file not found: {dicom_path}')
            return None
            
        ds = sitk.ReadImage(dicom_path)
        if ds is None:
            logger.error(f'Failed to read DICOM file: {dicom_path}')
            return None
            
        img_array = sitk.GetArrayFromImage(ds)
        if img_array is None or img_array.size == 0:
            logger.error(f'Failed to get array from DICOM image: {dicom_path}')
            return None
        
        logger.info(f"Original DICOM image shape: {img_array.shape}")
        
        # Preprocess image (this will handle shape conversion properly)
        img_array = preprocess_image_for_skull_extraction(img_array)
        if img_array is None:
            logger.error(f'Failed to preprocess image: {dicom_path}')
            return None
        
        # Extract skull
        skull_mask = predict_skull_mask(img_array, skull_model)
        if skull_mask is None:
            logger.error(f'Failed to predict skull mask: {dicom_path}')
            return None
        
        # Apply mask to the preprocessed image
        # Remove batch and channel dimensions for processing
        img_2d = np.squeeze(img_array)  # Shape: (176, 208)
        
        # Apply skull mask
        processed_img = img_2d * skull_mask
        
        # Apply CLAHE
        try:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            processed_img = (processed_img * 255).astype(np.uint8)
            processed_img = clahe.apply(processed_img)
        except Exception as e:
            logger.error(f'CLAHE processing failed: {str(e)}')
            # Continue without CLAHE if it fails
            processed_img = (processed_img * 255).astype(np.uint8)
        
        # Apply gamma correction
        try:
            processed_img = np.power(processed_img / 255.0, 1.5) * 255
            processed_img = processed_img.astype(np.float32) / 255.0
        except Exception as e:
            logger.error(f'Gamma correction failed: {str(e)}')
            # Continue without gamma correction if it fails
            processed_img = processed_img.astype(np.float32) / 255.0
        
        logger.info(f"Final processed image shape: {processed_img.shape}")
        return processed_img
        
    except Exception as e:
        logger.error(f'Error in process_dicom_image: {str(e)}')
        return None

def convert_to_png(image_array, output_path):
    """
    Convert processed image array to PNG format
    
    Args:
        image_array: numpy array of the processed image
        output_path: path where to save the PNG file
    """
    try:
        # Ensure the image is in the correct range (0-255)
        if image_array.max() <= 1.0:
            png_image = (image_array * 255).astype(np.uint8)
        else:
            png_image = np.clip(image_array, 0, 255).astype(np.uint8)
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Save as PNG
        success = cv2.imwrite(output_path, png_image)
        if not success:
            logger.error(f"Failed to save PNG to {output_path}")
            return None
        
        logger.info(f"Successfully saved PNG to {output_path}")
        return output_path
    except Exception as e:
        logger.error(f"Error converting to PNG: {str(e)}")
        return None