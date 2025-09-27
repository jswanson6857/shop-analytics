// src/App.js - Efficient Auto Shop Dashboard for Hundreds of Records
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

const WEBSOCKET_URL =
  process.env.REACT_APP_WEBSOCKET_URL ||
  "wss://u4sqthpk4c.execute-api.us-east-1.amazonaws.com/dev";
const REST_API_URL =
  process.env.REACT_APP_REST_API_URL ||
  "https://x21d6cpmv6.execute-api.us-east-1.amazonaws.com/dev";

// Debug logging
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || "");
};

// Enhanced Auto Shop Data Parser
class AutoShopParser {
  static parseWebhook(webhook) {
    try {
      let data, event;

      // Handle different webhook structures
      if (webhook.body?.data) {
        data = webhook.body.data;
        event = webhook.body.event || "";
      } else if (webhook.data) {
        data = webhook.data;
        event = webhook.event || "";
      } else if (webhook.parsed_body?.data) {
        data = webhook.parsed_body.data;
        event = webhook.parsed_body.event || "";
      } else if (webhook.parsed_body) {
        data = webhook.parsed_body;
        event = webhook.parsed_body.event || "";
      } else {
        data = webhook;
        event = webhook.event || webhook.message || "";
      }

      // Skip events that don't have meaningful repair order data
      if (!data || typeof data !== "object" || !data.repairOrderNumber) {
        log("Skipping webhook - no repair order data", webhook);
        return null;
      }

      return this.parseRepairOrder(data, event, webhook);
    } catch (error) {
      log("Parser error", error);
      return null;
    }
  }

  static safeGet(obj, ...keys) {
    for (const key of keys) {
      if (obj && obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }
    return null;
  }

  static normalizeAmount(amount) {
    if (!amount || amount === null || amount === undefined) return 0;
    if (isNaN(amount)) return 0;
    const num = parseFloat(amount);
    if (num === 0) return 0;
    return num / 100; // Convert cents to dollars
  }

  static parseRepairOrder(data, event, webhook) {
    const orderNumber = data.repairOrderNumber;
    const status = this.safeGet(data, "repairOrderStatus.name") || "Unknown";
    const customLabel =
      this.safeGet(data, "repairOrderCustomLabel.name") || null;

    // Handle financial data
    const financials = {
      laborSales: this.normalizeAmount(data.laborSales),
      partsSales: this.normalizeAmount(data.partsSales),
      subletSales: this.normalizeAmount(data.subletSales),
      discountTotal: this.normalizeAmount(data.discountTotal),
      feeTotal: this.normalizeAmount(data.feeTotal),
      taxes: this.normalizeAmount(data.taxes),
      totalSales: this.normalizeAmount(data.totalSales),
      amountPaid: this.normalizeAmount(data.amountPaid),
    };

    const jobs = data.jobs || [];
    const concerns = data.customerConcerns || [];
    const jobStats = this.calculateJobStats(jobs);
    const balanceDue = financials.totalSales - financials.amountPaid;

    return {
      id: webhook.id || `repair-${orderNumber}-${Date.now()}`,
      type: "repair-order",
      timestamp: webhook.timestamp || new Date().toISOString(),
      orderNumber: orderNumber,
      status: status,
      customLabel: customLabel,
      ...financials,
      balanceDue: balanceDue,
      totalJobs: jobs.length,
      jobStats: jobStats,
      jobs: jobs,
      customerConcerns: concerns.map((c) => c.concern || c).filter(Boolean),
      priority: this.determinePriority(balanceDue, status),
      event: event,

      // Additional metadata
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      shopId: data.shopId,
      serviceWriterId: data.serviceWriterId,
      technicianId: data.technicianId,
      color: data.color,
      createdDate: data.createdDate,
      updatedDate: data.updatedDate,
    };
  }

  static calculateJobStats(jobs) {
    if (!Array.isArray(jobs)) return { authorized: 0, pending: 0, declined: 0 };

    const stats = { authorized: 0, pending: 0, declined: 0 };
    jobs.forEach((job) => {
      if (job.authorized === true) {
        stats.authorized++;
      } else if (job.authorized === false) {
        stats.declined++;
      } else {
        stats.pending++;
      }
    });
    return stats;
  }

  static determinePriority(balanceDue, status) {
    if (balanceDue > 5000) return "high";
    if (status && status.toLowerCase().includes("arrived")) return "high";
    if (balanceDue > 1000) return "medium";
    if (status && status.toLowerCase().includes("progress")) return "medium";
    return "normal";
  }
}

function App() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Filter states
  const [filters, setFilters] = useState({
    search: "",
    type: "all",
    status: "all",
    priority: "all",
    technician: "all",
  });

  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    repairOrders: 0,
    totalRevenue: 0,
    pendingBalance: 0,
    highPriority: 0,
  });

  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Set page title and favicon
  useEffect(() => {
    document.title = "Auto Shop Dashboard - Real-Time Orders";

    // Create favicon
    const link = document.createElement("link");
    link.rel = "icon";
    link.href =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🔧</text></svg>';

    // Remove any existing favicons
    const existingLinks = document.querySelectorAll("link[rel*='icon']");
    existingLinks.forEach((link) => link.remove());

    document.head.appendChild(link);
  }, []);

  // Load historical data
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!REST_API_URL || historicalDataLoaded) return;

      try {
        const dataEndpoint = `${REST_API_URL}/data`;
        log(`Loading historical data from: ${dataEndpoint}`);
        setConnectionStatus("loading-history");

        const response = await fetch(dataEndpoint);
        if (response.ok) {
          const historicalData = await response.json();
          log(`Received ${historicalData.length} historical events`);

          if (
            historicalData &&
            Array.isArray(historicalData) &&
            historicalData.length > 0
          ) {
            const parsedEvents = historicalData
              .map((rawEvent) => AutoShopParser.parseWebhook(rawEvent))
              .filter(Boolean)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (parsedEvents.length > 0 && mountedRef.current) {
              setEvents(parsedEvents);
              log(`Loaded ${parsedEvents.length} historical events`);
            }
          }
        }
        setHistoricalDataLoaded(true);
      } catch (error) {
        log(`Failed to load historical data: ${error.message}`);
        setHistoricalDataLoaded(true);
      } finally {
        if (mountedRef.current && connectionStatus === "loading-history") {
          setConnectionStatus("disconnected");
        }
      }
    };

    if (mountedRef.current && !historicalDataLoaded) {
      loadHistoricalData();
    }
  }, [historicalDataLoaded, connectionStatus]);

  // Calculate statistics
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayEvents = events.filter((e) => e.timestamp?.startsWith(today));
    const repairOrders = events.filter((e) => e.type === "repair-order");
    const highPriority = events.filter((e) => e.priority === "high");

    const totalRevenue = repairOrders.reduce(
      (sum, ro) => sum + (ro.totalSales || 0),
      0
    );
    const pendingBalance = repairOrders.reduce(
      (sum, ro) => sum + (ro.balanceDue || 0),
      0
    );

    setStats({
      total: events.length,
      today: todayEvents.length,
      repairOrders: repairOrders.length,
      totalRevenue: totalRevenue,
      pendingBalance: pendingBalance,
      highPriority: highPriority.length,
    });
  }, [events]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...events];

    // Apply search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.orderNumber?.toString().includes(searchLower) ||
          e.status?.toLowerCase().includes(searchLower) ||
          e.customLabel?.toLowerCase().includes(searchLower) ||
          e.event?.toLowerCase().includes(searchLower) ||
          e.customerId?.toString().includes(searchLower) ||
          e.vehicleId?.toString().includes(searchLower) ||
          e.jobs?.some((job) => job.name?.toLowerCase().includes(searchLower))
      );
    }

    // Apply other filters
    if (filters.type !== "all") {
      filtered = filtered.filter((e) => e.type === filters.type);
    }
    if (filters.priority !== "all") {
      filtered = filtered.filter((e) => e.priority === filters.priority);
    }
    if (filters.status !== "all") {
      const statusFilter = filters.status.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.status?.toLowerCase().includes(statusFilter) ||
          e.customLabel?.toLowerCase().includes(statusFilter)
      );
    }

    setFilteredEvents(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [events, filters]);

  // WebSocket connection logic (same as before)
  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current || !WEBSOCKET_URL) return;
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      log("WebSocket already connected");
      return;
    }

    log(`Connecting to WebSocket: ${WEBSOCKET_URL}`);
    setConnectionStatus("connecting");

    try {
      const websocket = new WebSocket(WEBSOCKET_URL);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        log("WebSocket connected");
        if (mountedRef.current) {
          setConnectionStatus("connected");
          setConnectionAttempts(0);
        }
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "webhook_data" && message.event === "insert") {
            const rawWebhook = {
              id: message.data.id,
              timestamp: message.data.timestamp,
              body: message.data.parsed_body,
            };

            const parsedEvent = AutoShopParser.parseWebhook(rawWebhook);
            if (parsedEvent && mountedRef.current) {
              setEvents((prev) => [parsedEvent, ...prev.slice(0, 499)]);
            }
          }
        } catch (error) {
          log("Error parsing WebSocket message", error);
        }
      };

      websocket.onclose = () => {
        log("WebSocket closed");
        if (mountedRef.current && connectionAttempts < 3) {
          setConnectionStatus("disconnected");
          setConnectionAttempts((prev) => prev + 1);
        }
      };

      websocket.onerror = (error) => {
        log("WebSocket error", error);
        if (mountedRef.current) {
          setConnectionStatus("error");
        }
      };
    } catch (error) {
      log("Failed to create WebSocket", error);
      setConnectionStatus("error");
    }
  }, [connectionAttempts]);

  // Connection management
  useEffect(() => {
    if (!mountedRef.current) return;

    if (
      historicalDataLoaded &&
      connectionStatus === "disconnected" &&
      connectionAttempts === 0
    ) {
      connectWebSocket();
    } else if (
      historicalDataLoaded &&
      connectionAttempts > 0 &&
      connectionAttempts < 3
    ) {
      const delay = 2000 * connectionAttempts;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [
    connectionStatus,
    connectionAttempts,
    connectWebSocket,
    historicalDataLoaded,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // Helper functions
  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMinutes = Math.floor((now - date) / (1000 * 60));

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes} min ago`;
      if (diffMinutes < 1440)
        return `${Math.floor(diffMinutes / 60)} hour${
          Math.floor(diffMinutes / 60) !== 1 ? "s" : ""
        } ago`;

      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return dateString;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "#28a745";
      case "connecting":
        return "#17a2b8";
      case "loading-history":
        return "#6f42c1";
      case "disconnected":
        return "#ffc107";
      case "error":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "loading-history":
        return "Loading...";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  const toggleExpand = (eventId) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentEvents = filteredEvents.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="auto-shop-dashboard">
      <header className="dashboard-header">
        <div className="header-row">
          <h1>🔧 Auto Shop Dashboard</h1>
          <div className="connection-status">
            <div
              className="status-indicator"
              style={{ backgroundColor: getStatusColor() }}
            ></div>
            <span>{getStatusText()}</span>
          </div>
        </div>

        <div className="filters-row">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by order #, customer, tech, service writer, job name..."
              value={filters.search}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>

          <select
            className="filter-select"
            value={filters.type}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, type: e.target.value }))
            }
          >
            <option value="all">All Types</option>
            <option value="repair-order">Repair Orders</option>
          </select>

          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="all">All Status</option>
            <option value="work-in-progress">Work In Progress</option>
            <option value="complete">Complete</option>
            <option value="arrived">Arrived</option>
            <option value="quoting">Quoting</option>
          </select>

          <select
            className="filter-select"
            value={filters.priority}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, priority: e.target.value }))
            }
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="normal">Normal Priority</option>
          </select>
        </div>

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
            <div className="stat-label">Pending Balance</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.highPriority}</div>
            <div className="stat-label">High Priority</div>
          </div>
        </div>
      </header>

      <main className="events-container">
        {currentEvents.length === 0 ? (
          <div className="no-data">
            {connectionStatus === "loading-history" ? (
              <>
                <h2>Loading historical data...</h2>
                <p>Fetching recent auto shop events from the database.</p>
              </>
            ) : filteredEvents.length === 0 && events.length > 0 ? (
              <>
                <h2>No results found</h2>
                <p>Try adjusting your search or filter criteria.</p>
              </>
            ) : (
              <>
                <h2>Waiting for shop events...</h2>
                <p>
                  Real-time data will appear here when your auto shop system
                  sends webhooks.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="pagination-controls">
              <div className="page-info">
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredEvents.length)} of{" "}
                {filteredEvents.length} orders
              </div>
              <div className="page-buttons">
                <button
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  ← Prev
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`page-btn ${
                        currentPage === pageNum ? "active" : ""
                      }`}
                      onClick={() => goToPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next →
                </button>
              </div>
              <select
                className="filter-select"
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                style={{ width: "auto" }}
              >
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="events-list">
              {currentEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isExpanded={expandedCards.has(event.id)}
                  onToggleExpand={() => toggleExpand(event.id)}
                  formatCurrency={formatCurrency}
                  formatTime={formatTime}
                />
              ))}
            </div>

            <div className="pagination-controls">
              <div className="page-info">
                Showing {startIndex + 1}-
                {Math.min(endIndex, filteredEvents.length)} of{" "}
                {filteredEvents.length} orders
              </div>
              <div className="page-buttons">
                <button
                  className="page-btn"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  ← Prev
                </button>
                <button
                  className="page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Enhanced Event Card Component
function EventCard({
  event,
  isExpanded,
  onToggleExpand,
  formatCurrency,
  formatTime,
}) {
  const getEventIcon = () => {
    if (event.status?.toLowerCase().includes("complete")) return "✅";
    if (event.status?.toLowerCase().includes("arrived")) return "🚗";
    if (event.customLabel?.toLowerCase().includes("quoting")) return "💰";
    return "🔄";
  };

  const getTechName = () => {
    // When tech names are available, they'll be here
    if (event.technicianId) {
      return `Tech ${event.technicianId}`;
    }
    return "Unassigned";
  };

  const getServiceWriterName = () => {
    // When service writer names are available, they'll be here
    if (event.serviceWriterId) {
      return `Writer ${event.serviceWriterId}`;
    }
    return "Unknown Writer";
  };

  return (
    <div
      className={`event-card priority-${event.priority}`}
      onClick={onToggleExpand}
      style={{ cursor: "pointer" }}
    >
      <div className="event-main">
        <div className="event-icon">{getEventIcon()}</div>
        <div className="event-title">
          <h4>Repair Order #{event.orderNumber}</h4>
          <div className="event-subtitle">
            <span>👤 {getTechName()}</span>
            <span>📝 {getServiceWriterName()}</span>
            <span>🕐 {formatTime(event.timestamp)}</span>
            <span>🆔 Customer: {event.customerId}</span>
          </div>
        </div>
        <div className="status-badges">
          <span className="badge status">{event.status}</span>
          {event.customLabel && (
            <span className="badge custom">{event.customLabel}</span>
          )}
          {event.priority !== "normal" && (
            <span className="badge priority">{event.priority}</span>
          )}
        </div>
        <div className="event-amount">
          <div
            className={`amount-value ${
              event.balanceDue > 0 ? "amount-due" : "amount-paid"
            }`}
          >
            {formatCurrency(
              event.balanceDue > 0 ? event.balanceDue : event.totalSales
            )}
          </div>
          <div className="amount-label">
            {event.balanceDue > 0
              ? "Balance Due"
              : event.amountPaid > 0
              ? "Paid"
              : "Total Sales"}
          </div>
        </div>
      </div>

      <div className="event-details">
        <div className="detail-group">
          <div className="detail-row">
            <span className="detail-label">Total Sales:</span>
            <span className="detail-value">
              {formatCurrency(event.totalSales)}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Amount Paid:</span>
            <span className="detail-value">
              {formatCurrency(event.amountPaid)}
            </span>
          </div>
        </div>

        <div className="detail-group">
          <div className="detail-row">
            <span className="detail-label">Labor:</span>
            <span className="detail-value">
              {formatCurrency(event.laborSales)}
            </span>
          </div>
          {event.feeTotal > 0 && (
            <div className="detail-row">
              <span className="detail-label">Fees:</span>
              <span className="detail-value">
                {formatCurrency(event.feeTotal)}
              </span>
            </div>
          )}
          {event.taxes > 0 && (
            <div className="detail-row">
              <span className="detail-label">Taxes:</span>
              <span className="detail-value">
                {formatCurrency(event.taxes)}
              </span>
            </div>
          )}
        </div>

        <div className="detail-group">
          <div
            style={{
              marginBottom: "0.5rem",
              fontWeight: 600,
              color: "#495057",
            }}
          >
            Jobs Summary:
          </div>
          <div className="jobs-summary">
            <div className="job-stat">
              <span className="job-count">{event.totalJobs}</span>
              <span>Total</span>
            </div>
            {event.jobStats?.authorized > 0 && (
              <div className="job-stat">
                <span className="job-count authorized">
                  {event.jobStats.authorized}
                </span>
                <span>Authorized</span>
              </div>
            )}
            {event.jobStats?.pending > 0 && (
              <div className="job-stat">
                <span className="job-count pending">
                  {event.jobStats.pending}
                </span>
                <span>Pending</span>
              </div>
            )}
            {event.jobStats?.declined > 0 && (
              <div className="job-stat">
                <span className="job-count declined">
                  {event.jobStats.declined}
                </span>
                <span>Declined</span>
              </div>
            )}
          </div>
        </div>

        <div className="detail-group">
          <div className="detail-row">
            <span className="detail-label">Vehicle ID:</span>
            <span className="detail-value">{event.vehicleId}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Created:</span>
            <span className="detail-value">
              {formatTime(event.createdDate)}
            </span>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="expandable-details expanded">
          <div className="job-details">
            <div
              style={{
                fontWeight: 600,
                marginBottom: "1rem",
                color: "#495057",
              }}
            >
              📋 Detailed Job Breakdown:
            </div>

            {event.jobs && event.jobs.length > 0 ? (
              event.jobs.map((job, index) => (
                <div
                  key={job.id || index}
                  className={`job-item ${
                    job.authorized === true
                      ? "authorized"
                      : job.authorized === false
                      ? "declined"
                      : "pending"
                  }`}
                >
                  <div className="job-header">
                    <span className="job-name">
                      Job: "{job.name}"{" "}
                      {job.authorized === true
                        ? "✅"
                        : job.authorized === false
                        ? "❌"
                        : "⏳"}
                    </span>
                    <span
                      className={`badge ${
                        job.authorized === true
                          ? "authorized"
                          : job.authorized === false
                          ? "declined"
                          : "pending"
                      }`}
                    >
                      {job.authorized === true
                        ? "Authorized"
                        : job.authorized === false
                        ? "Declined"
                        : "Pending"}
                    </span>
                  </div>
                  <div className="job-financials">
                    <span>
                      Labor: {formatCurrency(job.laborTotal || 0)} (
                      {job.laborHours || 0}h)
                    </span>
                    <span>Parts: {formatCurrency(job.partsTotal || 0)}</span>
                    <span>Fees: {formatCurrency(job.feeTotal || 0)}</span>
                    <span>Subtotal: {formatCurrency(job.subtotal || 0)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  fontStyle: "italic",
                  padding: "1rem",
                }}
              >
                No detailed job information available
              </div>
            )}
          </div>
        </div>
      )}

      <button
        className="expand-toggle"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {isExpanded ? "▲ Hide" : "▼ Show"} detailed job breakdown
      </button>
    </div>
  );
}

export default App;
