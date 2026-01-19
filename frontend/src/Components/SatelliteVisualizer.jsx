// src/components/SatelliteVisualizer.jsx
import React from 'react';

const SatelliteVisualizer = ({ satellites, hdop }) => {
  const getSignalQuality = (hdop) => {
    const h = parseFloat(hdop) || 999;
    if (h < 1.0) return { emoji: '⭐', level: 'Ideal', color: '#4CAF50' };
    if (h < 2.0) return { emoji: '✅', level: 'Excellent',  color: '#8BC34A' };
    if (h < 5.0) return { emoji: '👍', level: 'Good', color: '#FFC107' };
    if (h < 10.0) return { emoji: '⚠️', level: 'Moderate', color: '#FF9800' };
    return {  level: 'Poor', 
       color: '#F44336' };
  };

  const quality = getSignalQuality(hdop);

  // Generate satellite dots
  const satelliteDots = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    active: i < satellites,
    angle: (i * 30) * (Math.PI / 180),
    distance: 40
  }));

  return (
    <div className="satellite-visualizer">
      <h3>🛰️ Satellite Coverage</h3>
      <div className="satellite-container">
        <div className="satellite-sky">
          {satelliteDots.map(sat => (
            <div
              key={sat.id}
              className={`satellite-dot ${sat.active ? 'active' : 'inactive'}`}
              style={{
                left: `calc(50% + ${Math.cos(sat.angle) * sat.distance}px)`,
                top: `calc(50% + ${Math.sin(sat.angle) * sat.distance}px)`
              }}
            />
          ))}
          <div className="horizon-circle"></div>
          <div className="center-point"></div>
        </div>
      </div>

      <div className="satellite-info">
        <div className="sat-count">
          <span className="count">{satellites}</span>
          <span className="label">Satellites in View</span>
        </div>
        <div className="hdop-indicator" style={{ backgroundColor: quality.color }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{quality.emoji}</span>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>{quality.level}</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>HDOP: {hdop}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, marginTop: 6, fontStyle: 'italic', opacity: 0.95 }}>
            {quality.meaning}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SatelliteVisualizer;