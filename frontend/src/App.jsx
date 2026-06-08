import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout/AdminLayout";
import LoginSignup from "./components/LoginSignup/LoginSignup";
import Dashboard from "./components/Dashboard/Dashboard";
import PendingUsers from "./components/PendingUsers/PendingUsers";
import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import Title from "./components/Title/Title";
import Gallery from "./components/Galleries/Gallery";
import About from "./components/About/About";
import Testimonials from "./components/Testimonials/Testimonials";
import FileUploader from "./components/FileUploader/FileUploader";
import Contact from "./components/Contact/Contact";
import Footer from "./components/Footer/Footer";
import ResultsPage from "./components/ResultsPage/ResultsPage";
import ImageApprovalPage from "./components/ImageApprovalPage/ImageApprovalPage";
import SegmentationResultsPage from "./components/SegmentationResultsPage/SegmentationResultsPage";
import axios from "axios";

const App = () => {
  const [isAdmin, setIsAdmin] = useState(null); // null = uninitialized
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkUserStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      console.log("App.jsx: Access token:", token);
      if (!token) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        return;
      }
      const response = await axios.get(
        "http://127.0.0.1:8000/api/user-status/",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("App.jsx: User status response:", response.data);
      const isAdminUser = response.data.specialty?.toLowerCase() === "admin";
      setIsLoggedIn(true);
      setIsAdmin(isAdminUser);
      console.log("App.jsx: Setting isAdmin:", isAdminUser);
    } catch (err) {
      console.error(
        "App.jsx: Error checking user status:",
        err.response?.data || err.message
      );
      setIsLoggedIn(false);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only check status if state is uninitialized
    if (isLoggedIn === null && isAdmin === null) {
      checkUserStatus();
    } else {
      setLoading(false);
    }
  }, [checkUserStatus, isLoggedIn, isAdmin]);

  if (loading || isAdmin === null || isLoggedIn === null) {
    return <div>Loading...</div>;
  }

  console.log(
    "App.jsx: Rendering with isLoggedIn:",
    isLoggedIn,
    "isAdmin:",
    isAdmin
  );

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginSignup setIsLoggedIn={setIsLoggedIn} setIsAdmin={setIsAdmin} />
        }
      />
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <div>
              <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
              <section id="hero">
                <Hero />
              </section>
              <div className="container">
                <Title subTitle="OUR PROGRAM" title="What We Offer" />
                <Gallery />
                <section id="about">
                  <Title subTitle="ABOUT US" title="Who We Are" />
                  <About />
                </section>
                <section id="testimonials">
                  <Title subTitle="TESTIMONIALS" title="What Experts Say" />
                  <Testimonials />
                </section>
                {isLoggedIn && (
                  <section id="file-uploader">
                    <Title subTitle="DATA UPLOAD" title="Choose MRI Uploads" />
                    <FileUploader />
                  </section>
                )}
                <section id="contact">
                  <Title subTitle="CONTACT US" title="Get In Touch" />
                  <Contact />
                </section>
                <Footer />
              </div>
            </div>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route  path="/results" element={<ResultsPage />} />
      <Route  path="/approval" element={<ImageApprovalPage />} />
      <Route  path="/segmentation-results" element={<SegmentationResultsPage />} />
      <Route
        element={<AdminLayout isAdmin={isAdmin} isLoggedIn={isLoggedIn} />}
      >
        <Route
          path="/dashboard"
          element={isAdmin ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/pending-users"
          element={isAdmin ? <PendingUsers /> : <Navigate to="/login" />}
        />
      </Route>

      <Route path="*" element={<div>404 Not Found</div>} />
    </Routes>
  );
};

export default App;
