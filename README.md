# 📍 BASMA Duty — Geofenced Attendance & GPS Location Hub

[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-blue.svg?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green.svg?logo=leaflet)](https://leafletjs.com/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4.svg?logo=googlechrome)](https://developer.chrome.com/docs/extensions/)
[![Language](https://img.shields.io/badge/Docs-English_%7C_%D8%B9%D8%B1%D8%A8%D9%8A-orange.svg)](README_AR.md)

A comprehensive, production-ready geospatial hub and attendance coordination suite. **BASMA Duty** pairs an interactive **OpenStreetMap Leaflet** dashboard with an **NMEA 0183 hardware GPS simulator** featuring organic satellite micro-jitter, a standalone **Manifest V3 Chrome Extension** for browser geolocation overriding, and a lightweight Python SDK for attendance scripts and duty bots.

> 📖 **للقراءة باللغة العربية:** يمكنك الاطلاع على النسخة العربية في [README_AR.md](README_AR.md).

---

## 📑 Table of Contents

- [Key Architecture & Features](#-key-architecture--features)
  - [1. Interactive Geospatial Control Center](#1-interactive-geospatial-control-center)
  - [2. Virtual Hardware GPS Chip Simulator](#2-virtual-hardware-gps-chip-simulator)
  - [3. Standalone Chrome Extension](#3-standalone-chrome-extension)
  - [4. Python Integration SDK](#4-python-integration-sdk)
  - [5. Verification & Diagnostics Suite](#5-verification--diagnostics-suite)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [How to Run](#-how-to-run)
  - [Method 1: Windows 1-Click Launcher](#method-1-windows-1-click-launcher)
  - [Method 2: Command Line (CLI)](#method-2-command-line-cli)
  - [Method 3: Standalone GPS Hardware Simulator](#method-3-standalone-gps-hardware-simulator)
- [Chrome Extension Setup](#-chrome-extension-setup)
- [Python Integration Guide](#-python-integration-guide)
- [REST API Endpoints](#-rest-api-endpoints)
- [License](#-license)

---

## ✨ Key Architecture & Features

### 1. Interactive Geospatial Control Center
* **Live OpenStreetMap & Multiple Layer Support:** High-resolution map with OpenStreetMap Standard, Satellite Imagery, Dark Mode, and Topography layers.
* **Radar Pulse Pin & Drag-and-Drop:** Interactive pulsing marker that updates coordinates in real time when dragged or clicked anywhere on the globe.
* **Geofence Radius Controller:** Visual interactive radius overlay with customizable boundaries from 30 meters up to 2,000 meters and quick presets (50m, 150m, 300m, 500m, 1km).
* **Smart Search & Autocomplete:** Floating search bar powered by OpenStreetMap Nominatim for searching cities, districts, office buildings, or landmarks worldwide.
* **Reverse Geocoding:** Instant automated conversion of latitude/longitude into formatted, human-readable street addresses.
* **Device GPS Sync:** One-click real GPS acquisition from the client device.
* **Branch & Headquarters Presets:** Save and switch between multiple company branches, headquarters, or custom worksites (`presets.json`).
* **Multi-Format Export:**
  * 📋 **Copy Coordinates:** Single-click copy of `(Latitude, Longitude)`.
  * 🗺️ **Google Maps & OSM:** Direct redirect to Google Maps / OpenStreetMap for turn-by-turn navigation.
  * 🐍 **Python Snippet:** Instant ready-to-paste Python code for duty automation.
  * 📥 **GPX Waypoint:** Download GPX tracks for GPS mock devices.
  * 📄 **JSON Object:** Clean JSON structure containing metadata, radius, and timestamps.
* **Persistent Multi-Store Sync:** Saving updates `location.json`, `.env`, and browser `localStorage` simultaneously.

### 2. Virtual Hardware GPS Chip Simulator (`gps_simulator.py`)
* **Authentic Chip Emulation:** Simulates real GPS receiver hardware (such as u-blox NEO or MediaTek MT3339).
* **Standard NMEA 0183 Protocol:** Emits valid, checksummed NMEA sentences:
  * `$GPGGA` (Global Positioning System Fix Data)
  * `$GPRMC` (Recommended Minimum Specific GNSS Data)
  * `$GPVTG` (Course Over Ground and Ground Speed)
  * `$GPGSA` (GNSS DOP and Active Satellites)
* **Organic Signal Jitter (Anti-Detection):** Injects realistic Gaussian micro-drift (0.5m – 1.5m) and natural velocity fluctuations to emulate authentic atmospheric variance and physical device handling.
* **Dual-Protocol Network Broadcasting:**
  * **UDP Broadcast:** Port `10110` (Standard marine / GPS network broadcast).
  * **TCP Server:** Port `2947` (Compatible with `gpsd` client protocols).

### 3. Standalone Chrome Extension (`chrome_extension/`)
* **Manifest V3 Compliant:** Operates without requiring complex external proxy applications.
* **`MAIN` World Inception:** Injects at `document_start` to override native `navigator.geolocation.getCurrentPosition` and `navigator.geolocation.watchPosition` before web applications can query them.
* **Realistic Geolocation Position Objects:** Returns complete `GeolocationPosition` objects with accurate `latitude`, `longitude`, `altitude`, `accuracy`, `speed`, `heading`, and high-precision `timestamp`.
* **Dark-Themed Modern Popup:** Visual controller showing current active coordinates, server status, and one-click reload.

### 4. Python Integration SDK (`location_service.py`)
* Zero-dependency internal library to read, update, and manage designated duty coordinates programmatically.
* Ready-made sample bot implementation in `example_duty_check.py`.

### 5. Verification & Diagnostics Suite (`verify_gps_chip.py`)
* Automated socket listener that binds to the UDP network feed, validates NMEA checksum integrity, verifies active satellite counts, and matches real broadcast coordinates against `location.json`.

---

## 📁 Project Structure

```text
BASMA_Duty/
├── app.py                  # FastAPI application backend and REST API
├── main.py                 # Multi-mode launcher (Desktop app / Browser auto-start)
├── run.bat                 # 1-Click quick launcher for Windows
├── location_service.py     # Python core service for reading/writing location data
├── example_duty_check.py   # Practical example showing how to query location in bot scripts
├── gps_simulator.py        # Hardware GPS chip emulator (NMEA 0183 over UDP/TCP)
├── run_gps_simulator.bat   # 1-Click launcher for the standalone GPS simulator
├── verify_gps_chip.py      # Automated socket verification & checksum test suite
├── location.json           # Active location state (lat, lon, radius, address, timestamp)
├── presets.json            # Branch and office headquarters saved presets
├── .env                    # Environment variables synchronized with active location
├── .env.example            # Environment variables template
├── requirements.txt        # Python package dependencies
├── chrome_extension/       # Standalone Chrome browser extension (Manifest V3)
│   ├── manifest.json       # Chrome extension manifest configuration
│   ├── popup.html          # Extension popup UI (modern dark theme)
│   ├── popup.js            # Extension popup logic & background communications
│   ├── override.js         # Geolocation API interceptor running in MAIN world
│   ├── content.js          # Content script bridge communicating with storage
│   └── icon.png            # Extension icon
├── static/                 # Frontend assets for the control center
│   ├── index.html          # Main web application dashboard
│   ├── style.css           # Modern responsive design (Dark/Light themes)
│   ├── app.js              # Leaflet map engine, geofencing & animations
│   └── libs/
│       └── leaflet/        # Bundled Leaflet library files (offline capable)
├── README.md               # English documentation (this file)
└── README_AR.md            # Arabic documentation
```

---

## ⚙️ Prerequisites

* **Operating System:** Windows 10/11, Linux, or macOS.
* **Python:** Version `3.8` or newer installed and added to your `PATH`.
* **Browser:** Google Chrome, Microsoft Edge, Brave, or any Chromium-based browser (for extension and dashboard).

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Hiseen-Samy/BASMA_Duty.git
   cd BASMA_Duty
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

---

## 🚀 How to Run

### Method 1: Windows 1-Click Launcher
Double-click:
```text
run.bat
```
This automatically boots the FastAPI backend, initiates the background GPS hardware simulator, and launches your default web browser to:
```text
http://127.0.0.1:8000
```

### Method 2: Command Line (CLI)
Run the application launcher directly:
```bash
python main.py
```

**Optional Command-Line Arguments:**
```bash
# Open directly in default web browser:
python main.py --browser

# Run on a custom network port:
python main.py --port 8080

# Specify a custom host address:
python main.py --host 0.0.0.0 --port 8000

# Enable live auto-reload for development:
python main.py --reload
```

### Method 3: Standalone GPS Hardware Simulator
If you only need to run the NMEA 0183 GPS socket broadcaster without the web interface:
```bash
python gps_simulator.py
```
*(Or double-click `run_gps_simulator.bat` on Windows).*

To verify that the GPS simulator is actively broadcasting valid NMEA packets:
```bash
python verify_gps_chip.py
```

---

## 🧩 Chrome Extension Setup

The included Chrome Extension enables your web browser to automatically report the chosen coordinates to any web-based attendance or fingerprint system.

1. Open Google Chrome (or Edge / Brave).
2. Navigate to: `chrome://extensions/`
3. Toggle on **"Developer mode"** in the top right corner.
4. Click the **"Load unpacked"** button in the top left.
5. Select the `chrome_extension` folder inside this repository:
   ```text
   BASMA_Duty/chrome_extension
   ```
6. The extension is now active! Pin it to your Chrome toolbar, open its popup, and enjoy instant, site-wide geolocation overriding.

---

## 🐍 Python Integration Guide

You can query the approved duty location in any external Python script or attendance bot using `location_service`:

```python
import location_service

# Retrieve current approved duty coordinates and geofence
loc = location_service.get_current_location()

latitude = loc["lat"]
longitude = loc["lon"]
radius_meters = loc["radius"]
address = loc["address"]

print(f"📍 Active Duty Site: {latitude}, {longitude} (Radius: {radius_meters}m)")
print(f"🏠 Address: {address}")

# Example attendance payload
payload = {
    "latitude": latitude,
    "longitude": longitude,
    "accuracy": 15.0
}
```

Or run the provided verification example:
```bash
python example_duty_check.py
```

---

## 🌐 REST API Endpoints

The FastAPI server provides the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the main interactive dashboard UI |
| `GET` | `/api/location` | Retrieves current saved coordinates, radius, and metadata |
| `POST` | `/api/location` | Updates and persists new coordinates to `.env` and `location.json` |
| `GET` | `/api/presets` | Retrieves all saved office and branch location presets |
| `POST` | `/api/presets` | Saves a new location preset |
| `DELETE` | `/api/presets/{preset_id}` | Removes a saved preset |
| `GET` | `/api/search?q={query}` | Proxies Nominatim geocoding search for location queries |
| `GET` | `/api/export/gpx` | Downloads a GPX Waypoint file with current coordinates |
| `GET` | `/api/export/python` | Returns generated Python snippet code |
| `GET` | `/api/gps/status` | Returns the real-time status of the NMEA GPS simulator |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). You are free to use, modify, and distribute it in your personal and commercial workflows.
