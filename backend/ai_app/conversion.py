
import os
import pydicom
import logging
from collections import defaultdict
from pydicom.errors import InvalidDicomError
import nibabel as nib
import numpy as np
from PIL import Image
import base64
import io
import subprocess
import shutil

logger = logging.getLogger(__name__)

def anonymize_dicom_files(input_dir, anon_dir, sequence):
    try:
        os.makedirs(anon_dir, exist_ok=True)
        total_files_attempted = 0
        valid_dicom_processed = 0
        skipped_or_invalid = 0
        skip_reasons = defaultdict(int)
        metadata = None
        series_groups = defaultdict(list)
        unique_descriptions = set()
        processed_files = []
        metadata_log = []

        files = []
        for root, _, filenames in os.walk(input_dir):
            for filename in filenames:
                files.append(os.path.relpath(os.path.join(root, filename), input_dir))

        total_files_attempted = len(files)

        if not files:
            logger.error(f"No files found in {input_dir}")
            return None, 0, 0, 0, defaultdict(list), unique_descriptions, []

        logger.info(f"Found {len(files)} files in {input_dir}")

        for relative_path in sorted(files):
            file_path = os.path.join(input_dir, relative_path)
            try:
                ds = pydicom.dcmread(file_path, force=True)

                if not hasattr(ds, 'PixelData'):
                    skip_reasons['no_pixel_data'] += 1
                    skipped_or_invalid += 1
                    continue

                series_description = str(ds.get('SeriesDescription', 'None')).upper()
                unique_descriptions.add(series_description)
                metadata_log.append({
                    'file': relative_path,
                    'SeriesDescription': series_description,
                    'Modality': str(ds.get('Modality', 'Unknown')),
                    'SeriesInstanceUID': str(ds.get('SeriesInstanceUID', 'Unknown'))
                })

                if sequence.upper() not in series_description and 'DWI' not in series_description:
                    skip_reasons[f'sequence_mismatch_{series_description}'] += 1
                    skipped_or_invalid += 1
                    continue

                series_uid = str(ds.get('SeriesInstanceUID', 'single_series'))
                series_groups[series_uid].append(relative_path)

                if metadata is None:
                    metadata = {
                        'PatientID': str(ds.get('PatientID', 'Unknown')),
                        'InstitutionName': str(ds.get('InstitutionName', 'Unknown')),
                        'SeriesDate': str(ds.get('SeriesDate', 'Unknown')),
                        'Modality': str(ds.get('Modality', 'Unknown')),
                        'SeriesDescription': str(ds.get('SeriesDescription', 'Unknown')),
                        'BodyPartExamined': str(ds.get('BodyPartExamined', 'Unknown')),
                        'PatientPosition': str(ds.get('PatientPosition', 'Unknown')),
                    }

                if 'PatientName' in ds:
                    ds.PatientName = ''
                anon_file_path = os.path.join(anon_dir, relative_path)
                os.makedirs(os.path.dirname(anon_file_path), exist_ok=True)
                ds.save_as(anon_file_path)
                valid_dicom_processed += 1
                processed_files.append(relative_path)

            except InvalidDicomError:
                skip_reasons['invalid_dicom'] += 1
                skipped_or_invalid += 1
                continue
            except Exception as e:
                skip_reasons[f'error_{str(e)[:50]}'] += 1
                skipped_or_invalid += 1
                continue

        logger.info(f"Metadata for processed files: {metadata_log[:50]}{'...' if len(metadata_log) > 50 else ''}")
        if skipped_or_invalid:
            logger.info(f"Skipped {skipped_or_invalid} files. Reasons: {dict(skip_reasons)}")

        if valid_dicom_processed == 0:
            logger.error(f"No valid DICOM files processed for sequence '{sequence}'. Attempted: {total_files_attempted}, Skipped: {skipped_or_invalid}, Reasons: {dict(skip_reasons)}")
            return None, total_files_attempted, 0, skipped_or_invalid, defaultdict(list), unique_descriptions, []

        logger.info(f"Anonymization complete. Attempted: {total_files_attempted}, Valid: {valid_dicom_processed}, Skipped: {skipped_or_invalid}, Series count: {len(series_groups)}")
        return metadata, total_files_attempted, valid_dicom_processed, skipped_or_invalid, series_groups, unique_descriptions, processed_files

    except Exception as e:
        logger.error(f"Anonymization process failed: {str(e)}")
        return None, 0, 0, 0, defaultdict(list), set(), []

def convert_to_nifti(anon_dir, output_dir, series_groups):
    try:
        os.makedirs(output_dir, exist_ok=True)
        nifti_files = []
        total_nifti = len(series_groups)
        valid_nifti = 0
        invalid_nifti = 0

        logger.info(f"Converting {total_nifti} series to NIfTI")

        for series_uid, filenames in series_groups.items():
            series_dir = os.path.join(anon_dir, os.path.dirname(filenames[0])) if filenames[0].split(os.sep)[0] else anon_dir
            series_dir = os.path.normpath(os.path.abspath(series_dir))
            logger.info(f"Processing series {series_uid} in {series_dir}")

            anon_files = []
            for root, _, files in os.walk(series_dir):
                for f in files:
                    anon_files.append(os.path.relpath(os.path.join(root, f), series_dir))
            logger.info(f"Found {len(anon_files)} files in {series_dir}")

            if not anon_files:
                logger.warning(f"No files found in {series_dir}")
                invalid_nifti += 1
                continue

            output_nifti_dir = os.path.join(output_dir, series_uid)
            os.makedirs(output_nifti_dir, exist_ok=True)

            cmd = [
                'C:/dcm2niix/dcm2niix.exe',
                '-f', f'{series_uid}_%s',
                '-o', output_nifti_dir,
                '-z', 'y',
                series_dir
            ]
            logger.info(f"Running dcm2niix: {' '.join(cmd)}")
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                logger.info(f"dcm2niix stdout: {result.stdout}")
            except subprocess.CalledProcessError as e:
                logger.error(f"dcm2niix failed for {series_uid}: {e.stderr}")
                invalid_nifti += 1
                continue
            except FileNotFoundError:
                logger.error("dcm2niix executable not found at C:/dcm2niix/dcm2niix.exe")
                invalid_nifti += 1
                continue
            except Exception as e:
                logger.error(f"dcm2niix unexpected error for {series_uid}: {str(e)}")
                invalid_nifti += 1
                continue

            for f in os.listdir(output_nifti_dir):
                if f.endswith('.nii.gz'):
                    nifti_path = os.path.join(output_nifti_dir, f)
                    try:
                        nib.load(nifti_path)
                        nifti_files.append(nifti_path)
                        valid_nifti += 1
                        logger.info(f"Generated NIfTI: {nifti_path}")
                    except Exception as e:
                        logger.warning(f"Invalid NIfTI {nifti_path}: {str(e)}")
                        invalid_nifti += 1

        logger.info(f"NIfTI conversion complete. Total: {total_nifti}, Valid: {valid_nifti}, Invalid: {invalid_nifti}")
        return nifti_files, total_nifti, valid_nifti, invalid_nifti

    except Exception as e:
        logger.error(f"NIfTI conversion failed: {str(e)}")
        return [], 0, 0, total_nifti

def convert_to_png(nifti_files, output_dir, metadata):
    try:
        os.makedirs(output_dir, exist_ok=True)
        images = []
        valid_images = 0

        if not nifti_files:
            logger.error("No NIfTI files provided for PNG conversion")
            return [], 0

        logger.info(f"Converting {len(nifti_files)} NIfTI files to PNG in {output_dir}")

        for nifti_file in nifti_files:
            try:
                nifti_img = nib.load(nifti_file)
                data = nifti_img.get_fdata()
                logger.debug(f"NIfTI {nifti_file} shape: {data.shape}")

                if data.ndim == 4:
                    volume_data = data[:, :, :, 0]
                elif data.ndim == 3:
                    volume_data = data
                else:
                    logger.warning(f"NIfTI {nifti_file} has invalid dimensions: {data.shape}, skipping")
                    continue

                num_slices = volume_data.shape[2]

                for slice_idx in range(num_slices):
                    slice_data = volume_data[:, :, slice_idx]
                    slice_data = np.rot90(slice_data)

                    slice_min = slice_data.min()
                    slice_max = slice_data.max()
                    if slice_max > slice_min:
                        slice_data = ((slice_data - slice_min) / (slice_max - slice_min) * 255).astype(np.uint8)
                    else:
                        logger.warning(f"Slice {slice_idx} in {nifti_file} has no valid range, using zeros")
                        slice_data = np.zeros_like(slice_data, dtype=np.uint8)

                    img = Image.fromarray(slice_data, mode='L')
                    img = img.convert('RGB')

                    filename = f"slice_{valid_images:04d}.png"
                    output_path = os.path.join(output_dir, filename)
                    img.save(output_path, format='PNG')
                    logger.debug(f"Saved PNG: {output_path}")

                    buffered = io.BytesIO()
                    img.save(buffered, format='PNG')
                    img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

                    images.append({
                        'filename': filename,
                        'image': img_base64,
                        'metadata': metadata
                    })
                    valid_images += 1

            except Exception as e:
                logger.error(f"Failed to convert {nifti_file} to PNG: {str(e)}")
                continue

        if not images:
            logger.error(f"PNG conversion produced no images. Valid: {valid_images}, NIfTI files: {len(nifti_files)}")
        else:
            logger.info(f"PNG conversion complete. Valid: {valid_images}, Images: {len(images)}")
        return images, valid_images

    except Exception as e:
        logger.error(f"PNG conversion failed globally: {str(e)}")
        return [], 0
