// ---------- Firebase Setup ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getDatabase, ref, query, orderByChild, startAt, onValue 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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

// ✅ Register Chart Zoom Plugin (works with non-module script)
if (window.Chart && Chart.register) {
  try {
    Chart.register(window['chartjs-plugin-zoom']);
    console.log('✅ Chart Zoom plugin registered successfully');
  } catch (err) {
    console.warn('⚠️ Could not register zoom plugin:', err);
  }
}

// ---------- Utility: Get Start of Today (UTC) ----------
function getTodayUTCBounds() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0
  ));
  const endOfDay = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999
  ));
  return { startOfDay, endOfDay };
}

const { startOfDay, endOfDay } = getTodayUTCBounds();

// ---------- Base Chart Options ----------
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400, easing: "easeOutQuart" },
  scales: {
    x: {
      type: "time",
      time: { unit: "hour", tooltipFormat: "MMM d, HH:mm" },
      grid: { color: "rgba(0,0,0,0.1)" },
      title: { display: true, text: "Time (UTC)" },
      min: startOfDay.getTime(),
      max: endOfDay.getTime(),
    },
    y: {
      beginAtZero: false,
      grid: { color: "rgba(0,0,0,0.1)" }
    }
  },
  plugins: {
    tooltip: { mode: "index", intersect: false },
    legend: { display: true },
    zoom: {
      pan: {
        enabled: true,
        mode: "x",
        threshold: 5,
        onPanStart({ chart }) { chart.options.plugins.tooltip.enabled = false; },
        onPanComplete({ chart }) { chart.options.plugins.tooltip.enabled = true; }
      },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        drag: {
          enabled: true,
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          borderColor: 'rgba(59, 130, 246, 0.5)',
          borderWidth: 1
        },
        mode: "x"
      },
      limits: {
        x: {
          min: startOfDay.getTime(),
          max: endOfDay.getTime(),
          minRange: 1000 * 60 * 2 // 2 minutes
        }
      }
    }
  },
  interaction: { mode: "nearest", intersect: false },
  elements: { point: { radius: 2 }, line: { tension: 0.25 } }
};

// ---------- Create Charts ----------
const tempChart = new Chart(document.getElementById("tempChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { label: "Temperature (°C)", borderColor: "#ef4444", data: [], fill: false }
  ]},
  options: JSON.parse(JSON.stringify(baseOptions))
});

const doChart = new Chart(document.getElementById("doChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { label: "DO Concentration (mg/L)", borderColor: "#3b82f6", data: [], fill: false }
  ]},
  options: JSON.parse(JSON.stringify(baseOptions))
});

const satChart = new Chart(document.getElementById("satChart"), {
  type: "line",
  data: { labels: [], datasets: [
    { label: "DO Saturation (%)", borderColor: "#10b981", data: [], fill: false }
  ]},
  options: JSON.parse(JSON.stringify(baseOptions))
});

// ---------- Fetch Today's Data (All UTC Readings) ----------
const todayISO = startOfDay.toISOString();
const sensorQuery = query(
  ref(db, "sensorData"),
  orderByChild("timestamp"),
  startAt(todayISO)
);

onValue(sensorQuery, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const entries = Object.values(data)
    .filter(e => e.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const times = [], temps = [], concs = [], sats = [];

  entries.forEach((e) => {
    const t = parseTimestamp(e.timestamp);
    if (!t) return;
    times.push(t);
    temps.push(Number(e.temperature));
    concs.push(Number(e.do_concentration));
    sats.push(Number(e.do_saturation));
  });

  [tempChart, doChart, satChart].forEach((chart, i) => {
    chart.data.labels = times;
    chart.data.datasets[0].data = [temps, concs, sats][i];
    chart.update("none");
  });
});

// ---------- Timestamp Helper ----------
function parseTimestamp(v) {
  if (!v) return null;
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// ---------- Zoom Reset Buttons ----------
document.querySelectorAll("[data-reset-zoom]").forEach(btn => {
  btn.addEventListener("click", () => {
    const chartId = btn.dataset.resetZoom;
    const chart = { tempChart, doChart, satChart }[chartId];
    if (chart?.resetZoom) chart.resetZoom({ duration: 500 });
  });
});

// ---------- Scroll to Charts Button ----------
document.querySelector('.btn-outline-primary')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('charts-section')?.scrollIntoView({
    behavior: 'smooth', block: 'start'
  });
});

// ---------- Double-click / Alt-click Zoom ----------
document.querySelectorAll("canvas").forEach(canvas => {
  canvas.addEventListener("dblclick", (e) => {
    const chart = Chart.getChart(e.target);
    if (chart?.zoom) chart.zoom(1.2);
  });
  canvas.addEventListener("click", (e) => {
    if (!e.altKey) return;
    const chart = Chart.getChart(e.target);
    if (chart?.zoom) chart.zoom(0.8);
  });
});
