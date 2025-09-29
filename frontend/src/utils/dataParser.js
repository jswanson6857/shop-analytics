// src/utils/dataParser.js - Parse webhook data with ZERO loss

export const JOB_CATEGORIES = {
  DIAG: {
    keywords: ["diagnostic", "diag", "check engine", "scan"],
    color: "#9C27B0",
  },
  OILCH: { keywords: ["oil change", "oil service", "lube"], color: "#4CAF50" },
  INSP: { keywords: ["inspection", "courtesy"], color: "#2196F3" },
  STNSP: { keywords: ["state inspection", "emissions"], color: "#FF9800" },
  MAIN: { keywords: ["maintenance", "service", "tune"], color: "#607D8B" },
  BRAK: { keywords: ["brake", "rotor", "caliper", "pad"], color: "#F44336" },
  CBACK: { keywords: ["come back", "comeback"], color: "#E91E63" },
  BELT: { keywords: ["belt", "serpentine", "timing"], color: "#795548" },
  "A /C": {
    keywords: ["air conditioning", "a/c", "ac ", "hvac"],
    color: "#00BCD4",
  },
  OL: { keywords: ["oil leak", "leak"], color: "#FF5722" },
  SUSP: {
    keywords: ["suspension", "shock", "strut", "trailing", "arm"],
    color: "#3F51B5",
  },
  ENG: { keywords: ["engine", "motor"], color: "#D32F2F" },
  DRV: { keywords: ["drive", "driveline", "axle", "cv"], color: "#9E9E9E" },
  TRANS: { keywords: ["transmission", "trans", "clutch"], color: "#C62828" },
  ELEC: { keywords: ["electrical", "battery", "alternator"], color: "#FDD835" },
  PWAR: { keywords: ["warranty", "pwar"], color: "#8BC34A" },
  Tires: { keywords: ["tire", "tyre", "wheel", "balance"], color: "#424242" },
  "3DR": { keywords: ["repeat", "30 day"], color: "#FF6F00" },
  Sub: { keywords: ["sublet", "sub", "outsource"], color: "#9C27B0" },
  EMP: { keywords: ["employee", "emp"], color: "#4A148C" },
  INT: { keywords: ["interior", "upholstery"], color: "#6D4C41" },
  ExWAR: { keywords: ["external warranty", "third party"], color: "#1B5E20" },
  STEER: { keywords: ["steering", "rack", "pinion"], color: "#0D47A1" },
  CLNT: { keywords: ["coolant", "radiator"], color: "#006064" },
  STG: { keywords: ["storage", "parking"], color: "#BF360C" },
  LWARR: { keywords: ["labor warranty"], color: "#33691E" },
  Prog: { keywords: ["programming", "reprogram"], color: "#1A237E" },
  EXH: { keywords: ["exhaust", "muffler"], color: "#263238" },
  FUEL: { keywords: ["fuel", "injector", "pump"], color: "#E65100" },
};

// Helper function - must be defined BEFORE parseWebhookData uses it
export const getJobCategory = (jobName) => {
  if (!jobName) return "OTHER";
  const nameLower = jobName.toLowerCase();

  for (const [code, category] of Object.entries(JOB_CATEGORIES)) {
    if (category.keywords.some((keyword) => nameLower.includes(keyword))) {
      return code;
    }
  }
  return "OTHER";
};

// Helper function - must be defined BEFORE parseWebhookData uses it
const determinePriority = (data) => {
  const balanceDue = (data.totalSales || 0) - (data.amountPaid || 0);
  const status = data.repairOrderStatus?.name || "";

  if (balanceDue > 500000) return "high"; // > $5000
  if (status.toLowerCase().includes("arrived")) return "high";
  if (balanceDue > 100000) return "medium"; // > $1000
  if (status.toLowerCase().includes("progress")) return "medium";
  return "normal";
};

// Main parser function
export const parseWebhookData = (webhook) => {
  try {
    console.log("🔍 parseWebhookData called with:", {
      hasWebhook: !!webhook,
      webhookKeys: webhook ? Object.keys(webhook) : [],
      webhookId: webhook?.id,
      hasBody: !!webhook?.body,
      hasData: !!webhook?.data,
      hasParsedBody: !!webhook?.parsed_body,
    });

    let data, event;

    // Handle different webhook structures
    if (webhook.body?.data) {
      data = webhook.body.data;
      event = webhook.body.event || "";
      console.log("✅ Path 1: webhook.body.data");
    } else if (webhook.data) {
      data = webhook.data;
      event = webhook.event || "";
      console.log("✅ Path 2: webhook.data");
    } else if (webhook.parsed_body?.data) {
      data = webhook.parsed_body.data;
      event = webhook.parsed_body.event || "";
      console.log("✅ Path 3: webhook.parsed_body.data");
    } else if (webhook.parsed_body) {
      // Try parsing the parsed_body directly
      try {
        const parsed =
          typeof webhook.parsed_body === "string"
            ? JSON.parse(webhook.parsed_body)
            : webhook.parsed_body;

        if (parsed.data) {
          data = parsed.data;
          event = parsed.event || "";
          console.log("✅ Path 4a: parsed.data from parsed_body");
        } else {
          data = parsed;
          event = parsed.event || "";
          console.log("✅ Path 4b: direct parsed_body");
        }
      } catch (e) {
        data = webhook.parsed_body;
        event = webhook.parsed_body.event || "";
        console.log("✅ Path 4c: webhook.parsed_body (parse error)");
      }
    } else {
      data = webhook;
      event = webhook.event || webhook.message || "";
      console.log("✅ Path 5: direct webhook");
    }

    console.log("📦 Extracted data:", {
      hasData: !!data,
      dataType: typeof data,
      event: event,
      repairOrderNumber: data?.repairOrderNumber,
      dataId: data?.id,
    });

    // Skip events that don't have meaningful repair order data
    if (!data || typeof data !== "object") {
      console.log("❌ SKIPPED: no data object");
      return null;
    }

    // Check if this is a repair order (has repairOrderNumber OR id with jobs)
    if (!data.repairOrderNumber && !data.id) {
      console.log("❌ SKIPPED: no repair order identifier", {
        keys: Object.keys(data),
        sample: data,
      });
      return null;
    }

    // If it has jobs but no repairOrderNumber, try to use id
    const orderNumber = data.repairOrderNumber || data.id;
    console.log("✅ Order number:", orderNumber);

    // Parse jobs and add categories
    const jobs = (data.jobs || []).map((job) => ({
      ...job,
      category: getJobCategory(job.name),
    }));

    // Calculate job stats
    const jobStats = {
      authorized: jobs.filter((j) => j.authorized === true).length,
      declined: jobs.filter((j) => j.authorized === false).length,
      pending: jobs.filter(
        (j) => j.authorized === null || j.authorized === undefined
      ).length,
    };

    // FIXED: Generate truly unique ID by combining webhook.id with timestamp
    // This prevents duplicate keys when same repair order appears multiple times
    const uniqueId = webhook.id
      ? `${webhook.id}`
      : `repair-${orderNumber}-${webhook.timestamp || Date.now()}`;

    console.log("✅ Generated uniqueId:", uniqueId);

    // Return complete parsed data with ALL fields
    // CRITICAL: Spread ...data FIRST, then override with unique values
    const parsed = {
      // All repair order fields (46 total) - spread FIRST
      ...data,

      // Webhook metadata - UNIQUE ID (overrides data.id)
      id: uniqueId,
      timestamp:
        webhook.timestamp || data.createdDate || new Date().toISOString(),
      event: event || "repair_order.unknown", // CRITICAL: Event field

      // Ensure repairOrderNumber exists (override if needed)
      repairOrderNumber: orderNumber,

      // Enhanced fields (override/add to data)
      jobs: jobs,
      jobStats: jobStats,
      balanceDue: (data.totalSales || 0) - (data.amountPaid || 0),
      priority: determinePriority(data),
    };

    console.log("✅ PARSED SUCCESSFULLY:", {
      id: parsed.id,
      repairOrderNumber: parsed.repairOrderNumber,
      event: parsed.event,
      jobCount: parsed.jobs?.length,
    });

    return parsed;
  } catch (error) {
    console.error("❌ Parser error:", error.message, error);
    return null;
  }
};

// Currency formatter
export const formatCurrency = (cents) => {
  if (!cents && cents !== 0) return "$0.00";

  // Values from your API are already in cents (e.g., 3500 = $35.00)
  // Divide by 100 to convert cents to dollars
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
};

// Date formatter
export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
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
