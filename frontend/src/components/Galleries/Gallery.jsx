import React from 'react'
import './Gallery.css'
import gallery_1 from '../../assets/gallery-1.png'
import gallery_2 from '../../assets/gallery-2.jpg'
import gallery_3 from '../../assets/gallery-3.jpg'

const Gallery = () => {
  return (
    <div className='galleries'>
      <div className='gallery'>
        <img src={gallery_1} alt='' />
          <p>Exploration</p>
      </div>
      <div className='gallery'>
        <img src={gallery_2} alt='' />
          <p>Diagnosis</p>
      </div>
      <div className='gallery'>
        <img src={gallery_3} alt='' />
          <p>Lesion Segmentation</p>
      </div>
    </div>
  )
}

export default Gallery
