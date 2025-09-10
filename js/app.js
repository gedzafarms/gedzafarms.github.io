console.log("Dashboard loaded!");

// Import firebase sdk
// Import { initializeApp } from "firebase/app";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  query, 
  limitToLast,
  orderByChild, 
  onValue,
  get } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase config settings
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

// Show error message
function showError(message) {
  tempEl.textContent = message;
  conEl.textContent  = message;
  satEl.textContent  = message;
}

// Realtime Latest Reading
const latestRef = query(ref(db, "sensorData"), limitToLast(1));

let countdownInterval;

onValue(latestRef, (snapshot) => {
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const data = child.val();

      // Update cards
      tempEl.textContent = (data.temperature ?? "--") + " °C";
      conEl.textContent  = (data.do_concentration ?? "--") + " mg/L";
      satEl.textContent  = (data.do_saturation ?? "--") + " %";

      // Save timestamp + reset countdown
      const ts = Number(data.timestamp) || Date.now(); // ensure valid number
      const savedTs = Number(localStorage.getItem("lastSensorTimestamp")) || 0;

      if (ts > savedTs) {
        // NEW data arrived - start fresh 60s countdown
        localStorage.setItem("lastSensorTimestamp", ts);
        startCountdown(60);
        // const elapsed = Math.floor((Date.now() - ts) / 1000);
        // const remaining = Math.max(60 - elapsed, 0);
        // startCountdown(remaining);
      }
      else if (ts === savedTs) {
        // SAME data (page refresh) - calculate remaining time
        const elapsed = Math.floor((Date.now() - ts) / 1000);
        const remaining = Math.max(60 - elapsed, 0);
        startCountdown(remaining);
      }
    });
  } 
  else {
    // No data available yet
    showError("⚠️ Sensor is offline");
  }
}, (error) => {
  console.error("Firebase error:", error);
  showError("⚠️ Network error");
});

// Countdown function
function startCountdown(seconds) {
  clearInterval(countdownInterval);
  
  let remaining = Math.max(0, seconds); // Ensure non-negative

  // Update display immediately
  updateCountdownDisplay(remaining);

  countdownInterval = setInterval(() => {
    remaining--;
    updateCountdownDisplay(remaining);

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownEl.textContent = "Waiting for update...";
    } 
  }, 1000);
}

// Helper function to update countdown display
function updateCountdownDisplay(seconds) {
  if (seconds > 0) {
    countdownEl.textContent = `Next update in ${seconds}s`;
  } else {
    countdownEl.textContent = "Update overdue...";
  }
}


// HISTORY VIEW FUNCTIONALITY
async function loadHistory(filter = "day") {
  const historyRef = query(ref(db, "sensorData"), limitToLast(500));
  const tableBody = document.getElementById("historyTableBody");
  
  if (!tableBody) return; // safeguard

  // Show spinner
  tableBody.innerHTML = `
    <tr>
      <td colspan='4' class='text-center'>
        <div class="spinner-border text-primary" role="status"></div>
        <span class="ms-2">Loading...</span>
      </td>
    </tr>
  `;

  try {
    const snapshot = await get(historyRef);

    if (!snapshot.exists()) {
    tableBody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>⚠️ No history found</td></tr>";
    return;
    }

    let rows = [];
    const now = new Date();

    // Define cutoffs
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    // Start of this week (Monday 00:00)
    const startOfWeek = new Date(startOfToday);
    const day = now.getDay();
    const diff = (day === 0 ? 6 : day - 1)
    startOfWeek.setDate(startOfWeek.getDate() - diff); // Sunday = start
    startOfWeek.setHours(0, 0, 0, 0);


    // Start of this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    function parseTimestamp(raw) {
      if (typeof raw === "number") {
        return new Date(raw); // already epoch ms
      }

      if (typeof raw === "string") {
        // Convert "YYYY-MM-DD HH:MM:SS" → ISO "YYYY-MM-DDTHH:MM:SSZ"
        const iso = raw.replace(" ", "T") + "Z"; 
        return new Date(iso);
      }

      return null;
    }


    snapshot.forEach(child => {
      const data = child.val();
      const ts = parseTimestamp(data.timestamp);

      if (!ts || isNaN(ts.getTime())) {
        console.warn("Invalid date:", data.timestamp);
        return;
      }

      let include = false;
      if (filter === "day") {
        include = ts >= startOfToday && ts <= now;
      }
      if (filter === "week") {
        include = ts >= startOfWeek && ts <= now;
      }
      if (filter === "month") {
        include = ts >= startOfMonth && ts <= now;
      }

      if (include) {
        rows.push(`
          <tr>
            <td>${ts.toLocaleString()}</td>
            <td>${data.temperature ?? "--"}</td>
            <td>${data.do_concentration ?? "--"}</td>
            <td>${data.do_saturation ?? "--"}</td>
          </tr>
        `);
      }
    });


    tableBody.innerHTML = rows.length 
      ? rows.reverse().join("") 
      : "<tr><td colspan='4' class='text-center text-warning'>⚠️ No data for this period</td></tr>";
  }
  catch (err) {
    console.error("Error loading history:", err);
    tableBody.innerHTML = "<tr><td colspan='4' class='text-center text-danger'>⚠️ Network error</td></tr>";
  }
}

// On page load, resume countdown based on last timestamp
window.addEventListener("DOMContentLoaded", () => {
  const lastTs = Number(localStorage.getItem("lastSensorTimestamp"));

  if (lastTs && !isNaN(lastTs)) {
    const elapsed = Math.floor((Date.now() - lastTs) / 1000);
    const remaining = Math.max(60 - elapsed, 0);
    
    if (remaining > 0) {
      startCountdown(remaining);
    } else {
      // Data is overdue
      countdownEl.textContent = "Update overdue...";
    }
  } 
  else {
    // No previous data yet → show waiting
    countdownEl.textContent = "Waiting for first reading...";
  }
});

// Event listeners for modal + filter
const filterSelect = document.getElementById("filterSelect");
if (filterSelect) {
  filterSelect.addEventListener("change", e => {
    loadHistory(e.target.value);
  });
}

const historyModal = document.getElementById("historyModal");
if (historyModal) {
  historyModal.addEventListener("show.bs.modal", () => {
    const filter = filterSelect ? filterSelect.value : "day";
    loadHistory(filter);
  });
}


