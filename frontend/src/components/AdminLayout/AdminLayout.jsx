// C:\Users\asus\Documents\Projects\frontend\src\components\AdminLayout\AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar/Navbar';
import Sidebar from '../Sidebar/Sidebar';
import './AdminLayout.css';

const AdminLayout = ({ isAdmin, isLoggedIn }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="admin-layout">
      <Navbar isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
      <div className="admin-content">
        <Sidebar isAdmin={isAdmin} toggleSidebar={toggleSidebar} isOpen={isSidebarOpen} />
        <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <Outlet />
        </main>
        <div
          className={`backdrop ${isSidebarOpen ? 'active' : ''}`}
          onClick={toggleSidebar}
          aria-hidden={!isSidebarOpen}
          role="button"
          tabIndex={isSidebarOpen ? 0 : -1}
          onKeyDown={(e) => e.key === 'Enter' && toggleSidebar()}
          data-testid="backdrop"
        ></div>
      </div>
    </div>
  );
};

export default AdminLayout;