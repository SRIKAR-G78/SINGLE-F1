import React from 'react';
import '../Styles/Welcome.css';

const Welcome = ({ onWelcome }) => {
  return (
    <div className="welcome-container">
      <div className="welcome-content">
        <div className="welcome-title">
          <h1>🛰️ GPS Dashboard</h1>
          <p className="subtitle">Real-time GPS Tracking System</p>
        </div>

        <div className="welcome-images">
          <div className="image-box satellite">
            <div className="satellite-icon">
              🛰️
            </div>
            <p className="image-label">Satellite Receiver</p>
          </div>
          
          <div className="connection-line"></div>
          
          <div className="image-box receiver">
            <div className="receiver-icon">
              📡
            </div>
            <p className="image-label">GPS Module</p>
          </div>
        </div>

        <div className="welcome-description">
          <h2>Welcome to Your GPS Tracking Dashboard</h2>
          <p>
            Monitor real-time GPS data, track your position, view satellite information,
            and analyze your movement with our advanced dashboard.
          </p>
          <ul className="features-list">
            <li>✅ Real-time Position Tracking</li>
            <li>✅ Satellite Visualization</li>
            <li>✅ Interactive Map View</li>
            <li>✅ Signal Quality Analysis</li>
          </ul>
        </div>

        <button className="welcome-button" onClick={onWelcome}>
          🚀 Welcome to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Welcome;
