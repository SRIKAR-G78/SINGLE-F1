# GPS Dashboard - Real Arduino Integration Guide

## Overview
The backend reads GPS data from an Arduino serial port, parses it, and broadcasts it over WebSocket to the React dashboard frontend.

## Supported Data Formats

### 1. NMEA Sentences
Standard GPS NMEA format (e.g., from a GPS module):
```
$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
```

Parsed fields:
- `latitude` / `longitude` (decimal degrees)
- `altitude` (meters)
- `satellites` (number of satellites)
- `hdop` (horizontal dilution of precision)
- `speed` (knots for GPRMC, converted to km/h)
- `course` (degrees)
- `date` / `time` (ISO 8601 format)
- `fix` (boolean)

### 2. Labeled Key:Value Format
Arduino Serial Monitor output (one value per line):
```
Latitude: 17.392955
Longitude: 78.318664
Altitude: 150.5
Satellites: 8
HDOP: 98
Speed: 25
Course: 180
Date: 121224
Time: 140530
Fix: 1
```

Parsed fields:
- Same as NMEA format
- HDOP is auto-scaled (e.g., 98 → 0.98)
- Speed is converted if needed (knots/m/s → km/h)

## Backend Configuration

### Run with Real Serial Data
1. Connect your Arduino with GPS module to USB.
2. Note the COM port (e.g., COM3, COM4).
3. Start the backend (remove `SKIP_SERIAL` or don't set it):
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\backend'
node server.js
```

If port is different from COM3, set it:
```powershell
$env:SERIAL_PORT = 'COM4'
$env:BAUD_RATE = '9600'
node server.js
```

### Run in Mock Mode (for Testing)
```powershell
$env:SKIP_SERIAL = '1'
node server.js
```
Generates random GPS data for testing dashboard without real hardware.

## Debugging Tools

### Serial Port Sniffer
View raw Arduino serial output:
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\backend'
node serial-sniffer.js
```

Or specify a port:
```powershell
node serial-sniffer.js COM4
```

### Test WebSocket Client
Verify server accepts WebSocket connections:
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\backend'
node test-ws-client.js
```

## Full Integration Test

### Terminal 1: Start Backend
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\backend'
node server.js
```
Watch for:
- "Server started on port 8080 (pid=...)"
- "WebSocket server attached"
- When Arduino sends data: "Parsing raw GPS data: ..." and "Broadcasting to WebSocket client: ..."

### Terminal 2: (Optional) Sniff Serial Data
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\backend'
node serial-sniffer.js
```
Confirm Arduino is sending data in expected format.

### Terminal 3: Start Frontend Dev Server
```powershell
cd 'C:\Users\srinu\OneDrive\Desktop\dashboard\gps-dashboard'
npm start
```
Browser opens at http://localhost:3001. Watch for:
- Green "connected" status banner.
- Dashboard shows live GPS coordinates, altitude, satellites, HDOP, speed, etc.
- Map updates with current location.

## Dashboard Parameters Displayed

The frontend dashboard shows:
- **Latitude / Longitude** (degrees, 6 decimal places)
- **Altitude** (meters)
- **Satellites** (count)
- **HDOP** (horizontal dilution of precision, 2 decimal places)
- **Speed** (km/h, 2 decimal places)
- **Course** (degrees, 2 decimal places)
- **Date** (YYYY-MM-DD)
- **Time** (HH:MM:SS)
- **Fix** (boolean, "Active" or "No Fix")
- **Connection Status** (connected, disconnected, error)
- **Map** (OpenStreetMap iframe centered on current lat/lon)

## Troubleshooting

### No data received on dashboard
1. Check Arduino is connected and sending data.
2. Use `serial-sniffer.js` to confirm raw data is being received.
3. Check server terminal for "Parsing raw GPS data:" logs.
4. Verify backend port 8080 is listening: `Get-NetTCPConnection -LocalPort 8080`.
5. Check browser console for WebSocket errors.

### Serial port not found
1. Verify Arduino COM port: `[System.IO.Ports.SerialPort]::GetPortNames()` in PowerShell.
2. Set `$env:SERIAL_PORT = 'COMX'` to override default COM3.
3. Use `SKIP_SERIAL=1` to run in mock mode and verify frontend works.

### WebSocket connection fails
1. Ensure backend is running (`node server.js` or `npm start` in backend folder).
2. Verify port 8080 is not in use by another process.
3. Check browser console for specific error messages.

## Arduino Code Example

Minimal Arduino sketch that sends GPS data in labeled format:
```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  // Example: read from GPS module (replace with actual GPS library)
  // Assuming gps object provides latitude, longitude, etc.
  
  Serial.print("Latitude: ");
  Serial.println(gps.latitude, 6);
  
  Serial.print("Longitude: ");
  Serial.println(gps.longitude, 6);
  
  Serial.print("Altitude: ");
  Serial.println(gps.altitude);
  
  Serial.print("Satellites: ");
  Serial.println(gps.satellites);
  
  Serial.print("HDOP: ");
  Serial.println(gps.hdop);
  
  Serial.print("Speed: ");
  Serial.println(gps.speed_kmh);
  
  Serial.print("Course: ");
  Serial.println(gps.course);
  
  Serial.print("Date: ");
  Serial.println(gps.date);
  
  Serial.print("Time: ");
  Serial.println(gps.time);
  
  Serial.print("Fix: ");
  Serial.println(gps.fix ? 1 : 0);
  
  delay(1000); // Update once per second
}
```

## Next Steps

1. **Connect Arduino**: Plug in Arduino with GPS module via USB.
2. **Identify COM port**: Check Device Manager or run serial-sniffer.js.
3. **Start backend**: `node server.js` (or set `$env:SERIAL_PORT` if needed).
4. **Monitor serial output**: `node serial-sniffer.js` in another terminal to confirm data.
5. **Start frontend**: `npm start` in gps-dashboard folder.
6. **View dashboard**: Open browser at http://localhost:3001 and confirm live GPS updates.

---
**Questions?** Check the backend terminal logs for parsing errors or WebSocket connection issues.
