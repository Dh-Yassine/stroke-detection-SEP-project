import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UploadForm.css';
import dark_arrow from '../../assets/dark-arrow.png';

const UploadForm = () => {
  const navigate = useNavigate();
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
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required fields
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
    if (files.length === 0) {
      setError('Please upload DICOM files');
      return;
    }

    // Prepare FormData
    const data = new FormData();
    data.append('sequence', formData.sequenceType); // Backend expects 'sequence'
    files.forEach((file) => data.append('file', file));
    Object.entries(formData).forEach(([key, value]) => {
      if (key !== 'sequenceType') {
        data.append(key, value);
      }
    });

    try {
      const accessToken = localStorage.getItem('access_token');
      const response = await axios.post(
        'http://127.0.0.1:8000/api/convert-dicom/',
        data,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      navigate('/results', { state: { imageData: response.data, formData } });
    } catch (err) {
      setError(err.response?.data?.error || 'Error uploading files');
    }
  };

  return (
    <div className='upload-form'>
      <h1>Upload Stroke Risk Data</h1>
      <form onSubmit={handleSubmit}>
        <div className='form-group'>
          <label htmlFor='dicomFolder'>DICOM Folder</label>
          <input
            type='file'
            id='dicomFolder'
            accept='.dcm,.dicom,.zip'
            multiple
            onChange={handleFileChange}
            aria-describedby='dicomFolderHelp'
          />
          <small id='dicomFolderHelp'>Upload DICOM files (.dcm, .dicom) or ZIP</small>
        </div>

        <div className='form-group'>
          <label htmlFor='folderNumber'>Folder Number</label>
          <input
            type='text'
            id='folderNumber'
            name='folderNumber'
            value={formData.folderNumber}
            onChange={handleInputChange}
            placeholder='e.g., STROKE_001'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='sequenceType'>Sequence Type</label>
          <select
            id='sequenceType'
            name='sequenceType'
            value={formData.sequenceType}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select sequence</option>
            <option value='DIFFUS'>DIFFUS</option>
            <option value='FLAIR'>FLAIR</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='age'>Age</label>
          <input
            type='number'
            id='age'
            name='age'
            value={formData.age}
            onChange={handleInputChange}
            min='0'
            max='120'
            placeholder='e.g., 45'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='gender'>Gender</label>
          <select
            id='gender'
            name='gender'
            value={formData.gender}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select gender</option>
            <option value='Male'>Male</option>
            <option value='Female'>Female</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='bmi'>BMI</label>
          <input
            type='number'
            id='bmi'
            name='bmi'
            value={formData.bmi}
            onChange={handleInputChange}
            step='0.1'
            min='0'
            placeholder='e.g., 25.5'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='smokingStatus'>Smoking Status</label>
          <select
            id='smokingStatus'
            name='smokingStatus'
            value={formData.smokingStatus}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select status</option>
            <option value='Never smoked'>Never smoked</option>
            <option value='Formerly smoked'>Formerly smoked</option>
            <option value='Smokes'>Smokes</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='avgGlucoseLevel'>Average Glucose Level</label>
          <input
            type='number'
            id='avgGlucoseLevel'
            name='avgGlucoseLevel'
            value={formData.avgGlucoseLevel}
            onChange={handleInputChange}
            step='0.1'
            min='0'
            placeholder='e.g., 105.2'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='everMarried'>Ever Married</label>
          <select
            id='everMarried'
            name='everMarried'
            value={formData.everMarried}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select option</option>
            <option value='Yes'>Yes</option>
            <option value='No'>No</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='heartDisease'>Heart Disease</label>
          <select
            id='heartDisease'
            name='heartDisease'
            value={formData.heartDisease}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select option</option>
            <option value='0'>0 (No)</option>
            <option value='1'>1 (Yes)</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='hypertension'>Hypertension</label>
          <select
            id='hypertension'
            name='hypertension'
            value={formData.hypertension}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select option</option>
            <option value='0'>0 (No)</option>
            <option value='1'>1 (Yes)</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='residenceType'>Residence Type</label>
          <select
            id='residenceType'
            name='residenceType'
            value={formData.residenceType}
            onChange={handleInputChange}
            required
          >
            <option value='' disabled>Select type</option>
            <option value='Rural'>Rural</option>
            <option value='Urban'>Urban</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor='other'>Other Information</label>
          <textarea
            id='other'
            name='other'
            value={formData.other}
            onChange={handleInputChange}
            placeholder='Additional notes (optional)'
            rows='4'
          />
        </div>

        {error && <div className='error-message'>{error}</div>}

        <button type='submit' className='btn'>
          Share <img src={dark_arrow} alt='Arrow' />
        </button>
      </form>
    </div>
  );
};

export default UploadForm;