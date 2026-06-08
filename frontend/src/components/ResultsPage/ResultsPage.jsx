import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ResultsPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ResultsPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { imageData = {}, formData = {} } = state || {};
  const images = imageData.images || [];
  const validImages = imageData.valid_images || 0;
  const metadata = images[0]?.metadata || {};
  
  // New state for processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImages, setProcessedImages] = useState([]);
  const [showProcessed, setShowProcessed] = useState(false);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Please log in to process images');
      navigate('/login');
    }
  }, [navigate]);

  // Debug: Log the received state
  console.log('Results state:', state);
  console.log('Image data:', imageData);
  console.log('Number of images:', images.length);
  console.log('Valid images:', validImages);
  console.log('Sample image:', images[0]);
  console.log('Metadata:', metadata);

  // Helper function to ensure proper URL formatting
  const formatImageUrl = (url) => {
    if (!url) return null;
    
    // If URL already starts with http/https, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If URL starts with /, it's an absolute path on the server
    if (url.startsWith('/')) {
      return `${API_BASE_URL}${url}`;
    }
    
    // If it's a relative path, add API_BASE_URL and a slash
    return `${API_BASE_URL}/${url}`;
  };

  const handleProcessImages = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Please log in to process images');
        return;
      }

      // Get the patient ID from the URL or state
      const patientId = formData.folderNumber;
      if (!patientId) {
        setError('Patient ID is required');
        return;
      }

      setProcessing(true);
      setError(null);
      setProgress(0);
      setProcessingStatus('Preparing images...');

      // Create FormData to send files
      const formDataToSend = new FormData();
      formDataToSend.append('patient_id', patientId);

      // Convert base64 images to blobs and append to FormData
      const totalImages = images.filter(img => img.image).length;
      let processedImages = 0;

      images.forEach((img, index) => {
        if (img.image) {
          try {
            setProcessingStatus(`Processing image ${index + 1} of ${totalImages}...`);
            
            // The image data is already in base64 format
            const base64Data = img.image;
            
            // Convert base64 to blob
            const byteString = atob(base64Data);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: 'image/png' });
            formDataToSend.append('files', blob, `image_${index}.png`);
            
            processedImages++;
            setProgress((processedImages / totalImages) * 50); // First 50% for preparation
          } catch (err) {
            console.error(`Error processing image ${index}:`, err);
            setError(`Error processing image ${index + 1}. Please try again.`);
          }
        }
      });

      setProcessingStatus('Sending images to server...');
      console.log('Request details:', {
        url: `${API_BASE_URL}/api/process-dicom/${patientId}/`,
        patientId,
        hasToken: !!token,
        fileCount: totalImages
      });

      const response = await axios.post(
        `${API_BASE_URL}/api/process-dicom/${patientId}/`,
        formDataToSend,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const uploadProgress = (progressEvent.loaded / progressEvent.total) * 25; // Next 25% for upload
            setProgress(50 + uploadProgress);
          }
        }
      );

      setProgress(75); // Upload complete
      setProcessingStatus('Processing images on server...');

      if (response.data.success) {
        console.log('Raw processed images response:', response.data.processed_images);
        
        // Format URLs properly and add debugging
        const formattedProcessedImages = response.data.processed_images.map((img, index) => {
          const formattedUrl = formatImageUrl(img.url);
          console.log(`Image ${index}:`, {
            originalUrl: img.url,
            formattedUrl: formattedUrl,
            sequenceNumber: img.sequence_number
          });
          
          return {
            ...img,
            url: formattedUrl
          };
        });
        
        console.log('Formatted processed images:', formattedProcessedImages);
        setProcessedImages(formattedProcessedImages);
        
        if (response.data.message) {
          setError(null); // Clear any previous errors
        }
        setProgress(100);
        setProcessingStatus('Processing complete!');
        
        // Navigate to approval page with the processed images
        setTimeout(() => {
          navigate('/approval', {
            state: {
              originalImages: images,
              processedImages: response.data.processed_images,
              formData: formData
            }
          });
        }, 1000); // Small delay to show completion message
      } else {
        setError(response.data.error || 'Failed to process images');
        setProcessingStatus('Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      if (error.response) {
        console.error('Error response:', error.response);
        if (error.response.status === 401) {
          setError('Your session has expired. Please log in again.');
          localStorage.removeItem('access_token');
          navigate('/login');
        } else if (error.response.status === 404) {
          setError('No DICOM files found for this patient. Please upload DICOM files first.');
        } else {
          setError(error.response.data.error || 'Failed to process images');
        }
      } else {
        setError('Failed to connect to the server');
      }
      setProcessingStatus('Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className='results-page'>
      <h1>Uploaded images</h1>
      <div className='page-layout'>
        <aside className='sidebar'>
          <section className='form-data'>
            <h2>Submitted Information</h2>
            <div className='data-list'>
              <p><strong>Folder Number:</strong> {formData.folderNumber || 'N/A'}</p>
              <p><strong>Sequence Type:</strong> {formData.sequenceType || 'N/A'}</p>
              <p><strong>Age:</strong> {formData.age || 'N/A'}</p>
              <p><strong>Gender:</strong> {formData.gender || 'N/A'}</p>
              <p><strong>BMI:</strong> {formData.bmi || 'N/A'}</p>
              <p><strong>Smoking Status:</strong> {formData.smokingStatus || 'N/A'}</p>
              <p><strong>Average Glucose Level:</strong> {formData.avgGlucoseLevel || 'N/A'}</p>
              <p><strong>Ever Married:</strong> {formData.everMarried || 'N/A'}</p>
              <p><strong>Heart Disease:</strong> {formData.heartDisease || 'N/A'}</p>
              <p><strong>Hypertension:</strong> {formData.hypertension || 'N/A'}</p>
              <p><strong>Residence Type:</strong> {formData.residenceType || 'N/A'}</p>
              <p><strong>Other:</strong> {formData.other || 'None'}</p>
            </div>
          </section>
          <section className='metadata'>
            <h2>DICOM Metadata</h2>
            <div className='data-list'>
              <p><strong>Patient ID:</strong> {metadata.PatientID || 'Unknown'}</p>
              <p><strong>Institution Name:</strong> {metadata.InstitutionName || 'Unknown'}</p>
              <p><strong>Series Date:</strong> {metadata.SeriesDate || 'Unknown'}</p>
              <p><strong>Modality:</strong> {metadata.Modality || 'Unknown'}</p>
              <p><strong>Series Description:</strong> {metadata.SeriesDescription || 'Unknown'}</p>
              <p><strong>Body Part Examined:</strong> {metadata.BodyPartExamined || 'Unknown'}</p>
              <p><strong>Patient Position:</strong> {metadata.PatientPosition || 'Unknown'}</p>
            </div>
          </section>
        </aside>
        <main className='main-content'>
          <section className='images'>
            <div className='images-header'>
              <h2>{showProcessed ? 'Processed Images' : 'Original Images'}</h2>
              <div className='images-actions'>
                <button 
                  className='process-button'
                  onClick={handleProcessImages}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Process Images'}
                </button>
                {processedImages.length > 0 && (
                  <button 
                    className='toggle-button'
                    onClick={() => setShowProcessed(!showProcessed)}
                  >
                    {showProcessed ? 'Show Original' : 'Show Processed'}
                  </button>
                )}
              </div>
            </div>
            {error && <div className='error-message'>{error}</div>}
            <p><strong>Total Images:</strong> {validImages}</p>
            {showProcessed ? (
              processedImages.length > 0 ? (
                <div className='image-grid'>
                  {processedImages.map((img, index) => (
                    <div key={index} className='image-item'>
                      {img.url ? (
                        <img 
                          src={img.url} 
                          alt={`Processed Slice ${img.sequence_number}`}
                          onLoad={() => {
                            console.log(`Successfully loaded image: ${img.url}`);
                          }}
                          onError={(e) => {
                            console.error('Failed to load image:', {
                              url: img.url,
                              sequenceNumber: img.sequence_number,
                              error: e
                            });
                            // Replace with placeholder
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                          }}
                          style={{ maxWidth: '100%', height: 'auto' }}
                        />
                      ) : (
                        <div className="image-placeholder" style={{
                          width: '200px',
                          height: '200px',
                          backgroundColor: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #ddd'
                        }}>
                          <p>No Image URL</p>
                        </div>
                      )}
                      <div className="error-placeholder" style={{
                        display: 'none',
                        width: '200px',
                        height: '200px',
                        backgroundColor: '#ffe6e6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #ff9999',
                        color: '#cc0000'
                      }}>
                        <p>Image Load Failed</p>
                      </div>
                      <p>Slice {img.sequence_number}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No processed images available. Click "Process Images" to generate processed images.</p>
              )
            ) : (
              images.length > 0 ? (
              <div className='image-grid'>
                {images.map((img, index) => (
                  <div key={index} className='image-item'>
                    <img src={`data:image/png;base64,${img.image}`} alt={`Slice ${index}`} />
                    <p>{img.filename}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p>No images available</p>
              )
            )}
          </section>
        </main>
      </div>
      {processing && (
        <div className='processing-overlay'>
          <div className='processing-content'>
            <div className='spinner'></div>
            <div className='processing-status'>{processingStatus}</div>
            <div className='progress-bar'>
              <div 
                className='progress-fill' 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className='progress-text'>{Math.round(progress)}%</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;