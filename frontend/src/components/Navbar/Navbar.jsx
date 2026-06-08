import React, { useState, useEffect, useRef } from 'react';
import './Navbar.css';
import logo from '../../assets/logo.png';
import { Link as ScrollLink } from 'react-scroll';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import Avatar_Img from '../../assets/user-1.png';
import axios from 'axios';
import { FaBell } from 'react-icons/fa';

const Navbar = ({ isLoggedIn, isAdmin }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  const isAdminRoute = ['/dashboard', '/pending-users'].includes(location.pathname);

  useEffect(() => {
    if (isLoggedIn) {
      const fetchNotifications = async () => {
        try {
          const response = await axios.get('http://127.0.0.1:8000/api/notifications/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          setNotifications(response.data);
          setUnreadCount(response.data.filter((n) => !n.is_read).length);
        } catch (error) {
          console.error('Error fetching notifications:', error);
        }
      };
      fetchNotifications();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn) {
      const checkValidationStatus = async () => {
        try {
          const response = await axios.get('http://127.0.0.1:8000/api/user-status/', {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          if (response.data.validation_status === 'not_approved') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            navigate('/login', { state: { notification: 'Your account was not approved by the admin.' } });
          }
        } catch (error) {
          console.error('Error checking validation status:', error);
        }
      };
      checkValidationStatus();
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const nav = document.querySelector('nav');
      if (window.scrollY > lastScrollY && window.scrollY > 50) {
        nav.style.transform = 'translateY(-100%)';
        nav.style.pointerEvents = 'none';
      } else {
        nav.style.transform = 'translateY(0)';
        nav.style.pointerEvents = 'auto';
      }
      lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        const accessToken = localStorage.getItem('access_token');
        await axios.post(
          'http://127.0.0.1:8000/api/logout/',
          { refresh: refreshToken },
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setDropdownOpen(false);
      setNotificationOpen(false);
      navigate('/login');
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.patch(
        `http://127.0.0.1:8000/api/notifications/${notificationId}/`,
        { is_read: true },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => prev - 1);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
    setNotificationOpen(false);
  };

  const toggleNotifications = () => {
    setNotificationOpen(!notificationOpen);
    setDropdownOpen(false);
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleSectionNavigation = (section) => {
    if (isHomePage) {
      setMenuOpen(false);
    } else {
      navigate('/', { state: { section } });
    }
  };

  useEffect(() => {
    if (location.state?.section && isHomePage) {
      setTimeout(() => {
        const element = document.getElementById(location.state.section);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location]);

  return (
    <nav className="container">
      <img src={logo} alt="Logo" className="logo" />
      {isLoggedIn && (
      <div className="hamburger" onClick={toggleMenu}>
        {menuOpen ? '✕' : '☰'}
      </div>
      )}
      <ul className={menuOpen ? 'active' : ''}>
        {isLoggedIn && !isAdmin && (
          <>
            <li>
              {isHomePage ? (
                <ScrollLink
                  to="hero"
                  smooth={true}
                  offset={0}
                  duration={500}
                  onClick={() => setMenuOpen(false)}
                >
                  Home
                </ScrollLink>
              ) : (
                <div onClick={() => handleSectionNavigation('hero')}>Home</div>
              )}
            </li>
            <li>
              {isHomePage ? (
                <ScrollLink
                  to="about"
                  smooth={true}
                  offset={-260}
                  duration={500}
                  onClick={() => setMenuOpen(false)}
                >
                  About Us
                </ScrollLink>
              ) : (
                <div onClick={() => handleSectionNavigation('about')}>About Us</div>
              )}
            </li>
            <li>
              {isHomePage ? (
                <ScrollLink
                  to="testimonials"
                  smooth={true}
                  offset={-150}
                  duration={500}
                  onClick={() => setMenuOpen(false)}
                >
                  Testimonials
                </ScrollLink>
              ) : (
                <div onClick={() => handleSectionNavigation('testimonials')}>
                  Testimonials
                </div>
              )}
            </li>
            <li>
              {isHomePage ? (
                <ScrollLink
                  to="contact"
                  smooth={true}
                  offset={-260}
                  duration={500}
                  onClick={() => setMenuOpen(false)}
                >
                  Contact Us
                </ScrollLink>
              ) : (
                <div onClick={() => handleSectionNavigation('contact')}>
                  Contact Us
                </div>
              )}
            </li>
            <li className="notification-dropdown" ref={notificationRef}>
              <div className="notification-bell" onClick={toggleNotifications}>
                <FaBell className="bell-icon" />
                {unreadCount > 0 && (
                  <span className="notification-count">{unreadCount}</span>
                )}
              </div>
              {notificationOpen && (
                <div className="notification-dropdown-menu">
                  {notifications.length === 0 ? (
                    <div className="notification-item no-notifications">No notifications</div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                        onClick={() => !notification.is_read && markAsRead(notification.id)}
                      >
                        <p className="notification-message">{notification.message}</p>
                        <span className="notification-time">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          </>
        )}
        {isLoggedIn ? (
          <li className="profile-dropdown" ref={dropdownRef}>
            <div className="avatar-container" onClick={toggleDropdown}>
              <img src={Avatar_Img} alt="Profile" className="avatar-img" />
              <span className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`}>▼</span>
            </div>
            {dropdownOpen && (
              <div className="dropdown-menu">
                <RouterLink
                  to="/reports"
                  className="dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    setMenuOpen(false);
                  }}
                >
                  My AI Reports
                </RouterLink>
                <div
                  className="dropdown-item"
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                >
                  Logout
                </div>
              </div>
            )}
          </li>
        ) : (
          <li>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;