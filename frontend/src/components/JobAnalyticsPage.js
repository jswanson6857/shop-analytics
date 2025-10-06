// src/components/JobAnalyticsPage.js - FIXED: Proper date filtering
import React, { useState, useMemo } from "react";
import { formatCurrency, JOB_CATEGORIES } from "../utils/dataParser";

const JobAnalyticsPage = ({
  data,
  selectedCategory,
  setSelectedCategory,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const itemsPerPage = 12;

  // FIXED: Filter data by date using both createdDate and timestamp
  const filteredByDate = useMemo(() => {
    console.log("🔍 JobAnalytics filtering:", {
      totalData: data.length,
      dateFrom,
      dateTo,
    });

    return data.filter((ro) => {
      // Use createdDate if available, otherwise use timestamp
      const dateStr = ro.createdDate || ro.timestamp;
      if (!dateStr) return true; // Include if no date

      const eventDate = new Date(dateStr);
      const matchesDateFrom =
        !dateFrom || eventDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo =
        !dateTo || eventDate <= new Date(dateTo + "T23:59:59");

      return matchesDateFrom && matchesDateTo;
    });
  }, [data, dateFrom, dateTo]);

  console.log(
    `✅ JobAnalytics filtered: ${filteredByDate.length} of ${data.length} records`
  );

  // FIXED: Calculate analytics by category from filtered data
  const categoryAnalytics = useMemo(() => {
    const stats = {};

    filteredByDate.forEach((ro) => {
      ro.jobs?.forEach((job) => {
        const cat = job.category || "OTHER";
        if (!stats[cat]) {
          stats[cat] = {
            approved: 0,
            declined: 0,
            pending: 0,
            approvedAmt: 0,
            declinedAmt: 0,
            pendingAmt: 0,
          };
        }

        if (job.authorized === true) {
          stats[cat].approved++;
          stats[cat].approvedAmt += job.subtotal || 0;
        } else if (job.authorized === false) {
          stats[cat].declined++;
          stats[cat].declinedAmt += job.subtotal || 0;
        } else {
          stats[cat].pending++;
          stats[cat].pendingAmt += job.subtotal || 0;
        }
      });
    });

    // Calculate close ratios
    Object.keys(stats).forEach((cat) => {
      const total = stats[cat].approved + stats[cat].declined;
      stats[cat].closeRatio =
        total > 0 ? ((stats[cat].approved / total) * 100).toFixed(1) : 0;
    });

    console.log(
      "📊 Category analytics calculated:",
      Object.keys(stats).length,
      "categories"
    );
    return stats;
  }, [filteredByDate]);

  // Filter and search categories
  const filteredCategories = useMemo(() => {
    let categories = Object.entries(categoryAnalytics);

    // Filter by selected category
    if (selectedCategory !== "all") {
      categories = categories.filter(([cat]) => cat === selectedCategory);
    }

    // Search filter
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

  // FIXED: Calculate overall stats from filtered data
  const overallStats = useMemo(() => {
    const stats = Object.values(categoryAnalytics);
    const totals = {
      totalApproved: stats.reduce((s, c) => s + c.approved, 0),
      totalDeclined: stats.reduce((s, c) => s + c.declined, 0),
      totalPending: stats.reduce((s, c) => s + c.pending, 0),
      approvedRevenue: stats.reduce((s, c) => s + c.approvedAmt, 0),
      declinedValue: stats.reduce((s, c) => s + c.declinedAmt, 0),
      pendingValue: stats.reduce((s, c) => s + c.pendingAmt, 0),
    };

    // Calculate overall close ratio
    const totalQuoted = totals.totalApproved + totals.totalDeclined;
    totals.overallCloseRatio =
      totalQuoted > 0
        ? ((totals.totalApproved / totalQuoted) * 100).toFixed(1)
        : 0;

    console.log("📈 Overall stats:", totals);
    return totals;
  }, [categoryAnalytics]);

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
            <div className="stat-label">Total Approved</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#dc3545" }}>
              {overallStats.totalDeclined}
            </div>
            <div className="stat-label">Total Declined</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#ffc107" }}>
              {overallStats.totalPending}
            </div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#007bff" }}>
              {formatCurrency(overallStats.approvedRevenue)}
            </div>
            <div className="stat-label">Approved Revenue</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#6c757d" }}>
              {formatCurrency(overallStats.declinedValue)}
            </div>
            <div className="stat-label">Declined Value</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: "#17a2b8" }}>
              {overallStats.overallCloseRatio}%
            </div>
            <div className="stat-label">Overall Close Ratio</div>
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
          const total = stats.approved + stats.declined + stats.pending;

          return (
            <div
              key={category}
              style={{
                background: "var(--card-bg)",
                border: "2px solid var(--border-color)",
                borderRadius: "8px",
                padding: "1rem",
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
                      fontSize: "2rem",
                      fontWeight: "bold",
                      color: "#28a745",
                    }}
                  >
                    {stats.closeRatio}%
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    Close Ratio
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
                {/* Approved */}
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
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#155724",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✓ Approved
                    </span>
                    <span
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: "bold",
                        color: "#28a745",
                      }}
                    >
                      {stats.approved}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#155724" }}>
                    Revenue:{" "}
                    <strong>{formatCurrency(stats.approvedAmt)}</strong>
                  </div>
                </div>

                {/* Declined */}
                <div
                  style={{
                    background: "#f8d7da",
                    padding: "0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        color: "#721c24",
                        fontSize: "0.85rem",
                      }}
                    >
                      ✗ Declined
                    </span>
                    <span
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: "bold",
                        color: "#dc3545",
                      }}
                    >
                      {stats.declined}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#721c24" }}>
                    Lost: <strong>{formatCurrency(stats.declinedAmt)}</strong>
                  </div>
                </div>

                {/* Pending */}
                {stats.pending > 0 && (
                  <div
                    style={{
                      background: "#fff3cd",
                      padding: "0.75rem",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "#856404",
                          fontSize: "0.85rem",
                        }}
                      >
                        ⏳ Pending
                      </span>
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: "bold",
                          color: "#ffc107",
                        }}
                      >
                        {stats.pending}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#856404",
                        marginTop: "0.25rem",
                      }}
                    >
                      Value: <strong>{formatCurrency(stats.pendingAmt)}</strong>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div
                  style={{
                    paddingTop: "0.75rem",
                    borderTop: "2px solid var(--border-color)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Total Jobs:
                    </span>
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "var(--text-primary)",
                      }}
                    >
                      {total}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>
                      Total Value:
                    </span>
                    <span
                      style={{
                        fontWeight: "bold",
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatCurrency(
                        stats.approvedAmt + stats.declinedAmt + stats.pendingAmt
                      )}
                    </span>
                  </div>
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
    </>
  );
};

export default JobAnalyticsPage;
