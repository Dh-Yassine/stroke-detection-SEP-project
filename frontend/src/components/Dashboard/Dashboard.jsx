import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import './Dashboard.css';

// Register Chart.js components and Filler plugin
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setError('No access token found');
          return;
        }
        const response = await axios.get('http://127.0.0.1:8000/api/admin/dashboard/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(response.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      }
    };
    fetchDashboardData();
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div>Loading...</div>;

  const chartData = {
    labels: data.report_trends.map((trend) => trend.created_at__date),
    datasets: [
      {
        label: 'Reports Created',
        data: data.report_trends.map((trend) => trend.count),
        fill: true,
        backgroundColor: 'rgba(26, 115, 232, 0.2)',
        borderColor: '#1a73e8',
        tension: 0.4,
      },
    ],
  };

  return (
    <div className="dashboard">
      <h2>Admin Dashboard</h2>
      <div className="stats">
        <div>Active Users: {data.active_users}</div>
        <div>Total Patients: {data.total_patients}</div>
        <div>Trial Users: {data.trial_users}</div>
      </div>
      <div className="chart">
        <h3>Report Trends</h3>
        <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: true } } }} />
      </div>
      <div className="specialties">
        <h3>Specialty Distribution</h3>
        <ul>
          {data.specialties.map((spec) => (
            <li key={spec.specialty}>{spec.specialty}: {spec.count}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;