import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaCheck, FaTimes, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './PendingUsers.css';

const PendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'email', direction: 'asc' });
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const usersPerPage = 5;
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPendingUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/pending-users/', {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        setPendingUsers(response.data);
        setError('');
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Access denied. Only admin users can view this page.');
          setTimeout(() => navigate('/'), 3000);
        } else {
          setError('Failed to fetch pending users.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPendingUsers();
  }, [navigate]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      const direction = prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc';
      return { key, direction };
    });
  };

  const sortedUsers = [...pendingUsers].sort((a, b) => {
    if (sortConfig.key === 'trial_start') {
      return sortConfig.direction === 'asc'
        ? new Date(a.trial_start) - new Date(b.trial_start)
        : new Date(b.trial_start) - new Date(a.trial_start);
    }
    const aValue = a[sortConfig.key] || '';
    const bValue = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  const handleApprove = async (userId) => {
    setLoading(true);
    try {
      await axios.post(
        `http://127.0.0.1:8000/api/approve-user/${userId}/`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );
      setPendingUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success('User approved successfully.');
    } catch (err) {
      setError('Failed to approve user.');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const handleReject = async (userId) => {
    setLoading(true);
    try {
      await axios.post(
        `http://127.0.0.1:8000/api/reject-user/${userId}/`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );
      setPendingUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success('User rejected and deleted.');
    } catch (err) {
      setError('Failed to reject user.');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const openConfirmModal = (action, userId) => {
    setConfirmAction({ action, userId });
  };

  const closeConfirmModal = () => {
    setConfirmAction(null);
  };

  const totalPages = Math.ceil(pendingUsers.length / usersPerPage);
  const paginatedUsers = sortedUsers.slice((page - 1) * usersPerPage, page * usersPerPage);

  return (
    <div className="pending-users-container">
      {error && (
        <div className="error-alert">
          <span>{error}</span>
          <button className="close-error" onClick={() => setError('')} aria-label="Close error">
            <FaTimes />
          </button>
        </div>
      )}
      {loading && <div className="loading-spinner"></div>}
      {pendingUsers.length === 0 && !loading ? (
        <p className="no-users">No pending users to validate.</p>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="pending-users-table" aria-label="Pending Users Table">
              <thead>
                <tr>
                  {['email', 'name', 'surname', 'specialty', 'affiliation', 'phone_number', 'title', 'trial_start', 'upload_count'].map((key) => (
                    <th key={key} onClick={() => handleSort(key)} className="sortable" tabIndex="0" aria-sort={sortConfig.key === key ? sortConfig.direction : 'none'}>
                      {key.replace('_', ' ').toUpperCase()}
                      {sortConfig.key === key && (
                        <span className="sort-icon">
                          {sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                        </span>
                      )}
                      {sortConfig.key !== key && <FaSort className="sort-icon" />}
                    </th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user, index) => (
                  <tr key={user.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td>{user.email}</td>
                    <td>{user.name}</td>
                    <td>{user.surname}</td>
                    <td>{user.specialty}</td>
                    <td>{user.affiliation}</td>
                    <td>{user.phone_number}</td>
                    <td>{user.title}</td>
                    <td>{new Date(user.trial_start).toLocaleString()}</td>
                    <td>{user.upload_count}</td>
                    <td className="actions-cell">
                      <button
                        className="approve-btn"
                        onClick={() => openConfirmModal('approve', user.id)}
                        aria-label={`Approve user ${user.email}`}
                        disabled={loading}
                        title="Approve User"
                      >
                        <FaCheck />
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => openConfirmModal('reject', user.id)}
                        aria-label={`Reject user ${user.email}`}
                        disabled={loading}
                        title="Reject User"
                      >
                        <FaTimes />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {confirmAction && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm {confirmAction.action === 'approve' ? 'Approval' : 'Rejection'}</h2>
            <p>
              Are you sure you want to {confirmAction.action} this user?
            </p>
            <div className="modal-buttons">
              <button
                className={confirmAction.action === 'approve' ? 'approve-btn' : 'reject-btn'}
                onClick={() =>
                  confirmAction.action === 'approve'
                    ? handleApprove(confirmAction.userId)
                    : handleReject(confirmAction.userId)
                }
                aria-label={confirmAction.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                title={confirmAction.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              >
                {confirmAction.action === 'approve' ? <FaCheck /> : <FaTimes />}
              </button>
              <button
                className="cancel-btn"
                onClick={closeConfirmModal}
                aria-label="Cancel"
                title="Cancel"
              >
                <FaTimes />
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />
    </div>
  );
};

export default PendingUsers;