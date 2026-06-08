import React, { useEffect, useState } from 'react';
import './Hero.css';
import { Link as ScrollLink } from 'react-scroll';
import { useNavigate, useLocation } from 'react-router-dom';
import dark_arrow from '../../assets/dark-arrow.png';

const Hero = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    setIsLoggedIn(!!accessToken);
  }, []);

  const handleButtonClick = (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      navigate('/login');
    }
  };

  return (
    <div className='hero' id='hero'>
      <div className='hero-text'>
        <h1>Accurate Stroke Risk Prediction at Your Fingertips</h1>
        <p>
          Our Stroke Prediction Platform uses advanced algorithms to assess your stroke risk with accuracy.
          Take control of your health with personalized insights in a secure, user-friendly system.
        </p>
        {isLoggedIn && isHomePage ? (
          <ScrollLink
            to='uploader-container'
            smooth={true}
            offset={-150}
            duration={500}
            className='btn'
          >
            Start Sharing Images <img src={dark_arrow} alt='Arrow' />
          </ScrollLink>
        ) : (
          <button className='btn' onClick={handleButtonClick}>
            Start Sharing Images <img src={dark_arrow} alt='Arrow' />
          </button>
        )}
        <p>Upload DICOM files and automatically anonymize them</p>
      </div>
    </div>
  );
};

export default Hero;