import React, { useState, useEffect } from 'react';
import api from '../services/api';

function AppointmentTracker() {
  const [repairOrders, setRepairOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const rosData = await api.getRepairOrders({ status: 'APPOINTMENT_TRACKER' });
      setRepairOrders(rosData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const getInterestedJobsCount = (ro) => {
    if (!ro.contact_history || ro.contact_history.length === 0) return 0;
    const lastContact = ro.contact_history[ro.contact_history.length - 1];
    return (lastContact.job_interests || []).filter(j => 
      j.interest_status === 'appointment_made'
    ).length;
  };
  
  const getStatusBadgeClass = (ro) => {
    if (ro.completed) return 'completed';
    if (ro.no_show) return 'no-show';
    return 'pending';
  };
  
  const getStatusText = (ro) => {
    if (ro.completed) return 'Completed';
    if (ro.no_show) return 'No Show';
    return 'Pending';
  };
  
  if (loading) {
    return (
      <div className="view-container loading">
        <div className="spinner"></div>
      </div>
    );
  }
  
  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h1>📅 Appointment Tracker</h1>
          <p style={{color: '#7f8c8d', fontSize: '0.9rem', marginTop: '0.25rem'}}>
            Scheduled appointments
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>
      
      <div className="tracker-table-container">
        <table className="tracker-table">
          <thead>
            <tr>
              <th>Appointment Date</th>
              <th>RO #</th>
              <th>Status</th>
              <th>Interested Jobs</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {repairOrders.map(ro => (
              <tr key={ro.ro_id}>
                <td>
                  {ro.follow_up_date ? 
                    new Date(ro.follow_up_date).toLocaleDateString() : 
                    'Not set'
                  }
                </td>
                <td className="ro-number-cell">
                  <strong>{ro.ro_number}</strong>
                  <div className="customer-name-small">{ro.customer_name}</div>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(ro)}`}>
                    {getStatusText(ro)}
                  </span>
                </td>
                <td>{getInterestedJobsCount(ro)}</td>
                <td className="value-highlight">
                  ${ro.declined_value?.toFixed(2) || '0.00'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {repairOrders.length === 0 && (
          <div className="empty-state">
            <h3>No appointments scheduled</h3>
            <p>Appointments will appear here when you mark jobs as "Appointment Made"</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppointmentTracker;
