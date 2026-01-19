// src/components/GpsCard.jsx
import React from 'react';

const GpsCard = ({ title, value, unit, icon, color }) => {
  return (
    <div className="gps-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="card-header">
        <span className="card-icon">{icon}</span>
        <h3>{title}</h3>
      </div>
      <div className="card-value">
        <span className="value" style={{ color }}>{value}</span>
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
};

export default GpsCard;