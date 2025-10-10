// src/App.js - REFACTORED: Auth0 + Combined ROs + Posted Filter
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import "./App.css";
import RepairOrdersPage from "./components/RepairOrdersPage";
import EventExplorerPage from "./components/EventExplorerPage";
import JobAnalyticsPage from "./components/JobAnalyticsPage";
import FollowUpPage from "./components/FollowUpPage";
import CustomerImportPage from "./components/CustomerImportPage";
import LoginButton from "./components/LoginPage";
import LogoutButton from "./components/LogoutPage";
import { parseWebhookData, combineROEvents } from "./utils/dataParser";

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
  const { isAuthenticated, isLoading: authLoading } = useAuth0();

  const [allEvents, setAllEvents] = useState([]);
  const [combinedROs, setCombinedROs] = useState([]);
  const [customers, setCustomers] = useState({});
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
  const [selectedRONumber, setSelectedRONumber] = useState(null);

  const websocketRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    document.title = "Auto Shop Dashboard - Real-Time Orders";
    mountedRef.current = true;

    // Load customers from localStorage
    const savedCustomers = localStorage.getItem("auto-shop-customers");
    if (savedCustomers) {
      try {
        setCustomers(JSON.parse(savedCustomers));
      } catch (e) {
        console.error("Failed to parse saved customers:", e);
      }
    }

    return () => {
      mountedRef.current = false;
      if (websocketRef.current) websocketRef.current.close();
    };
  }, []);

  // Update customers handler
  const updateCustomers = useCallback((newCustomers) => {
    setCustomers(newCustomers);
    localStorage.setItem("auto-shop-customers", JSON.stringify(newCustomers));
  }, []);

  // Combine events by RO number and filter for posted-only
  useEffect(() => {
    if (allEvents.length === 0) {
      setCombinedROs([]);
      return;
    }

    const combined = combineROEvents(allEvents);

    // CRITICAL: Only show ROs where most recent event contains "posted by"
    const postedOnly = combined.filter((ro) => {
      const mostRecentEvent = ro.events[0]; // events are sorted newest first
      return (
        mostRecentEvent.event &&
        mostRecentEvent.event.toLowerCase().includes("posted by")
      );
    });

    setCombinedROs(postedOnly);
  }, [allEvents]);

  // Paginated historical fetch
  useEffect(() => {
    const fetchHistoricalDataBatch = async () => {
      if (!REST_API_URL || historicalDataLoaded || !isAuthenticated) return;

      setConnectionStatus("loading-history");
      console.log("🔄 Starting paginated historical fetch...");

      let fetchedEvents = [];
      let lastKey = null;

      try {
        do {
          const url = new URL(`${REST_API_URL}/data`);
          url.searchParams.append("limit", "500");
          url.searchParams.append("hours", "720");
          if (lastKey) url.searchParams.append("lastKey", lastKey);

          console.log(`Fetching historical batch: ${url.toString()}`);
          const response = await fetch(url.toString());
          if (!response.ok)
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);

          const result = await response.json();
          const eventsPage = result.events || [];

          console.log(
            `Received ${eventsPage.length} events, total: ${
              fetchedEvents.length + eventsPage.length
            }`
          );

          fetchedEvents = fetchedEvents.concat(
            eventsPage
              .map((rawEvent) => parseWebhookData(rawEvent))
              .filter(Boolean)
          );

          lastKey = result.lastKey;

          if (mountedRef.current)
            setConnectionStatus(
              `loading-history (${fetchedEvents.length} events)`
            );
        } while (lastKey);

        fetchedEvents.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );

        console.log(`✅ Loaded all historical events: ${fetchedEvents.length}`);

        if (mountedRef.current) {
          setAllEvents(fetchedEvents);
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

    if (mountedRef.current && !historicalDataLoaded && isAuthenticated) {
      fetchHistoricalDataBatch();
    }
  }, [historicalDataLoaded, isAuthenticated]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current || !WEBSOCKET_URL || !isAuthenticated) return;
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
              setAllEvents((prev) => [parsedEvent, ...prev.slice(0, 999)]);
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
  }, [isAuthenticated]);

  useEffect(() => {
    if (
      historicalDataLoaded &&
      connectionStatus === "disconnected" &&
      isAuthenticated
    ) {
      connectWebSocket();
    }
  }, [
    historicalDataLoaded,
    connectionStatus,
    connectWebSocket,
    isAuthenticated,
  ]);

  // Filtering for different pages
  const filteredROs = useMemo(() => {
    if (!combinedROs.length) return [];

    return combinedROs.filter((ro) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        ro.repairOrderNumber?.toString().includes(search) ||
        ro.customer?.firstName?.toLowerCase().includes(search) ||
        ro.customer?.lastName?.toLowerCase().includes(search) ||
        ro.technician?.firstName?.toLowerCase().includes(search);

      const activityDate = new Date(ro.timestamp);
      const matchesDateFrom =
        !dateFrom || activityDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo =
        !dateTo || activityDate <= new Date(dateTo + "T23:59:59");

      const matchesStatus =
        statusFilter === "all" || ro.repairOrderStatus?.name === statusFilter;

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
    });
  }, [combinedROs, searchTerm, dateFrom, dateTo, statusFilter]);

  const filteredEvents = useMemo(() => {
    if (!allEvents.length) return [];

    return allEvents.filter((event) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        event.repairOrderNumber?.toString().includes(search) ||
        event.event?.toLowerCase().includes(search);

      const activityDate = new Date(event.timestamp);
      const matchesDateFrom =
        !dateFrom || activityDate >= new Date(dateFrom + "T00:00:00");
      const matchesDateTo =
        !dateTo || activityDate <= new Date(dateTo + "T23:59:59");

      return matchesSearch && matchesDateFrom && matchesDateTo;
    });
  }, [allEvents, searchTerm, dateFrom, dateTo]);

  // Navigate to RO modal
  const openROModal = useCallback((roNumber) => {
    setSelectedRONumber(roNumber);
  }, []);

  const closeROModal = useCallback(() => {
    setSelectedRONumber(null);
  }, []);

  // Navigate to Event Explorer
  const navigateToEvent = useCallback(
    (roNumber) => {
      const event = allEvents.find((e) => e.repairOrderNumber === roNumber);
      if (!event) return;

      setCurrentPage("events");
      setExpandedEventId(event.id);

      setTimeout(() => {
        const el = document.getElementById(`event-${event.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    },
    [allEvents]
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

  // Show loading while Auth0 initializes
  if (authLoading) {
    return (
      <div className="auto-shop-dashboard">
        <div className="loading-screen">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="auto-shop-dashboard">
        <div className="login-screen">
          <div className="login-container">
            <h1>🔧 Auto Shop Dashboard</h1>
            <p>
              Please log in to access customer information and repair orders
            </p>
            <LoginButton />
          </div>
        </div>
      </div>
    );
  }

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
            <LogoutButton />
          </div>
        </div>

        <div className="nav-tabs">
          <button
            className={currentPage === "orders" ? "active" : ""}
            onClick={() => setCurrentPage("orders")}
          >
            Repair Orders (Posted)
          </button>
          <button
            className={currentPage === "events" ? "active" : ""}
            onClick={() => setCurrentPage("events")}
          >
            Event Explorer (All Events)
          </button>
          <button
            className={currentPage === "analytics" ? "active" : ""}
            onClick={() => setCurrentPage("analytics")}
          >
            Job Analytics
          </button>
          <button
            className={currentPage === "followup" ? "active" : ""}
            onClick={() => setCurrentPage("followup")}
          >
            Follow-Up Tracker
          </button>
          <button
            className={currentPage === "import" ? "active" : ""}
            onClick={() => setCurrentPage("import")}
          >
            Import Customers
          </button>
        </div>
      </header>

      <main className="events-container">
        {currentPage === "orders" && (
          <RepairOrdersPage
            data={filteredROs}
            customers={customers}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            connectionStatus={connectionStatus}
            openROModal={openROModal}
            navigateToEvent={navigateToEvent} // ✅ now used
          />
        )}

        {currentPage === "events" && (
          <EventExplorerPage
            data={filteredEvents}
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
            data={filteredROs}
            allData={combinedROs}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            openROModal={openROModal}
          />
        )}

        {currentPage === "followup" && <FollowUpPage customers={customers} />}

        {currentPage === "import" && (
          <CustomerImportPage
            customers={customers}
            updateCustomers={updateCustomers}
          />
        )}
      </main>

      {/* RO Detail Modal */}
      {selectedRONumber && (
        <RODetailModal
          roNumber={selectedRONumber}
          combinedRO={combinedROs.find(
            (ro) => ro.repairOrderNumber === selectedRONumber
          )}
          customers={customers}
          onClose={closeROModal}
        />
      )}
    </div>
  );
}

// RO Detail Modal Component
const RODetailModal = ({ roNumber, combinedRO, customers, onClose }) => {
  if (!combinedRO) return null;

  const customer = customers[combinedRO.customerId] || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ro-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Repair Order #{roNumber}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Customer Info */}
          <div className="customer-info-section">
            <h3>Customer Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Name:</span>
                <span className="value">
                  {customer.name ||
                    `${combinedRO.customer?.firstName || ""} ${
                      combinedRO.customer?.lastName || ""
                    }`}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Phone:</span>
                <span className="value">
                  {customer.phone || "Not available"}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Customer ID:</span>
                <span className="value">#{combinedRO.customerId}</span>
              </div>
            </div>
          </div>

          {/* RO Summary */}
          <div className="ro-summary-section">
            <h3>Order Summary</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Status:</span>
                <span className="value">
                  {combinedRO.repairOrderStatus?.name}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Total:</span>
                <span className="value">
                  ${(combinedRO.totalWithTax / 100).toFixed(2)}
                </span>
              </div>
              <div className="info-item">
                <span className="label">Balance Due:</span>
                <span className="value">
                  ${(combinedRO.balanceDue / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Jobs with Contact Tracking */}
          <JobContactSection ro={combinedRO} customer={customer} />
        </div>
      </div>
    </div>
  );
};

// Job Contact Section Component
const JobContactSection = ({ ro, customer }) => {
  const [jobNotes, setJobNotes] = useState({});
  const [jobResponses, setJobResponses] = useState({});

  useEffect(() => {
    // Load saved data from localStorage
    const savedData = localStorage.getItem(`ro-jobs-${ro.repairOrderNumber}`);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setJobNotes(parsed.notes || {});
        setJobResponses(parsed.responses || {});
      } catch (e) {
        console.error("Failed to load job data:", e);
      }
    }
  }, [ro.repairOrderNumber]);

  const handleSaveJob = (jobId) => {
    const followUpData = {
      roNumber: ro.repairOrderNumber,
      jobId: jobId,
      job: ro.jobs.find((j) => j.id === jobId),
      customer: customer,
      notes: jobNotes[jobId] || "",
      response: jobResponses[jobId] || "no_response",
      timestamp: new Date().toISOString(),
      customerId: ro.customerId,
    };

    // Save to follow-up DB (localStorage for now)
    const existingFollowUps = JSON.parse(
      localStorage.getItem("follow-up-jobs") || "[]"
    );
    const updatedFollowUps = [
      ...existingFollowUps.filter((f) => f.jobId !== jobId),
      followUpData,
    ];
    localStorage.setItem("follow-up-jobs", JSON.stringify(updatedFollowUps));

    alert("Job contact information saved to Follow-Up Tracker!");
  };

  return (
    <div className="jobs-contact-section">
      <h3>Jobs - Contact Tracking</h3>

      {/* Approved Jobs */}
      {ro.approvedJobs && ro.approvedJobs.length > 0 && (
        <div className="job-group">
          <h4 className="job-group-title approved">
            ✓ Approved Jobs ({ro.approvedJobs.length})
          </h4>
          {ro.approvedJobs.map((job) => (
            <JobContactCard
              key={job.id}
              job={job}
              isApproved={true}
              notes={jobNotes[job.id] || ""}
              response={jobResponses[job.id] || "no_response"}
              onNotesChange={(value) =>
                setJobNotes((prev) => ({ ...prev, [job.id]: value }))
              }
              onResponseChange={(value) =>
                setJobResponses((prev) => ({ ...prev, [job.id]: value }))
              }
              onSave={() => handleSaveJob(job.id)}
            />
          ))}
        </div>
      )}

      {/* Declined Jobs */}
      {ro.jobs && ro.jobs.filter((j) => j.authorized === false).length > 0 && (
        <div className="job-group">
          <h4 className="job-group-title declined">
            ✗ Declined Jobs (
            {ro.jobs.filter((j) => j.authorized === false).length})
          </h4>
          {ro.jobs
            .filter((j) => j.authorized === false)
            .map((job) => (
              <JobContactCard
                key={job.id}
                job={job}
                isApproved={false}
                notes={jobNotes[job.id] || ""}
                response={jobResponses[job.id] || "no_response"}
                onNotesChange={(value) =>
                  setJobNotes((prev) => ({ ...prev, [job.id]: value }))
                }
                onResponseChange={(value) =>
                  setJobResponses((prev) => ({ ...prev, [job.id]: value }))
                }
                onSave={() => handleSaveJob(job.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
};

// Individual Job Contact Card
const JobContactCard = ({
  job,
  isApproved,
  notes,
  response,
  onNotesChange,
  onResponseChange,
  onSave,
}) => {
  return (
    <div className={`job-contact-card ${isApproved ? "approved" : "declined"}`}>
      <div className="job-contact-header">
        <span className="job-name">{job.name}</span>
        <span className="job-amount">
          ${(job.totalWithTax / 100).toFixed(2)}
        </span>
      </div>

      <div className="job-contact-inputs">
        <div className="input-group">
          <label>Notes:</label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add notes about customer conversation..."
            rows={3}
          />
        </div>

        <div className="input-group">
          <label>Customer Response:</label>
          <select
            value={response}
            onChange={(e) => onResponseChange(e.target.value)}
          >
            <option value="no_response">No Response</option>
            <option value="yes">Yes - Interested</option>
            <option value="no">No - Not Interested</option>
            <option value="maybe">Maybe - Call Back Later</option>
            <option value="work_completed">Work Already Completed</option>
          </select>
        </div>

        <button className="save-job-btn" onClick={onSave}>
          💾 Save to Follow-Up Tracker
        </button>
      </div>
    </div>
  );
};

// Main App with Auth0 Provider
function App() {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN || "YOUR_AUTH0_DOMAIN"}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID || "YOUR_AUTH0_CLIENT_ID"}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Auth0Provider>
  );
}

export default App;
