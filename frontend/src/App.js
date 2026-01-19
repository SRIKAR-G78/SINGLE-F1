// src/App.js - Updated Version
import React, { useState, useEffect, useRef } from 'react';
import Dashboard from './Components/Dashboard';
import KalmanPage from './Components/KalmanPage';
import Welcome from './Components/Welcome';
import './Styles/App.css';

function App() {
  // Load dashboard state from localStorage on initial render
  const [showDashboard, setShowDashboard] = useState(() => {
    const saved = localStorage.getItem('showDashboard');
    return saved !== null ? JSON.parse(saved) : false; // Default: false (show Welcome first)
  });
  const [showKalman, setShowKalman] = useState(false);
  const [isBackendActive, setIsBackendActive] = useState(false);
  
  const [gpsData, setGpsData] = useState({
    latitude: '0.000000',
    longitude: '0.000000',
    altitude: '0.0',
    satellites: 0,
    hdop: '0.00',
    speed: '0.00',
    course: '0.00',
    date: '2024-01-01',
    time: '00:00:00',
    fix: false,
    connection: 'disconnected'
  });

  // Use refs to keep the socket and reconnect timers without triggering rerenders
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    const MAX_BACKOFF = 30000; // 30s max

    function scheduleReconnect() {
      reconnectAttemptsRef.current += 1;
      const backoff = Math.min(1000 * 2 ** reconnectAttemptsRef.current, MAX_BACKOFF);
      reconnectTimerRef.current = setTimeout(() => {
        openWebSocket();
      }, backoff);
    }

    function openWebSocket() {
      // If there's already a socket opening/open, don't create another
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        return;
      }

      try {
        const websocket = new WebSocket('ws://localhost:8080');
        wsRef.current = websocket;

        websocket.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setGpsData(prev => ({ ...prev, connection: 'connected' }));
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setGpsData(prev => ({ ...prev, ...data, connection: 'connected' }));
          } catch (error) {
            // Error parsing message - silently ignore
          }
        };

        websocket.onerror = (error) => {
          setGpsData(prev => ({ ...prev, connection: 'error' }));
        };

        websocket.onclose = (ev) => {
          setGpsData(prev => ({ ...prev, connection: 'disconnected' }));
          // schedule a reconnect
          scheduleReconnect();
        };
      } catch (err) {
        scheduleReconnect();
      }
    }

    // start connection only after backend health check succeeds
    let cancelled = false;

    // Only start connection if backend is active
    if (!isBackendActive) {
      return () => {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
        }
        cancelled = true;
      };
    }

    async function waitAndConnect() {
      const MAX_HEALTH_ATTEMPTS = 6;
      let attempt = 0;
      while (attempt < MAX_HEALTH_ATTEMPTS && !cancelled) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 2000);
          const resp = await fetch('http://localhost:8080/health', { signal: controller.signal });
          clearTimeout(timeout);
          if (resp.ok) {
            openWebSocket();
            return;
          }
        } catch (err) {
          // ignored - server might not be ready
        }

        attempt += 1;
        const delay = Math.min(500 * 2 ** attempt, 5000);
        await new Promise(r => setTimeout(r, delay));
      }

      // If health did not become ready, still attempt WebSocket once
      if (!cancelled) openWebSocket();
    }

    waitAndConnect();

    // cleanup on unmount
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
      }
      cancelled = true;
    };
  }, [isBackendActive]);

  // Fallback to demo data if no connection
  useEffect(() => {
    let demoInterval;
    
    if (gpsData.connection === 'disconnected' || gpsData.connection === 'error') {
      demoInterval = setInterval(() => {
        setGpsData(prev => {
          if (prev.connection === 'connected') {
            clearInterval(demoInterval);
            return prev;
          }
          
          const mockData = {
            latitude: (17.3850 + Math.random() * 0.01).toFixed(6),
            longitude: (78.4867 + Math.random() * 0.01).toFixed(6),
            altitude: (100 + Math.random() * 50).toFixed(1),
            satellites: Math.floor(Math.random() * 5) + 4,
            hdop: (Math.random() * 1.5).toFixed(2),
            speed: (Math.random() * 30).toFixed(2),
            course: (Math.random() * 360).toFixed(2),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            fix: Math.random() > 0.3,
            connection: prev.connection
          };
          
          return { ...prev, ...mockData };
        });
      }, 2000);
    }
    
    return () => {
      if (demoInterval) clearInterval(demoInterval);
    };
  }, [gpsData.connection]);

  const handleWelcome = () => {
    setShowDashboard(true);
    setIsBackendActive(true);
    localStorage.setItem('showDashboard', JSON.stringify(true));
  };

  // Navigate back to Welcome without disconnecting backend (preserve connection)
  const handleNavigateBack = () => {
    setShowDashboard(false);
    localStorage.setItem('showDashboard', JSON.stringify(false));
    // do not change isBackendActive or close WebSocket
  };

  const handleDisconnect = () => {
    setShowDashboard(false);
    setIsBackendActive(false);
    localStorage.setItem('showDashboard', JSON.stringify(false));
    setGpsData(prev => ({
      ...prev,
      connection: 'disconnected'
    }));
    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }
  };

  const handleOpenKalman = () => setShowKalman(true);
  const handleCloseKalman = () => setShowKalman(false);

  const handleStartConnection = () => {
    setIsBackendActive(true);
  };

  const handleStopConnection = () => {
    setIsBackendActive(false);
    setGpsData(prev => ({
      ...prev,
      connection: 'disconnected'
    }));
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }
  };

  return (
    <div className="App">
      {!showDashboard ? (
        <Welcome onWelcome={handleWelcome} />
      ) : (
        <>
          <div className="connection-banner" data-status={gpsData.connection}>
            Status: {gpsData.connection.toUpperCase()}
          </div>
          {!showKalman ? (
            <Dashboard gpsData={gpsData} onDisconnect={handleDisconnect} onNavigateBack={handleNavigateBack} onOpenKalman={handleOpenKalman} onStartConnection={handleStartConnection} onStopConnection={handleStopConnection} isBackendActive={isBackendActive} />
          ) : (
            <KalmanPage gpsData={gpsData} onBack={handleCloseKalman} />
          )}
        </>
      )}
    </div>
  );
}

export default App;