import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './FileUploader.css';
import axios from 'axios';
import dark_arrow from '../../assets/dark-arrow.png';

const FileUploader = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [isFolderUpload, setIsFolderUpload] = useState(false);
  const [formData, setFormData] = useState({
    folderNumber: '',
    sequenceType: '',
    age: '',
    gender: '',
    bmi: '',
    smokingStatus: '',
    avgGlucoseLevel: '',
    everMarried: '',
    heartDisease: '',
    hypertension: '',
    residenceType: '',
    other: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const isDICOMFile = async (file) => {
    try {
      const arrayBuffer = await file.slice(128, 255).arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const dicomMagic = String.fromCharCode(...uint8Array.slice(0, 4));
      return dicomMagic === 'DICM';
    } catch (err) {
      console.error(`Error reading file ${file.name}:`, err);
      return false;
    }
  };

  const filterDicomFiles = async (fileList) => {
    console.log(`Filtering ${fileList.length} files`);
    const filtered = [];
    for (const file of Array.from(fileList)) {
      if (!file.name || typeof file.name !== 'string') {
        console.log(`Invalid file object:`, file);
        continue;
      }
      const extension = file.name.split('.').pop()?.toLowerCase() || 'none';
      const hasValidExtension = extension === 'dcm' || extension === 'dicom';
      let isValid = hasValidExtension;
      if (!hasValidExtension) {
        isValid = await isDICOMFile(file);
      }
      console.log(`File: ${file.webkitRelativePath || file.name}, Extension: ${extension}, Valid: ${isValid}`);
      if (isValid) filtered.push(file);
    }
    console.log(`Filtered ${filtered.length} files from ${fileList.length} total`);
    return filtered;
  };

  const processSelectedFiles = async (selectedFiles) => {
    console.log('Selected files raw:', selectedFiles);
    if (!selectedFiles || !selectedFiles.length) {
      console.log('No files selected or invalid file input');
      setFiles([]);
      setIsFolderUpload(false);
      setError('No files selected. Please choose DICOM files.');
      setStatusMessage('');
      return;
    }
    const fileNames = Array.from(selectedFiles).map(f => f.name);
    console.log('Selected files:', fileNames);
    const dicomFiles = await filterDicomFiles(selectedFiles);
    setFiles(dicomFiles);
    setIsFolderUpload(false);
    setError(null);
    setStatusMessage(
      dicomFiles.length > 0
        ? `Selected ${dicomFiles.length} DICOM file(s). Ensure files have a SeriesDescription including the selected sequence (e.g., "DWI_b1000" or "Diffusion" for DWI/DIFF, "T2_FLAIR" for FLAIR).`
        : 'No valid DICOM files found. Please select files with .dcm/.dicom extensions or valid DICOM content.'
    );
  };

  const processFolderSelection = async (selectedFiles) => {
    console.log('Folder files raw:', selectedFiles);
    if (!selectedFiles || !selectedFiles.length) {
      console.log('No files in folder or invalid folder input');
      setFiles([]);
      setIsFolderUpload(true);
      setError('No files found in the selected folder.');
      setStatusMessage('');
      return;
    }
    const fileNames = Array.from(selectedFiles).map(f => f.webkitRelativePath || f.name);
    console.log('Folder files:', fileNames);
    const dicomFiles = await filterDicomFiles(selectedFiles);
    setFiles(dicomFiles);
    setIsFolderUpload(true);
    setError(null);
    setStatusMessage(
      dicomFiles.length > 0
        ? `Selected folder containing ${dicomFiles.length} DICOM file(s). Ensure files have a SeriesDescription including the selected sequence (e.g., "DWI_b1000" or "Diffusion" for DWI/DIFF, "T2_FLAIR" for FLAIR).`
        : 'No valid DICOM files found in the folder. Please select a folder with .dcm/.dicom files or valid DICOM content.'
    );
  };

  const handleFileChange = async (event) => {
    console.log('File input changed, webkitdirectory:', event.target.webkitdirectory, 'Files count:', event.target.files ? event.target.files.length : 'undefined');
    if (!event.target.files) {
      console.log('No files provided in event.target.files');
      setError('No files selected. Please try again.');
      return;
    }
    const inputIsFolder = event.target.webkitdirectory === true;
    if (inputIsFolder) {
      await processFolderSelection(event.target.files);
    } else {
      await processSelectedFiles(event.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = null;
    if (folderInputRef.current) folderInputRef.current.value = null;
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setError(null);
    setStatusMessage('Processing dropped items...');
    const items = event.dataTransfer.items;
    let droppedFiles = [];
    let containsFolder = false;

    const processEntry = async (entry) => {
      if (entry.isFile) {
        return new Promise((resolve) => entry.file(resolve));
      } else if (entry.isDirectory) {
        containsFolder = true;
        const reader = entry.createReader();
        return new Promise((resolve) => {
          const entries = [];
          const readEntries = () => {
            reader.readEntries(async (batch) => {
              if (batch.length > 0) {
                entries.push(...batch);
                readEntries();
              } else {
                const files = [];
                for (const subEntry of entries) {
                  const processedSubEntry = await processEntry(subEntry);
                  if (Array.isArray(processedSubEntry)) {
                    files.push(...processedSubEntry);
                  } else if (processedSubEntry) {
                    files.push(processedSubEntry);
                  }
                }
                resolve(files);
              }
            }, (err) => {
              console.error("Error reading directory entries:", err);
              resolve([]);
            });
          };
          readEntries();
        });
      }
      return null;
    };

    const filePromises = [];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
        if (entry) {
          filePromises.push(processEntry(entry));
        }
      }
    }

    try {
      const results = await Promise.all(filePromises);
      droppedFiles = results.filter(result => result !== null).flat();
      console.log('Dropped files:', droppedFiles.map(f => f.webkitRelativePath || f.name));
      if (containsFolder) {
        await processFolderSelection(droppedFiles);
      } else {
        await processSelectedFiles(droppedFiles);
      }
    } catch (err) {
      console.error('Error processing dropped items:', err);
      setError('Error processing dropped folder/files.');
      setStatusMessage('');
      setFiles([]);
      setIsFolderUpload(false);
    }
  };

  const handleClearFiles = () => {
    setFiles([]);
    setStatusMessage('');
    setError(null);
    setIsFolderUpload(false);
    if (fileInputRef.current) fileInputRef.current.value = null;
    if (folderInputRef.current) folderInputRef.current.value = null;
  };

  const handleProceedToForm = () => {
    console.log('Proceed to form - files count:', files.length, 'isUploading:', isUploading);
    if (files.length === 0) {
      setError('Please select valid DICOM files.');
      return;
    }
    if (files.length < 30) {
      setError('Warning: Selected less than 30 DICOM files. Ensure the selection contains at least 30 valid DICOM files for a complete series.');
    }
    setStatusMessage(
      `Ensure selected DICOM files have a SeriesDescription including the selected sequence (e.g., "DWI_b1000" or "Diffusion" for DWI/DIFF, "T2_FLAIR" for FLAIR).`
    );
    setStep(2);
    setError(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    if (name === 'sequenceType' && value) {
      setStatusMessage(
        `Selected sequence type: ${value}. Ensure selected DICOM files have a SeriesDescription including "${value === 'DIFF' ? 'DWI or Diffusion' : 'FLAIR'}" (e.g., "${value === 'DIFF' ? 'DWI_b1000' : 'T2_FLAIR'}").`
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const requiredFields = [
      'folderNumber',
      'sequenceType',
      'age',
      'gender',
      'bmi',
      'smokingStatus',
      'avgGlucoseLevel',
      'everMarried',
      'heartDisease',
      'hypertension',
      'residenceType',
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        setError(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return;
      }
    }

    const data = new FormData();
    files.forEach((file) => {
      const filePath = file.webkitRelativePath || file.name;
      console.log(`Appending file: ${filePath}`);
      data.append('file', file, filePath);
    });

    Object.entries(formData).forEach(([key, value]) => {
      data.append(key, value);
    });

    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage('Uploading files...');

    try {
      const accessToken = localStorage.getItem('access_token');
      if (!accessToken) {
        throw new Error('You must be logged in to upload files.');
      }

      const response = await axios.post(
        'http://localhost:8000/api/convert-dicom/',
        data,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          onUploadProgress: (progressEvent) => {
            const totalSize = files.reduce((sum, f) => sum + f.size, 1);
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || totalSize)
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      console.log('API Response:', response.data);
      const { valid_dicom = 0, valid_images = 0 } = response.data;
      setStatusMessage(`Processing successful! ${valid_dicom} DICOM files processed, ${valid_images} images generated. Redirecting...`);
      navigate('/results', {
        state: {
          imageData: {
            images: response.data.images || [],
            valid_images: response.data.valid_images || 0,
          },
          formData,
          backendResponse: response.data,
        },
      });
    } catch (err) {
      console.error('Error during upload or conversion:', err);
      let errorMsg = 'An error occurred during upload or processing.';
      if (err.response) {
        if (err.response.status === 401) {
          errorMsg = 'Authentication error. Please log in again.';
          navigate('/login');
        } else if (err.response.status === 404) {
          errorMsg = 'API endpoint not found. Please check the server URL or contact support.';
        } else if (err.response.data && err.response.data.error) {
          errorMsg = err.response.data.error;
          if (err.response.data.error.includes('No valid DICOM files found')) {
            errorMsg += ' Use a DICOM viewer or script to verify the SeriesDescription of your files.';
          }
        } else {
          errorMsg = `Server error: ${err.response.status}. Please check logs or ensure files are valid.`;
        }
      } else if (err.request) {
        errorMsg = 'No response from server. Please check your connection.';
      } else {
        errorMsg = err.message || 'Error uploading files';
      }
      setError(errorMsg);
      setStatusMessage('');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="uploader-container">
      {step === 1 ? (
        <>
          <h1>Upload DICOM Files or Folder</h1>
          <p className="info-text">
            Select individual DICOM files with .dcm or .dicom extension, or a folder containing DICOM files.
            Files without extensions may be accepted if they are valid DICOM files.
            Ensure files have a SeriesDescription including the sequence type (e.g., "DWI_b1000" or "Diffusion" for DWI/DIFF, "T2_FLAIR" for FLAIR).
            You can also drag and drop files or a folder.
          </p>
          <div
            className={`drop-zone ${files.length > 0 ? 'has-file' : ''} ${
              isUploading ? 'uploading' : ''
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".dcm,.dicom,*/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="fileInput"
              ref={fileInputRef}
              multiple
            />
            <input
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="folderInput"
              ref={folderInputRef}
              webkitdirectory="true"
              directory="true"
            />
            <div className="upload-options">
              <label htmlFor="fileInput" className="upload-label-button btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                Select DICOM Files
              </label>
              <span> or </span>
              <label htmlFor="folderInput" className="upload-label-button btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                </svg>
                Select Folder
              </label>
            </div>
            <p className="drop-text">or drag and drop files/folder here</p>
            {statusMessage && !isUploading && (
              <div className="status-message selection-message">{statusMessage}</div>
            )}
          </div>
          {files.length > 0 && (
            <button
              type="button"
              className="btn clear-btn"
              onClick={handleClearFiles}
              disabled={isUploading}
            >
              Clear Selection
            </button>
          )}
          {isUploading && (
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="progress-text">{statusMessage} ({uploadProgress}%)</p>
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
          <button
            className="primary"
            disabled={isUploading || files.length === 0}
            onClick={handleProceedToForm}
          >
            Proceed to Form <img src={dark_arrow} alt="Arrow" />
          </button>
        </>
      ) : (
        <>
          <h1>Enter Patient Information</h1>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="folderNumber">Folder Number</label>
              <input
                type="text"
                id="folderNumber"
                name="folderNumber"
                value={formData.folderNumber}
                onChange={handleInputChange}
                placeholder="e.g., STROKE_001"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="sequenceType">Sequence Type</label>
              <select
                id="sequenceType"
                name="sequenceType"
                value={formData.sequenceType}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select sequence
                </option>
                <option value="DIFF">DWI/DIFF</option>
                <option value="FLAIR">FLAIR</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="age">Age</label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                min="0"
                max="120"
                placeholder="e.g., 45"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select gender
                </option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="bmi">BMI</label>
              <input
                type="number"
                id="bmi"
                name="bmi"
                value={formData.bmi}
                onChange={handleInputChange}
                step="0.1"
                min="0"
                placeholder="e.g., 25.5"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="smokingStatus">Smoking Status</label>
              <select
                id="smokingStatus"
                name="smokingStatus"
                value={formData.smokingStatus}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select status
                </option>
                <option value="Never smoked">Never smoked</option>
                <option value="Formerly smoked">Formerly smoked</option>
                <option value="Smokes">Smokes</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="avgGlucoseLevel">Average Glucose Level</label>
              <input
                type="number"
                id="avgGlucoseLevel"
                name="avgGlucoseLevel"
                value={formData.avgGlucoseLevel}
                onChange={handleInputChange}
                step="0.1"
                min="0"
                placeholder="e.g., 1.6"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="everMarried">Ever Married</label>
              <select
                id="everMarried"
                name="everMarried"
                value={formData.everMarried}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select option
                </option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="heartDisease">Heart Disease</label>
              <select
                id="heartDisease"
                name="heartDisease"
                value={formData.heartDisease}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select option
                </option>
                <option value="0">0</option>
                <option value="1">1</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="hypertension">Hypertension</label>
              <select
                id="hypertension"
                name="hypertension"
                value={formData.hypertension}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select option
                </option>
                <option value="0">0</option>
                <option value="1">1</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="residenceType">Residence Type</label>
              <select
                id="residenceType"
                name="residenceType"
                value={formData.residenceType}
                onChange={handleInputChange}
                required
              >
                <option value="" disabled>
                  Select type
                </option>
                <option value="Rural">Rural</option>
                <option value="Urban">Urban</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="other">Other Information</label>
              <textarea
                id="other"
                name="other"
                value={formData.other}
                onChange={handleInputChange}
                placeholder="Additional notes (optional)"
                rows="4"
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            {statusMessage && <div className="status-message">{statusMessage}</div>}
            <div className="form-buttons">
              <button
                type="button"
                className="btn"
                onClick={() => setStep(1)}
                disabled={isUploading}
              >
                Back to File Upload
              </button>
              <button
                type="submit"
                className={`btn submit-btn ${isUploading ? 'disabled' : ''}`}
                disabled={isUploading}
              >
                Upload <img src={dark_arrow} alt="Submit" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default FileUploader;
