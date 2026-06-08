import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import "./SegmentationResultsPage.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SegmentationResultsPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { segmentationResults = [], formData = {} } = state || {};
  const [zoomedImage, setZoomedImage] = useState(null);

  const formatImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return `${API_BASE_URL}${url}`;
  };

  return (
    <div className='results-page'>
      <h1>Segmentation Results</h1>
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
        </aside>
        <main className='main-content'>
          <section className='images'>
            <div className='images-header'>
              <h2>Approved Slices and Masks</h2>
            </div>
            <p><strong>Total Approved Slices:</strong> {segmentationResults.length}</p>
            <div className='image-grid'>
              {segmentationResults.map((item, idx) => (
                <div key={idx} className='image-item'>
                  <div className='slice-info'>
                    <span className='slice-number'>Slice {item.slice_number}</span>
                  </div>
                  <div className='image-comparison' style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                    <div className='original-image'>
                      <h4>Original</h4>
                      {item.original ? (
                        <img src={formatImageUrl(item.original)} alt={`Original Slice ${item.slice_number}`} style={{maxWidth: '100%', height: 'auto'}} onClick={() => setZoomedImage(formatImageUrl(item.original))} />
                      ) : <div className='image-placeholder'><p>No Original</p></div>}
                    </div>
                    <div className='processed-image'>
                      <h4>Processed</h4>
                      {item.processed ? (
                        <img src={formatImageUrl(item.processed)} alt={`Processed Slice ${item.slice_number}`} style={{maxWidth: '100%', height: 'auto'}} onClick={() => setZoomedImage(formatImageUrl(item.processed))} />
                      ) : <div className='image-placeholder'><p>No Processed</p></div>}
                    </div>
                    <div className='mask-image'>
                      <h4>Mask</h4>
                      {item.mask ? (
                        <img src={formatImageUrl(item.mask)} alt={`Mask Slice ${item.slice_number}`} style={{maxWidth: '100%', height: 'auto'}} onClick={() => setZoomedImage(formatImageUrl(item.mask))} />
                      ) : <div className='image-placeholder'><p>No Mask</p></div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
      <div className='bottom-buttons-centered'>
        <button className='submit-btn' onClick={() => navigate('/results')}>
          ← Back to Original Images
        </button>
      </div>

      {zoomedImage && (
        <div className="image-modal-overlay" onClick={() => setZoomedImage(null)}>
          <button className="close-modal-button" onClick={() => setZoomedImage(null)}>&times;</button>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <TransformWrapper>
              <TransformComponent>
                <img src={zoomedImage} alt="Zoomed View" className="zoomed-image" />
              </TransformComponent>
            </TransformWrapper>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentationResultsPage; 