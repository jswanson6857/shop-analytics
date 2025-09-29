// src/components/EventExplorerPage.js
import React, { useState, useMemo } from "react";
import { formatCurrency, formatDate } from "../utils/dataParser";

const EventExplorerPage = ({
  data,
  searchTerm,
  setSearchTerm,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) => {
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [data, currentPage]);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const toggleEvent = (id) => {
    setExpandedEvents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const analyzeFields = (ro) => {
    const provided = [];
    const nullFields = [];

    const checkField = (name, value, description) => {
      if (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        (typeof value !== "object" || Object.keys(value).length > 0)
      ) {
        provided.push({ name, value, description });
      } else {
        nullFields.push({ name, description });
      }
    };

    checkField("event", ro.event, "Event type");
    checkField("customer", ro.customer, "Customer with name");
    checkField("technician", ro.technician, "Technician with name");
    checkField("serviceWriter", ro.serviceWriter, "Service writer");
    checkField("totalSales", ro.totalSales, "Total sales amount");
    checkField("laborSales", ro.laborSales, "Labor sales");
    checkField("partsSales", ro.partsSales, "Parts sales");
    checkField(
      "amountPaid",
      ro.amountPaid !== undefined ? ro.amountPaid : null,
      "Amount paid"
    );
    checkField("milesIn", ro.milesIn, "Miles in");
    checkField("milesOut", ro.milesOut, "Miles out");
    checkField("keytag", ro.keytag, "Key tag");
    checkField("jobs", ro.jobs?.length > 0 ? ro.jobs : null, "Jobs array");
    checkField("feeTotal", ro.feeTotal, "Fees total");
    checkField("taxes", ro.taxes, "Taxes");
    checkField("discountTotal", ro.discountTotal, "Discounts");
    checkField("subletSales", ro.subletSales, "Sublet sales");

    return { provided, nullFields };
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
              placeholder="Search by event, RO#, customer..."
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
        </div>
      </div>

      {/* Event Cards */}
      <div className="events-list">
        {paginatedData.map((ro) => {
          const isExpanded = expandedEvents.has(ro.id);
          const { provided, nullFields } = analyzeFields(ro);

          return (
            <div
              key={ro.id}
              className="event-card"
              style={{ borderLeftColor: "#9C27B0" }}
            >
              <div
                className="event-main"
                onClick={() => toggleEvent(ro.id)}
                style={{ cursor: "pointer" }}
              >
                <div className="event-icon">{isExpanded ? "▼" : "▶"}</div>
                <div className="event-title">
                  <h4 style={{ color: "#9C27B0" }}>{ro.event}</h4>
                  <div className="event-subtitle">
                    <span>RO #{ro.repairOrderNumber}</span>
                    <span>{formatDate(ro.timestamp)}</span>
                  </div>
                </div>
                <div className="status-badges">
                  <span
                    className="badge"
                    style={{ background: "#28a745", color: "white" }}
                  >
                    {provided.length} Provided
                  </span>
                  <span
                    className="badge"
                    style={{ background: "#6c757d", color: "white" }}
                  >
                    {nullFields.length} Null
                  </span>
                </div>
              </div>

              {/* Quick Preview */}
              <div style={{ padding: "0 1rem 1rem 1rem" }}>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
                >
                  {ro.customer && (
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        background: "#d4edda",
                        color: "#155724",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      ✓ Customer: {ro.customer.firstName} {ro.customer.lastName}
                    </span>
                  )}
                  {ro.technician && (
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        background: "#d4edda",
                        color: "#155724",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      ✓ Tech: {ro.technician.firstName} {ro.technician.lastName}
                    </span>
                  )}
                  {ro.totalSales && (
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        background: "#d4edda",
                        color: "#155724",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      ✓ Total: {formatCurrency(ro.totalSales)}
                    </span>
                  )}
                  {ro.jobs && ro.jobs.length > 0 && (
                    <span
                      style={{
                        padding: "0.25rem 0.5rem",
                        background: "#d4edda",
                        color: "#155724",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      ✓ {ro.jobs.length} Jobs
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="expandable-details expanded">
                  <div
                    style={{
                      padding: "1rem",
                      background: "#f8f9fa",
                      borderTop: "1px solid #dee2e6",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "1rem",
                      }}
                    >
                      {/* Provided Fields */}
                      <div>
                        <h4
                          style={{
                            fontWeight: 600,
                            color: "#28a745",
                            marginBottom: "0.75rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          ✓ Provided Fields ({provided.length})
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {provided.map((field, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "#d4edda",
                                borderLeft: "4px solid #28a745",
                                padding: "0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                              }}
                            >
                              <div
                                style={{ fontWeight: 600, color: "#155724" }}
                              >
                                {field.name}
                              </div>
                              <div
                                style={{ color: "#6c757d", fontSize: "0.7rem" }}
                              >
                                {field.description}
                              </div>
                              <div
                                style={{
                                  color: "#155724",
                                  marginTop: "0.25rem",
                                  fontFamily: "monospace",
                                }}
                              >
                                {typeof field.value === "object"
                                  ? field.name === "customer"
                                    ? `${field.value.firstName} ${
                                        field.value.lastName
                                      }${
                                        field.value.email
                                          ? ` (${field.value.email})`
                                          : ""
                                      }`
                                    : field.name === "technician" ||
                                      field.name === "serviceWriter"
                                    ? `${field.value.firstName} ${field.value.lastName}`
                                    : field.name === "jobs"
                                    ? `${field.value.length} jobs`
                                    : JSON.stringify(field.value).substring(
                                        0,
                                        50
                                      )
                                  : field.name.includes("Sales") ||
                                    field.name.includes("Paid") ||
                                    field.name.includes("Total")
                                  ? formatCurrency(field.value)
                                  : field.value?.toLocaleString
                                  ? field.value.toLocaleString()
                                  : field.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Null Fields */}
                      <div>
                        <h4
                          style={{
                            fontWeight: 600,
                            color: "#6c757d",
                            marginBottom: "0.75rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          ○ Null Fields ({nullFields.length})
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {nullFields.map((field, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "#f8f9fa",
                                borderLeft: "4px solid #6c757d",
                                padding: "0.5rem",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                              }}
                            >
                              <div
                                style={{ fontWeight: 600, color: "#495057" }}
                              >
                                {field.name}
                              </div>
                              <div
                                style={{ color: "#6c757d", fontSize: "0.7rem" }}
                              >
                                {field.description}
                              </div>
                              <div
                                style={{ color: "#999", marginTop: "0.25rem" }}
                              >
                                NULL or not provided
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Jobs from this event */}
                    {ro.jobs && ro.jobs.length > 0 && (
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "1rem",
                          borderTop: "1px solid #dee2e6",
                        }}
                      >
                        <h4
                          style={{
                            fontWeight: 600,
                            marginBottom: "0.5rem",
                            fontSize: "0.9rem",
                          }}
                        >
                          Jobs from this event:
                        </h4>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                          }}
                        >
                          {ro.jobs.map((job) => (
                            <div
                              key={job.id}
                              style={{
                                background: "#e7f3ff",
                                padding: "0.5rem",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "0.75rem",
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600 }}>
                                  {job.name}
                                </span>
                                <span style={{ marginLeft: "0.5rem" }}>
                                  {job.authorized === true && (
                                    <span style={{ color: "#28a745" }}>
                                      ✓ Authorized
                                    </span>
                                  )}
                                  {job.authorized === false && (
                                    <span style={{ color: "#dc3545" }}>
                                      ✗ Declined
                                    </span>
                                  )}
                                  {job.authorized === null && (
                                    <span style={{ color: "#ffc107" }}>
                                      ⏳ Pending
                                    </span>
                                  )}
                                </span>
                              </div>
                              <span style={{ fontWeight: 600 }}>
                                {formatCurrency(job.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="pagination-controls">
        <div className="page-info">
          Showing {(currentPage - 1) * itemsPerPage + 1}-
          {Math.min(currentPage * itemsPerPage, data.length)} of {data.length}{" "}
          events
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

export default EventExplorerPage;
