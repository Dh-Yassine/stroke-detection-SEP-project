import React, { useRef } from "react";
import "./Testimonials.css";
import next_icon from "../../assets/next-icon.png";
import back_icon from "../../assets/back-icon.png";
import user_1 from "../../assets/user-1.png";
import user_2 from "../../assets/user-2.png";
import user_3 from "../../assets/user-3.png";
import user_4 from "../../assets/user-4.png";

const Testimonials = () => {
    const slider = useRef();
  let tx = 0;

  const slideForward = () => {
    if (tx > -75) { // Adjusted to account for 4 slides (25% each)
      tx -= 25;
    }
    slider.current.style.transform = `translateX(${tx}%)`; // Fixed typo
  };

  const slideBackward = () => {
    if (tx < 0) {
      tx += 25;
    }
    slider.current.style.transform = `translateX(${tx}%)`; // Fixed typo
  };
        
  return (
    <div className="testimonials">
      <img src={next_icon} alt="" className="next-btn" onClick={slideForward} />
      <img src={back_icon} alt="" className="back-btn" onClick={slideBackward} />
      <div className="slider">
        <ul ref={slider}>
          <li>
            <div className="slide">
              <div className="user-info">
                <img src={user_1} alt="" />
                <div>
                  <h3>Dr. Raj Patel</h3>
                  <span>Stroke Researcher</span>
                </div>
              </div>
              <p>
                The curated datasets and analysis tools here streamline my
                research on stroke recovery patterns.
              </p>
            </div>
          </li>

          <li>
            <div className="slide">
              <div className="user-info">
                <img src={user_2} alt="" />
                <div>
                  <h3>Dr. Sarah Lopez</h3>
                  <span>Data Scientist</span>
                </div>
              </div>
              <p>
                I use this platform’s stroke outcome models to build predictive
                tools for clinical trials.
              </p>
            </div>
          </li>
          <li>
            <div className="slide">
              <div className="user-info">
                <img src={user_3} alt="" />
                <div>
                  <h3>Dr.Michael Okoye</h3>
                  <span>Neurologist</span>
                </div>
              </div>
              <p>
                The site’s real-time stroke care guidelines keep my team aligned
                with the latest standards.
              </p>
            </div>
          </li>
          <li>
            <div className="slide">
              <div className="user-info">
                <img src={user_4} alt="" />
                <div>
                  <h3>Dr. Emily Chen</h3>
                  <span>Neurologist</span>
                </div>
              </div>
              <p>This site’s stroke protocols and data insights help me make faster, evidence-based decisions in the ER.</p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Testimonials;
