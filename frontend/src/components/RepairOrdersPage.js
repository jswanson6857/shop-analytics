// src/components/RepairOrdersPage.js - FIXED: Better rendering and data display
import React, { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "../utils/dataParser";

const RepairOrdersPage = ({
  data,
  customers,
  searchTerm,
  setSearchTerm,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  statusFilter,
  setStatusFilter,
  connectionStatus,
  openROModal,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const applyTodayFilter = () => {
    const today = getTodayDate();
    setDateFrom(today);
    setDateTo(today);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFrom("");
    setDateTo("");
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayEvents = data.filter((e) => {
      const eventDate = new Date(e.createdDate || e.timestamp)
        .toISOString()
        .split("T")[0];
      return eventDate === today;
    });

    const totalRevenue = data.reduce(
      (sum, ro) => sum + (ro.totalWithTax || 0),
      0
    );

    const pendingBalance = data.reduce(
      (sum, ro) => sum + (ro.balanceDue || 0),
      0
    );

    return {
      total: data.length,
      today: todayEvents.length,
      totalRevenue: totalRevenue,
      pendingBalance: pendingBalance,
    };
  }, [data]);

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);

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
              placeholder="Search by RO#, customer, tech..."
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

          <button
            className="filter-action-btn today-btn"
            onClick={applyTodayFilter}
            title="Show only today's records"
          >
            📅 Today
          </button>

          <button
            className="filter-action-btn clear-btn"
            onClick={clearFilters}
            title="Clear all filters"
          >
            ✖ Clear
          </button>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Posted Orders</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today's Activity</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="stat-label">Total Sales (incl. tax)</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {formatCurrency(stats.pendingBalance)}
            </div>
            <div className="stat-label">Balance Due</div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {paginatedData.length === 0 ? (
        <div className="no-data">
          {connectionStatus === "loading-history" ? (
            <>
              <h2>📥 Loading historical data...</h2>
              <p>Fetching posted repair orders from the database.</p>
            </>
          ) : data.length === 0 ? (
            <>
              <h2>No posted repair orders yet</h2>
              <p>
                Only repair orders with "posted by" in their most recent event
                will appear here.
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
                customer={customers[order.customerId]}
                onOpenModal={() => openROModal(order.repairOrderNumber)}
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

// Order Card Component - FIXED: Better rendering
const OrderCard = ({ order, customer, onOpenModal }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const balanceDue = order.balanceDue || 0;
  const totalWithTax = order.totalWithTax || 0;

  // Get customer info
  const customerName =
    customer?.name ||
    `${order.customer?.firstName || ""} ${
      order.customer?.lastName || ""
    }`.trim() ||
    "Unknown Customer";
  const customerPhone = customer?.phone || "N/A";

  // Get tech info
  const techName = order.technician
    ? `${order.technician.firstName} ${order.technician.lastName}`
    : "Unassigned";

  return (
    <div className="event-card" style={{ borderLeftColor: "#007bff" }}>
      {/* Main Row */}
      <div
        className="event-main"
        style={{ cursor: "pointer", padding: "1.25rem" }}
      >
        <div className="event-icon" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? "▼" : "▶"}
        </div>

        <div className="event-title" style={{ flex: 1 }}>
          <h4 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
            Repair Order #{order.repairOrderNumber}
          </h4>
          <div className="event-subtitle">
            <span>
              👤 {customerName} (ID: {order.customerId})
            </span>
            <span>📞 {customerPhone}</span>
            <span>🔧 Tech: {techName}</span>
            <span>🕐 {formatDate(order.createdDate || order.timestamp)}</span>
            <span>🚗 Vehicle: #{order.vehicleId}</span>
          </div>
        </div>

        <div className="status-badges">
          <span
            className="badge status"
            style={{
              background: "#28a745",
              color: "white",
              padding: "0.4rem 0.8rem",
              fontSize: "0.85rem",
            }}
          >
            {order.repairOrderStatus?.name || "Unknown"}
          </span>
          {order.repairOrderCustomLabel?.name && (
            <span
              className="badge custom"
              style={{
                background: "#007bff",
                color: "white",
                padding: "0.4rem 0.8rem",
                fontSize: "0.85rem",
              }}
            >
              {order.repairOrderCustomLabel.name}
            </span>
          )}
        </div>

        <div className="event-amount">
          <div
            className={`amount-value ${
              balanceDue > 0 ? "amount-due" : "amount-paid"
            }`}
            style={{ fontSize: "1.4rem" }}
          >
            {formatCurrency(balanceDue > 0 ? balanceDue : totalWithTax)}
          </div>
          <div className="amount-label" style={{ fontSize: "0.85rem" }}>
            {balanceDue > 0
              ? "Balance Due (incl. tax)"
              : order.amountPaid > 0
              ? "Paid"
              : "Total (incl. tax)"}
          </div>
        </div>

        <button
          className="view-detail-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal();
          }}
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "6px",
            fontWeight: 600,
            cursor: "pointer",
            marginLeft: "1rem",
            whiteSpace: "nowrap",
          }}
        >
          View Details
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="event-details">
          {/* Financial Summary */}
          <div className="detail-group">
            <h5
              style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}
            >
              💰 Financial Summary
            </h5>
            <div className="detail-row">
              <span className="detail-label">Labor Sales:</span>
              <span className="detail-value">
                {formatCurrency(order.laborSales || 0)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Parts Sales:</span>
              <span className="detail-value">
                {formatCurrency(order.partsSales || 0)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Fees:</span>
              <span className="detail-value">
                {formatCurrency(order.feeTotal || 0)}
              </span>
            </div>
            <div
              className="detail-row"
              style={{
                borderTop: "2px solid var(--border-color)",
                paddingTop: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <span className="detail-label" style={{ fontWeight: 700 }}>
                Subtotal:
              </span>
              <span className="detail-value" style={{ fontWeight: 700 }}>
                {formatCurrency(order.totalSales || 0)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Taxes:</span>
              <span className="detail-value">
                {formatCurrency(order.taxes || 0)}
              </span>
            </div>
            <div
              className="detail-row"
              style={{
                borderTop: "2px solid var(--border-color)",
                paddingTop: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <span className="detail-label" style={{ fontWeight: 700 }}>
                Total (with tax):
              </span>
              <span
                className="detail-value"
                style={{ fontWeight: 700, fontSize: "1.1rem" }}
              >
                {formatCurrency(totalWithTax)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Amount Paid:</span>
              <span className="detail-value" style={{ color: "#28a745" }}>
                {formatCurrency(order.amountPaid || 0)}
              </span>
            </div>
            <div
              className="detail-row"
              style={{
                borderTop: "2px solid var(--border-color)",
                paddingTop: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              <span className="detail-label" style={{ fontWeight: 700 }}>
                Balance Due:
              </span>
              <span
                className={`detail-value ${
                  balanceDue > 0 ? "amount-due" : "amount-paid"
                }`}
                style={{ fontWeight: 700, fontSize: "1.1rem" }}
              >
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="detail-group">
            <h5
              style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}
            >
              🚗 Vehicle Information
            </h5>
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
            <h5
              style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}
            >
              👥 Staff Information
            </h5>
            <div className="detail-row">
              <span className="detail-label">Service Writer:</span>
              <span className="detail-value">
                {order.serviceWriter
                  ? `${order.serviceWriter.firstName} ${order.serviceWriter.lastName}`
                  : "N/A"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Technician:</span>
              <span className="detail-value">{techName}</span>
            </div>
          </div>

          {/* Customer Concerns */}
          {order.customerConcerns && order.customerConcerns.length > 0 && (
            <div className="detail-group" style={{ gridColumn: "1 / -1" }}>
              <h5 style={{ marginBottom: "0.75rem", color: "#dc3545" }}>
                ⚠️ Customer Concerns
              </h5>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {order.customerConcerns.map((concern, idx) => (
                  <li
                    key={idx}
                    style={{
                      marginBottom: "0.5rem",
                      padding: "0.5rem",
                      background: "#fff3cd",
                      borderLeft: "4px solid #ffc107",
                      borderRadius: "4px",
                    }}
                  >
                    • {concern.concern || concern}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Jobs Summary */}
          <div className="detail-group" style={{ gridColumn: "1 / -1" }}>
            <h5
              style={{ marginBottom: "0.75rem", color: "var(--text-primary)" }}
            >
              📋 Jobs Summary
            </h5>
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
            <button
              className="view-detail-btn"
              onClick={onOpenModal}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "6px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "1rem",
                width: "100%",
              }}
            >
              🔍 View Full Details & Contact Declined Jobs
            </button>
          </div>

          {/* Event History */}
          {order.events && order.events.length > 1 && (
            <div className="detail-group" style={{ gridColumn: "1 / -1" }}>
              <h5
                style={{
                  marginBottom: "0.75rem",
                  color: "var(--text-primary)",
                }}
              >
                📅 Event History ({order.events.length} events combined)
              </h5>
              <div style={{ fontSize: "0.85rem" }}>
                {order.events.slice(0, 5).map((evt, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "0.5rem",
                      marginBottom: "0.5rem",
                      background: "var(--bg-tertiary)",
                      borderRadius: "4px",
                      borderLeft: "3px solid #007bff",
                    }}
                  >
                    <div
                      style={{ fontWeight: 600, color: "var(--text-primary)" }}
                    >
                      {evt.event || "Event"}
                    </div>
                    <div
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "0.8rem",
                      }}
                    >
                      {formatDate(evt.timestamp)}
                    </div>
                  </div>
                ))}
                {order.events.length > 5 && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      fontSize: "0.85rem",
                      fontStyle: "italic",
                    }}
                  >
                    + {order.events.length - 5} more events
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RepairOrdersPage;
