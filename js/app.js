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

/**
 * Timestamp parser:
 * - ISO strings
 */
function parseTimestamp(raw) {
  if (raw == null) return null;

  // numeric
  if (typeof raw === "number") {
    // treat >1e10 as ms, else seconds
    if (raw > 1e11) return new Date(raw);
    if (raw > 1e9) return new Date(raw); // ms
    return new Date(raw * 1000); // seconds -> ms
  }

  if (typeof raw === "string") {
    const s = raw.trim();

    // If ISO-like or includes T or Z, let Date try first
    if (s.includes("T") || s.includes("Z")) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Try plain Date parse
    const tryDirect = new Date(s);
    if (!isNaN(tryDirect.getTime())) return tryDirect;

    // Match "YYYY-MM-DD HH:MM:SS" explicitly and create local date
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const yr = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const day = Number(m[3]);
      const hh = Number(m[4]);
      const mm = Number(m[5]);
      const ss = Number(m[6]);
      return new Date(yr, mo, day, hh, mm, ss);
    }

    // Fallback: try append Z (UTC)
    const tryZ = new Date(s + "Z");
    if (!isNaN(tryZ.getTime())) return tryZ;
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

// Start countdown
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
      //setCountText("Update overdue...");
    }
  }, 1000);
}

function updateCountdownDisplay(seconds) {
  if (!countdownEl) return;
  if (seconds > 0) {
    setCountText(`Next update in ${seconds}s`);
  } 
//   else {
//     setCountText("Update overdue...");
//   }
}

// Sensor Offline Detection
function resetOfflineTimeout() {
  if (offlineTimeout) clearTimeout(offlineTimeout);
  offlineTimeout = setTimeout(() => {
    showError("⚠️ Sensor is offline");
    setCountText("No update received!");
    clearCountInterval();
  }, OFFLINE_WAIT_SECONDS * 1000);
}

/**
 * Real-time listener (latest reading)
 * Always show 'updating' until there's a new reading
 */
if (countdownEl) setCountText("Updating...");

// Realtime Latest Reading
const latestRef = query(ref(db, "sensorData"), limitToLast(1));

onValue(latestRef, (snapshot) => {
  try {
    if (!snapshot.exists()) {
      showError("⚠️ Sensor is offline");
      return;
    }

    // get the single node's value
    let newest = null;
    snapshot.forEach(c => newest = c.val());
    if (!newest) {
      showError("⚠️ Sensor is offline");
      return;
    }

    // parse timestamp with new value
    const tsDate = parseTimestamp(newest.timestamp);
    const tsMs = (tsDate && !isNaN(tsDate.getTime())) ? tsDate.getTime() : Date.now();

    // update values
    if (tempEl) tempEl.textContent = (newest.temperature ?? "--") + " °C";
    if (conEl) conEl.textContent = (newest.do_concentration ?? "--") + " mg/L";
    if (satEl) satEl.textContent = (newest.do_saturation ?? "--") + " %";

    // reset offline timeout
    resetOfflineTimeout();

    // compare with saved
    const savedRaw = localStorage.getItem("lastSensorTimestamp");
    const savedTs = safeNum(savedRaw, 0);

    // debug
    console.debug("Latest tsMs:", tsMs, "savedTs:", savedTs, "countdownText:", countdownEl ? countdownEl.textContent : "");

    // allow ms delay for parsing
    const TOL_MS = 2000;

    if (savedTs === 0) {
      // start fresh countdown after new update
      localStorage.setItem("lastSensorTimestamp", String(tsMs));
      startCountdown(READ_INTERVAL_SECONDS);
      return;
    }

    if (tsMs > savedTs + TOL_MS) {
      // definite new reading
      localStorage.setItem("lastSensorTimestamp", String(tsMs));
      startCountdown(READ_INTERVAL_SECONDS);
      return;
    }

    // tsMs <= savedTs + tolerance => either same reading (refresh) or small clock differences
    // If the page is currently showing "Updating..." (user just loaded), compute remaining and start
    const elapsed = Math.floor((Date.now() - tsMs) / 1000);
    const remaining = Math.max(READ_INTERVAL_SECONDS - elapsed, 0);

    // // If the UI is "Updating..." (initial or stuck) and we have a reasonable remaining, start it so user sees countdown
    // const uiText = countdownEl ? countdownEl.textContent || "" : "";
    // const uiIsUpdating = uiText.toLowerCase().includes("updating") || uiText.toLowerCase().includes("waiting") || uiText.toLowerCase().includes("update overdue");

    // if (uiIsUpdating && remaining > 0) {
    //   // Start countdown from computed remaining (this helps when parsing/storage differences would otherwise keep "Updating...")
    //   startCountdown(remaining);
    // } else {
    //   // keep "Updating..." until next fresh reading
    //   if (countdownEl) countdownEl.textContent = "Updating...";
    // }

    // Always compute countdown based on latest timestamp
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

async function loadHistory(filter = "day") {
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

    // Always work in UTC so results are consistent worldwide
    const now = new Date();
    const nowUtc = new Date(now.getTime())

    const startOfToday = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate(), 0,0,0,0));
    const startOfWeek = new Date(startOfToday);
    const day = startOfToday.getUTCDay();  // 0=Sunday
    const diff = (day === 0 ? 6 : day - 1);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);
    startOfWeek.setUTCHours(0,0,0,0);
    const startOfMonth = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0,0,0,0));

    snapshot.forEach(child => {
      const data = child.val();
      const ts = parseTimestamp(data.timestamp);
      if (!ts || isNaN(ts.getTime())) return;

      const tsUtc = new Date(ts.getTime());      // treat stored timestamp as absolute UTC

      let include = false;
      if (filter === "day") include = tsUtc >= startOfToday && tsUtc <= nowUtc;
      if (filter === "week") include = tsUtc >= startOfWeek && tsUtc <= nowUtc;
      if (filter === "month") include = tsUtc >= startOfMonth && tsUtc <= nowUtc;

      if (include) {
        historyRows.push(`
          <tr>
            <td>${tsUtc.toLocaleString()}</td>
            <td>${data.temperature ?? "--"}</td>
            <td>${data.do_concentration ?? "--"}</td>
            <td>${data.do_saturation ?? "--"}</td>
          </tr>
        `);
      }
    });

    if (historyRows.length === 0) {
      historyTableBody.innerHTML = 
      "<tr><td colspan='4' class='text-center text-warning'>⚠️ No data for this period</td></tr>";
      return;
    }

    // newest first
    historyRows = historyRows.reverse();
    historyVisibleCount = Math.min(HISTORY_CHUNK, historyRows.length);
    renderHistoryChunk();

    if (historyRows.length > historyVisibleCount) viewMoreBtn?.classList.remove("d-none");

  } 
  catch (err) {
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

// display history view
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

//checks on page onload
document.addEventListener("DOMContentLoaded", () => {
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