/**
 * ============================================================================
 * NEO-6M GPS Frontend Application
 * ============================================================================
 * Main React component for real-time GPS tracking and visualization
 * 
 * Features:
 * - WebSocket connection to backend GPS server
 * - Auto-reconnection with exponential backoff
 * - LocalStorage persistence for state
 * - Mock GPS data fallback for offline testing
 * - Multi-page navigation (Welcome → Dashboard → Kalman)
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './Components/Dashboard';
import KalmanPage from './Components/KalmanPage';
import Welcome from './Components/Welcome';
import './Styles/App.css';

function App() {
  // ==================== STATE MANAGEMENT ====================
  
  // Show dashboard screen (false = Welcome screen)
  const [showDashboard, setShowDashboard] = useState(() => {
    const saved = localStorage.getItem('showDashboard');
    return saved !== null ? JSON.parse(saved) : false; // Default: show Welcome first
  });
  
  // Show Kalman filter visualization page
  const [showKalman, setShowKalman] = useState(false);
  
  // Backend connection active (controls WebSocket connection)
  const [isBackendActive, setIsBackendActive] = useState(false);
  
  // ==================== GPS DATA STATE ====================
  // Current GPS data received from backend
  const [gpsData, setGpsData] = useState({
    latitude: '0.000000',        // Latitude coordinate
    longitude: '0.000000',       // Longitude coordinate
    altitude: '0.0',             // Altitude in meters
    satellites: 0,               // Number of satellites in view
    hdop: '0.00',                // Horizontal dilution of precision
    speed: '0.00',               // Speed in km/h
    course: '0.00',              // Heading/course in degrees
    date: '2024-01-01',          // Date from GPS
    time: '00:00:00',            // Time from GPS
    fix: false,                  // GPS fix status
    connection: 'disconnected'   // Connection status
  });

  // ==================== REFS FOR WEBSOCKET & TIMERS ====================
  // Use refs to avoid re-renders when these values change
  const wsRef = useRef(null);             // WebSocket connection reference
  const reconnectTimerRef = useRef(null); // Reconnect timer reference
  const reconnectAttemptsRef = useRef(0); // Count of reconnection attempts

  /**
   * =========================================================================
   * WEBSOCKET CONNECTION & AUTO-RECONNECT LOGIC
   * =========================================================================
   * Handles:
   * - Initial connection to backend WebSocket server
   * - Exponential backoff reconnection on failure
   * - Health check before WebSocket connection
   * - Cleanup on component unmount or when backend deactivated
   */
  useEffect(() => {
    const MAX_BACKOFF = 30000; // Maximum backoff delay (30 seconds)

    /**
     * Schedule a reconnection attempt with exponential backoff
     * Delay = min(1000 * 2^attempts, MAX_BACKOFF)
     * Example: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
     */
    function scheduleReconnect() {
      reconnectAttemptsRef.current += 1;
      const backoff = Math.min(1000 * 2 ** reconnectAttemptsRef.current, MAX_BACKOFF);
      console.log(`⏱️  Reconnecting in ${backoff}ms (attempt ${reconnectAttemptsRef.current})`);
      reconnectTimerRef.current = setTimeout(() => {
        openWebSocket();
      }, backoff);
    }

    /**
     * Open WebSocket connection to backend
     * Prevents duplicate connections
     * Sets up event handlers for all WebSocket events
     */
    function openWebSocket() {
      // Don't create duplicate connections
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        console.log('⚠️  WebSocket already connecting/open, skipping...');
        return;
      }

      try {
        console.log('🔗 Attempting WebSocket connection...');
        const websocket = new WebSocket('ws://localhost:8080');
        wsRef.current = websocket;

        // Connection opened successfully
        websocket.onopen = () => {
          console.log('✅ WebSocket connected!');
          reconnectAttemptsRef.current = 0; // Reset retry counter
          setGpsData(prev => ({ ...prev, connection: 'connected' }));
        };

        // Received GPS data from server
        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📍 Received GPS data:', { lat: data.latitude, lon: data.longitude });
            // Update GPS data and mark connection as active
            setGpsData(prev => ({ ...prev, ...data, connection: 'connected' }));
          } catch (error) {
            // Silently ignore JSON parse errors
          }
        };

        // Connection error occurred
        websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setGpsData(prev => ({ ...prev, connection: 'error' }));
        };

        // Connection closed (may reconnect)
        websocket.onclose = (ev) => {
          console.log('🔌 WebSocket closed');
          setGpsData(prev => ({ ...prev, connection: 'disconnected' }));
          // Schedule reconnection attempt
          scheduleReconnect();
        };
      } catch (err) {
        console.error('❌ Error creating WebSocket:', err);
        scheduleReconnect();
      }
    }

    // Track if this effect was cancelled (component unmounted or dependency changed)
    let cancelled = false;

    // If backend is not active, don't connect
    if (!isBackendActive) {
      return () => {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
        }
        cancelled = true;
      };
    }

    /**
     * Wait for backend health check, then connect
     * Performs multiple health check attempts before giving up
     */
    async function waitAndConnect() {
      const MAX_HEALTH_ATTEMPTS = 6;
      let attempt = 0;
      
      while (attempt < MAX_HEALTH_ATTEMPTS && !cancelled) {
        try {
          // Set a 2-second timeout for health check
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          
          const resp = await fetch('http://localhost:8080/health', { signal: controller.signal });
          clearTimeout(timeout);
          
          if (resp.ok) {
            console.log('✅ Backend health check passed!');
            openWebSocket();
            return;
          }
        } catch (err) {
          // Backend not ready yet, will retry
          console.log(`⏳ Waiting for backend... (attempt ${attempt + 1}/${MAX_HEALTH_ATTEMPTS})`);
        }

        attempt += 1;
        // Exponential backoff between health checks
        const delay = Math.min(500 * 2 ** attempt, 5000);
        await new Promise(r => setTimeout(r, delay));
      }

      // If health checks exhausted, try WebSocket anyway
      if (!cancelled) {
        console.log('⚠️  Health checks exhausted, attempting WebSocket directly');
        openWebSocket();
      }
    }

    // Start the connection process
    waitAndConnect();

    // Cleanup when component unmounts or dependencies change
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
      }
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
      }
      cancelled = true;
    };
  }, [isBackendActive]);

  /**
   * =========================================================================
   * MOCK GPS DATA GENERATION
   * =========================================================================
   * Generates simulated GPS data when backend is disconnected
   * Useful for:
   * - Testing frontend without hardware
   * - Demonstrating features in offline mode
   * - Development and debugging
   * 
   * Updates every 2 seconds with random variations
   */
  useEffect(() => {
    let demoInterval;
    
    // Generate mock data only when disconnected or error
    if (gpsData.connection === 'disconnected' || gpsData.connection === 'error') {
      console.log('📡 Starting mock GPS data generation');
      
      demoInterval = setInterval(() => {
        setGpsData(prev => {
          // Stop generating if connection becomes active
          if (prev.connection === 'connected') {
            console.log('🛑 Stopping mock data, real connection active');
            clearInterval(demoInterval);
            return prev;
          }
          
          // Generate random GPS data around Hyderabad, India
          const mockData = {
            latitude: (17.3850 + Math.random() * 0.01).toFixed(6),     // Vary by ±0.01 degrees (~1km)
            longitude: (78.4867 + Math.random() * 0.01).toFixed(6),
            altitude: (100 + Math.random() * 50).toFixed(1),             // 100-150 meters
            satellites: Math.floor(Math.random() * 5) + 4,              // 4-8 satellites
            hdop: (Math.random() * 1.5).toFixed(2),                     // HDOP 0-1.5
            speed: (Math.random() * 30).toFixed(2),                     // Speed 0-30 km/h
            course: (Math.random() * 360).toFixed(2),                   // Direction 0-360°
            date: new Date().toISOString().split('T')[0],              // Today's date
            time: new Date().toLocaleTimeString(),                      // Current time
            fix: Math.random() > 0.3,                                   // 70% probability of fix
            connection: prev.connection                                  // Keep current connection status
          };
          
          return { ...prev, ...mockData };
        });
      }, 2000); // Update every 2 seconds
    }
    
    // Cleanup interval on unmount or when connection changes
    return () => {
      if (demoInterval) clearInterval(demoInterval);
    };
  }, [gpsData.connection]);

  // ==================== EVENT HANDLERS ====================

  /**
   * Handle Welcome screen confirmation
   * - Show dashboard
   * - Activate backend connection
   * - Save state to localStorage
   */
  const handleWelcome = () => {
    console.log('👋 Welcome confirmed, starting backend connection');
    setShowDashboard(true);
    setIsBackendActive(true);
    localStorage.setItem('showDashboard', JSON.stringify(true));
  };

  /**
   * Navigate back to Welcome without disconnecting backend
   * - Hide dashboard
   * - Keep WebSocket connection active (user can return quickly)
   * - Update localStorage
   */
  const handleNavigateBack = () => {
    console.log('🔙 Navigating back to Welcome (keeping connection)');
    setShowDashboard(false);
    localStorage.setItem('showDashboard', JSON.stringify(false));
    // Note: isBackendActive remains true to preserve WebSocket connection
  };

  /**
   * Handle full disconnect
   * - Hide dashboard
   * - Close WebSocket connection
   * - Stop backend updates
   * - Clear GPS data
   */
  const handleDisconnect = () => {
    console.log('❌ Disconnecting from backend');
    setShowDashboard(false);
    setIsBackendActive(false);
    localStorage.setItem('showDashboard', JSON.stringify(false));
    setGpsData(prev => ({
      ...prev,
      connection: 'disconnected'
    }));
    // Close WebSocket manually
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }
  };

  // Show/hide Kalman filter visualization
  // Show/hide Kalman filter visualization
  const handleOpenKalman = () => setShowKalman(true);
  const handleCloseKalman = () => setShowKalman(false);

  // ==================== RENDER ====================
  return (
    <div className="App">
      {/* Show Welcome screen if not on dashboard */}
      {!showDashboard ? (
        <Welcome onWelcome={handleWelcome} />
      ) : (
        <>
          {/* Connection Status Banner */}
          <div className="connection-banner" data-status={gpsData.connection}>
            Status: {gpsData.connection.toUpperCase()}
          </div>
          
          {/* Main Content: Dashboard or Kalman Filter View */}
          {!showKalman ? (
            // Dashboard View - Shows GPS data and map
            <Dashboard 
              gpsData={gpsData} 
              onDisconnect={handleDisconnect} 
              onNavigateBack={handleNavigateBack} 
              onOpenKalman={handleOpenKalman} 
              isBackendActive={isBackendActive} 
            />
          ) : (
            // Kalman Filter View - Shows filtered GPS tracking
            <KalmanPage 
              gpsData={gpsData} 
              onBack={handleCloseKalman} 
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;