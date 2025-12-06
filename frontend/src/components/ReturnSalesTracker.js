import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ReturnSalesTracker() {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  useEffect(() => {
    loadData();
  }, [userFilter, startDate, endDate]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);
      
      const analyticsData = await api.getAnalytics({
        user_id: userFilter,
        start_date: startDate,
        end_date: endDate
      });
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading || !analytics) {
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
          <h1>📊 Return Sales Tracker</h1>
          <p style={{color: '#7f8c8d', fontSize: '0.9rem', marginTop: '0.25rem'}}>
            Analytics and performance metrics
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>
      
      {/* Filters */}
      <div className="filter-bar">
        <select 
          value={userFilter} 
          onChange={(e) => setUserFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Users</option>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          placeholder="Start Date"
          className="filter-input"
        />
        
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          placeholder="End Date"
          className="filter-input"
        />
      </div>
      
      <div className="analytics-container">
        {/* LEFT COLUMN */}
        <div className="analytics-left">
          
          {/* Outbound Calls */}
          <div className="analytics-card">
            <h3>Out Bound Calls</h3>
            <div className="analytics-grid">
              <div className="analytics-stat">
                <div className="stat-number">{analytics.outbound_calls.first_reach}</div>
                <div className="stat-label">1st Reach</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-number">{analytics.outbound_calls.second_reach}</div>
                <div className="stat-label">2nd Reach</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-number">{analytics.outbound_calls.third_plus_reach}</div>
                <div className="stat-label">3+ Reach</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-number">{analytics.outbound_calls.appointment_calls}</div>
                <div className="stat-label">Appt Call</div>
              </div>
            </div>
            <div className="analytics-total">
              Total: {analytics.outbound_calls.total}
            </div>
          </div>
          
          {/* Contacted Calls */}
          <div className="analytics-card">
            <h3>Contacted Calls</h3>
            <div className="analytics-grid">
              <div className="analytics-stat green">
                <div className="stat-number">{analytics.contacted_calls.first_reach}</div>
                <div className="stat-label">1st Reach</div>
              </div>
              <div className="analytics-stat green">
                <div className="stat-number">{analytics.contacted_calls.second_reach}</div>
                <div className="stat-label">2nd Reach</div>
              </div>
              <div className="analytics-stat green">
                <div className="stat-number">{analytics.contacted_calls.third_plus_reach}</div>
                <div className="stat-label">3+ Reach</div>
              </div>
              <div className="analytics-stat green">
                <div className="stat-number">{analytics.contacted_calls.appointment_calls}</div>
                <div className="stat-label">Appt Call</div>
              </div>
            </div>
            <div className="analytics-total">
              Total: {analytics.contacted_calls.total}
            </div>
          </div>
          
          {/* Summary Stats */}
          <div className="analytics-summary">
            <div className="summary-stat">
              <div className="stat-number blue">{analytics.summary.leads}</div>
              <div className="stat-label">Leads</div>
            </div>
            <div className="summary-stat">
              <div className="stat-number blue">{analytics.summary.appointments_made}</div>
              <div className="stat-label">Appointments</div>
            </div>
            <div className="summary-stat">
              <div className="stat-number red">{analytics.summary.not_interested}</div>
              <div className="stat-label">Not Interested</div>
            </div>
          </div>
          
          {/* Sales Generated */}
          <div className="analytics-card">
            <h3>Sales Generated</h3>
            <div className="sales-display">
              <div className="sales-row">
                <span>Direct:</span>
                <span className="sales-amount green">${analytics.sales.direct.toFixed(2)}</span>
              </div>
              <div className="sales-row">
                <span>Indirect:</span>
                <span className="sales-amount blue">${analytics.sales.indirect.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* RIGHT COLUMN - Sales By Category */}
        <div className="analytics-right">
          <div className="analytics-card">
            <h3>Sales By Job Category</h3>
            <div className="category-grid">
              {(analytics.sales_by_category || []).map((cat, idx) => (
                <div key={idx} className="category-analytics-card">
                  <div className={`category-badge ${cat.name.toLowerCase()}`}>
                    {cat.name}
                  </div>
                  <div className="category-number">{cat.calls}</div>
                  <div className="category-details">
                    <div>Calls: {cat.calls}</div>
                    <div>Completed: {cat.completed}</div>
                  </div>
                  <div className="category-revenue">
                    ${cat.revenue.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReturnSalesTracker;
