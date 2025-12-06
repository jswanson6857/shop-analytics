import React, { useState, useEffect } from 'react';
import api from '../services/api';
import RODetailModal from './RODetailModal';

function FollowUpBoard() {
  const [view, setView] = useState('categories'); // 'categories' or 'ros'
  const [categories, setCategories] = useState([]);
  const [repairOrders, setRepairOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRO, setSelectedRO] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filters
  const [serviceWriterFilter, setServiceWriterFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersData = await api.getUsers();
      setUsers(usersData);
      
      // Load job categories
      const categoriesData = await api.getJobCategories('FOLLOW_UP_BOARD');
      setCategories(categoriesData);
      
      // Load ROs
      const rosData = await api.getRepairOrders({ status: 'FOLLOW_UP_BOARD' });
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
    await loadData(); // Reload to reflect status changes
  };
  
  // Filter ROs
  const filteredROs = repairOrders.filter(ro => {
    if (serviceWriterFilter !== 'all' && ro.service_writer !== serviceWriterFilter) return false;
    if (categoryFilter !== 'all' && !(ro.job_categories || []).includes(categoryFilter)) return false;
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter);
      const daysAgo = Math.floor((Date.now() - new Date(ro.posted_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysAgo > days) return false;
    }
    return true;
  });
  
  const serviceWriters = [...new Set(repairOrders.map(ro => ro.service_writer))];
  
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
          <h1>📋 Follow-Up Board</h1>
          <p style={{color: '#7f8c8d', fontSize: '0.9rem', marginTop: '0.25rem'}}>
            New declined jobs requiring follow-up
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary">
          🔄 Refresh
        </button>
      </div>
      
      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`toggle-btn ${view === 'categories' ? 'active' : ''}`}
          onClick={() => setView('categories')}
        >
          Job Categories
        </button>
        <button
          className={`toggle-btn ${view === 'ros' ? 'active' : ''}`}
          onClick={() => setView('ros')}
        >
          Repair Orders
        </button>
      </div>
      
      {/* Filters */}
      <div className="filter-bar">
        <select 
          value={serviceWriterFilter} 
          onChange={(e) => setServiceWriterFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Service Writers</option>
          {serviceWriters.map(sw => (
            <option key={sw} value={sw}>{sw}</option>
          ))}
        </select>
        
        <select 
          value={dateFilter} 
          onChange={(e) => setDateFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Dates</option>
          <option value="3">Last 3 Days</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
        </select>
        
        {view === 'ros' && (
          <select 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat.name} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        )}
      </div>
      
      {/* JOB CATEGORIES VIEW */}
      {view === 'categories' && (
        <div className="categories-grid">
          {categories.map(category => (
            <div
              key={category.name}
              className="category-card"
              onClick={() => {
                setCategoryFilter(category.name);
                setView('ros');
              }}
            >
              <div className="category-header">
                <div className={`category-badge ${category.name.toLowerCase()}`}>
                  {category.name}
                </div>
                <div className="category-count">{category.declined_count}</div>
              </div>
              
              <div className="category-stats">
                <div className="stat-row">
                  <span>Declined Jobs:</span>
                  <span className="stat-value">{category.declined_count}</span>
                </div>
                <div className="stat-row">
                  <span>Follow-up Needed:</span>
                  <span className="stat-value">{category.ro_ids.length}</span>
                </div>
                <div className="stat-row">
                  <span>Declined Sales:</span>
                  <span className="stat-value">${category.declined_value.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="category-footer">
                <div className="approval-stats">
                  <span className="approved">✓ {category.approved_count}</span>
                  <span className="declined">✗ {category.declined_count}</span>
                </div>
                <div className="close-ratio">
                  Close Rate: {category.close_ratio}%
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* REPAIR ORDERS VIEW */}
      {view === 'ros' && (
        <div className="ro-table-container">
          <table className="ro-table">
            <thead>
              <tr>
                <th>Close Ratio %</th>
                <th>Approved Jobs</th>
                <th>Declined Jobs</th>
                <th>Service Writer</th>
                <th>RO #</th>
                <th>Posted Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredROs.map(ro => (
                <tr key={ro.ro_id} onClick={() => openRODetail(ro)} className="clickable-row">
                  <td>
                    <span className="close-ratio-badge">
                      {ro.close_ratio}%
                    </span>
                  </td>
                  <td>
                    <span className="approved-count">
                      ✓ {ro.approved_jobs?.length || 0}
                    </span>
                  </td>
                  <td>
                    <span className="declined-count">
                      ✗ {ro.declined_jobs?.length || 0}
                    </span>
                  </td>
                  <td>{ro.service_writer}</td>
                  <td className="ro-number-cell">
                    <strong>{ro.ro_number}</strong>
                    <div className="customer-name-small">{ro.customer_name}</div>
                  </td>
                  <td>{new Date(ro.posted_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredROs.length === 0 && (
            <div className="empty-state">
              <h3>No repair orders found</h3>
              <p>Try adjusting your filters</p>
            </div>
          )}
        </div>
      )}
      
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

export default FollowUpBoard;
