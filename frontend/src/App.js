// src/App.js - Clean Auto Shop Dashboard with Fixed Parser
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

const WEBSOCKET_URL =
  process.env.REACT_APP_WEBSOCKET_URL ||
  "wss://u4sqthpk4c.execute-api.us-east-1.amazonaws.com/dev";
const REST_API_URL =
  process.env.REACT_APP_REST_API_URL ||
  "https://x21d6cpmv6.execute-api.us-east-1.amazonaws.com/dev";

// Add debug logging
console.log("🔧 WebSocket URL:", WEBSOCKET_URL);
console.log("🔧 REST API URL:", REST_API_URL);

// Debug logging
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || "");
};

// Fixed Auto Shop Data Parser
class AutoShopParser {
  static parseWebhook(webhook) {
    try {
      let data, event;

      // Handle different webhook structures - FIXED for your DynamoDB data
      if (webhook.body?.data) {
        data = webhook.body.data;
        event = webhook.body.event || "";
      } else if (webhook.data) {
        data = webhook.data;
        event = webhook.event || "";
      } else if (webhook.parsed_body?.data) {
        // This handles your DynamoDB structure
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

      // All your data appears to be repair orders, so parse as such
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

    // Your data is in cents, convert to dollars
    return num / 100;
  }

  static parseRepairOrder(data, event, webhook) {
    const orderNumber = data.repairOrderNumber;
    const status = this.safeGet(data, "repairOrderStatus.name") || "Unknown";
    const customLabel =
      this.safeGet(data, "repairOrderCustomLabel.name") || null;

    // Handle financial data - your values are in cents
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

    // Calculate job stats
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
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    priority: "all",
    search: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    repairOrders: 0,
    appointments: 0,
    highPriority: 0,
    totalRevenue: 0,
    pendingBalance: 0,
  });

  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

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
    const appointments = events.filter((e) => e.type === "appointment");
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
      appointments: appointments.length,
      highPriority: highPriority.length,
      totalRevenue: totalRevenue,
      pendingBalance: pendingBalance,
    });
  }, [events]);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    if (filters.type !== "all") {
      filtered = filtered.filter((e) => e.type === filters.type);
    }
    if (filters.priority !== "all") {
      filtered = filtered.filter((e) => e.priority === filters.priority);
    }
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.orderNumber?.toString().includes(searchLower) ||
          e.title?.toLowerCase().includes(searchLower) ||
          e.status?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredEvents(filtered);
  }, [events, filters]);

  // WebSocket connection
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
    if (!amount || isNaN(amount)) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    try {
      return new Date(dateString).toLocaleString();
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
        return "Loading data...";
      case "disconnected":
        return "Disconnected";
      case "error":
        return "Connection Error";
      default:
        return "Unknown";
    }
  };

  return (
    <div className="auto-shop-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Auto Shop Real-Time Dashboard</h1>
          <div className="connection-status">
            <div
              className="status-indicator"
              style={{ backgroundColor: getStatusColor() }}
            ></div>
            <span>{getStatusText()}</span>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Events</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.today}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.repairOrders}</div>
            <div className="stat-label">Repair Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.appointments}</div>
            <div className="stat-label">Appointments</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.highPriority}</div>
            <div className="stat-label">High Priority</div>
          </div>
          <div className="stat-card revenue">
            <div className="stat-value">
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div className="stat-label">Total Revenue</div>
          </div>
          <div className="stat-card balance">
            <div className="stat-value">
              {formatCurrency(stats.pendingBalance)}
            </div>
            <div className="stat-label">Pending Balance</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters">
          <select
            value={filters.type}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, type: e.target.value }))
            }
          >
            <option value="all">All Types</option>
            <option value="repair-order">Repair Orders</option>
            <option value="appointment">Appointments</option>
            <option value="inspection">Inspections</option>
            <option value="status-update">Status Updates</option>
            <option value="generic">Other Events</option>
          </select>

          <select
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

          <input
            type="text"
            placeholder="Search orders, customers, jobs..."
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
            className="search-input"
          />

          <button onClick={() => setEvents([])} className="clear-button">
            Clear History
          </button>
        </div>
      </header>

      <main className="events-container">
        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            {connectionStatus === "loading-history" ? (
              <>
                <h2>Loading historical data...</h2>
                <p>Fetching recent auto shop events from the database.</p>
              </>
            ) : (
              <>
                <h2>Waiting for shop events...</h2>
                <p>
                  Real-time data will appear here when your auto shop system
                  sends webhooks.
                </p>
                {events.length > 0 && (
                  <p>
                    📊 {events.length} events loaded. Check your filters above.
                  </p>
                )}
              </>
            )}

            {!WEBSOCKET_URL && (
              <div className="setup-warning">
                <strong>Setup Required:</strong> WebSocket URL not configured.
              </div>
            )}
            {!REST_API_URL && (
              <div className="setup-warning">
                <strong>Setup Required:</strong> REST API URL not configured.
              </div>
            )}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <EventCard
              key={`${event.type}-${event.id}-${event.timestamp}`}
              event={event}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
            />
          ))
        )}
      </main>
    </div>
  );
}

// Event Card Component
function EventCard({ event, formatCurrency, formatTime }) {
  const getEventTitle = () => {
    return `Repair Order #${event.orderNumber}`;
  };

  const getStatusBadge = () => {
    const status = event.status || "Unknown";
    const statusClass = status.toLowerCase().replace(/\s+/g, "-");

    return (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className={`status-badge ${statusClass}`}>{status}</span>
        {event.customLabel && event.customLabel !== status && (
          <span className="custom-label">{event.customLabel}</span>
        )}
      </div>
    );
  };

  return (
    <div className={`event-card ${event.type} priority-${event.priority}`}>
      <div className="event-header">
        <div className="event-title">
          <h3>{getEventTitle()}</h3>
          {getStatusBadge()}
        </div>
        <div className="event-meta">
          <span className="timestamp">{formatTime(event.timestamp)}</span>
          {event.priority !== "normal" && (
            <span className={`priority-badge priority-${event.priority}`}>
              {event.priority.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="event-details">
        {/* Financial Summary */}
        <div className="financial-summary">
          <strong>Financial Summary</strong>
          <div className="financial-grid">
            {event.laborSales > 0 && (
              <div className="financial-item">
                <strong>Labor:</strong>
                <span>{formatCurrency(event.laborSales)}</span>
              </div>
            )}
            {event.partsSales > 0 && (
              <div className="financial-item">
                <strong>Parts:</strong>
                <span>{formatCurrency(event.partsSales)}</span>
              </div>
            )}
            {event.subletSales > 0 && (
              <div className="financial-item">
                <strong>Sublet:</strong>
                <span>{formatCurrency(event.subletSales)}</span>
              </div>
            )}
            {event.feeTotal > 0 && (
              <div className="financial-item">
                <strong>Fees:</strong>
                <span>{formatCurrency(event.feeTotal)}</span>
              </div>
            )}
            {event.taxes > 0 && (
              <div className="financial-item">
                <strong>Taxes:</strong>
                <span>{formatCurrency(event.taxes)}</span>
              </div>
            )}
          </div>

          <div className="total-section">
            <div className="total-item">
              <strong>Total Sales:</strong>
              <span className="total-amount">
                {formatCurrency(event.totalSales)}
              </span>
            </div>
            {event.amountPaid > 0 && (
              <div className="total-item">
                <strong>Amount Paid:</strong>
                <span className="paid-amount">
                  {formatCurrency(event.amountPaid)}
                </span>
              </div>
            )}
            {event.balanceDue > 0 && (
              <div className="total-item">
                <strong>Balance Due:</strong>
                <span className="balance-due">
                  {formatCurrency(event.balanceDue)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Job Summary */}
        {event.totalJobs > 0 && event.jobStats && (
          <div className="job-summary">
            <strong>Jobs Summary</strong>
            <div className="job-stats">
              <div className="job-stat">
                <span className="job-count">{event.totalJobs}</span>
                <span className="job-label">Total</span>
              </div>
              <div className="job-stat authorized">
                <span className="job-count">{event.jobStats.authorized}</span>
                <span className="job-label">Authorized</span>
              </div>
              <div className="job-stat pending">
                <span className="job-count">{event.jobStats.pending}</span>
                <span className="job-label">Pending</span>
              </div>
              <div className="job-stat declined">
                <span className="job-count">{event.jobStats.declined}</span>
                <span className="job-label">Declined</span>
              </div>
            </div>
          </div>
        )}

        {/* Customer Concerns */}
        {event.customerConcerns && event.customerConcerns.length > 0 && (
          <div className="customer-concerns">
            <strong>Customer Concerns:</strong>
            <ul>
              {event.customerConcerns.map((concern, idx) => (
                <li key={idx}>{concern}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Event Footer */}
        {event.event && (
          <div className="event-footer">
            <small>{event.event}</small>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
