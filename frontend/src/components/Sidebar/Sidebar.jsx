// C:\Users\asus\Documents\Projects\frontend\src\components\Sidebar\Sidebar.jsx
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FaBars, FaTachometerAlt, FaUsers } from 'react-icons/fa';
import axios from 'axios';
import './Sidebar.css';

const Sidebar = ({ isAdmin, toggleSidebar, isOpen }) => {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      const fetchNotifications = async () => {
        try {
          const token = localStorage.getItem('access_token');
          if (!token) {
            setError('No access token found');
            return;
          }
          const response = await axios.get('http://127.0.0.1:8000/api/notifications/', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setNotifications(response.data);
        } catch (err) {
          console.error('Error fetching notifications:', err);
          setError('Failed to load notifications');
        }
      };
      fetchNotifications();
    }
  }, [isAdmin]);

  return (
    <>
      <button
        className={`sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        aria-label={isOpen ? 'Close Sidebar' : 'Open Sidebar'}
        data-testid="sidebar-toggle"
        aria-expanded={isOpen}
      >
        <FaBars />
      </button>
      <div className={`sidebar ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <nav className="sidebar-nav">
          {isAdmin ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                data-testid="dashboard-link"
              >
                <FaTachometerAlt className="sidebar-icon" /> Dashboard
              </NavLink>
              <NavLink
                to="/pending-users"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                data-testid="pending-users-link"
              >
                <FaUsers className="sidebar-icon" /> Pending Users
              </NavLink>
            </>
          ) : (
            <p className="error">Not authorized.</p>
          )}
        </nav>
        
        {error && <div className="error">{error}</div>}
      </div>
    </>
  );
};

export default Sidebar;