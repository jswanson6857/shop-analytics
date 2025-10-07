// src/App.js - COMPLETE FIX: Paginated historical loading + WebSocket + UI intact
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

  const [expandedEventId, setExpandedEventId] = useState(null);

  const websocketRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    document.title = "Auto Shop Dashboard - Real-Time Orders";
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (websocketRef.current) websocketRef.current.close();
    };
  }, []);

  // --- Paginated historical fetch ---
  useEffect(() => {
    const fetchHistoricalDataBatch = async () => {
      if (!REST_API_URL || historicalDataLoaded) return;

      setConnectionStatus("loading-history");
      console.log("🔄 Starting paginated historical fetch...");

      let allEvents = [];
      let lastKey = null;

      try {
        do {
          const url = new URL(`${REST_API_URL}/data`);
          url.searchParams.append("limit", "500"); // batch size
          url.searchParams.append("hours", "720"); // last 30 days
          if (lastKey) url.searchParams.append("lastKey", lastKey);

          console.log(`Fetching historical batch: ${url.toString()}`);
          const response = await fetch(url.toString());
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);

          const result = await response.json();
          const eventsPage = result.events || [];

          console.log(
            `Received ${
              eventsPage.length
            } events in this batch, total so far: ${
              allEvents.length + eventsPage.length
            }`
          );

          allEvents = allEvents.concat(
            eventsPage
              .map((rawEvent) => parseWebhookData(rawEvent))
              .filter(Boolean)
          );

          lastKey = result.lastKey;

          if (mountedRef.current)
            setConnectionStatus(`loading-history (${allEvents.length} events)`);
        } while (lastKey);

        allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        console.log(`✅ Loaded all historical events: ${allEvents.length}`);

        if (mountedRef.current) {
          setEvents(allEvents);
          setHistoricalDataLoaded(true);
          setConnectionStatus("disconnected");
        }
      } catch (err) {
        console.error("❌ Failed to fetch historical data:", err);
        if (mountedRef.current) {
          setConnectionStatus("error");
          setHistoricalDataLoaded(true);
        }
      }
    };

    if (mountedRef.current && !historicalDataLoaded) fetchHistoricalDataBatch();
  }, [historicalDataLoaded]);

  // --- WebSocket ---
  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current || !WEBSOCKET_URL) return;
    if (websocketRef.current?.readyState === WebSocket.OPEN) return;

    console.log(`Connecting to WebSocket: ${WEBSOCKET_URL}`);
    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected");
        if (mountedRef.current) setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "webhook_data" && msg.event === "insert") {
            const parsedEvent = parseWebhookData({
              id: msg.data.id,
              timestamp: msg.data.timestamp,
              body: msg.data.parsed_body,
            });
            if (parsedEvent && mountedRef.current) {
              setEvents((prev) => [parsedEvent, ...prev.slice(0, 999)]);
            }
          }
        } catch (e) {
          console.log("Error parsing WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        if (mountedRef.current) setConnectionStatus("disconnected");
      };

      ws.onerror = (err) => {
        console.log("WebSocket error:", err);
        if (mountedRef.current) setConnectionStatus("error");
      };
    } catch (err) {
      console.log("Failed to create WebSocket:", err);
      setConnectionStatus("error");
    }
  }, []);

  useEffect(() => {
    if (historicalDataLoaded && connectionStatus === "disconnected") {
      connectWebSocket();
    }
  }, [historicalDataLoaded, connectionStatus, connectWebSocket]);

  // --- Filtering ---
  const filteredData = useMemo(() => {
    if (!events.length) return [];

    return events.filter((ro) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        ro.repairOrderNumber?.toString().includes(search) ||
        ro.customer?.firstName?.toLowerCase().includes(search) ||
        ro.customer?.lastName?.toLowerCase().includes(search) ||
        ro.technician?.firstName?.toLowerCase().includes(search) ||
        ro.event?.toLowerCase().includes(search);

      const activityDate = new Date(ro.timestamp);
      const matchesDateFrom =
        !dateFrom || activityDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo =
        !dateTo || activityDate <= new Date(dateTo + "T23:59:59");

      const matchesStatus =
        statusFilter === "all" || ro.repairOrderStatus?.name === statusFilter;

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
    });
  }, [events, searchTerm, dateFrom, dateTo, statusFilter]);

  // --- Navigate to Event Explorer ---
  const navigateToRO = useCallback(
    (roNumber) => {
      const event = events.find((e) => e.repairOrderNumber === roNumber);
      if (!event) return;

      setCurrentPage("events");
      setExpandedEventId(event.id);

      setTimeout(() => {
        const el = document.getElementById(`ro-${event.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
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
