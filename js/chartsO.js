// js/charts.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase config (keep yours)
const firebaseConfig = {
  apiKey: "AIzaSyDtjxgFGhWxri9cQbDL6fORnEOptDgxlt0",
  authDomain: "datahub-62b39.firebaseapp.com",
  databaseURL: "https://datahub-62b39-default-rtdb.firebaseio.com",
  projectId: "datahub-62b39",
  storageBucket: "datahub-62b39.firebasestorage.app",
  messagingSenderId: "48519052251",
  appId: "1:48519052251:web:f988130796a51cce14c5fe"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM
const tempChartCtx = document.getElementById("tempChart");
const doChartCtx = document.getElementById("doChart");
const satChartCtx = document.getElementById("satChart");
const statusEl = document.getElementById("sensor-status");

// ---------- timestamp parser ----------
function parseTimestamp(v) {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? new Date(v) : new Date(v * 1000);
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
    const n = Number(v);
    if (!Number.isNaN(n)) return n > 1e12 ? new Date(n) : new Date(n * 1000);
  }
  return null;
}

// ---------- try to register zoom plugin ----------
let zoomPluginAvailable = false;
try {
  if (window.Chart && window['chartjs-plugin-zoom']) {
    Chart.register(window['chartjs-plugin-zoom']);
    zoomPluginAvailable = true;
    console.log("chartjs-plugin-zoom registered");
  } else {
    console.warn("Zoom plugin not found on window; falling back to manual zoom buttons.");
  }
} catch (e) {
  console.warn("Zoom plugin registration error:", e);
}

// ---------- chart options ----------
const zoomOptions = {
  pan: { enabled: true, mode: "x", modifierKey: "ctrl" },
  zoom: { wheel: { enabled: true }, pinch: { enabled: true }, drag: { enabled: false }, mode: "x" },
  limits: { x: { minRange: 1000 * 60 * 2 } }
};

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { type: "time", time: { unit: "hour", tooltipFormat: "MMM d, HH:mm" }, title: { display: true, text: "Time (UTC)" } },
    y: { beginAtZero: false }
  },
  plugins: { tooltip: { mode: "index", intersect: false }, legend: { display: true }, zoom: zoomOptions },
  interaction: { mode: "nearest", intersect: false },
  elements: { point: { radius: 2 }, line: { tension: 0.25 } }
};

// ---------- create charts ----------
const tempChart = new Chart(tempChartCtx, {
  type: "line",
  data: { labels: [], datasets: [{ label: "Temperature (°C)", data: [], borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.2)", fill: true }] },
  options: baseOptions
});
const doChart = new Chart(doChartCtx, {
  type: "line",
  data: { labels: [], datasets: [{ label: "DO Concentration (mg/L)", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.2)", fill: true }] },
  options: baseOptions
});
const satChart = new Chart(satChartCtx, {
  type: "line",
  data: { labels: [], datasets: [{ label: "DO Saturation (%)", data: [], borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.2)", fill: true }] },
  options: baseOptions
});

// ---------- helper: set x range on a chart to [now - ms, now] ----------
function setChartRangeToWindow(chart, windowMs) {
  if (!chart || !chart.options || !chart.scales || !chart.scales.x) return;
  const now = Date.now();
  const from = now - windowMs;
  // set scale min/max and update
  chart.options.scales.x.min = from;
  chart.options.scales.x.max = now;
  chart.update();
}

// ---------- helper: reset zoom (two strategies) ----------
function resetChartZoom(chart) {
  if (zoomPluginAvailable && chart.resetZoom) {
    try { chart.resetZoom(); return; } catch (e) { /* fallback below */ }
  }
  // fallback: remove explicit min/max and update
  if (chart.options && chart.options.scales && chart.options.scales.x) {
    delete chart.options.scales.x.min;
    delete chart.options.scales.x.max;
  }
  chart.update();
}

// ---------- wire zoom buttons ----------
document.getElementById("do-zoom-30m").addEventListener("click", () => setChartRangeToWindow(doChart, 1000 * 60 * 30));
document.getElementById("do-zoom-2h").addEventListener("click", () => setChartRangeToWindow(doChart, 1000 * 60 * 60 * 2));
document.getElementById("do-zoom-reset").addEventListener("click", () => resetChartZoom(doChart));

document.getElementById("sat-zoom-30m").addEventListener("click", () => setChartRangeToWindow(satChart, 1000 * 60 * 30));
document.getElementById("sat-zoom-2h").addEventListener("click", () => setChartRangeToWindow(satChart, 1000 * 60 * 60 * 2));
document.getElementById("sat-zoom-reset").addEventListener("click", () => resetChartZoom(satChart));

document.getElementById("temp-zoom-30m").addEventListener("click", () => setChartRangeToWindow(tempChart, 1000 * 60 * 30));
document.getElementById("temp-zoom-2h").addEventListener("click", () => setChartRangeToWindow(tempChart, 1000 * 60 * 60 * 2));
document.getElementById("temp-zoom-reset").addEventListener("click", () => resetChartZoom(tempChart));

// ---------- firebase listener ----------
const historyRef = query(ref(db, "sensorData"), limitToLast(500));
let newestTsMs = 0;

onValue(historyRef, (snapshot) => {
  if (!snapshot.exists()) {
    statusEl.textContent = "🔴 Sensor Offline";
    statusEl.className = "status-indicator status-offline";
    return;
  }

  const timestamps = [], temps = [], concs = [], sats = [];
  let maxTsLocal = 0;

  snapshot.forEach(child => {
    const d = child.val();
    const ts = parseTimestamp(d.timestamp);
    if (!ts) return;
    timestamps.push(ts);
    temps.push(Number(d.temperature ?? null));
    concs.push(Number(d.do_concentration ?? null));
    sats.push(Number(d.do_saturation ?? null));
    const tms = ts.getTime();
    if (tms > maxTsLocal) maxTsLocal = tms;
  });

  // ensure labels sorted ascending (timestamps array should already be)
  tempChart.data.labels = timestamps;
  tempChart.data.datasets[0].data = temps;
  doChart.data.labels = timestamps;
  doChart.data.datasets[0].data = concs;
  satChart.data.labels = timestamps;
  satChart.data.datasets[0].data = sats;

  tempChart.update("none");
  doChart.update("none");
  satChart.update("none");

  // update newestTsMs if we found one
  if (maxTsLocal > 0) newestTsMs = maxTsLocal;
});

// ---------- status logic: prefer newestTsMs but fallback to localStorage set by index page ----------
// ---------- status logic: prefer newestTsMs but fallback to localStorage set by index page ----------
function updateStatusFromTimestamps() {
  // 1. Read latest timestamp from localStorage (if index page saved one)
  const stored = localStorage.getItem("lastSensorTimestamp");
  let storedMs = 0;
  if (stored) {
    const n = Number(stored);
    if (!Number.isNaN(n) && n > 0) storedMs = n;
  }

  // 2. Use whichever is newer — Firebase latest or stored
  const msToUse = Math.max(newestTsMs, storedMs);
  if (!msToUse) {
    statusEl.textContent = "🔴 Sensor Offline";
    statusEl.className = "status-indicator status-offline";
    return;
  }

  // 3. Compute time difference in seconds
  const now = Date.now();
  const diffSec = (now - msToUse) / 1000;

  // 4. Apply logic
  if (diffSec <= 150) {  // allow up to 2.5 minutes tolerance
    statusEl.textContent = "🟢 Sensor Online";
    statusEl.className = "status-indicator status-online";
  } else {
    statusEl.textContent = "🔴 Sensor Offline";
    statusEl.className = "status-indicator status-offline";
  }

  // Debug log for verification
  console.log("⏱ Status check:", {
    now: new Date(now).toISOString(),
    latest: new Date(msToUse).toISOString(),
    diffSec
  });
}

// Run periodically and on storage updates
setInterval(updateStatusFromTimestamps, 5000);
updateStatusFromTimestamps();

window.addEventListener("storage", (ev) => {
  if (ev.key === "lastSensorTimestamp") {
    const n = Number(ev.newValue);
    if (!Number.isNaN(n) && n > 0) newestTsMs = Math.max(newestTsMs, n);
    updateStatusFromTimestamps();
  }
});


// run periodically so UI stays in sync
setInterval(updateStatusFromTimestamps, 3000);
// also run immediately once
updateStatusFromTimestamps();

// listen to storage changes (so index page can update charts page via localStorage)
window.addEventListener("storage", (ev) => {
  if (ev.key === "lastSensorTimestamp") {
    // parse and set newestTsMs as fallback
    const n = Number(ev.newValue);
    if (!Number.isNaN(n) && n > 0) newestTsMs = Math.max(newestTsMs, n);
    updateStatusFromTimestamps();
  }
});
