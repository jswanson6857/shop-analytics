// src/App.js - COMPLETE FIX: All issues resolved
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import "./App.css";
import RepairOrdersPage from "./components/RepairOrdersPage";
import EventExplorerPage from "./components/EventExplorerPage";
import JobAnalyticsPage from "./components/JobAnalyticsPage";
import { parseWebhookData } from "./utils/dataParser";

// Theme Context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};

// Theme Provider
const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("auto-shop-theme");
    return saved === "dark";
  });

  useEffect(() => {
    localStorage.setItem("auto-shop-theme", isDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark-mode", isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Toggle Button
const ThemeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
};

const WEBSOCKET_URL =
  process.env.REACT_APP_WEBSOCKET_URL ||
  "wss://u4sqthpk4c.execute-api.us-east-1.amazonaws.com/dev";
const REST_API_URL =
  process.env.REACT_APP_REST_API_URL ||
  "https://x21d6cpmv6.execute-api.us-east-1.amazonaws.com/dev";

function AppContent() {
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

  // NEW: For navigation from JobAnalytics to EventExplorer
  const [expandedEventId, setExpandedEventId] = useState(null);

  const websocketRef = useRef(null);
  const mountedRef = useRef(true);

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
            const parsedEvents = historicalData
              .map((rawEvent) => parseWebhookData(rawEvent))
              .filter(Boolean)
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            console.log(
              `✅ Successfully parsed ${parsedEvents.length} repair orders`
            );

            if (parsedEvents.length > 0 && mountedRef.current) {
              setEvents(parsedEvents);
            }
          }
        }
        setHistoricalDataLoaded(true);
      } catch (error) {
        console.log(`Failed to load historical data: ${error.message}`);
        setHistoricalDataLoaded(true);
      } finally {
        if (mountedRef.current) {
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

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  // FIXED: Filter data using TIMESTAMP (last activity) not createdDate
  const filteredData = useMemo(() => {
    console.log("🔍 FILTERING - START:", {
      totalEvents: events.length,
      searchTerm,
      dateFrom,
      dateTo,
      statusFilter,
    });

    if (events.length === 0) return [];

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

      // FIXED: Use TIMESTAMP (last activity) for date filtering
      const activityDate = new Date(ro.timestamp); // Use timestamp (last activity)
      const matchesDateFrom =
        !dateFrom || activityDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo =
        !dateTo || activityDate <= new Date(dateTo + "T23:59:59");

      // Status filter
      const matchesStatus =
        statusFilter === "all" || ro.repairOrderStatus?.name === statusFilter;

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
    });

    console.log(
      `✅ FILTERING - DONE: ${filtered.length} of ${events.length} records passed`
    );
    return filtered;
  }, [events, searchTerm, dateFrom, dateTo, statusFilter]);

  // NEW: Navigate to Event Explorer with specific RO expanded
  const navigateToRO = useCallback(
    (roNumber) => {
      // Find the event with this RO number
      const event = events.find((e) => e.repairOrderNumber === roNumber);
      if (event) {
        setCurrentPage("events");
        setExpandedEventId(event.id);

        // Scroll to the RO after a short delay
        setTimeout(() => {
          const element = document.getElementById(`ro-${event.id}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    },
    [events]
  );

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
      <header className="dashboard-header">
        <div className="header-row">
          <h1>🔧 Auto Shop Dashboard</h1>
          <div className="header-controls">
            <ThemeToggle />
            <div className="connection-status">
              <div
                className="status-indicator"
                style={{ backgroundColor: getStatusColor() }}
              ></div>
              <span>{getStatusText()}</span>
            </div>
          </div>
        </div>

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
            expandedEventId={expandedEventId}
            setExpandedEventId={setExpandedEventId}
          />
        )}

        {currentPage === "analytics" && (
          <JobAnalyticsPage
            data={filteredData}
            allData={events}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            navigateToRO={navigateToRO}
          />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
