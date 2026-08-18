# ML model files (not in Git)

Place these Keras model files in this folder before running the backend:

| File | Used for |
|------|----------|
| `concat_unet_patches_v2_withoutblack.keras` | Lesion segmentation |
| `unet_brain_segmentation-cpu.keras` | Skull / brain extraction |


You can override the directory with the `ML_MODELS_DIR` environment variable in `backend/.env`.
