console.log("Dashboard loaded!");

// Import firebase sdk
//import { initializeApp } from "firebase/app";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

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
const oxyEl  = document.getElementById("con-value");
const satEl  = document.getElementById("sat-value");

// Reusable error display
function showError(message) {
  tempEl.textContent = message;
  oxyEl.textContent  = message;
  satEl.textContent  = message;
}

// Listen to sensor data
const sensorRef = ref(db, "sensorData/latest");

onValue(sensorRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    tempEl.textContent = data.temperature + " °C";
    oxyEl.textContent  = data.oxygen + " mg/L";
    satEl.textContent  = data.saturation + " %";
  } else {
    showError("⚠️ Sensor is offline");
  }
}, (error) => {
  console.error("Firebase error:", error);
  showError("⚠️ Network error");
});
