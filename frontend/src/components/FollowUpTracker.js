import React, { useState, useEffect } from 'react';
import api from '../services/api';
import RODetailModal from './RODetailModal';

function FollowUpTracker() {
  const [repairOrders, setRepairOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRO, setSelectedRO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState('follow_up_date');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);
      
      const rosData = await api.getRepairOrders({ status: 'FOLLOW_UP_TRACKER' });
      setRepairOrders(rosData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const openRODetail = (ro) => {
    setSelectedRO(ro);
    setShowModal(true);
  };
  
  const handleSaveContact = async (roId, contactData) => {
    await api.saveContact(roId, contactData);
    await loadData();
  };
  
  // Calculate interested/not interested counts from contact history
  const getInterestCounts = (ro) => {
    const interested = (ro.contact_history || []).reduce((count, contact) => {
      return count + (contact.job_interests || []).filter(j => j.interest_status === 'interested').length;
    }, 0);
    
    const notInterested = (ro.contact_history || []).reduce((count, contact) => {
      return count + (contact.job_interests || []).filter(j => j.interest_status === 'not_interested').length;
    }, 0);
    
    return { interested, notInterested };
  };
  
  // Check if follow-up is overdue
  const isOverdue = (followUpDate) => {
    if (!followUpDate) return false;
    return new Date(followUpDate) < new Date();
  };
  
  // Sort ROs
  const sortedROs = [...repairOrders].sort((a, b) => {
    if (sortBy === 'follow_up_date') {
      return new Date(a.follow_up_date || 0) - new Date(b.follow_up_date || 0);
    } else if (sortBy === 'declined_value') {
      return (b.declined_value || 0) - (a.declined_value || 0);
    } else if (sortBy === 'reach_count') {
      return (b.reach_count || 0) - (a.reach_count || 0);
    }
    return 0;
  });
  
  if (loading) {
    return (
      <div className="view-container loading">
        <div className="spinner"></div>
      </div>
    );
  }
  
  return (
    <div className="view-container">
      {/* Header */}
      <div className="view-header">
        <div>
          <h1>📞 Follow-Up Tracker</h1>
          <p style={{color: '#7f8c8d', fontSize: '0.9rem', marginTop: '0.25rem'}}>
            Active follow-ups (contacted at least once)
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>
      
      {/* Sort Controls */}
      <div className="filter-bar">
        <label>Sort by:</label>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
          <option value="follow_up_date">Follow-up Date</option>
          <option value="declined_value">Declined Value</option>
          <option value="reach_count">Reach Count</option>
        </select>
      </div>
      
      {/* Follow-up Table */}
      <div className="tracker-table-container">
        <table className="tracker-table">
          <thead>
            <tr>
              <th>RO #</th>
              <th>Interested</th>
              <th>Not Interested</th>
              <th>Assigned</th>
              <th>Follow Up Count</th>
              <th>Follow-up Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedROs.map(ro => {
              const counts = getInterestCounts(ro);
              const overdue = isOverdue(ro.follow_up_date);
              const assignedUser = users.find(u => u.id === ro.assigned_user_id);
              
              return (
                <tr key={ro.ro_id} onClick={() => openRODetail(ro)} className="clickable-row">
                  <td className="ro-number-cell">
                    <strong>{ro.ro_number}</strong>
                    <div className="customer-name-small">{ro.customer_name}</div>
                  </td>
                  <td>
                    <span className="interest-badge interested">
                      ✓ {counts.interested}
                    </span>
                  </td>
                  <td>
                    <span className="interest-badge not-interested">
                      ✗ {counts.notInterested}
                    </span>
                  </td>
                  <td>
                    {assignedUser ? (
                      <div className="user-circle">
                        <div className="avatar">
                          {assignedUser.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="user-name-small">{assignedUser.name}</span>
                      </div>
                    ) : (
                      <span className="text-muted">Unassigned</span>
                    )}
                  </td>
                  <td>
                    <span className={`reach-badge reach-${Math.min(ro.reach_count || 0, 3)}`}>
                      #{ro.reach_count || 0}
                    </span>
                  </td>
                  <td>
                    {ro.follow_up_date ? (
                      <div className="follow-up-date">
                        {new Date(ro.follow_up_date).toLocaleDateString()}
                        {overdue && <span className="overdue-badge">DUE!</span>}
                      </div>
                    ) : (
                      <span className="text-muted">Not set</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {sortedROs.length === 0 && (
          <div className="empty-state">
            <h3>No active follow-ups</h3>
            <p>ROs will appear here once you make first contact</p>
          </div>
        )}
      </div>
      
      {/* RO Detail Modal */}
      {showModal && selectedRO && (
        <RODetailModal
          ro={selectedRO}
          users={users}
          onClose={() => setShowModal(false)}
          onSave={handleSaveContact}
        />
      )}
    </div>
  );
}

export default FollowUpTracker;
