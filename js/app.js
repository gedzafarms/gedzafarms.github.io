console.log("Dashboard loaded!");

// Import firebase sdk
//import { initializeApp } from "firebase/app";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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

// Show error message
function showError(message) {
  tempEl.textContent = message;
  conEl.textContent  = message;
  satEl.textContent  = message;
}

// Realtime Latest Reading
const latestRef = query(ref(db, "sensorData"), limitToLast(1));

onValue(latestRef, (snapshot) => {
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const data = child.val();

      // Update cards
      tempEl.textContent = data.temperature + " °C";
      conEl.textContent  = data.do_concentration + " mg/L";
      satEl.textContent  = data.do_saturation + " %";
    });
  } else {
    // No data available yet
    showError("⚠️ Sensor is offline");
  }
}, (error) => {
  console.error("Firebase error:", error);
  showError("⚠️ Network error");
});
