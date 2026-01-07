import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

function RODetailModal({ ro, users, onClose, onSave }) {
  const { user } = useAuth0();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('jobs');
  
  // Form state
  const [notes, setNotes] = useState('');
  const [contactMethod, setContactMethod] = useState(null);
  const [jobInterests, setJobInterests] = useState({});
  const [assignedUserId, setAssignedUserId] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  // Initialize from existing data if reopening
  useEffect(() => {
    if (ro && ro.contact_history && ro.contact_history.length > 0) {
      setIsEditMode(true);
      const lastContact = ro.contact_history[ro.contact_history.length - 1];
      setNotes(lastContact.notes || '');
      setContactMethod(lastContact.contact_method);
      setFollowUpDate(ro.follow_up_date || '');
      setAssignedUserId(ro.assigned_user_id || '');
      
      // Populate job interests from last contact
      const interests = {};
      (lastContact.job_interests || []).forEach(ji => {
        interests[ji.job_id] = ji.interest_status;
      });
      setJobInterests(interests);
    }
  }, [ro]);
  
  // Handle job interest change
  const handleJobInterestChange = (jobId, status) => {
    setJobInterests(prev => ({
      ...prev,
      [jobId]: status
    }));
  };
  
  // Check if interest status should be disabled (voicemail/text)
  const isInterestDisabled = contactMethod === 'voicemail' || contactMethod === 'text';
  
  // Validate form
  const validateForm = () => {
    if (!contactMethod) {
      return 'Please select a contact method';
    }
    
    if (contactMethod === 'call') {
      const hasInterestSelected = Object.keys(jobInterests).length > 0;
      if (!hasInterestSelected) {
        return 'Please select interest status for at least one job when making a call';
      }
    }
    
    return null;
  };
  
  // Handle save
  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }
    
    setSaving(true);
    setValidationError('');
    
    try {
      // Build job interests array
      const jobInterestsArray = Object.entries(jobInterests).map(([jobId, status]) => {
        const job = ro.declined_jobs.find(j => j.id === jobId);
        return {
          job_id: jobId,
          job_name: job?.name || '',
          interest_status: status
        };
      });
      
      const contactData = {
        contact_method: contactMethod,
        job_interests: jobInterestsArray,
        notes: notes.trim(),
        follow_up_date: followUpDate || null,
        assigned_user_id: assignedUserId || null,
        assigned_user_name: users.find(u => u.id === assignedUserId)?.name || null,
        user_id: user?.sub || 'unknown',
        user_name: user?.name || 'Unknown User',
        is_edit_mode: isEditMode
      };
      
      await onSave(ro.ro_id, contactData);
      onClose();
    } catch (error) {
      setValidationError('Failed to save contact: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  if (!ro) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ro-detail-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>RO #{ro.ro_number}</h2>
            <p style={{color: '#7f8c8d', fontSize: '0.9rem', marginTop: '0.25rem'}}>
              {ro.customer_name}
            </p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {/* Tabs */}
        <div className="ro-tabs">
          <button 
            className={`ro-tab ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs
          </button>
          <button 
            className={`ro-tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity Feed
          </button>
        </div>
        
        <div className="modal-body ro-detail-body">
          <div className="ro-main-content">
            
            {/* JOBS TAB */}
            {activeTab === 'jobs' && (
              <>
                {/* Notes Section */}
                <div className="form-section">
                  <label className="form-label">Notes / Comments</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter notes about this conversation..."
                    rows={3}
                    className="notes-textarea"
                  />
                </div>
                
                {/* Contact Method */}
                <div className="form-section">
                  <label className="form-label">Contact Method *</label>
                  <div className="contact-methods">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={contactMethod === 'call'}
                        onChange={() => setContactMethod('call')}
                      />
                      <span>Call</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={contactMethod === 'voicemail'}
                        onChange={() => setContactMethod('voicemail')}
                      />
                      <span>Voicemail</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={contactMethod === 'text'}
                        onChange={() => setContactMethod('text')}
                      />
                      <span>Text</span>
                    </label>
                  </div>
                  {isInterestDisabled && (
                    <p className="help-text">
                      Interest status disabled for voicemail/text (no customer response yet)
                    </p>
                  )}
                </div>
                
                {/* Declined Jobs */}
                <div className="jobs-section">
                  <h3>Declined Jobs</h3>
                  {(ro.declined_jobs || []).map((job, idx) => (
                    <div key={job.id} className="job-card declined">
                      <div className="job-header">
                        <div>
                          <h4>{job.name}</h4>
                          {job.description && (
                            <p className="job-description">{job.description}</p>
                          )}
                          <span className={`category-badge ${(job.category || 'other').toLowerCase()}`}>
                            {job.category || 'Other'}
                          </span>
                        </div>
                        <div className="job-total">${job.total?.toFixed(2) || '0.00'}</div>
                      </div>
                      
                      {/* Labor */}
                      {job.labor_hours > 0 && (
                        <div className="job-breakdown">
                          <h5>Labor</h5>
                          <table className="breakdown-table">
                            <thead>
                              <tr>
                                <th>Hours</th>
                                <th>Rate</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>{job.labor_hours}</td>
                                <td>${job.labor_rate?.toFixed(2)}</td>
                                <td>${job.labor_total?.toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {/* Parts */}
                      {job.parts && job.parts.length > 0 && (
                        <div className="job-breakdown">
                          <h5>Parts</h5>
                          <table className="breakdown-table">
                            <thead>
                              <tr>
                                <th>Part</th>
                                <th>Part #</th>
                                <th>Qty</th>
                                <th>Cost</th>
                                <th>Retail</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {job.parts.map((part, pidx) => (
                                <tr key={pidx}>
                                  <td>{part.name}</td>
                                  <td>{part.part_number}</td>
                                  <td>{part.quantity}</td>
                                  <td>${part.cost?.toFixed(2)}</td>
                                  <td>${part.retail?.toFixed(2)}</td>
                                  <td>${part.total?.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {/* Fees */}
                      {job.fees && job.fees.length > 0 && (
                        <div className="job-breakdown">
                          <h5>Fees</h5>
                          <table className="breakdown-table">
                            <thead>
                              <tr>
                                <th>Description</th>
                                <th>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {job.fees.map((fee, fidx) => (
                                <tr key={fidx}>
                                  <td>{fee.name}</td>
                                  <td>${fee.amount?.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {/* Subtotal & Tax */}
                      <div className="job-subtotal">
                        <div className="subtotal-row">
                          <span>Subtotal:</span>
                          <span>${job.subtotal?.toFixed(2)}</span>
                        </div>
                        {job.tax > 0 && (
                          <div className="subtotal-row">
                            <span>Tax:</span>
                            <span>${job.tax?.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="subtotal-row total">
                          <span>Total:</span>
                          <span>${job.total?.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      {/* Interest Status for this job */}
                      <div className="job-interest">
                        <label className="form-label">Interest Status for this job:</label>
                        <div className="interest-options">
                          <label className={`interest-option ${isInterestDisabled ? 'disabled' : ''}`}>
                            <input
                              type="checkbox"
                              disabled={isInterestDisabled}
                              checked={jobInterests[job.id] === 'interested'}
                              onChange={() => handleJobInterestChange(job.id, 'interested')}
                            />
                            <span>Interested</span>
                          </label>
                          <label className={`interest-option ${isInterestDisabled ? 'disabled' : ''}`}>
                            <input
                              type="checkbox"
                              disabled={isInterestDisabled}
                              checked={jobInterests[job.id] === 'appointment_made'}
                              onChange={() => handleJobInterestChange(job.id, 'appointment_made')}
                            />
                            <span>Appointment Made</span>
                          </label>
                          <label className={`interest-option ${isInterestDisabled ? 'disabled' : ''}`}>
                            <input
                              type="checkbox"
                              disabled={isInterestDisabled}
                              checked={jobInterests[job.id] === 'not_interested'}
                              onChange={() => handleJobInterestChange(job.id, 'not_interested')}
                            />
                            <span>Not Interested</span>
                          </label>
                          <label className={`interest-option ${isInterestDisabled ? 'disabled' : ''}`}>
                            <input
                              type="checkbox"
                              disabled={isInterestDisabled}
                              checked={jobInterests[job.id] === 'work_completed'}
                              onChange={() => handleJobInterestChange(job.id, 'work_completed')}
                            />
                            <span>Work Already Completed</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Approved Jobs */}
                {ro.approved_jobs && ro.approved_jobs.length > 0 && (
                  <div className="jobs-section approved-jobs">
                    <h3>Approved Jobs (What Customer Already Paid)</h3>
                    {ro.approved_jobs.map((job, idx) => (
                      <div key={idx} className="job-card approved">
                        <div className="job-simple">
                          <span className="job-name">{job.name}</span>
                          <span className="job-amount">${job.total?.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Assignment & Follow-up */}
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">Assign User for Follow-up</label>
                    <select
                      value={assignedUserId}
                      onChange={(e) => setAssignedUserId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select user...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-field">
                    <label className="form-label">Follow-up Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                
                {/* Validation Error */}
                {validationError && (
                  <div className="validation-error">
                    ⚠️ {validationError}
                  </div>
                )}
              </>
            )}
            
            {/* ACTIVITY FEED TAB */}
            {activeTab === 'activity' && (
              <div className="activity-feed">
                {ro.contact_history && ro.contact_history.length > 0 ? (
                  ro.contact_history.map((contact, idx) => (
                    <div key={idx} className="activity-entry">
                      <div className="activity-header">
                        <div className="activity-user">
                          <div className="user-avatar">
                            {contact.user_name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="activity-user-name">{contact.user_name}</div>
                            <div className="activity-timestamp">
                              {new Date(contact.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="activity-method">
                          <span className={`method-badge ${contact.contact_method}`}>
                            {contact.contact_method}
                          </span>
                          <span className="reach-badge">
                            Reach #{contact.reach_count}
                          </span>
                        </div>
                      </div>
                      
                      {contact.job_interests && contact.job_interests.length > 0 && (
                        <div className="activity-interests">
                          {contact.job_interests.map((ji, jiIdx) => (
                            <div key={jiIdx} className="interest-item">
                              <span className="job-name">{ji.job_name}:</span>
                              <span className={`status-badge ${ji.interest_status}`}>
                                {ji.interest_status.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {contact.notes && (
                        <div className="activity-notes">
                          <strong>Notes:</strong> {contact.notes}
                        </div>
                      )}
                      
                      {contact.follow_up_date && (
                        <div className="activity-followup">
                          Follow-up scheduled: {new Date(contact.follow_up_date).toLocaleDateString()}
                          {contact.assigned_user_name && (
                            <span> (Assigned to {contact.assigned_user_name})</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="empty-activity">
                    <p>No activity yet. Make the first contact!</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* RIGHT SIDEBAR - Customer Info */}
          <div className="ro-sidebar">
            <h3>Customer Information</h3>
            
            <div className="sidebar-section">
              <label>Name</label>
              <div className="sidebar-value">{ro.customer_name}</div>
            </div>
            
            <div className="sidebar-section">
              <label>Phone</label>
              <div className="sidebar-value">{ro.customer_phone || 'N/A'}</div>
            </div>
            
            <div className="sidebar-section">
              <label>Email</label>
              <div className="sidebar-value">{ro.customer_email || 'N/A'}</div>
            </div>
            
            <h3 style={{marginTop: '1.5rem'}}>Vehicle</h3>
            
            <div className="sidebar-section">
              <label>Year / Make / Model</label>
              <div className="sidebar-value">
                {ro.vehicle?.year} {ro.vehicle?.make} {ro.vehicle?.model}
              </div>
            </div>
            
            <div className="sidebar-section">
              <label>VIN</label>
              <div className="sidebar-value">{ro.vehicle?.vin || 'N/A'}</div>
            </div>
            
            <div className="sidebar-section">
              <label>Mileage</label>
              <div className="sidebar-value">
                {ro.vehicle?.mileage ? `${ro.vehicle.mileage.toLocaleString()} mi` : 'N/A'}
              </div>
            </div>
            
            <h3 style={{marginTop: '1.5rem'}}>RO Details</h3>
            
            <div className="sidebar-section">
              <label>Service Writer</label>
              <div className="sidebar-value">{ro.service_writer}</div>
            </div>
            
            <div className="sidebar-section">
              <label>Posted Date</label>
              <div className="sidebar-value">
                {new Date(ro.posted_date).toLocaleDateString()}
              </div>
            </div>
            
            <div className="sidebar-section">
              <label>Close Ratio</label>
              <div className="sidebar-value">{ro.close_ratio}%</div>
            </div>
            
            <div className="sidebar-section">
              <label>Declined Value</label>
              <div className="sidebar-value value-highlight">
                ${ro.declined_value?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer with SAVE button */}
        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-save" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RODetailModal;
