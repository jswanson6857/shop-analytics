// src/components/RepairOrdersPage.js
import React, { useState, useMemo, useEffect } from "react";
import {
  formatCurrency,
  formatDate,
  JOB_CATEGORIES,
} from "../utils/dataParser";

const RepairOrdersPage = ({
  data,
  searchTerm,
  setSearchTerm,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  statusFilter,
  setStatusFilter,
  connectionStatus,
}) => {
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Debug logging
  useEffect(() => {
    console.log("RepairOrdersPage received data:", {
      count: data?.length,
      hasData: !!data,
      isArray: Array.isArray(data),
    });
  }, [data]);

  // Calculate statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayEvents = data.filter((e) => e.timestamp?.startsWith(today));
    const repairOrders = data.filter((e) => e.repairOrderNumber);
    const highPriority = data.filter((e) => e.priority === "high");

    const totalRevenue = repairOrders.reduce(
      (sum, ro) => sum + (ro.totalSales || 0),
      0
    );
    const pendingBalance = repairOrders.reduce(
      (sum, ro) => sum + (ro.balanceDue || 0),
      0
    );

    return {
      total: data.length,
      today: todayEvents.length,
      repairOrders: repairOrders.length,
      totalRevenue: totalRevenue,
      pendingBalance: pendingBalance,
      highPriority: highPriority.length,
    };
  }, [data]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const toggleOrder = (id) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleJob = (id) => {
    setExpandedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
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
              placeholder="Search by RO#, customer, tech, event..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

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

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Status</option>
            <option value="Complete">Complete</option>
            <option value="Work-In-Progress">Work In Progress</option>
            <option value="Arrived">Arrived</option>
            <option value="Quoting">Quoting</option>
          </select>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="stat-label">Total Revenue</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {formatCurrency(stats.pendingBalance)}
            </div>
            <div className="stat-label">Balance Due</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.highPriority}</div>
            <div className="stat-label">High Priority</div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {paginatedData.length === 0 ? (
        <div className="no-data">
          {connectionStatus === "loading-history" ? (
            <>
              <h2>Loading historical data...</h2>
              <p>Fetching recent auto shop events from the database.</p>
            </>
          ) : data.length === 0 ? (
            <>
              <h2>Waiting for shop events...</h2>
              <p>
                Real-time data will appear here when your auto shop system sends
                webhooks.
              </p>
            </>
          ) : (
            <>
              <h2>No results found</h2>
              <p>Try adjusting your search or filter criteria.</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="events-list">
            {paginatedData.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={expandedOrders.has(order.id)}
                onToggle={() => toggleOrder(order.id)}
                expandedJobs={expandedJobs}
                toggleJob={toggleJob}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="pagination-controls">
            <div className="page-info">
              Showing {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, data.length)} of{" "}
              {data.length} orders
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
      )}
    </>
  );
};

const OrderCard = ({
  order,
  isExpanded,
  onToggle,
  expandedJobs,
  toggleJob,
}) => {
  const balanceDue = order.balanceDue || 0;

  return (
    <div
      className={`event-card priority-${order.priority}`}
      style={{ borderLeftColor: order.color || "#007bff" }}
    >
      {/* Main Row */}
      <div
        className="event-main"
        onClick={onToggle}
        style={{ cursor: "pointer" }}
      >
        <div className="event-icon">{isExpanded ? "▼" : "▶"}</div>
        <div className="event-title">
          <h4>Repair Order #{order.repairOrderNumber}</h4>
          <div className="event-subtitle">
            <span>
              👤 {order.customer?.firstName} {order.customer?.lastName} (#
              {order.customerId})
            </span>
            <span>
              🔧 Tech: {order.technician?.firstName}{" "}
              {order.technician?.lastName}
            </span>
            <span>🕐 {formatDate(order.timestamp)}</span>
          </div>
        </div>
        <div className="status-badges">
          <span className="badge status">
            {order.repairOrderStatus?.name || "Unknown"}
          </span>
          {order.event && <span className="badge custom">{order.event}</span>}
          {order.repairOrderCustomLabel?.name && (
            <span className="badge custom">
              {order.repairOrderCustomLabel.name}
            </span>
          )}
        </div>
        <div className="event-amount">
          <div
            className={`amount-value ${
              balanceDue > 0 ? "amount-due" : "amount-paid"
            }`}
          >
            {formatCurrency(balanceDue > 0 ? balanceDue : order.totalSales)}
          </div>
          <div className="amount-label">
            {balanceDue > 0
              ? "Balance Due"
              : order.amountPaid > 0
              ? "Paid"
              : "Total Sales"}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="event-details">
          {/* Financial Summary */}
          <div className="detail-group">
            <div className="detail-row">
              <span className="detail-label">Labor Sales:</span>
              <span className="detail-value">
                {formatCurrency(order.laborSales)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Parts Sales:</span>
              <span className="detail-value">
                {formatCurrency(order.partsSales)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Fees:</span>
              <span className="detail-value">
                {formatCurrency(order.feeTotal)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Taxes:</span>
              <span className="detail-value">
                {formatCurrency(order.taxes)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Total Sales:</span>
              <span className="detail-value">
                {formatCurrency(order.totalSales)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Amount Paid:</span>
              <span className="detail-value">
                {formatCurrency(order.amountPaid)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Balance Due:</span>
              <span
                className={`detail-value ${
                  balanceDue > 0 ? "amount-due" : "amount-paid"
                }`}
              >
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="detail-group">
            <div className="detail-row">
              <span className="detail-label">Vehicle ID:</span>
              <span className="detail-value">#{order.vehicleId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Miles In:</span>
              <span className="detail-value">
                {order.milesIn?.toLocaleString() || "N/A"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Miles Out:</span>
              <span className="detail-value">
                {order.milesOut?.toLocaleString() || "N/A"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Key Tag:</span>
              <span className="detail-value">{order.keytag || "N/A"}</span>
            </div>
          </div>

          {/* Staff Info */}
          <div className="detail-group">
            <div className="detail-row">
              <span className="detail-label">Service Writer:</span>
              <span className="detail-value">
                {order.serviceWriter?.firstName} {order.serviceWriter?.lastName}{" "}
                (#{order.serviceWriterId})
              </span>
            </div>
          </div>

          {/* Customer Concerns */}
          {order.customerConcerns && order.customerConcerns.length > 0 && (
            <div className="detail-group" style={{ gridColumn: "1 / -1" }}>
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                  color: "#dc3545",
                }}
              >
                ⚠️ Customer Concerns:
              </div>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {order.customerConcerns.map((concern, idx) => (
                  <li key={idx} style={{ marginBottom: "0.25rem" }}>
                    • {concern.concern || concern}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Jobs Summary */}
          <div className="detail-group" style={{ gridColumn: "1 / -1" }}>
            <div className="jobs-summary">
              <div className="job-stat">
                <span className="job-count">{order.jobs?.length || 0}</span>
                <span>Total Jobs</span>
              </div>
              {order.jobStats && (
                <>
                  {order.jobStats.authorized > 0 && (
                    <div className="job-stat">
                      <span className="job-count authorized">
                        {order.jobStats.authorized}
                      </span>
                      <span>Authorized</span>
                    </div>
                  )}
                  {order.jobStats.pending > 0 && (
                    <div className="job-stat">
                      <span className="job-count pending">
                        {order.jobStats.pending}
                      </span>
                      <span>Pending</span>
                    </div>
                  )}
                  {order.jobStats.declined > 0 && (
                    <div className="job-stat">
                      <span className="job-count declined">
                        {order.jobStats.declined}
                      </span>
                      <span>Declined</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Jobs Breakdown */}
      {isExpanded && order.jobs && order.jobs.length > 0 && (
        <div className="expandable-details expanded">
          <div className="job-details">
            <div
              style={{
                fontWeight: 600,
                marginBottom: "1rem",
                color: "#495057",
              }}
            >
              📋 Jobs Breakdown ({order.jobs.length}):
            </div>

            {order.jobs.map((job) => {
              const jobExp = expandedJobs.has(job.id);
              const categoryColor =
                JOB_CATEGORIES[job.category]?.color || "#607D8B";

              return (
                <div
                  key={job.id}
                  className={`job-item ${
                    job.authorized === true
                      ? "authorized"
                      : job.authorized === false
                      ? "declined"
                      : "pending"
                  }`}
                  onClick={() => toggleJob(job.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="job-header">
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <span
                          style={{
                            backgroundColor: categoryColor,
                            color: "white",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          {job.category}
                        </span>
                        {job.authorized === true && (
                          <span
                            style={{ color: "#28a745", fontWeight: "bold" }}
                          >
                            ✓
                          </span>
                        )}
                        {job.authorized === false && (
                          <span
                            style={{ color: "#dc3545", fontWeight: "bold" }}
                          >
                            ✗
                          </span>
                        )}
                        {job.authorized === null && (
                          <span
                            style={{ color: "#ffc107", fontWeight: "bold" }}
                          >
                            ⏳
                          </span>
                        )}
                      </div>
                      <span className="job-name">{job.name}</span>
                    </div>
                    <div className="job-financials">
                      <span>{job.laborHours}h</span>
                      <span>Subtotal: {formatCurrency(job.subtotal)}</span>
                    </div>
                  </div>

                  {jobExp && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.75rem",
                        borderTop: "1px solid #e9ecef",
                      }}
                    >
                      <div className="job-financials">
                        <span>Labor: {formatCurrency(job.laborTotal)}</span>
                        <span>Parts: {formatCurrency(job.partsTotal)}</span>
                        <span>Fees: {formatCurrency(job.feeTotal)}</span>
                      </div>

                      {job.labor && job.labor.length > 0 && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              marginBottom: "0.25rem",
                            }}
                          >
                            Labor Items:
                          </div>
                          {job.labor.map((l) => (
                            <div
                              key={l.id}
                              style={{
                                fontSize: "0.75rem",
                                color: "#666",
                                marginLeft: "1rem",
                              }}
                            >
                              • {l.name} ({l.hours}h @ {formatCurrency(l.rate)}
                              /hr)
                              {l.complete && (
                                <span
                                  style={{
                                    color: "#28a745",
                                    marginLeft: "0.5rem",
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {job.parts && job.parts.length > 0 && (
                        <div style={{ marginTop: "0.5rem" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              marginBottom: "0.25rem",
                            }}
                          >
                            Parts:
                          </div>
                          {job.parts.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                fontSize: "0.75rem",
                                color: "#666",
                                marginLeft: "1rem",
                              }}
                            >
                              • {p.name} (Qty: {p.quantity}) -{" "}
                              {formatCurrency(p.retail * p.quantity)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairOrdersPage;
