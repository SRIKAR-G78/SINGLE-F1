# 🗺️ NEO-6M GPS Backend Server

A Node.js/Express backend server that reads GPS data from an Arduino NEO-6M GPS module via serial port and broadcasts real-time updates to connected clients over WebSocket.

## 📋 Overview

This backend server performs the following functions:
- Connects to Arduino GPS hardware via USB serial port
- Parses NMEA GPS sentences (GPGGA, GPRMC formats)
- Supports labeled key-value GPS data from Arduino
- Broadcasts GPS data to all WebSocket-connected clients
- Provides health check and connection management endpoints
- Falls back to mock GPS data when hardware is unavailable

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Running the Server

```bash
# Start the backend server
npm start
```

The server will start on **http://localhost:8080**

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the backend directory or set these in your system:

```env
# Serial port configuration
SERIAL_PORT=COM3          # Windows: COM3, Linux: /dev/ttyUSB0
BAUD_RATE=9600            # Default: 9600

# Skip serial initialization (useful for testing without hardware)
SKIP_SERIAL=0             # Set to 1 to use mock data only

# Server port (optional)
PORT=8080                 # Default: 8080
```

## 📁 Project Structure

```
backend/
├── server.js              # Main server with GPS parsing & WebSocket logic
├── gpsModel.js            # MongoDB GPS data model (stub)
├── kalmanFilter.js        # Kalman filter implementation for GPS smoothing
├── serial-sniffer.js      # Utility to debug serial port data
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns server status
**Response:**
```json
{ "status": "ok" }
```

### Connect Arduino
```
POST /connect
```
Reconnect to Arduino serial port
**Response:**
```json
{ 
  "status": "connected", 
  "message": "Arduino connected successfully" 
}
```

### Disconnect Arduino
```
POST /disconnect
```
Closes serial port and all WebSocket connections
**Response:**
```json
{ 
  "status": "disconnected", 
  "message": "Arduino disconnected successfully" 
}
```

## 🔌 WebSocket Interface

The server broadcasts GPS data to all connected WebSocket clients at **ws://localhost:8080**

### GPS Data Format

```json
{
  "source": "nmea|labeled|mock",
  "latitude": 17.3850,
  "longitude": 78.4867,
  "altitude": 100.5,
  "satellites": 12,
  "hdop": 0.95,
  "speed": 0.0,
  "course": 0.0,
  "date": "2024-04-23",
  "time": "14:30:45",
  "fix": true,
  "local_time": "2024-04-23 20:00:15",
  "timezone": "UTC+05:30",
  "connection": "connected"
}
```

### Connection Example (JavaScript)

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to GPS server');
};

ws.onmessage = (event) => {
  const gpsData = JSON.parse(event.data);
  console.log('Latitude:', gpsData.latitude);
  console.log('Longitude:', gpsData.longitude);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from GPS server');
};
```

## 📝 File Descriptions

### server.js
Main server file containing:
- Express server setup with CORS middleware
- Serial port initialization and GPS data parsing
- WebSocket server and client broadcast logic
- NMEA sentence parsing (GPGGA, GPRMC)
- Labeled GPS data parsing (key: value format)
- Mock GPS data generation
- Health check and connection endpoints

### gpsModel.js
GPS data model for database storage (stub for MongoDB)

### kalmanFilter.js
Implements Kalman filter algorithm for smoothing GPS coordinates and reducing noise

### serial-sniffer.js
Debug utility to capture and display raw serial port data from Arduino

## 🔍 Supported GPS Data Formats

### NMEA Format (Standard)
The server supports standard NMEA-0183 GPS sentences:

**GPGGA** - Global Positioning System Fix Data
```
$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
```

**GPRMC** - Recommended Minimum Specific GPS/Transit Data
```
$GPRMC,hhmmss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,,*hh
```

### Labeled Format
Key-value format from Arduino Serial Monitor:
```
Latitude: 17.385012
Longitude: 78.486712
Altitude: 100.5
Satellites: 12
HDOP: 0.95
Speed: 5.2
Course: 45.3
Date: 2024-04-23
Time: 14:30:45
Fix: true
```

## 🛠️ Dependencies

- **express**: Web framework for HTTP endpoints
- **ws**: WebSocket library for real-time client communication
- **serialport**: Serial port communication with Arduino
- **@serialport/parser-readline**: Parses serial data by line breaks
- **cors**: Cross-Origin Resource Sharing middleware
- **dotenv**: Environment variable management

## 🐛 Troubleshooting

### Serial Port Not Found
```
No serial ports found. Falling back to mock GPS data.
```
**Solution:**
- Check Arduino is connected via USB
- Verify correct port in `.env` (use `COM3` on Windows, `/dev/ttyUSB0` on Linux)
- Use `serial-sniffer.js` to debug

### Connection Timeouts
**Solution:**
- Check firewall settings
- Verify frontend is connecting to correct WebSocket URL
- Check server logs for errors

### Mock Data Only
**Solution:**
- Check SKIP_SERIAL environment variable is not set to 1
- Verify serialport module is installed: `npm install serialport`
- Check Arduino hardware connection

## 📊 Logging

Server logs all events with emoji indicators:
- 🚀 Server startup
- ✅ Successful operations
- ❌ Errors
- ⚠️ Warnings
- 🔴 Disconnect events
- 🟢 Connect events

## 🔐 Security Notes

- CORS is set to allow all origins (`*`) - restrict this in production
- No authentication currently implemented
- WebSocket connections are unencrypted - use WSS for production

## 🚦 Development Tips

1. **Test without hardware:**
   ```bash
   SKIP_SERIAL=1 npm start
   ```

2. **Debug serial data:**
   ```bash
   node serial-sniffer.js
   ```

3. **Check available ports:**
   - Windows: Device Manager → COM Ports
   - Linux: `ls /dev/tty*`

## 📚 Related Files

- Frontend: `../frontend/README.md`
- GPS Model: `./gpsModel.js`
- Kalman Filter: `./kalmanFilter.js`

---

**Created for NEO-6M GPS Integration Project**
