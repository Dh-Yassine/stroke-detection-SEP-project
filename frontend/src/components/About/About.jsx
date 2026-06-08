import React from 'react'
import './About.css'
import about_img from '../../assets/about.webp'
import play_icon from '../../assets/play-icon.png'

const About = () => {
  return (
    <div className='about'>
      <div className='about-left'>
        <img src={about_img} alt='' className='about-img'/>
        <img src={play_icon} alt='' className='play-icon'/>
      </div>
      <div className='about-right'>
        <p>At VitalScan, we’re transforming stroke prevention with cutting edge technology. 
        Our platform leverages advanced machine learning to deliver accurate, personalized stroke risk predictions,
        empowering you to take control of your health.</p>
        <p>Designed for everyone from individuals to healthcare professionals our user friendly system ensures secure and accessible insights. 
        Backed by a team of experts, we’re committed to privacy and precision in every prediction.</p>
        <p>Join us in the fight against stroke.{' '}
        </p>
      </div>
    </div>
  )
}

export default About
