import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ImageApprovalPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ImageApprovalPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { originalImages = [], processedImages = [], formData = {} } = state || {};
  const metadata = originalImages[0]?.metadata || {};
  
  const [approvalStatus, setApprovalStatus] = useState({});
  const [currentProcessedImages, setCurrentProcessedImages] = useState(processedImages);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [imageLoadStates, setImageLoadStates] = useState({});

  // URL formatting function (same as ResultsPage)
  const formatImageUrl = (url) => {
    console.log('Formatting URL:', url);
    
    if (!url) {
      console.warn('URL is null or undefined');
      return null;
    }
    
    if (typeof url !== 'string') {
      console.warn('URL is not a string:', typeof url, url);
      return null;
    }
    
    // If it's already a full URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('URL is already full:', url);
      return url;
    }
    
    // If it starts with /media/, make it a full URL
    if (url.startsWith('/media/')) {
      const fullUrl = `${API_BASE_URL}${url}`;
      console.log('Adding API_BASE_URL to /media/ URL:', fullUrl);
      return fullUrl;
    }
    
    // If it doesn't start with /media/, add it
    if (!url.startsWith('/media/')) {
      const fullUrl = `${API_BASE_URL}/media/${url}`;
      console.log('Adding /media/ prefix to URL:', fullUrl);
      return fullUrl;
    }
    
    console.log('Returning URL as is:', url);
    return url;
  };

  // Format processed images URLs on component mount
  useEffect(() => {
    if (processedImages.length > 0) {
      console.log('Original processed images:', processedImages);
      const formattedImages = processedImages.map(img => {
        const formattedUrl = formatImageUrl(img.url);
        console.log(`Formatting URL for image ${img.id}:`, {
          originalUrl: img.url,
          formattedUrl: formattedUrl,
          sequenceNumber: img.sequence_number
        });
        
        // Skip images with missing or invalid URLs
        if (!formattedUrl) {
          console.warn(`Skipping image ${img.id} - no valid URL`);
          return null;
        }
        
        return {
          ...img,
          url: formattedUrl
        };
      }).filter(img => img !== null); // Remove null entries
      
      console.log('Formatted processed images:', formattedImages);
      setCurrentProcessedImages(formattedImages);
    }
  }, [processedImages]);

  // Check authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Please log in to approve images');
      navigate('/login');
    }
  }, [navigate]);

  // Initialize approval status for all processed images
  useEffect(() => {
    const initialStatus = {};
    currentProcessedImages.forEach((img, index) => {
      initialStatus[img.id] = 'approved'; // Auto-approve all images when processed
    });
    setApprovalStatus(initialStatus);
  }, [currentProcessedImages]);

  const handleApprove = (imageId) => {
    setApprovalStatus(prev => ({
      ...prev,
      [imageId]: prev[imageId] === 'approved' ? 'pending' : 'approved'
    }));
  };

  const handleReject = async (imageId) => {
    const currentStatus = approvalStatus[imageId];
    
    // If already rejected, toggle back to pending
    if (currentStatus === 'rejected') {
      setApprovalStatus(prev => ({
        ...prev,
        [imageId]: 'pending'
      }));
      return;
    }
    
    // If approving or pending, reject and delete from server but keep in UI
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Please log in to reject images');
        return;
      }

      // Call backend to delete the processed image from server
      const response = await axios.delete(
        `${API_BASE_URL}/api/delete-processed-image/${imageId}/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        // Mark as rejected in UI but keep the image visible
        setApprovalStatus(prev => ({
          ...prev,
          [imageId]: 'rejected'
        }));
        console.log('Image rejected and deleted from server successfully');
      } else {
        setError('Failed to reject image');
      }
    } catch (error) {
      console.error('Error rejecting image:', error);
      setError('Failed to reject image. Please try again.');
    }
  };

  const handleSubmitApprovals = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Please log in to submit approvals');
        return;
      }

      const approvedImages = currentProcessedImages.filter(img => approvalStatus[img.id] === 'approved');
      const rejectedImages = currentProcessedImages.filter(img => approvalStatus[img.id] === 'rejected');

      // Call backend to save approval status
      const response = await axios.post(
        `${API_BASE_URL}/api/save-approval-status/`,
        {
          approved_images: approvedImages.map(img => img.id),
          rejected_images: rejectedImages.map(img => img.id),
          patient_id: formData.folderNumber
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        // Navigate to segmentation results page with the returned data
        navigate('/segmentation-results', {
          state: {
            segmentationResults: response.data.segmentation_results || [],
            formData: formData
          }
        });
      } else {
        setError('Failed to save approval status');
      }
    } catch (error) {
      console.error('Error submitting approvals:', error);
      setError('Failed to submit approvals. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalCounts = () => {
    const approved = Object.values(approvalStatus).filter(status => status === 'approved').length;
    const rejected = Object.values(approvalStatus).filter(status => status === 'rejected').length;
    const pending = Object.values(approvalStatus).filter(status => status === 'pending').length;
    return { approved, rejected, pending };
  };

  const { approved, rejected, pending } = getApprovalCounts();

  const handleImageLoad = (imageId, type) => {
    setImageLoadStates(prev => ({
      ...prev,
      [`${imageId}-${type}`]: 'loaded'
    }));
    console.log(`Successfully loaded ${type} image: ${imageId}`);
  };

  const handleImageError = (imageId, type, error) => {
    setImageLoadStates(prev => ({
      ...prev,
      [`${imageId}-${type}`]: 'error'
    }));
    console.error(`Failed to load ${type} image:`, {
      imageId,
      error: error?.target?.src
    });
  };



  return (
    <div className='results-page'>
      <h1>Image Approval</h1>
      
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
              <h2>Image Approval</h2>
            </div>
            {error && <div className='error-message'>{error}</div>}
            <p><strong>Total Processed Images:</strong> {currentProcessedImages.length}</p>
            
            {currentProcessedImages.length === 0 ? (
              <div className='no-images-message'>
                <h3>No processed images available</h3>
                <p>All images have been rejected or no images were processed.</p>
              </div>
            ) : (
              <div className='image-grid'>
                {currentProcessedImages.map((processedImg, index) => {
                  const originalImg = originalImages[index];
                  const status = approvalStatus[processedImg.id];
                  
                  return (
                    <div key={processedImg.id} className={`image-item ${status}`}>
                      <div className='image-comparison'>
                        <div className='original-image'>
                          <h4>Original</h4>
                          <div className='image-container'>
                            {originalImg ? (
                              <>
                                <img 
                                  src={`data:image/png;base64,${originalImg.image}`} 
                                  alt={`Original Slice ${processedImg.sequence_number}`}
                                  onLoad={() => handleImageLoad(processedImg.id, 'original')}
                                  onError={(e) => handleImageError(processedImg.id, 'original', e)}
                                  style={{ 
                                    maxWidth: '100%', 
                                    height: 'auto',
                                    display: imageLoadStates[`${processedImg.id}-original`] === 'error' ? 'none' : 'block'
                                  }}
                                />
                                
                                {imageLoadStates[`${processedImg.id}-original`] === 'error' && (
                                  <div className="error-placeholder" style={{
                                    width: '200px',
                                    height: '200px',
                                    backgroundColor: '#ffe6e6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #ff9999',
                                    color: '#cc0000'
                                  }}>
                                    <p>Image Load Failed</p>
                                    <button 
                                      onClick={() => {
                                        // Reset error state and try loading again
                                        setImageLoadStates(prev => ({
                                          ...prev,
                                          [`${processedImg.id}-original`]: 'loading'
                                        }));
                                        const img = new Image();
                                        img.src = `data:image/png;base64,${originalImg.image}`;
                                      }}
                                      style={{
                                        marginTop: '10px',
                                        padding: '5px 10px',
                                        background: '#fff',
                                        border: '1px solid #cc0000',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}
                              </>
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
                                <p>No Image</p>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className='processed-image'>
                          <h4>Processed</h4>
                          <div className='image-container'>
                            {processedImg.url ? (
                              <>
                                <img 
                                  src={processedImg.url} 
                                  alt={`Processed Slice ${processedImg.sequence_number}`}
                                  onLoad={() => handleImageLoad(processedImg.id, 'processed')}
                                  onError={(e) => handleImageError(processedImg.id, 'processed', e)}
                                  style={{ 
                                    maxWidth: '100%', 
                                    height: 'auto',
                                    display: imageLoadStates[`${processedImg.id}-processed`] === 'error' ? 'none' : 'block'
                                  }}
                                />
                                
                                {imageLoadStates[`${processedImg.id}-processed`] === 'error' && (
                                  <div className="error-placeholder" style={{
                                    width: '200px',
                                    height: '200px',
                                    backgroundColor: '#ffe6e6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid #ff9999',
                                    color: '#cc0000'
                                  }}>
                                    <p>Image Load Failed</p>
                                    <button 
                                      onClick={() => {
                                        // Reset error state and try loading again
                                        setImageLoadStates(prev => ({
                                          ...prev,
                                          [`${processedImg.id}-processed`]: 'loading'
                                        }));
                                        const img = new Image();
                                        img.src = processedImg.url;
                                      }}
                                      style={{
                                        marginTop: '10px',
                                        padding: '5px 10px',
                                        background: '#fff',
                                        border: '1px solid #cc0000',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )}
                              </>
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
                          </div>
                        </div>
                      </div>
                      
                      <div className='slice-overlay'>
                        <div className='slice-info'>
                          <span className='slice-number'>Slice {processedImg.sequence_number}</span>
                        </div>
                        <div className='action-buttons'>
                          <button
                            className={`approve-btn ${status === 'approved' ? 'active' : ''}`}
                            onClick={() => handleApprove(processedImg.id)}
                            title="Approve this slice"
                          >
                            <span className='btn-icon'>✓</span>
                            <span className='btn-text'>Approve</span>
                          </button>
                          <button
                            className={`reject-btn ${status === 'rejected' ? 'active' : ''}`}
                            onClick={() => handleReject(processedImg.id)}
                            title="Reject this slice"
                          >
                            <span className='btn-icon'>✗</span>
                            <span className='btn-text'>Reject</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
      
      {/* Approval Counter at Bottom */}
      <div className='approval-counter-bottom'>
        <div className='counter-stats'>
          <div className='stat-item approved'>
            <span className='stat-icon'>✅</span>
            <span className='stat-label'>Approved</span>
            <span className='stat-value'>{approved}</span>
          </div>
          <div className='stat-item rejected'>
            <span className='stat-icon'>❌</span>
            <span className='stat-label'>Rejected</span>
            <span className='stat-value'>{rejected}</span>
          </div>
          <div className='stat-item total'>
            <span className='stat-icon'>📊</span>
            <span className='stat-label'>Total</span>
            <span className='stat-value'>{currentProcessedImages.length}</span>
          </div>
        </div>
      </div>
      
      {/* Bottom Buttons: Back and Save Approvals */}
      <div className='bottom-buttons-centered'>
        <button
          className='submit-btn'
          onClick={() => navigate('/results')}
          style={{ marginRight: '1rem' }}
        >
          ← Back to Original Images
        </button>
        <button
          className='submit-btn'
          onClick={handleSubmitApprovals}
          disabled={isSubmitting || currentProcessedImages.length === 0}
        >
          {isSubmitting ? 'Saving...' : 'Save Approvals'}
        </button>
      </div>
    </div>
  );
};

export default ImageApprovalPage; 