// src/utils/dataParser.js - COMPLETE FIX: Proportional tax + Sales terminology

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

// NEW: Calculate proportional tax for a job
export const calculateJobTax = (job, roTotalSales, roTaxes) => {
  if (!roTotalSales || roTotalSales === 0) return 0;

  // Proportional tax: (job.subtotal / ro.totalSales) × ro.taxes
  const taxPortion = (job.subtotal / roTotalSales) * roTaxes;
  return Math.round(taxPortion); // Round to nearest cent
};

// NEW: Calculate job total including tax
export const calculateJobTotal = (job, roTotalSales, roTaxes) => {
  const jobTax = calculateJobTax(job, roTotalSales, roTaxes);
  return job.subtotal + jobTax;
};

const determinePriority = (data) => {
  // Use totalSales + taxes for balance calculation
  const totalWithTax = (data.totalSales || 0) + (data.taxes || 0);
  const balanceDue = totalWithTax - (data.amountPaid || 0);
  const status = data.repairOrderStatus?.name || "";

  if (balanceDue > 500000) return "high"; // > $5000
  if (status.toLowerCase().includes("arrived")) return "high";
  if (balanceDue > 100000) return "medium"; // > $1000
  if (status.toLowerCase().includes("progress")) return "medium";
  return "normal";
};

export const parseWebhookData = (webhook) => {
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
      try {
        const parsed =
          typeof webhook.parsed_body === "string"
            ? JSON.parse(webhook.parsed_body)
            : webhook.parsed_body;

        if (parsed.data) {
          data = parsed.data;
          event = parsed.event || "";
        } else {
          data = parsed;
          event = parsed.event || "";
        }
      } catch (e) {
        data = webhook.parsed_body;
        event = webhook.parsed_body.event || "";
      }
    } else {
      data = webhook;
      event = webhook.event || webhook.message || "";
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    if (!data.repairOrderNumber && !data.id) {
      return null;
    }

    const orderNumber = data.repairOrderNumber || data.id;

    // Parse jobs and add categories + calculated tax
    const roTotalSales = data.totalSales || 0;
    const roTaxes = data.taxes || 0;

    const jobs = (data.jobs || []).map((job) => {
      const jobTax = calculateJobTax(job, roTotalSales, roTaxes);
      const jobTotal = job.subtotal + jobTax;

      return {
        ...job,
        category: getJobCategory(job.name),
        calculatedTax: jobTax, // NEW: Proportional tax
        totalWithTax: jobTotal, // NEW: Total including tax
      };
    });

    // Calculate job stats (ONLY approved jobs count toward sales)
    const approvedJobs = jobs.filter((j) => j.authorized === true);
    const jobStats = {
      authorized: approvedJobs.length,
      declined: jobs.filter((j) => j.authorized === false).length,
      pending: jobs.filter(
        (j) => j.authorized === null || j.authorized === undefined
      ).length,
    };

    const uniqueId = webhook.id
      ? `${webhook.id}`
      : `repair-${orderNumber}-${webhook.timestamp || Date.now()}`;

    // Calculate totals
    const totalWithTax = roTotalSales + roTaxes;
    const balanceDue = totalWithTax - (data.amountPaid || 0);

    const parsed = {
      ...data,
      id: uniqueId,
      timestamp:
        webhook.timestamp ||
        data.updatedDate ||
        data.createdDate ||
        new Date().toISOString(),
      event: event || "repair_order.unknown",
      repairOrderNumber: orderNumber,
      jobs: jobs,
      jobStats: jobStats,
      approvedJobs: approvedJobs, // NEW: Only approved jobs
      totalWithTax: totalWithTax,
      balanceDue: balanceDue,
      priority: determinePriority(data),
    };

    return parsed;
  } catch (error) {
    console.error("❌ Parser error:", error.message, error);
    return null;
  }
};

// Currency formatter
export const formatCurrency = (cents) => {
  if (!cents && cents !== 0) return "$0.00";

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
