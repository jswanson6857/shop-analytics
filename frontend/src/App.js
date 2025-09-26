// src/App.js - Auto Shop Management Dashboard
import React, { useState, useEffect } from "react";
import "./App.css";

// Get WebSocket URL from environment or use placeholder
const WEBSOCKET_URL =
  process.env.REACT_APP_WEBSOCKET_URL ||
  "wss://your-websocket-id.execute-api.us-east-1.amazonaws.com/dev";

// Auto Shop Data Parser
class AutoShopParser {
  static parseWebhook(webhook) {
    const body = webhook.body;
    if (!body || !body.data) return null;

    const data = body.data;
    const event = body.event || "";

    if (data.repairOrderNumber) {
      return this.parseRepairOrder(data, event, webhook);
    } else if (data.appointmentStatus) {
      return this.parseAppointment(data, event, webhook);
    }
    return null;
  }

  static parseRepairOrder(data, event, webhook) {
    const orderNumber = data.repairOrderNumber;
    const status = data.repairOrderStatus?.name || "Unknown";
    const customLabel =
      data.repairOrderCustomLabel?.name || data.repairOrderLabel?.name;
    const totalSales = data.totalSales || 0;
    const amountPaid = data.amountPaid || 0;
    const balanceDue = totalSales - amountPaid;

    // Extract job information
    const jobs = data.jobs || [];
    const authorizedJobs = jobs.filter((job) => job.authorized);
    const pendingJobs = jobs.filter((job) => !job.authorized);

    // Extract customer concerns
    const concerns = data.customerConcerns?.map((c) => c.concern.trim()) || [];

    // Determine priority
    let priority = "normal";
    if (status === "Complete" && balanceDue > 0) priority = "high";
    else if (status === "Work-In-Progress") priority = "medium";
    else if (totalSales > 50000) priority = "high"; // $500+ orders

    return {
      id: webhook.id,
      type: "repair-order",
      timestamp: webhook.timestamp,
      orderNumber: orderNumber,
      status: status,
      customLabel: customLabel,
      totalSales: totalSales / 100, // Convert cents to dollars
      amountPaid: amountPaid / 100,
      balanceDue: balanceDue / 100,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      technicianId: data.technicianId,
      mileage: data.milesIn,
      keyTag: data.keytag,
      completedDate: data.completedDate,
      authorizedJobs: authorizedJobs.length,
      pendingJobs: pendingJobs.length,
      jobNames: authorizedJobs.slice(0, 3).map((job) => job.name),
      customerConcerns: concerns.slice(0, 2),
      priority: priority,
      event: event,
      color: data.color,
    };
  }

  static parseAppointment(data, event, webhook) {
    const status = data.appointmentStatus;
    const title = data.title || "Unknown Customer";
    const startTime = data.startTime ? new Date(data.startTime) : null;
    const endTime = data.endTime ? new Date(data.endTime) : null;

    let priority = "normal";
    if (status === "ARRIVED") priority = "high";
    else if (status === "CONFIRMED") priority = "medium";

    return {
      id: webhook.id,
      type: "appointment",
      timestamp: webhook.timestamp,
      status: status,
      title: title,
      startTime: startTime,
      endTime: endTime,
      description: data.description,
      arrived: data.arrived,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      appointmentOption: data.appointmentOption?.name,
      priority: priority,
      event: event,
      color: data.color,
    };
  }
}

function App() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
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

  // Calculate statistics
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayEvents = events.filter((e) => e.timestamp.startsWith(today));
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
    let filtered = events;

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

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.orderNumber?.toString().includes(searchLower) ||
          e.title?.toLowerCase().includes(searchLower) ||
          e.status?.toLowerCase().includes(searchLower) ||
          e.customLabel?.toLowerCase().includes(searchLower) ||
          e.customerConcerns?.some((concern) =>
            concern.toLowerCase().includes(searchLower)
          )
      );
    }

    setFilteredEvents(filtered);
  }, [events, filters]);

  // WebSocket connection management
  useEffect(() => {
    if (!WEBSOCKET_URL || WEBSOCKET_URL.includes("your-websocket-id")) {
      console.warn("WebSocket URL not configured");
      setConnectionStatus("error");
      return;
    }

    let websocket = null;
    let reconnectTimeout = null;

    const connect = () => {
      websocket = new WebSocket(WEBSOCKET_URL);

      websocket.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
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
            if (parsedEvent) {
              setEvents((prev) => [parsedEvent, ...prev.slice(0, 499)]);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      websocket.onclose = () => {
        console.log("WebSocket disconnected");
        setConnectionStatus("disconnected");

        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };
    };

    connect();

    // Cleanup function
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (websocket) {
        websocket.close();
      }
    };
  }, []); // Empty dependency array - this effect only runs once

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "#28a745";
      case "disconnected":
        return "#ffc107";
      case "error":
        return "#dc3545";
      default:
        return "#6c757d";
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
            <span>{connectionStatus}</span>
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
            placeholder="Search orders, customers, status..."
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
            <h2>Waiting for shop events...</h2>
            <p>
              Connect your auto shop system webhook to see real-time updates
              here.
            </p>
            {WEBSOCKET_URL.includes("your-websocket-id") && (
              <div className="setup-warning">
                <strong>Setup Required:</strong> Set REACT_APP_WEBSOCKET_URL
                environment variable
              </div>
            )}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`event-card ${event.type} priority-${event.priority}`}
            >
              {event.type === "repair-order" ? (
                <RepairOrderCard
                  event={event}
                  formatCurrency={formatCurrency}
                  formatTime={formatTime}
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

// Repair Order Card Component
function RepairOrderCard({ event, formatCurrency, formatTime }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#dc3545";
      case "medium":
        return "#fd7e14";
      default:
        return "#6c757d";
    }
  };

  return (
    <>
      <div className="event-header">
        <div className="event-title">
          <h3>Repair Order #{event.orderNumber}</h3>
          <span
            className={`status-badge ${event.status
              ?.toLowerCase()
              .replace(/\s+/g, "-")}`}
          >
            {event.status}
          </span>
          {event.customLabel && event.customLabel !== event.status && (
            <span className="custom-label">{event.customLabel}</span>
          )}
        </div>
        <div className="event-meta">
          <span className="timestamp">{formatTime(event.timestamp)}</span>
          <span
            className="priority-badge"
            style={{ backgroundColor: getPriorityColor(event.priority) }}
          >
            {event.priority}
          </span>
        </div>
      </div>

      <div className="event-details">
        <div className="detail-grid">
          {event.totalSales > 0 && (
            <div className="detail-item">
              <strong>Total:</strong>
              <span>{formatCurrency(event.totalSales)}</span>
            </div>
          )}
          {event.balanceDue > 0 && (
            <div className="detail-item">
              <strong>Balance Due:</strong>
              <span className="balance-due">
                {formatCurrency(event.balanceDue)}
              </span>
            </div>
          )}
          {event.mileage && (
            <div className="detail-item">
              <strong>Mileage:</strong>
              <span>{event.mileage.toLocaleString()} mi</span>
            </div>
          )}
          {event.keyTag && (
            <div className="detail-item">
              <strong>Key Tag:</strong>
              <span>{event.keyTag}</span>
            </div>
          )}
          {event.authorizedJobs > 0 && (
            <div className="detail-item">
              <strong>Authorized Jobs:</strong>
              <span>{event.authorizedJobs}</span>
            </div>
          )}
          {event.pendingJobs > 0 && (
            <div className="detail-item">
              <strong>Pending Jobs:</strong>
              <span>{event.pendingJobs}</span>
            </div>
          )}
        </div>

        {event.jobNames.length > 0 && (
          <div className="job-names">
            <strong>Jobs:</strong> {event.jobNames.join(", ")}
            {event.authorizedJobs > 3 && (
              <span> + {event.authorizedJobs - 3} more</span>
            )}
          </div>
        )}

        {event.customerConcerns.length > 0 && (
          <div className="customer-concerns">
            <strong>Customer Concerns:</strong>
            <ul>
              {event.customerConcerns.map((concern, idx) => (
                <li key={idx}>{concern}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="event-footer">
          <small>{event.event}</small>
        </div>
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
          <span className={`status-badge ${event.status?.toLowerCase()}`}>
            {event.status}
          </span>
          {event.arrived && <span className="arrived-badge">ARRIVED</span>}
        </div>
        <div className="event-meta">
          <span className="timestamp">{formatTime(event.timestamp)}</span>
        </div>
      </div>

      <div className="event-details">
        <div className="appointment-title">{event.title}</div>

        {event.startTime && event.endTime && (
          <div className="appointment-time">
            {event.startTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            -
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

        <div className="event-footer">
          <small>{event.event}</small>
        </div>
      </div>
    </>
  );
}

export default App;
