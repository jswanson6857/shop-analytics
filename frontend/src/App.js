// src/App.js - Auto Shop Management Dashboard - COMPLETE WITH HISTORICAL DATA
import React, { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";

// Get WebSocket URL from environment - this MUST be embedded in build
const WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL;
const REST_API_URL = process.env.REACT_APP_REST_API_URL;

// Debug logging for connection issues
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, data || "");
};

// Auto Shop Data Parser - Enhanced to handle full data structure
class AutoShopParser {
  static parseWebhook(webhook) {
    try {
      const body = webhook.body;
      if (!body || !body.data) {
        log("Invalid webhook body", webhook);
        return null;
      }

      const data = body.data;
      const event = body.event || "";

      if (data.repairOrderNumber) {
        return this.parseRepairOrder(data, event, webhook);
      } else if (data.appointmentStatus) {
        return this.parseAppointment(data, event, webhook);
      }

      log("Unknown webhook type", data);
      return null;
    } catch (error) {
      log("Error parsing webhook", error);
      return null;
    }
  }

  static parseRepairOrder(data, event, webhook) {
    try {
      const orderNumber = data.repairOrderNumber;
      const status = data.repairOrderStatus?.name || "Unknown";
      const statusCode = data.repairOrderStatus?.code;
      const customLabel =
        data.repairOrderCustomLabel?.name || data.repairOrderLabel?.name;
      const color = data.color;

      // Financial data (all in cents, convert to dollars) - handle null values
      const laborSales = data.laborSales ? data.laborSales / 100 : 0;
      const partsSales = data.partsSales ? data.partsSales / 100 : 0;
      const subletSales = data.subletSales ? data.subletSales / 100 : 0;
      const discountTotal = data.discountTotal ? data.discountTotal / 100 : 0;
      const feeTotal = data.feeTotal ? data.feeTotal / 100 : 0;
      const taxes = data.taxes ? data.taxes / 100 : 0;
      const totalSales = data.totalSales ? data.totalSales / 100 : 0;
      const amountPaid = data.amountPaid ? data.amountPaid / 100 : 0;
      const balanceDue = totalSales - amountPaid;

      // Extract job information with detailed breakdown
      const jobs = data.jobs || [];
      const authorizedJobs = jobs.filter((job) => job.authorized === true);
      const pendingJobs = jobs.filter((job) => job.authorized === null);
      const rejectedJobs = jobs.filter((job) => job.authorized === false);

      // Calculate total labor hours
      const totalLaborHours = jobs.reduce(
        (sum, job) => sum + (job.laborHours || 0),
        0
      );

      // Extract customer concerns - handle both string and object formats
      let concerns = [];
      if (data.customerConcerns && Array.isArray(data.customerConcerns)) {
        concerns = data.customerConcerns
          .map((c) => (typeof c === "string" ? c : c.concern))
          .filter(Boolean)
          .map((c) => c.trim());
      }

      // Determine priority based on multiple factors
      let priority = "normal";
      if (balanceDue > 500) priority = "high";
      else if (status === "Work-In-Progress" || statusCode === "WORKINPROGRESS")
        priority = "medium";
      else if (totalSales > 1000) priority = "medium";
      else if (authorizedJobs.length > 3) priority = "medium";

      // Job details for display - handle missing data gracefully
      const jobDetails = jobs.map((job) => ({
        id: job.id || Math.random(),
        name: job.name || "Unnamed Job",
        authorized: job.authorized,
        laborTotal: job.laborTotal ? job.laborTotal / 100 : 0,
        partsTotal: job.partsTotal ? job.partsTotal / 100 : 0,
        subtotal: job.subtotal ? job.subtotal / 100 : 0,
        laborHours: job.laborHours || 0,
        complete: job.labor?.some((l) => l.complete) || false,
      }));

      return {
        id: webhook.id || Math.random(),
        type: "repair-order",
        timestamp: webhook.timestamp || new Date().toISOString(),
        orderNumber: orderNumber,
        status: status,
        statusCode: statusCode,
        customLabel: customLabel,
        color: color,

        // Financial breakdown
        laborSales: laborSales,
        partsSales: partsSales,
        subletSales: subletSales,
        discountTotal: discountTotal,
        feeTotal: feeTotal,
        taxes: taxes,
        totalSales: totalSales,
        amountPaid: amountPaid,
        balanceDue: balanceDue,

        // Job details
        totalJobs: jobs.length,
        authorizedJobs: authorizedJobs.length,
        pendingJobs: pendingJobs.length,
        rejectedJobs: rejectedJobs.length,
        totalLaborHours: totalLaborHours,
        jobDetails: jobDetails,

        // Metadata - handle null values
        customerId: data.customerId || null,
        vehicleId: data.vehicleId || null,
        technicianId: data.technicianId || null,
        serviceWriterId: data.serviceWriterId || null,
        shopId: data.shopId || null,
        mileage: data.milesIn || null,
        milesOut: data.milesOut || null,
        keyTag: data.keytag || null,
        completedDate: data.completedDate || null,
        createdDate: data.createdDate || null,
        updatedDate: data.updatedDate || null,
        customerConcerns: concerns,
        priority: priority,
        event: event,
      };
    } catch (error) {
      log("Error parsing repair order", error);
      return null;
    }
  }

  static parseAppointment(data, event, webhook) {
    try {
      const status = data.appointmentStatus;
      const title = data.title || "Unknown Customer";
      const startTime = data.startTime ? new Date(data.startTime) : null;
      const endTime = data.endTime ? new Date(data.endTime) : null;

      let priority = "normal";
      if (status === "ARRIVED") priority = "high";
      else if (status === "CONFIRMED") priority = "medium";

      return {
        id: webhook.id || Math.random(),
        type: "appointment",
        timestamp: webhook.timestamp || new Date().toISOString(),
        status: status,
        title: title,
        startTime: startTime,
        endTime: endTime,
        description: data.description || null,
        arrived: data.arrived || false,
        customerId: data.customerId || null,
        vehicleId: data.vehicleId || null,
        appointmentOption: data.appointmentOption?.name || null,
        priority: priority,
        event: event,
        color: data.color || null,
      };
    } catch (error) {
      log("Error parsing appointment", error);
      return null;
    }
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
    totalLaborHours: 0,
  });

  // Use refs to prevent infinite loops and memory leaks
  const websocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Load historical data on component mount
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!REST_API_URL || historicalDataLoaded) return;

      try {
        const dataEndpoint = `${REST_API_URL}/data`;
        log(`🔄 Loading historical data from: ${dataEndpoint}`);
        setConnectionStatus("loading-history");

        const response = await fetch(dataEndpoint, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const historicalData = await response.json();
          log(`📚 Received ${historicalData.length} historical events`);

          if (
            historicalData &&
            Array.isArray(historicalData) &&
            historicalData.length > 0
          ) {
            // Parse historical data using the same parser
            const parsedEvents = historicalData
              .map((rawEvent) => {
                try {
                  return AutoShopParser.parseWebhook(rawEvent);
                } catch (error) {
                  log(`Error parsing historical event: ${error.message}`);
                  return null;
                }
              })
              .filter(Boolean)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (parsedEvents.length > 0 && mountedRef.current) {
              setEvents(parsedEvents);
              setHistoricalDataLoaded(true);
              log(
                `✅ Loaded ${parsedEvents.length} historical events on initial load`
              );
            }
          } else {
            log(`📭 No historical data available`);
            setHistoricalDataLoaded(true);
          }
        } else {
          log(
            `⚠️ Historical data endpoint returned ${response.status}: ${response.statusText}`
          );
          setHistoricalDataLoaded(true);
        }
      } catch (error) {
        log(`❌ Failed to load historical data: ${error.message}`);
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
    const todayEvents = events.filter(
      (e) => e.timestamp && e.timestamp.startsWith(today)
    );
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
    const totalLaborHours = repairOrders.reduce(
      (sum, ro) => sum + (ro.totalLaborHours || 0),
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
      totalLaborHours: totalLaborHours,
    });
  }, [events]);

  // Apply filters
  useEffect(() => {
    let filtered = [...events];

    if (filters.type !== "all") {
      filtered = filtered.filter((e) => e.type === filters.type);
    }

    if (filters.status !== "all") {
      filtered = filtered.filter((e) =>
        e.status?.toLowerCase().includes(filters.status.toLowerCase())
      );
    }

    if (filters.priority !== "all") {
      filtered = filtered.filter((e) => e.priority === filters.priority);
    }

    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      filtered = filtered.filter(
        (e) =>
          e.orderNumber?.toString().includes(searchLower) ||
          e.title?.toLowerCase().includes(searchLower) ||
          e.status?.toLowerCase().includes(searchLower) ||
          e.customLabel?.toLowerCase().includes(searchLower) ||
          e.customerConcerns?.some((concern) =>
            concern.toLowerCase().includes(searchLower)
          ) ||
          e.jobDetails?.some((job) =>
            job.name?.toLowerCase().includes(searchLower)
          )
      );
    }

    setFilteredEvents(filtered);
  }, [events, filters]);

  // ENHANCED WebSocket connection function
  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current) return;

    if (!WEBSOCKET_URL || WEBSOCKET_URL.includes("your-websocket-id")) {
      const error = `WebSocket URL not configured properly: ${WEBSOCKET_URL}`;
      log(error);
      setConnectionStatus("error");
      return;
    }

    if (
      websocketRef.current &&
      (websocketRef.current.readyState === WebSocket.CONNECTING ||
        websocketRef.current.readyState === WebSocket.OPEN)
    ) {
      log("WebSocket already active, skipping");
      return;
    }

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    log(`🔌 Attempting WebSocket connection to: ${WEBSOCKET_URL}`);
    setConnectionStatus("connecting");

    try {
      const websocket = new WebSocket(WEBSOCKET_URL);
      websocketRef.current = websocket;

      const connectionTimeout = setTimeout(() => {
        if (websocket.readyState === WebSocket.CONNECTING) {
          const timeoutError = `WebSocket connection timeout after 30 seconds`;
          log(`❌ ${timeoutError}`);
          websocket.close();
          if (mountedRef.current) {
            setConnectionStatus("error");
          }
        }
      }, 30000);

      websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        log(`✅ WebSocket connected successfully`);

        if (mountedRef.current) {
          setConnectionStatus("connected");
          setConnectionAttempts(0);
        }

        try {
          websocket.send(
            JSON.stringify({
              type: "ping",
              timestamp: new Date().toISOString(),
            })
          );
          log("📡 Ping sent");
        } catch (e) {
          log("⚠️ Could not send ping", e);
        }
      };

      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          log(`📨 Message received: ${message.type}`);

          if (message.type === "webhook_data" && message.event === "insert") {
            const rawWebhook = {
              id: message.data.id,
              timestamp: message.data.timestamp,
              body: message.data.parsed_body,
            };

            const parsedEvent = AutoShopParser.parseWebhook(rawWebhook);
            if (parsedEvent && mountedRef.current) {
              log(
                `🎯 Adding new real-time event: ${
                  parsedEvent.orderNumber || parsedEvent.title
                }`
              );

              setEvents((prev) => {
                const eventExists = prev.some(
                  (existingEvent) =>
                    existingEvent.id === parsedEvent.id &&
                    existingEvent.timestamp === parsedEvent.timestamp
                );

                if (eventExists) {
                  log(
                    `🔄 Event ${parsedEvent.id} already exists, skipping duplicate`
                  );
                  return prev;
                }

                return [parsedEvent, ...prev.slice(0, 499)];
              });
            }
          }
        } catch (error) {
          log("❌ Error parsing message", error);
        }
      };

      websocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        log(`🔌 WebSocket closed: Code ${event.code} - ${event.reason}`);

        if (websocketRef.current === websocket) {
          websocketRef.current = null;
        }

        if (mountedRef.current) {
          if (
            event.code !== 1000 &&
            event.code !== 1001 &&
            connectionAttempts < 3
          ) {
            setConnectionStatus("disconnected");
            setConnectionAttempts((prev) => prev + 1);
          } else if (connectionAttempts >= 3) {
            setConnectionStatus("failed");
          } else {
            setConnectionStatus("disconnected");
          }
        }
      };

      websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        log("❌ WebSocket error", error);

        if (mountedRef.current) {
          setConnectionStatus("error");
          setConnectionAttempts((prev) => prev + 1);
        }
      };
    } catch (error) {
      log("❌ Failed to create WebSocket", error);
      if (mountedRef.current) {
        setConnectionStatus("error");
        setConnectionAttempts((prev) => prev + 1);
      }
    }
  }, [connectionAttempts]);

  // Connection management with proper cleanup
  useEffect(() => {
    if (!mountedRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Only start WebSocket after historical data is loaded or failed to load
    if (
      historicalDataLoaded &&
      connectionStatus === "disconnected" &&
      connectionAttempts === 0
    ) {
      connectWebSocket();
    } else if (
      historicalDataLoaded &&
      (connectionStatus === "error" || connectionStatus === "disconnected") &&
      connectionAttempts > 0 &&
      connectionAttempts < 3
    ) {
      const delay = Math.min(
        2000 * Math.pow(1.5, connectionAttempts - 1),
        10000
      );
      log(`⏱️ Reconnecting in ${delay}ms (attempt ${connectionAttempts + 1})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connectWebSocket();
        }
      }, delay);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [
    connectionStatus,
    connectionAttempts,
    connectWebSocket,
    historicalDataLoaded,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (websocketRef.current) {
        websocketRef.current.close(1000, "Component unmounting");
        websocketRef.current = null;
      }
    };
  }, []);

  // Manual reconnect function
  const handleReconnect = () => {
    log("🔄 Manual reconnection triggered");
    setConnectionAttempts(0);
    setConnectionStatus("disconnected");
  };

  // Helper functions with null safety
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return "";
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

  const formatHours = (hours) => {
    if (hours === null || hours === undefined || isNaN(hours)) return "";
    return `${hours.toFixed(1)} hrs`;
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
      case "failed":
        return "#6c757d";
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
      case "failed":
        return "Connection Failed";
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
            {(connectionStatus === "error" ||
              connectionStatus === "failed") && (
              <button onClick={handleReconnect} className="retry-button">
                Retry
              </button>
            )}
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
          <div className="stat-card">
            <div className="stat-value">
              {formatHours(stats.totalLaborHours)}
            </div>
            <div className="stat-label">Labor Hours</div>
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
                    📊 {events.length} events loaded from database. Check your
                    filters above.
                  </p>
                )}
                {historicalDataLoaded && events.length === 0 && (
                  <p>
                    💡 No historical data found. New events will appear here in
                    real-time.
                  </p>
                )}
              </>
            )}

            {(!WEBSOCKET_URL ||
              WEBSOCKET_URL.includes("your-websocket-id")) && (
              <div className="setup-warning">
                <strong>Setup Required:</strong> WebSocket URL not configured.
              </div>
            )}

            {!REST_API_URL && (
              <div className="setup-warning">
                <strong>Setup Required:</strong> REST API URL not configured for
                historical data.
              </div>
            )}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={`${event.type}-${event.id}-${event.timestamp}`}
              className={`event-card ${event.type} priority-${event.priority}`}
              style={{ borderLeftColor: event.color || undefined }}
            >
              {event.type === "repair-order" ? (
                <RepairOrderCard
                  event={event}
                  formatCurrency={formatCurrency}
                  formatTime={formatTime}
                  formatHours={formatHours}
                />
              ) : (
                <AppointmentCard event={event} formatTime={formatTime} />
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

// Enhanced Repair Order Card Component with null safety
function RepairOrderCard({ event, formatCurrency, formatTime, formatHours }) {
  const getAuthorizationBadge = (authorized) => {
    if (authorized === true) return { text: "Authorized", class: "authorized" };
    if (authorized === false) return { text: "Declined", class: "declined" };
    return { text: "Pending", class: "pending" };
  };

  return (
    <>
      <div className="event-header">
        <div className="event-title">
          <h3>Repair Order #{event.orderNumber}</h3>
          {event.status && (
            <span
              className={`status-badge ${event.status
                .toLowerCase()
                .replace(/\s+/g, "-")}`}
            >
              {event.status}
            </span>
          )}
          {event.customLabel && event.customLabel !== event.status && (
            <span className="custom-label">{event.customLabel}</span>
          )}
        </div>
      </div>

      <div className="event-details">
        {/* Financial Summary */}
        {(event.laborSales > 0 ||
          event.partsSales > 0 ||
          event.totalSales > 0) && (
          <div className="financial-summary">
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
                  <strong>Tax:</strong>
                  <span>{formatCurrency(event.taxes)}</span>
                </div>
              )}
              {event.discountTotal > 0 && (
                <div className="financial-item discount">
                  <strong>Discount:</strong>
                  <span>-{formatCurrency(event.discountTotal)}</span>
                </div>
              )}
            </div>

            <div className="total-section">
              {event.totalSales > 0 && (
                <div className="total-item">
                  <strong>Total:</strong>
                  <span className="total-amount">
                    {formatCurrency(event.totalSales)}
                  </span>
                </div>
              )}
              {event.amountPaid > 0 && (
                <div className="total-item">
                  <strong>Paid:</strong>
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
        )}

        {/* Job Summary */}
        {event.totalJobs > 0 && (
          <div className="job-summary">
            <div className="job-stats">
              <div className="job-stat">
                <span className="job-count">{event.totalJobs}</span>
                <span className="job-label">Total Jobs</span>
              </div>
              {event.authorizedJobs > 0 && (
                <div className="job-stat authorized">
                  <span className="job-count">{event.authorizedJobs}</span>
                  <span className="job-label">Authorized</span>
                </div>
              )}
              {event.pendingJobs > 0 && (
                <div className="job-stat pending">
                  <span className="job-count">{event.pendingJobs}</span>
                  <span className="job-label">Pending</span>
                </div>
              )}
              {event.rejectedJobs > 0 && (
                <div className="job-stat declined">
                  <span className="job-count">{event.rejectedJobs}</span>
                  <span className="job-label">Declined</span>
                </div>
              )}
              {event.totalLaborHours > 0 && (
                <div className="job-stat">
                  <span className="job-count">
                    {formatHours(event.totalLaborHours)}
                  </span>
                  <span className="job-label">Labor Hours</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Job Details */}
        {event.jobDetails && event.jobDetails.length > 0 && (
          <div className="job-details">
            <strong>Job Details:</strong>
            <div className="job-list">
              {event.jobDetails.slice(0, 5).map((job, index) => (
                <div key={job.id || index} className="job-item">
                  <div className="job-header">
                    <span className="job-name">{job.name}</span>
                    <span
                      className={`auth-badge ${
                        getAuthorizationBadge(job.authorized).class
                      }`}
                    >
                      {getAuthorizationBadge(job.authorized).text}
                    </span>
                  </div>
                  <div className="job-financials">
                    {job.laborTotal > 0 && (
                      <span>Labor: {formatCurrency(job.laborTotal)}</span>
                    )}
                    {job.partsTotal > 0 && (
                      <span>Parts: {formatCurrency(job.partsTotal)}</span>
                    )}
                    {job.laborHours > 0 && (
                      <span>{formatHours(job.laborHours)}</span>
                    )}
                    <span className="job-total">
                      Total: {formatCurrency(job.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
              {event.jobDetails.length > 5 && (
                <div className="more-jobs">
                  + {event.jobDetails.length - 5} more jobs
                </div>
              )}
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

        {/* Metadata */}
        <div className="metadata">
          <div className="metadata-grid">
            {event.customerId && (
              <div className="metadata-item">
                <strong>Customer ID:</strong> <span>{event.customerId}</span>
              </div>
            )}
            {event.vehicleId && (
              <div className="metadata-item">
                <strong>Vehicle ID:</strong> <span>{event.vehicleId}</span>
              </div>
            )}
            {event.technicianId && (
              <div className="metadata-item">
                <strong>Technician ID:</strong>{" "}
                <span>{event.technicianId}</span>
              </div>
            )}
            {event.serviceWriterId && (
              <div className="metadata-item">
                <strong>Service Writer ID:</strong>{" "}
                <span>{event.serviceWriterId}</span>
              </div>
            )}
            {event.mileage && (
              <div className="metadata-item">
                <strong>Miles In:</strong>{" "}
                <span>{event.mileage.toLocaleString()}</span>
              </div>
            )}
            {event.milesOut && (
              <div className="metadata-item">
                <strong>Miles Out:</strong>{" "}
                <span>{event.milesOut.toLocaleString()}</span>
              </div>
            )}
            {event.keyTag && (
              <div className="metadata-item">
                <strong>Key Tag:</strong> <span>{event.keyTag}</span>
              </div>
            )}
            {event.createdDate && (
              <div className="metadata-item">
                <strong>Created:</strong>{" "}
                <span>{formatTime(event.createdDate)}</span>
              </div>
            )}
            {event.updatedDate && (
              <div className="metadata-item">
                <strong>Updated:</strong>{" "}
                <span>{formatTime(event.updatedDate)}</span>
              </div>
            )}
            {event.completedDate && (
              <div className="metadata-item">
                <strong>Completed:</strong>{" "}
                <span>{formatTime(event.completedDate)}</span>
              </div>
            )}
          </div>
        </div>

        {event.event && (
          <div className="event-footer">
            <small>{event.event}</small>
          </div>
        )}
      </div>
    </>
  );
}

// Appointment Card Component
function AppointmentCard({ event, formatTime }) {
  return (
    <>
      <div className="event-header">
        <div className="event-title">
          <h3>Appointment</h3>
          {event.status && (
            <span className={`status-badge ${event.status.toLowerCase()}`}>
              {event.status}
            </span>
          )}
          {event.arrived && <span className="arrived-badge">ARRIVED</span>}
        </div>
        <div className="event-meta">
          <span className="timestamp">{formatTime(event.timestamp)}</span>
        </div>
      </div>

      <div className="event-details">
        {event.title && <div className="appointment-title">{event.title}</div>}

        {event.startTime && event.endTime && (
          <div className="appointment-time">
            {event.startTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            -{" "}
            {event.endTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

        {event.description && (
          <div className="appointment-description">
            <strong>Description:</strong> {event.description}
          </div>
        )}

        {event.appointmentOption && (
          <div className="appointment-option">
            <strong>Service Option:</strong> {event.appointmentOption}
          </div>
        )}

        {event.customerId && (
          <div className="metadata">
            <div className="metadata-grid">
              <div className="metadata-item">
                <strong>Customer ID:</strong> <span>{event.customerId}</span>
              </div>
              {event.vehicleId && (
                <div className="metadata-item">
                  <strong>Vehicle ID:</strong> <span>{event.vehicleId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {event.event && (
          <div className="event-footer">
            <small>{event.event}</small>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
