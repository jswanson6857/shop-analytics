// src/components/FollowUpPage.js - Track Customer Contact Follow-Ups
import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency, formatDate } from "../utils/dataParser";

const FollowUpPage = ({ customers }) => {
  const [followUps, setFollowUps] = useState([]);
  const [filterResponse, setFilterResponse] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedJobs, setExpandedJobs] = useState(new Set());

  // Load follow-ups from localStorage
  useEffect(() => {
    const savedFollowUps = localStorage.getItem("follow-up-jobs");
    if (savedFollowUps) {
      try {
        setFollowUps(JSON.parse(savedFollowUps));
      } catch (e) {
        console.error("Failed to load follow-ups:", e);
      }
    }
  }, []);

  // Filter follow-ups
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((followUp) => {
      const matchesResponse =
        filterResponse === "all" || followUp.response === filterResponse;

      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        followUp.roNumber?.toString().includes(search) ||
        followUp.job?.name?.toLowerCase().includes(search) ||
        followUp.customer?.name?.toLowerCase().includes(search) ||
        followUp.notes?.toLowerCase().includes(search);

      return matchesResponse && matchesSearch;
    });
  }, [followUps, filterResponse, searchTerm]);

  // Group by response
  const groupedByResponse = useMemo(() => {
    const grouped = {
      yes: [],
      maybe: [],
      no: [],
      work_completed: [],
      no_response: [],
    };

    filteredFollowUps.forEach((followUp) => {
      const response = followUp.response || "no_response";
      if (grouped[response]) {
        grouped[response].push(followUp);
      }
    });

    return grouped;
  }, [filteredFollowUps]);

  const handleMarkServiced = (jobId) => {
    if (
      window.confirm(
        "Mark this job as serviced? This will remove it from the follow-up tracker."
      )
    ) {
      const updated = followUps.filter((f) => f.jobId !== jobId);
      setFollowUps(updated);
      localStorage.setItem("follow-up-jobs", JSON.stringify(updated));
    }
  };

  const handleUpdateFollowUp = (jobId, updates) => {
    const updated = followUps.map((f) => {
      if (f.jobId === jobId) {
        return {
          ...f,
          ...updates,
          lastUpdated: new Date().toISOString(),
        };
      }
      return f;
    });

    setFollowUps(updated);
    localStorage.setItem("follow-up-jobs", JSON.stringify(updated));
  };

  const toggleExpanded = (jobId) => {
    setExpandedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const responseLabels = {
    yes: { label: "Yes - Interested", color: "#28a745", icon: "✓" },
    maybe: { label: "Maybe - Call Back", color: "#ffc107", icon: "⏳" },
    no: { label: "No - Not Interested", color: "#dc3545", icon: "✗" },
    work_completed: {
      label: "Work Completed",
      color: "#17a2b8",
      icon: "✔",
    },
    no_response: { label: "No Response", color: "#6c757d", icon: "○" },
  };

  return (
    <div className="followup-page">
      <div className="page-header">
        <h2>📞 Follow-Up Tracker</h2>
        <p className="page-description">
          Track customer conversations and follow-up actions for declined and
          approved jobs.
        </p>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by RO#, job, customer, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={filterResponse}
            onChange={(e) => setFilterResponse(e.target.value)}
          >
            <option value="all">All Responses</option>
            <option value="yes">Yes - Interested</option>
            <option value="maybe">Maybe - Call Back</option>
            <option value="no">No - Not Interested</option>
            <option value="work_completed">Work Completed</option>
            <option value="no_response">No Response</option>
          </select>
        </div>

        {/* Stats */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{followUps.length}</div>
            <div className="stat-label">Total Follow-Ups</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#28a745" }}>
              {groupedByResponse.yes.length}
            </div>
            <div className="stat-label">Interested</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#ffc107" }}>
              {groupedByResponse.maybe.length}
            </div>
            <div className="stat-label">Call Back</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#17a2b8" }}>
              {groupedByResponse.work_completed.length}
            </div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Follow-Up List */}
      {filteredFollowUps.length === 0 ? (
        <div className="no-data">
          <h2>No follow-ups tracked yet</h2>
          <p>
            Add notes and customer responses to jobs in the Repair Orders or Job
            Analytics pages to track them here.
          </p>
        </div>
      ) : (
        <div className="followup-list">
          {filteredFollowUps
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map((followUp) => (
              <FollowUpCard
                key={followUp.jobId}
                followUp={followUp}
                customer={customers[followUp.customerId]}
                responseLabels={responseLabels}
                isExpanded={expandedJobs.has(followUp.jobId)}
                onToggle={() => toggleExpanded(followUp.jobId)}
                onMarkServiced={() => handleMarkServiced(followUp.jobId)}
                onUpdate={(updates) =>
                  handleUpdateFollowUp(followUp.jobId, updates)
                }
              />
            ))}
        </div>
      )}
    </div>
  );
};

// Follow-Up Card Component
const FollowUpCard = ({
  followUp,
  customer,
  responseLabels,
  isExpanded,
  onToggle,
  onMarkServiced,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState(followUp.notes || "");
  const [editResponse, setEditResponse] = useState(
    followUp.response || "no_response"
  );

  const handleSaveEdit = () => {
    onUpdate({
      notes: editNotes,
      response: editResponse,
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditNotes(followUp.notes || "");
    setEditResponse(followUp.response || "no_response");
    setIsEditing(false);
  };

  const responseInfo = responseLabels[followUp.response || "no_response"];

  return (
    <div
      className={`followup-card ${followUp.response}`}
      style={{ borderLeftColor: responseInfo.color }}
    >
      <div className="followup-header" onClick={onToggle}>
        <div className="followup-title">
          <span className="expand-icon">{isExpanded ? "▼" : "▶"}</span>
          <div>
            <h4>
              {followUp.job?.name} - RO #{followUp.roNumber}
            </h4>
            <div className="followup-meta">
              <span>
                👤 {customer?.name || followUp.customer?.name || "Unknown"}
              </span>
              <span>
                📞 {customer?.phone || followUp.customer?.phone || "N/A"}
              </span>
              <span>🕐 {formatDate(followUp.timestamp)}</span>
            </div>
          </div>
        </div>

        <div className="followup-status-badge">
          <span
            className="response-badge"
            style={{ backgroundColor: responseInfo.color }}
          >
            {responseInfo.icon} {responseInfo.label}
          </span>
          <span className="job-amount">
            {formatCurrency(
              followUp.job?.totalWithTax || followUp.job?.subtotal
            )}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="followup-details">
          {!isEditing ? (
            <>
              <div className="detail-section">
                <h5>📝 Notes:</h5>
                <p className="notes-text">
                  {followUp.notes || "No notes added"}
                </p>
              </div>

              <div className="followup-actions">
                <button
                  className="action-btn edit-btn"
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="action-btn serviced-btn"
                  onClick={onMarkServiced}
                >
                  ✔ Mark as Serviced
                </button>
              </div>
            </>
          ) : (
            <div className="edit-form">
              <div className="input-group">
                <label>Customer Response:</label>
                <select
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  className="filter-select"
                >
                  <option value="no_response">No Response</option>
                  <option value="yes">Yes - Interested</option>
                  <option value="no">No - Not Interested</option>
                  <option value="maybe">Maybe - Call Back Later</option>
                  <option value="work_completed">Work Already Completed</option>
                </select>
              </div>

              <div className="input-group">
                <label>Notes (add layered updates):</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add additional notes about the conversation..."
                  rows={4}
                />
              </div>

              <div className="edit-actions">
                <button
                  className="action-btn save-btn"
                  onClick={handleSaveEdit}
                >
                  💾 Save Changes
                </button>
                <button
                  className="action-btn cancel-btn"
                  onClick={handleCancelEdit}
                >
                  ✖ Cancel
                </button>
              </div>
            </div>
          )}

          {followUp.lastUpdated && (
            <div className="last-updated">
              Last updated: {formatDate(followUp.lastUpdated)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FollowUpPage;
