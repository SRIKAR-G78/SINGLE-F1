# 🗺️ NEO-6M GPS Frontend Dashboard

A React-based real-time GPS tracking dashboard that displays GPS coordinates, satellite information, and provides Kalman filtering visualization for GPS data from an Arduino NEO-6M module.

## 📋 Overview

This frontend application provides:
- Real-time GPS data visualization on an interactive map
- Connection status monitoring and management
- Satellite signal strength visualization
- Kalman filter tracking for GPS smoothing
- Mock data support for testing without hardware
- Responsive mobile-friendly design

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Running the App

```bash
# Start development server (port 3000)
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
# Create optimized build
npm run build
```

## ⚙️ Configuration

### Backend Connection

The app connects to the backend WebSocket server at:
```
ws://localhost:8080
```

**To change the backend URL**, edit [src/App.js](src/App.js) and update:
```javascript
const websocket = new WebSocket('ws://localhost:8080');
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── App.js                          # Main app component with WebSocket logic
│   ├── index.js                        # React entry point
│   ├── Components/                     # All React components
│   │   ├── Welcome.jsx                 # Welcome/initial screen
│   │   ├── Dashboard.jsx               # Main GPS dashboard
│   │   ├── GpsCard.jsx                 # GPS metrics display
│   │   ├── MapView.jsx                 # Leaflet map component
│   │   ├── KalmanPage.jsx              # Kalman filter visualization
│   │   ├── KalmanView.jsx              # Kalman data display
│   │   ├── SatelliteVisualizer.jsx    # Satellite signal visualization
│   │   └── ConnectionStatus.jsx        # Connection status indicator
│   ├── Styles/                         # CSS styling
│   │   ├── App.css                     # Main app styles
│   │   ├── Kalman.css                  # Kalman page styles
│   │   └── Welcome.css                 # Welcome page styles
│   ├── public/
│   │   ├── index.html                  # HTML entry point
│   │   └── _redirects                  # Netlify redirect config
│   └── package.json                    # Dependencies
├── README.md                           # This file
└── .env (optional)                     # Environment variables
```

## 🎯 Features

### 1. Welcome Screen
- Initial connection interface
- Start/stop GPS tracking
- Status indicators

### 2. GPS Dashboard
- Real-time GPS metrics display
- Latitude, Longitude, Altitude
- Satellite count and HDOP (dilution of precision)
- Speed and heading/course
- Date and time with local timezone

### 3. Interactive Map
- Leaflet map showing current GPS position
- Real-time marker updates
- Zoom and pan controls
- Satellite/street view toggle

### 4. Kalman Filter Visualization
- Smoothed vs raw GPS tracking
- Noise reduction visualization
- Filter comparison view

### 5. Satellite Visualizer
- Visual representation of satellite signals
- Signal strength indicators
- Satellite position display

### 6. Connection Management
- WebSocket connection status
- Auto-reconnect with exponential backoff
- Mock data fallback when offline
- Manual disconnect option

## 🔌 Component Details

### App.js (Main Component)
**Responsibilities:**
- Manages global GPS state
- WebSocket connection and auto-reconnection logic
- LocalStorage persistence
- Mock data generation for offline mode
- Component routing (Welcome → Dashboard → Kalman)

**Key State:**
```javascript
{
  showDashboard: boolean,           // Show dashboard screen
  showKalman: boolean,              // Show Kalman filter view
  isBackendActive: boolean,         // Backend connection active
  gpsData: {                        // Current GPS data
    latitude, longitude, altitude,
    satellites, hdop, speed, course,
    date, time, fix, connection
  }
}
```

### Dashboard.jsx
Displays:
- GPS metrics card with live data
- Interactive map view
- Satellite visualization
- Connection status banner
- Control buttons (Kalman, Disconnect)

### MapView.jsx
**Features:**
- Leaflet map integration
- Real-time marker positioning
- Layer controls (satellite/street view)
- Zoom and pan functionality
- Marker clustering for historical points

### GpsCard.jsx
**Displays:**
- Formatted GPS coordinates (6 decimal places)
- Altitude in meters
- Satellite count
- HDOP (horizontal dilution of precision)
- Speed in km/h
- Course/heading in degrees
- Date and time

### KalmanPage.jsx
**Shows:**
- Raw vs filtered GPS data comparison
- Kalman filter effectiveness visualization
- Data smoothness metrics

### SatelliteVisualizer.jsx
**Displays:**
- Satellite signal strength bars
- Signal quality indicators
- Satellite position/elevation

### ConnectionStatus.jsx
**Shows:**
- Current connection state (connected/disconnected/error)
- Live status indicator
- Last update timestamp

## 🌐 WebSocket Message Format

### Incoming Messages (GPS Data)
```json
{
  "source": "nmea|labeled|mock",
  "latitude": 17.3850,
  "longitude": 78.4867,
  "altitude": 100.5,
  "satellites": 12,
  "hdop": 0.95,
  "speed": 0.0,
  "course": 45.3,
  "date": "2024-04-23",
  "time": "14:30:45",
  "fix": true,
  "local_time": "2024-04-23 20:00:15",
  "timezone": "UTC+05:30",
  "connection": "connected"
}
```

## 🔄 Connection Flow

```
App.js (startup)
    ↓
Check localStorage for previous state
    ↓
If backend is active, attempt WebSocket connection
    ↓
Health check to /health endpoint
    ↓
Connect to ws://localhost:8080
    ↓
On connection → Show Dashboard
On error → Show mock data or Welcome screen
    ↓
Auto-reconnect with exponential backoff
    ↓
On disconnect → Show Welcome with option to reconnect
```

## 🎨 Styling

### CSS Files
- **App.css**: Main layout, responsive grid, status banner
- **Welcome.css**: Welcome screen and initial connection UI
- **Kalman.css**: Kalman filter visualization styling

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 📊 State Management

Uses React Hooks:
- `useState()`: For UI state (showDashboard, gpsData)
- `useRef()`: For WebSocket and timers (not causing re-renders)
- `useEffect()`: For connection logic and cleanup
- `localStorage`: For persisting dashboard state

## 🔌 Dependencies

### Core
- **react**: UI framework
- **react-dom**: React DOM rendering

### Mapping
- **leaflet**: Interactive map library

### Development
- **react-scripts**: Build and dev server tools
- **@testing-library/react**: React testing utilities

## 🌐 Environment Variables (Optional)

Create `.env` file to override defaults:

```env
REACT_APP_BACKEND_URL=ws://localhost:8080
REACT_APP_HEALTH_CHECK_URL=http://localhost:8080/health
```

Then access in code:
```javascript
const backendUrl = process.env.REACT_APP_BACKEND_URL || 'ws://localhost:8080';
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## 🐛 Troubleshooting

### WebSocket Connection Failed
```
Error connecting to backend
```
**Solution:**
1. Ensure backend server is running: `npm start` in backend folder
2. Check frontend is connecting to correct URL (http://localhost:8080)
3. Check firewall settings
4. Verify no port conflicts

### Map Not Showing
**Solution:**
1. Check Leaflet CSS is loaded in index.html
2. Check map container has height and width
3. Clear browser cache and hard refresh

### Mock Data Not Showing
**Solution:**
1. Expected behavior when backend is disconnected
2. Should show random GPS coordinates
3. Check browser console for errors

### GPS Coordinates Not Updating
**Solution:**
1. Check backend console for GPS parsing errors
2. Verify Arduino is sending GPS data
3. Check serial port configuration in backend

## 📱 Mobile Optimization

The app is responsive and works on:
- iOS Safari
- Android Chrome
- Tablet browsers
- Desktop browsers

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
1. Push code to GitHub
2. Connect repository to Netlify
3. Set build command: `npm run build`
4. Set publish directory: `build`

### Environment Setup
Update backend URL for production in App.js or via environment variables

## 📚 Component Hierarchy

```
App
├── Welcome
│   └── Start Connection
├── Dashboard
│   ├── ConnectionStatus
│   ├── GpsCard
│   ├── MapView
│   ├── SatelliteVisualizer
│   └── Control Buttons
└── KalmanPage
    ├── KalmanView
    └── Back Button
```

## 🔐 Security Notes

- WebSocket connection is unencrypted (use WSS in production)
- No authentication currently implemented
- GPS data is transmitted in plain text
- Add token-based auth for production use

## 📖 How to Read the Code

### For Beginners
1. Start with `App.js` to understand overall flow
2. Read individual components under `Components/`
3. Check CSS files for styling
4. Refer to comments in code for explanations

### For Advanced Users
1. Study WebSocket reconnection logic in `App.js`
2. Examine state management with React hooks
3. Review Leaflet map integration in `MapView.jsx`
4. Check mock data generation logic

## 💡 Tips for Development

1. **Use browser DevTools:**
   - Check WebSocket messages in Network tab
   - Monitor GPS data in Console
   - Debug component state with React DevTools

2. **Enable mock data:**
   - Set `SKIP_SERIAL=1` in backend
   - Frontend will auto-generate GPS data for testing

3. **Test offline mode:**
   - Stop backend server
   - Frontend will show mock data
   - Try reconnection with auto-backoff

## 🔗 Related Files

- Backend: `../backend/README.md`
- Backend server: `../backend/server.js`
- Kalman filter: `../backend/kalmanFilter.js`

---

**Created for NEO-6M GPS Integration Project**

