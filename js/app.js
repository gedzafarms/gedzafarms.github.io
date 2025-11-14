// js/app.js
console.log("Dashboard loaded!");

// Import firebase sdk
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  query, 
  limitToLast, 
  onValue,
  get } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDtjxgFGhWxri9cQbDL6fORnEOptDgxlt0",
  authDomain: "datahub-62b39.firebaseapp.com",
  databaseURL: "https://datahub-62b39-default-rtdb.firebaseio.com",
  projectId: "datahub-62b39",
  storageBucket: "datahub-62b39.firebasestorage.app",
  messagingSenderId: "48519052251",
  appId: "1:48519052251:web:f988130796a51cce14c5fe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// HTML elements
const tempEl = document.getElementById("temp-value");
const conEl  = document.getElementById("con-value");
const satEl  = document.getElementById("sat-value");
const countdownEl = document.getElementById("countdown");
const historyTableBody = document.getElementById("historyTableBody");
const filterSelect = document.getElementById("filterSelect");
const historyModal = document.getElementById("historyModal");
const viewMoreBtn = document.getElementById("viewMoreBtn");
const historyTriggerBtn = document.querySelector('[data-bs-target="#historyModal"]');

//Settings & state
const READ_INTERVAL_SECONDS = 60;
const OFFLINE_WAIT_SECONDS = 120;
const HISTORY_FETCH_LIMIT = 600;
const HISTORY_CHUNK = 100;

let countdownInterval = null;
let offlineTimeout = null;
let historyRows = [];
let historyVisibleCount = 0;

// Show error message
function showError(message) {
  tempEl.textContent = message;
  conEl.textContent  = message;
  satEl.textContent  = message;
}

function safeNum(value, fallback = 0) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

// Timestamp parser that handles your UTC format
function parseTimestamp(raw) {
  if (raw == null) return null;

  if (typeof raw === "number") {
    if (raw > 1e11) return new Date(raw);  // ms
    if (raw > 1e9) return new Date(raw * 1000); // sec
    return new Date(raw);
  }

  if (typeof raw === "string") {
    let s = raw.trim();

    // Remove invalid "+00:00Z" case
    if (s.endsWith("+00:00Z")) {
      s = s.replace("+00:00Z", "Z");
    }

    // Standard UTC like "2025-09-18T16:34:45Z"
    if (s.includes("T") && s.endsWith("Z")) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Old format fallback: "DD-MM-YYYY HH:MM:SS"
    const oldMatch = s.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (oldMatch) {
      const [, day, month, year, hour, min, sec] = oldMatch;
      return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(min),
        parseInt(sec)
      ));
    }

    // Final fallback
    const tryDirect = new Date(s);
    if (!isNaN(tryDirect.getTime())) return tryDirect;
  }

  return null;
}


//Countdown functions
function setCountText(t) {
  if (!countdownEl) return;
  countdownEl.textContent = t;
}

function clearCountInterval() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function startCountdown(seconds) {
  if (!countdownEl) return;
  clearCountInterval();
  let remaining = Math.max(0, Math.floor(seconds));
  updateCountdownDisplay(remaining);

  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      updateCountdownDisplay(remaining);
    } else {
      clearCountInterval();
    }
  }, 1000);
}

function updateCountdownDisplay(seconds) {
  if (!countdownEl) return;
  if (seconds > 0) {
    setCountText(`Next update in ${seconds}s`);
  }
}

function resetOfflineTimeout() {
  if (offlineTimeout) clearTimeout(offlineTimeout);
  offlineTimeout = setTimeout(() => {
    showError("⚠️ Sensor is offline");
    setCountText("No update received!");
    clearCountInterval();
  }, OFFLINE_WAIT_SECONDS * 1000);
}

if (countdownEl) setCountText("Updating...");

// Realtime Latest Reading
const latestRef = query(ref(db, "sensorData"), limitToLast(1));

onValue(latestRef, (snapshot) => {
  try {
    if (!snapshot.exists()) {
      showError("⚠️ Sensor is offline");
      return;
    }

    let newest = null;
    snapshot.forEach(c => newest = c.val());
    if (!newest) {
      showError("⚠️ Sensor is offline");
      return;
    }

    const tsDate = parseTimestamp(newest.timestamp);
    const tsMs = (tsDate && !isNaN(tsDate.getTime())) ? tsDate.getTime() : Date.now();

    if (tempEl) tempEl.textContent = (newest.temperature ?? "--") + " °C";
    if (conEl) conEl.textContent = (newest.do_concentration ?? "--") + " mg/L";
    if (satEl) satEl.textContent = (newest.do_saturation ?? "--") + " %";

    resetOfflineTimeout();

    const savedRaw = localStorage.getItem("lastSensorTimestamp");
    const savedTs = safeNum(savedRaw, 0);
    const TOL_MS = 2000;

    if (savedTs === 0) {
      localStorage.setItem("lastSensorTimestamp", String(tsMs));
      startCountdown(READ_INTERVAL_SECONDS);
      return;
    }

    if (tsMs > savedTs + TOL_MS) {
      localStorage.setItem("lastSensorTimestamp", String(tsMs));
      startCountdown(READ_INTERVAL_SECONDS);
      return;
    }

    const elapsed = Math.floor((Date.now() - tsMs) / 1000);
    const remaining = Math.max(READ_INTERVAL_SECONDS - elapsed, 0);

    if (remaining > 0) {
      startCountdown(remaining);
    } else {
      if (countdownEl) countdownEl.textContent = "Updating...";
    }

  } catch (err) {
    console.error("Error in onValue handler:", err);
    showError("⚠️ Network error");
  }
}, (err) => {
  console.error("Firebase onValue error:", err);
  showError("⚠️ Network error");
});

// Listen for daily min/max stats from Firebase
const dailyStatsRef = ref(db, "dailyStats/current");
onValue(dailyStatsRef, (snapshot) => {
  if (!snapshot.exists()) {
    console.error("❌ No daily stats found in Firebase");
    return;
  }

  const stats = snapshot.val();
  console.log("🔥 DailyStats snapshot:", stats);

  try {
    document.getElementById("sat-max").textContent  = stats.saturation.max ?? "--";
    document.getElementById("sat-min").textContent  = stats.saturation.min ?? "--";

    document.getElementById("con-max").textContent  = stats.concentration.max ?? "--";
    document.getElementById("con-min").textContent  = stats.concentration.min ?? "--";

    document.getElementById("temp-max").textContent = stats.temperature.max ?? "--";
    document.getElementById("temp-min").textContent = stats.temperature.min ?? "--";
  }
  catch (err) {
    console.error("⚠️ Error rendering dailyStats:", err, stats);
  }
});


// History loading
async function loadHistory(filter = "day") {
  console.log(`Loading history: ${filter}`);
  
  if (!historyTableBody) return;
  historyTableBody.innerHTML = 
  `<tr><td colspan="4" class="text-center">
    <div class="spinner-border text-primary" role="status"></div>
    <span class="ms-2">Loading...</span>
  </td></tr>`;

  historyRows = [];
  historyVisibleCount = 0;
  viewMoreBtn?.classList.add("d-none");

  try {
    const historyRef = query(ref(db, "sensorData"), limitToLast(HISTORY_FETCH_LIMIT));
    const snapshot = await get(historyRef);

    if (!snapshot.exists()) {
      historyTableBody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>⚠️ No history found</td></tr>";
      return;
    }

    const nowUtc = new Date();
    console.log(`Current UTC: ${nowUtc.toISOString()}`);
    
    let cutoffTime;
    if (filter === "day") {
      cutoffTime = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000);
    } else if (filter === "week") {
      cutoffTime = new Date(nowUtc.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (filter === "month") {
      cutoffTime = new Date(nowUtc.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      cutoffTime = new Date(0);
    }
    
    console.log(`Cutoff time: ${cutoffTime.toISOString()}`);

    const allData = [];
    let totalEntries = 0;
    let validEntries = 0;
    let filteredEntries = 0;
    
    snapshot.forEach(child => {
      totalEntries++;
      const data = child.val();
      const ts = parseTimestamp(data.timestamp);
      
      if (ts && !isNaN(ts.getTime())) {
        validEntries++;
        
        if (ts >= cutoffTime) {
          filteredEntries++;
          allData.push({
            timestamp: ts,
            temperature: data.temperature ?? "--",
            do_concentration: data.do_concentration ?? "--",
            do_saturation: data.do_saturation ?? "--"
          });
        }
      } else {
        console.warn(`Invalid timestamp: "${data.timestamp}"`);
      }
    });
    
    console.log(`Stats - Total: ${totalEntries}, Valid: ${validEntries}, After filter: ${filteredEntries}`);

    if (allData.length === 0) {
      historyTableBody.innerHTML = 
      "<tr><td colspan='4' class='text-center text-warning'>⚠️ No data for this period</td></tr>";
      return;
    }

    // Sort by timestamp descending (newest first)
    allData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    console.log(`Newest: ${allData[0].timestamp.toISOString()}`);
    console.log(`Oldest: ${allData[allData.length-1].timestamp.toISOString()}`);

    historyRows = allData.map(item => `
      <tr>
        <td>${item.timestamp.toLocaleString()}</td>
        <td>${item.temperature}</td>
        <td>${item.do_concentration}</td>
        <td>${item.do_saturation}</td>
      </tr>
    `);

    historyVisibleCount = Math.min(HISTORY_CHUNK, historyRows.length);
    renderHistoryChunk();

    if (historyRows.length > historyVisibleCount) viewMoreBtn?.classList.remove("d-none");

    console.log(`History loaded successfully - showing ${historyVisibleCount}/${historyRows.length} entries`);

  } catch (err) {
    console.error("Error loading history:", err);
    historyTableBody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>⚠️ Network error</td></tr>";
  }
}

function renderHistoryChunk() {
  if (!historyTableBody) return;
  const slice = historyRows.slice(0, historyVisibleCount);
  historyTableBody.innerHTML = slice.join("") || "<tr><td colspan='4' class='text-center text-warning'>⚠️ No data for this period</td></tr>";
}

if (viewMoreBtn) {
  viewMoreBtn.addEventListener("click", () => {
    historyVisibleCount = Math.min(historyRows.length, historyVisibleCount + HISTORY_CHUNK);
    renderHistoryChunk();
    if (historyVisibleCount >= historyRows.length) viewMoreBtn.classList.add("d-none");
  });
}

if (historyTriggerBtn) {
  historyTriggerBtn.addEventListener("click", () => historyTriggerBtn.blur());
}

if (historyModal) {
  historyModal.addEventListener("show.bs.modal", () => {
    const f = (filterSelect && filterSelect.value) ? filterSelect.value : "day";
    loadHistory(f);
  });
}

if (filterSelect) {
  filterSelect.addEventListener("change", () => {
    const f = filterSelect.value;
    loadHistory(f);
  });
}

// DEBUG FUNCTION
window.debugFirebase = async function() {
  console.log("=== FIREBASE DEBUG ===");
  
  try {
    const historyRef = query(ref(db, "sensorData"), limitToLast(5));
    const snapshot = await get(historyRef);
    
    if (!snapshot.exists()) {
      console.log("No data found!");
      return;
    }

    const entries = [];
    snapshot.forEach(child => {
      const data = child.val();
      entries.push({
        raw: data.timestamp,
        parsed: parseTimestamp(data.timestamp),
        temp: data.temperature
      });
    });
    
    entries.reverse().forEach((entry, idx) => {
      console.log(`${idx + 1}. "${entry.raw}" → ${entry.parsed} (${entry.temp}°C)`);
    });
    
    const latest = entries[0];
    const nowUtc = new Date();
    const ageMinutes = Math.floor((nowUtc - latest.parsed) / (1000 * 60));
    console.log(`\nLatest data is ${ageMinutes} minutes old`);
    
  } catch (err) {
    console.error("Debug error:", err);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("Dashboard ready!");
  if (countdownEl) countdownEl.textContent = "Updating...";
  const lastSaved = safeNum(localStorage.getItem("lastSensorTimestamp"), 0);
  if (lastSaved) {
    const ageSec = Math.floor((Date.now() - lastSaved) / 1000);
    if (ageSec > OFFLINE_WAIT_SECONDS) {
      showError("⚠️ Sensor is offline");
      if (countdownEl) countdownEl.textContent = "No recent update!";
    }
  }
});


