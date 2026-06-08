import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginSignup.css";
import user_icon from "../../assets/person-icon.png";
import password_icon from "../../assets/password-icon.png";
import mail_icon from "../../assets/mail-icon.png";
import phone_icon from "../../assets/phone-icon.png";
import affiliation_icon from "../../assets/affiliation-icon.png";
import title_icon from "../../assets/title-icon.png";
import Navbar from "../Navbar/Navbar";
import axios from "axios";

const LoginSignup = ({ setIsLoggedIn, setIsAdmin }) => {
  const [action, setAction] = useState("Sign in");
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    affiliation: "",
    phone_number: "",
    specialty: "",
    title: "",
    password: "",
    password2: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      if (action === "Sign Up") {
        // Client-side validation
        if (!formData.name || formData.name.length < 2) {
          setError("Name must be at least 2 characters.");
          setIsLoading(false);
          return;
        }
        if (!formData.surname || formData.surname.length < 2) {
          setError("Surname must be at least 2 characters.");
          setIsLoading(false);
          return;
        }
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
          setError("Please enter a valid email.");
          setIsLoading(false);
          return;
        }
        if (!formData.affiliation) {
          setError("Please enter your affiliation.");
          setIsLoading(false);
          return;
        }
        if (
          !formData.phone_number ||
          !/^\+?\d{7,15}$/.test(formData.phone_number)
        ) {
          setError("Please enter a valid phone number (7-15 digits).");
          setIsLoading(false);
          return;
        }
        if (!formData.specialty) {
          setError("Please select a specialty.");
          setIsLoading(false);
          return;
        }
        if (!formData.title) {
          setError("Please enter your title.");
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters.");
          setIsLoading(false);
          return;
        }
        if (formData.password !== formData.password2) {
          setError("Passwords do not match.");
          setIsLoading(false);
          return;
        }
        const response = await axios.post(
          "http://127.0.0.1:8000/api/register/",
          {
            name: formData.name,
            surname: formData.surname,
            email: formData.email,
            affiliation: formData.affiliation,
            phone_number: formData.phone_number,
            specialty: formData.specialty,
            title: formData.title,
            password: formData.password,
            password2: formData.password2,
          }
        );
        setSuccess("Registration successful! Please log in.");
        setAction("Sign in");
        setFormData({
          name: "",
          surname: "",
          email: "",
          affiliation: "",
          phone_number: "",
          specialty: "",
          title: "",
          password: "",
          password2: "",
        });
      } else {
        const response = await axios.post("http://127.0.0.1:8000/api/login/", {
          email: formData.email,
          password: formData.password,
        });
        const accessToken = response.data.Tokens.access;
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", response.data.Tokens.refresh);
        console.log("LoginSignup: Token stored:", accessToken);

        // Fetch user status
        const statusResponse = await axios.get(
          "http://127.0.0.1:8000/api/user-status/",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        console.log("LoginSignup: User status:", statusResponse.data);

        // Case-insensitive check for 'Admin'
        const isAdminUser = statusResponse.data.specialty?.toLowerCase() === "admin";
        setIsLoggedIn(true);
        setIsAdmin(isAdminUser);
        console.log("LoginSignup: Setting isAdmin:", isAdminUser);

        setSuccess("Login successful!");
        navigate(isAdminUser ? "/dashboard" : "/");
      }
    } catch (err) {
      console.error("LoginSignup: Error:", err.response?.data || err.message);
      if (err.response?.data) {
        const errors = err.response.data;
        if (typeof errors === "object") {
          const errorMessages = Object.values(errors).flat().join(" ");
          setError(errorMessages);
        } else {
          setError("An error occurred. Please try again.");
        }
      } else {
        setError("Network error. Please check your connection.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="loginsignup">
        <Navbar />
        <div className="header">
          <div className="text">{action}</div>
          <div className="underline"></div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="inputs">
            {action === "Sign Up" ? (
              <>
                <div className="input">
                  <img src={user_icon} alt="Name icon" />
                  <input
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="input">
                  <img src={user_icon} alt="Surname icon" />
                  <input
                    type="text"
                    name="surname"
                    placeholder="Surname"
                    value={formData.surname}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="input">
                  <img src={affiliation_icon} alt="Affiliation icon" />
                  <input
                    type="text"
                    name="affiliation"
                    placeholder="Affiliation (e.g., Hospital/Clinic)"
                    value={formData.affiliation}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="input">
                  <img src={phone_icon} alt="Phone icon" />
                  <input
                    type="text"
                    name="phone_number"
                    placeholder="Phone Number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="input">
                  <img src={user_icon} alt="Specialty icon" />
                  <select
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleInputChange}
                    required
                    className="select-input"
                  >
                    <option value="" disabled>
                      Select Specialty
                    </option>
                    <option value="Doctor">Doctor</option>
                    <option value="Admin">Admin</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="input">
                  <img src={title_icon} alt="Title icon" />
                  <input
                    type="text"
                    name="title"
                    placeholder="Title (e.g., Neurologist, Dermatologist)"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </>
            ) : null}
            <div className="input">
              <img src={mail_icon} alt="Email icon" />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="input">
              <img src={password_icon} alt="Password icon" />
              <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleInputChange}
                required
              />
            </div>
            {action === "Sign Up" ? (
              <div className="input">
                <img src={password_icon} alt="Confirm password icon" />
                <input
                  type="password"
                  name="password2"
                  placeholder="Confirm Password"
                  value={formData.password2}
                  onChange={handleInputChange}
                  required
                />
              </div>
            ) : null}
          </div>
          {action === "Sign in" && (
            <div className="forgot-password">
              Lost Password? <span>Click here</span>
            </div>
          )}
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <div className="submit-button-container">
            <button
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? "Submitting..." : "Submit"}
            </button>
          </div>
          <div className="login-signup-container">
            <button
              type="button"
              className={action === "Sign Up" ? "submit gray" : "submit"}
              onClick={() => {
                setAction("Sign in");
                setFormData({
                  ...formData,
                  name: "",
                  surname: "",
                  affiliation: "",
                  phone_number: "",
                  specialty: "",
                  title: "",
                  password2: "",
                });
                setError("");
                setSuccess("");
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={action === "Sign in" ? "submit gray" : "submit"}
              onClick={() => {
                setAction("Sign Up");
                setError("");
                setSuccess("");
              }}
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginSignup;