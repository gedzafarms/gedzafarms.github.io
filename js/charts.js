// ---------- Firebase Setup ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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

// ---------- Chart Base Options ----------
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 400,
    easing: "easeOutQuart" // ✅ smooth transition animations
  },
  scales: {
    x: {
      type: "time",
      time: { unit: "hour", tooltipFormat: "MMM d, HH:mm" },
      grid: { color: "rgba(0,0,0,0.1)" },
      title: { display: true, text: "Time (UTC)" }
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
        scaleMode: "x", // ✅ replaces deprecated overScaleMode
        modifierKey: null,
        deceleration: 0.9, // ✅ smooth glide panning
        threshold: 5,
        onPanStart({ chart }) {
          chart.options.plugins.tooltip.enabled = false;
        },
        onPanComplete({ chart }) {
          chart.options.plugins.tooltip.enabled = true;
        }
      },
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        drag: { enabled: false },
        mode: "x"
        // onZoomStart({ chart }) {
        //   chart.options.plugins.tooltip.enabled = false;
        // },
        // onZoomComplete({ chart }) {
        //   chart.options.plugins.tooltip.enabled = true;
        // }
      },
      limits: {
        x: { minRange: 1000 * 60 * 2 }
      }
    }
  },
  interaction: { mode: "nearest", intersect: false },
  elements: { point: { radius: 2 }, line: { tension: 0.25 } }
};

// ---------- Create Charts ----------
const tempChart = new Chart(document.getElementById("tempChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Temperature (°C)", borderColor: "#ef4444", data: [], fill: false }
    ]
  },
  options: baseOptions
});

const doChart = new Chart(document.getElementById("doChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "DO Concentration (mg/L)", borderColor: "#3b82f6", data: [], fill: false }
    ]
  },
  options: baseOptions
});

const satChart = new Chart(document.getElementById("satChart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "DO Saturation (%)", borderColor: "#10b981", data: [], fill: false }
    ]
  },
  options: baseOptions
});

// ---------- Fetch Data and Update ----------
const sensorRef = query(ref(db, "sensorData"), limitToLast(200));

onValue(sensorRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const entries = Object.values(data).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const times = [], temps = [], concs = [], sats = [];

  entries.forEach((e) => {
    const t = parseTimestamp(e.timestamp);
    if (!t) return;
    times.push(t);
    temps.push(Number(e.temperature));
    concs.push(Number(e.do_concentration));
    sats.push(Number(e.do_saturation));
  });

  // Update chart data
  [tempChart, doChart, satChart].forEach((chart, i) => {
    chart.data.labels = times;
    chart.data.datasets[0].data = [temps, concs, sats][i];
    chart.update("none");
  });
});

// ---------- Timestamp Helper ----------
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

// ---------- Zoom Reset Buttons ----------
document.querySelectorAll("[data-reset-zoom]").forEach(btn => {
  btn.addEventListener("click", () => {
    const chartId = btn.dataset.resetZoom;
    const chart = { tempChart, doChart, satChart }[chartId];
    if (chart && chart.resetZoom) {
      chart.resetZoom({ duration: 500 }); // ✅ smooth reset animation
    }
  });
});

// ---------- Scroll to Charts Button ----------
document.querySelector('.btn-outline-primary.ms-5')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('charts-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
});

// ---------- Double-click / Alt-click Zoom ----------
document.querySelectorAll("canvas").forEach(canvas => {
  canvas.addEventListener("dblclick", (e) => {
    const chart = Chart.getChart(e.target);
    if (!chart) return;
    chart.zoom({ x: 1.2 }, { transition: { duration: 300 } }); // ✅ smooth zoom-in
  });

  canvas.addEventListener("click", (e) => {
    if (!e.altKey) return;
    const chart = Chart.getChart(e.target);
    if (!chart) return;
    chart.zoom({ x: 0.8 }, { transition: { duration: 300 } }); // ✅ smooth zoom-out
  });
});
