// src/App.js - Complete Auto Shop Dashboard
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import "./App.css";
import RepairOrdersPage from "./components/RepairOrdersPage";
import EventExplorerPage from "./components/EventExplorerPage";
import JobAnalyticsPage from "./components/JobAnalyticsPage";
import { parseWebhookData } from "./utils/dataParser";

const WEBSOCKET_URL =
  process.env.REACT_APP_WEBSOCKET_URL ||
  "wss://u4sqthpk4c.execute-api.us-east-1.amazonaws.com/dev";
const REST_API_URL =
  process.env.REACT_APP_REST_API_URL ||
  "https://x21d6cpmv6.execute-api.us-east-1.amazonaws.com/dev";

function App() {
  const [events, setEvents] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [currentPage, setCurrentPage] = useState("orders");
  const [historicalDataLoaded, setHistoricalDataLoaded] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const websocketRef = useRef(null);
  const mountedRef = useRef(true);

  // Debug: Log when events change
  useEffect(() => {
    console.log("📦 Events state changed:", events.length);
  }, [events]);

  // Set page title
  useEffect(() => {
    document.title = "Auto Shop Dashboard - Real-Time Orders";
  }, []);

  // Load historical data
  useEffect(() => {
    const loadHistoricalData = async () => {
      if (!REST_API_URL || historicalDataLoaded) return;

      try {
        const dataEndpoint = `${REST_API_URL}/data`;
        console.log(`Loading historical data from: ${dataEndpoint}`);
        setConnectionStatus("loading-history");

        const response = await fetch(dataEndpoint);
        if (response.ok) {
          const historicalData = await response.json();
          console.log(`Received ${historicalData.length} historical events`);

          if (
            historicalData &&
            Array.isArray(historicalData) &&
            historicalData.length > 0
          ) {
            console.log(
              `📊 Processing ${historicalData.length} historical records...`
            );

            const parsedEvents = historicalData
              .map((rawEvent, index) => {
                const parsed = parseWebhookData(rawEvent);
                if (!parsed && index < 3) {
                  // Log first 3 skipped records for debugging
                  console.log(`Skipped record ${index}:`, rawEvent);
                }
                return parsed;
              })
              .filter(Boolean)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            console.log(
              `✅ Successfully parsed ${parsedEvents.length} repair orders`
            );

            if (parsedEvents.length === 0) {
              console.warn(
                "⚠️  No valid repair orders found in historical data. Check data structure."
              );
            }

            if (parsedEvents.length > 0 && mountedRef.current) {
              console.log(
                `🎉 Dashboard loaded with ${parsedEvents.length} orders`
              );
              console.log("📋 Sample order:", parsedEvents[0]);
              console.log(
                "📊 First order fields:",
                Object.keys(parsedEvents[0])
              );

              // Set events - this should trigger re-render
              setEvents(parsedEvents);

              // Verify state was set
              setTimeout(() => {
                console.log(
                  "🔄 Events state after setState:",
                  parsedEvents.length
                );
              }, 100);
            } else if (parsedEvents.length === 0) {
              console.warn("⚠️  No orders to display");
            }
          }
        }
        setHistoricalDataLoaded(true);
      } catch (error) {
        console.log(`Failed to load historical data: ${error.message}`);
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

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current || !WEBSOCKET_URL) return;
    if (websocketRef.current?.readyState === WebSocket.OPEN) return;

    console.log(`Connecting to WebSocket: ${WEBSOCKET_URL}`);
    setConnectionStatus("connecting");

    try {
      const websocket = new WebSocket(WEBSOCKET_URL);
      websocketRef.current = websocket;

      websocket.onopen = () => {
        console.log("WebSocket connected");
        if (mountedRef.current) {
          setConnectionStatus("connected");
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

            const parsedEvent = parseWebhookData(rawWebhook);
            if (parsedEvent && mountedRef.current) {
              setEvents((prev) => [parsedEvent, ...prev.slice(0, 999)]);
            }
          }
        } catch (error) {
          console.log("Error parsing WebSocket message", error);
        }
      };

      websocket.onclose = () => {
        console.log("WebSocket closed");
        if (mountedRef.current) {
          setConnectionStatus("disconnected");
        }
      };

      websocket.onerror = (error) => {
        console.log("WebSocket error", error);
        if (mountedRef.current) {
          setConnectionStatus("error");
        }
      };
    } catch (error) {
      console.log("Failed to create WebSocket", error);
      setConnectionStatus("error");
    }
  }, []);

  useEffect(() => {
    if (historicalDataLoaded && connectionStatus === "disconnected") {
      connectWebSocket();
    }
  }, [historicalDataLoaded, connectionStatus, connectWebSocket]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // Filter data
  const filteredData = useMemo(() => {
    console.log("🔍 Filtering data:", {
      totalEvents: events.length,
      searchTerm,
      dateFrom,
      dateTo,
      statusFilter,
    });

    const filtered = events.filter((ro) => {
      // Search filter
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        ro.repairOrderNumber?.toString().includes(search) ||
        ro.customer?.firstName?.toLowerCase().includes(search) ||
        ro.customer?.lastName?.toLowerCase().includes(search) ||
        ro.technician?.firstName?.toLowerCase().includes(search) ||
        ro.event?.toLowerCase().includes(search);

      // Date filter
      const createdDate = ro.createdDate ? new Date(ro.createdDate) : null;
      const matchesDateFrom =
        !dateFrom || !createdDate || createdDate >= new Date(dateFrom);
      const matchesDateTo =
        !dateTo ||
        !createdDate ||
        createdDate <= new Date(dateTo + "T23:59:59");

      // Status filter
      const matchesStatus =
        statusFilter === "all" || ro.repairOrderStatus?.name === statusFilter;

      const passes =
        matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;

      if (!passes && events.length < 10) {
        // Debug first few filtered items
        console.log("Filtered out:", {
          ro: ro.repairOrderNumber,
          matchesSearch,
          matchesDateFrom,
          matchesDateTo,
          matchesStatus,
          createdDate: ro.createdDate,
        });
      }

      return passes;
    });

    console.log(`✅ Filtered to ${filtered.length} records`);
    return filtered;
  }, [events, searchTerm, dateFrom, dateTo, statusFilter]);

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

  return (
    <div className="auto-shop-dashboard">
      {/* Header */}
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

        {/* Navigation */}
        <div className="nav-tabs">
          <button
            className={currentPage === "orders" ? "active" : ""}
            onClick={() => setCurrentPage("orders")}
          >
            Repair Orders
          </button>
          <button
            className={currentPage === "events" ? "active" : ""}
            onClick={() => setCurrentPage("events")}
          >
            Event Explorer
          </button>
          <button
            className={currentPage === "analytics" ? "active" : ""}
            onClick={() => setCurrentPage("analytics")}
          >
            Job Analytics
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main className="events-container">
        {currentPage === "orders" && (
          <RepairOrdersPage
            data={filteredData}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            connectionStatus={connectionStatus}
          />
        )}

        {currentPage === "events" && (
          <EventExplorerPage
            data={filteredData}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
          />
        )}

        {currentPage === "analytics" && (
          <JobAnalyticsPage
            data={events}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
          />
        )}
      </main>
    </div>
  );
}

export default App;
