<div align="center">

# 🌊 Water Quality Dashboard

A real-time dashboard that monitors and visualizes water sensor data (temperature, dissolved oxygen concentration & saturation) using **Firebase Realtime Database**, **Chart.js**, and **Bootstrap 5** — all running on a lightweight front-end hosted on **GitHub Pages**.

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?logo=github&style=for-the-badge)](https://byte-journey.github.io/water-quality-dashboard/)
[![Firebase](https://img.shields.io/badge/Backend-Firebase-orange?logo=firebase&style=for-the-badge)](https://firebase.google.com/)
[![Chart.js](https://img.shields.io/badge/Charts-Chart.js-ff6384?logo=chartdotjs&style=for-the-badge)](https://www.chartjs.org/)
[![Bootstrap](https://img.shields.io/badge/UI-Bootstrap%205-563d7c?logo=bootstrap&style=for-the-badge)](https://getbootstrap.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 🚀 **Overview**

This dashboard provides **real-time** visualization of water quality metrics gathered from IoT sensors.  
It automatically updates live data using **Firebase Realtime Database**, with interactive charts for analysis and historical trends.

---

## 🚀 Features
- Live data updates from Firebase Realtime Database  
- Auto-refresh countdown and offline sensor detection  
- Historical data table with filters (day, week, month)  
- Daily min/max stats display  
- Interactive charts with smooth animations  
- Fully responsive Bootstrap design  

---

## 🧰 Technologies Used
| Layer | Tools |
|-------|--------|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript (Chart.js) |
| Backend (data feed) | Python + Modbus sensor script pushing data to Firebase |
| Database | Firebase Realtime Database |
| Hosting | GitHub Pages |

---

## 📊 Firebase Structure Examples

**`sensorData`:**
```json
{
  "-OZf1tp2a-eVFANaKMkg": {
    "do_concentration": 8.67,
    "do_saturation": 100,
    "temperature": 29.07,
    "timestamp": "2025-09-08T20:36:38Z"
  }
}
```

**`dailyStats:`**
```json
{
  "2025-09-19": {
    "concentration": {
      "max": 7.66,
      "min": 7.1
    },
    "date": "2025-09-19",
    "saturation": {
      "max": 99.04,
      "min": 91.15
    },
    "temperature": {
      "max": 28.47,
      "min": 27.87
    }
  }
}
```








## Author
**Gideon Gakpetor**  
🔗 [GitHub Profile](https://github.com/byte-journey)  
🌍 Passionate about IoT, data visualization, and real-time monitoring systems.
