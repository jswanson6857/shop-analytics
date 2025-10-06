// src/components/JobAnalyticsPage.js - COMPLETE: Clickable categories with modal
import React, { useState, useMemo } from "react";
import {
  formatCurrency,
  JOB_CATEGORIES,
  calculateJobTax,
} from "../utils/dataParser";

const JobAnalyticsPage = ({
  data,
  allData,
  selectedCategory,
  setSelectedCategory,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  navigateToRO,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const itemsPerPage = 12;

  // Calculate analytics by category (ONLY APPROVED JOBS)
  const categoryAnalytics = useMemo(() => {
    const stats = {};

    data.forEach((ro) => {
      // ONLY count approved jobs
      const approvedJobs = (ro.jobs || []).filter((j) => j.authorized === true);

      approvedJobs.forEach((job) => {
        const cat = job.category || "OTHER";
        if (!stats[cat]) {
          stats[cat] = {
            approved: 0,
            approvedAmt: 0,
            jobs: [], // Store approved jobs with RO context
          };
        }

        // Calculate tax for this job
        const jobTax = calculateJobTax(job, ro.totalSales, ro.taxes);
        const jobTotal = job.subtotal + jobTax;

        const jobDetail = {
          ...job,
          repairOrderNumber: ro.repairOrderNumber,
          roId: ro.id,
          customer: ro.customer,
          technician: ro.technician,
          createdDate: ro.createdDate || ro.timestamp,
          orderStatus: ro.repairOrderStatus?.name,
          calculatedTax: jobTax,
          totalWithTax: jobTotal,
        };

        stats[cat].jobs.push(jobDetail);
        stats[cat].approved++;
        stats[cat].approvedAmt += jobTotal; // Include tax in total
      });
    });

    return stats;
  }, [data]);

  // Filter categories
  const filteredCategories = useMemo(() => {
    let categories = Object.entries(categoryAnalytics);

    if (selectedCategory !== "all") {
      categories = categories.filter(([cat]) => cat === selectedCategory);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      categories = categories.filter(([cat]) =>
        cat.toLowerCase().includes(search)
      );
    }

    return categories.sort(([a], [b]) => a.localeCompare(b));
  }, [categoryAnalytics, selectedCategory, searchTerm]);

  // Paginate
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(start, start + itemsPerPage);
  }, [filteredCategories, currentPage]);

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  // Calculate overall stats
  const overallStats = useMemo(() => {
    const stats = Object.values(categoryAnalytics);
    return {
      totalApproved: stats.reduce((s, c) => s + c.approved, 0),
      approvedSales: stats.reduce((s, c) => s + c.approvedAmt, 0),
    };
  }, [categoryAnalytics]);

  // Handle category click
  const handleCategoryClick = (category, stats) => {
    setModalData({ category, jobs: stats.jobs });
    setShowModal(true);
  };

  // Handle job click in modal
  const handleJobClick = (roNumber) => {
    setShowModal(false);
    navigateToRO(roNumber);
  };

  return (
    <>
      {/* Filters */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by category code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <select
            className="filter-select"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Categories</option>
            {Object.keys(categoryAnalytics)
              .sort()
              .map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>

          <div style={{ position: "relative", display: "inline-block" }}>
            <input
              type="date"
              className="filter-select"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
            <span
              className="filter-tooltip"
              title="Shows all repair orders with activity in this date range (not just created)"
            >
              ❓
            </span>
          </div>

          <input
            type="date"
            className="filter-select"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* Overall Summary Stats */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#28a745" }}>
              {overallStats.totalApproved}
            </div>
            <div className="stat-label">Total Approved Jobs</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#007bff" }}>
              {formatCurrency(overallStats.approvedSales)}
            </div>
            <div className="stat-label">Total Approved Sales (incl. tax)</div>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "1rem",
        }}
      >
        {paginatedCategories.map(([category, stats]) => {
          const catColor = JOB_CATEGORIES[category]?.color || "#757575";

          return (
            <div
              key={category}
              className="category-card"
              onClick={() => handleCategoryClick(category, stats)}
              style={{
                background: "var(--card-bg)",
                border: "2px solid var(--border-color)",
                borderRadius: "8px",
                padding: "1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 4px 12px var(--shadow-hover)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <span
                  style={{
                    backgroundColor: catColor,
                    color: "white",
                    padding: "0.5rem 1rem",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                    fontWeight: "bold",
                  }}
                >
                  {category}
                </span>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                      color: "#28a745",
                    }}
                  >
                    {stats.approved}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Approved Jobs
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {/* Approved Sales */}
                <div
                  style={{
                    background: "#d4edda",
                    padding: "0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#155724",
                        fontSize: "0.85rem",
                      }}
                    >
                      💰 Total Sales (incl. tax)
                    </span>
                    <span
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: "bold",
                        color: "#28a745",
                      }}
                    >
                      {formatCurrency(stats.approvedAmt)}
                    </span>
                  </div>
                </div>

                {/* Click to view */}
                <div
                  style={{
                    textAlign: "center",
                    padding: "0.5rem",
                    background: "var(--bg-tertiary)",
                    borderRadius: "6px",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                  }}
                >
                  🖱️ Click to view all jobs
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="pagination-controls">
        <div className="page-info">
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, filteredCategories.length)} of{" "}
          {filteredCategories.length} categories
        </div>
        <div className="page-buttons">
          <button
            className="page-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ← Prev
          </button>
          <button
            className="page-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && modalData && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalData.category} - Approved Jobs ({modalData.jobs.length})
              </h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {modalData.jobs
                .sort(
                  (a, b) => new Date(b.createdDate) - new Date(a.createdDate)
                )
                .map((job) => (
                  <div
                    key={job.id}
                    className="job-modal-item"
                    onClick={() => handleJobClick(job.repairOrderNumber)}
                  >
                    <div className="job-modal-header">
                      <div>
                        <div className="job-modal-name">{job.name}</div>
                        <div className="job-modal-meta">
                          RO #{job.repairOrderNumber} •
                          {job.customer &&
                            ` ${job.customer.firstName} ${job.customer.lastName}`}
                        </div>
                      </div>
                      <div className="job-modal-amount">
                        {formatCurrency(job.totalWithTax)}
                      </div>
                    </div>

                    <div className="job-modal-details">
                      {job.technician && (
                        <span className="job-modal-badge">
                          🔧 {job.technician.firstName}{" "}
                          {job.technician.lastName}
                        </span>
                      )}
                      <span className="job-modal-badge approved">
                        ✓ Approved
                      </span>
                      <span className="job-modal-badge">
                        Subtotal: {formatCurrency(job.subtotal)}
                      </span>
                      <span className="job-modal-badge">
                        Tax: {formatCurrency(job.calculatedTax)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
          backdrop-filter: blur(4px);
        }

        .modal-content {
          background: var(--card-bg);
          border-radius: 12px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 2px solid var(--border-color);
        }

        .modal-header h2 {
          margin: 0;
          color: var(--text-primary);
          font-size: 1.5rem;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .modal-body {
          padding: 1rem;
          overflow-y: auto;
          flex: 1;
        }

        .job-modal-item {
          background: var(--bg-tertiary);
          border: 2px solid var(--border-color);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .job-modal-item:hover {
          border-color: #007bff;
          box-shadow: 0 4px 12px var(--shadow-hover);
          transform: translateX(4px);
        }

        .job-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .job-modal-name {
          font-weight: 600;
          color: var(--text-primary);
          font-size: 1.1rem;
          margin-bottom: 0.25rem;
        }

        .job-modal-meta {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .job-modal-amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #28a745;
        }

        .job-modal-details {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .job-modal-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          background: var(--card-bg);
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .job-modal-badge.approved {
          background: #d4edda;
          color: #155724;
          border-color: #28a745;
        }

        .filter-tooltip {
          position: absolute;
          right: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          cursor: help;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        @media (max-width: 768px) {
          .modal-content {
            max-height: 95vh;
          }

          .modal-header h2 {
            font-size: 1.2rem;
          }

          .job-modal-header {
            flex-direction: column;
            gap: 0.5rem;
          }

          .job-modal-amount {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </>
  );
};

export default JobAnalyticsPage;
