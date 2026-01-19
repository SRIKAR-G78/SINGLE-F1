// src/components/ConnectionStatus.jsx
import React from 'react';

const ConnectionStatus = ({ fix }) => {
  return (
    <div className="connection-status">
      <div className={`status-indicator ${fix ? 'connected' : 'searching'}`}>
        <span className="status-dot"></span>
        <span className="status-text">
          {fix ? 'GPS Fix Acquired' : 'Searching for GPS...'}
        </span>
      </div>
      <div className="status-message">
        {fix ? 'Real-time data streaming active' : 'Awaiting satellite lock'}
      </div>
    </div>
  );
};

export default ConnectionStatus;