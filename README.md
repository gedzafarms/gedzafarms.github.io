# 🌊 Water Quality Dashboard

A real-time dashboard that monitors and visualizes water sensor data (temperature, dissolved oxygen concentration & saturation) using **Firebase Realtime Database**, **Chart.js**, and **Bootstrap 5** — all running on a lightweight front-end hosted on **GitHub Pages**.

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

**sensorData:**
```json
{
  "-OZf1tp2a-eVFANaKMkg": {
    "do_concentration": 8.67,
    "do_saturation": 100,
    "temperature": 29.07,
    "timestamp": "2025-09-08T20:36:38Z"
  }
}

dailyStats:
{
  "2025-09-19": {
    "concentration": {
      "max": 7.66,
      "min": 7.1
    },
    "date": 2025-09-19,
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

## Author
**Gideon Gakpetor**  
🔗 [GitHub Profile](https://github.com/byte-journey)  
🌍 Passionate about IoT, data visualization, and real-time monitoring systems.
