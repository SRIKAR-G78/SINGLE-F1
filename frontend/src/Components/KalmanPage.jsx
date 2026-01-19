import React, { useState, useCallback } from 'react';
import KalmanView from './KalmanView';
import '../Styles/Kalman.css';

const KalmanPage = ({ gpsData, onBack }) => {
  const [filteredCoord, setFilteredCoord] = useState({ lat: null, lon: null });
  const [errors, setErrors] = useState({ rawError: null, filteredError: null, neoKalman: null });
  const [errorHistory, setErrorHistory] = useState([]);

  // manual inputs on the page (prefilled from dashboard gpsData)
  const [neoLat, setNeoLat] = useState(gpsData.latitude);
  const [neoLon, setNeoLon] = useState(gpsData.longitude);
  // Google Reference - NO auto-population, manual user input only
  const [refLat, setRefLat] = useState('');
  const [refLon, setRefLon] = useState('');
  const [manualTrigger, setManualTrigger] = useState(null);

  const handleFilteredUpdate = useCallback((payload) => {
    if (!payload) return;
    const { lat, lon, rawError, filteredError } = payload;
    if (isFinite(lat) && isFinite(lon)) setFilteredCoord({ lat, lon });

    if (typeof rawError === 'number' || typeof filteredError === 'number' || typeof payload.neoKalman === 'number') {
      const newRaw = rawError != null ? rawError : null;
      const newFilt = filteredError != null ? filteredError : null;
      const newNeoKal = payload.neoKalman != null ? payload.neoKalman : null;

      setErrors(prev => ({
        rawError: newRaw != null ? newRaw : prev.rawError,
        filteredError: newFilt != null ? newFilt : prev.filteredError,
        neoKalman: newNeoKal != null ? newNeoKal : prev.neoKalman,
      }));

      if (payload.source === 'manual' && isFinite(newRaw) && isFinite(newFilt)) {
        const entry = {
          timestamp: new Date().toISOString(),
          neoLat: payload.rawLat !== undefined && payload.rawLat !== null ? payload.rawLat : (neoLat || (gpsData && gpsData.latitude) || null),
          neoLon: payload.rawLon !== undefined && payload.rawLon !== null ? payload.rawLon : (neoLon || (gpsData && gpsData.longitude) || null),
          refLat: refLat,
          refLon: refLon,
          rawError: newRaw,
          filteredError: newFilt,
          neoKalman: newNeoKal,
        };
        setErrorHistory(prev => [...prev, entry]);
      }
    }
  }, [neoLat, neoLon, refLat, refLon, gpsData]);

  const handleCompute = () => {
    // Validate that user has entered reference coordinates
    if (!refLat.trim() || !refLon.trim()) {
      alert('Please enter Google Reference coordinates (Latitude and Longitude)');
      return;
    }
    
    const rlat = parseFloat(refLat);
    const rlon = parseFloat(refLon);
    
    if (!isFinite(rlat) || !isFinite(rlon)) {
      alert('Invalid reference coordinates. Please enter valid numbers.');
      return;
    }
    // Use the latest dashboard GPS values for Neo-6M coordinates when available.
    // Fallback to manual Neo-6M inputs only if live GPS is not available.
    let nlat = NaN;
    let nlon = NaN;
    const gpsLat = parseFloat(gpsData && gpsData.latitude);
    const gpsLon = parseFloat(gpsData && gpsData.longitude);
    if (isFinite(gpsLat) && isFinite(gpsLon)) {
      nlat = gpsLat;
      nlon = gpsLon;
    } else {
      // fallback to manual Neo inputs if dashboard live GPS isn't available
      nlat = parseFloat(neoLat);
      nlon = parseFloat(neoLon);
    }

    if (!isFinite(nlat) || !isFinite(nlon)) {
      alert('No Neo-6M coordinates available to compute. Ensure GPS has a fix or provide Neo-6M coordinates.');
      return;
    }

    // Trigger manual compute in KalmanView with a payload (id for uniqueness)
    setManualTrigger({ id: Date.now(), neoLat: nlat, neoLon: nlon, refLat: rlat, refLon: rlon });
  };

  const handleDownload = () => {
    if (errorHistory.length === 0) {
      alert('No results to download. Compute distance errors first.');
      return;
    }
    const csvData = [
      ['Timestamp', 'Neo-6M Lat', 'Neo-6M Lon', 'Ref Lat', 'Ref Lon', 'Neo→Ref (m)', 'Kalman→Ref (m)', 'Neo↔Kalman (m)'],
      ...errorHistory.map(r => [
        r.timestamp,
        r.neoLat,
        r.neoLon,
        r.refLat,
        r.refLon,
        r.rawError.toFixed(2),
        r.filteredError.toFixed(2),
        r.neoKalman.toFixed(2)
      ])
    ];
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kalman-error-results-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="kalman-page">
      <div className="kalman-page-header">
        <div className="kalman-page-left">
          <button className="back-button" onClick={onBack}>← Back</button>
          <h1>Kalman Full Page View</h1>
          <p className="subtitle">Live Kalman-filtered location, error analysis and interactive map.</p>
        </div>

        <div className="kalman-page-right">
          <div className="metric">
            <div className="label">Kalman Latitude</div>
            <div className="value">{filteredCoord.lat !== null ? filteredCoord.lat.toFixed(6) : '—'}</div>
          </div>
          <div className="metric">
            <div className="label">Kalman Longitude</div>
            <div className="value">{filteredCoord.lon !== null ? filteredCoord.lon.toFixed(6) : '—'}</div>
          </div>
        </div>
      </div>

      <div className="kalman-page-grid">
        <div className="controls-pane">
          <h3> Neo-6M </h3>
          <label> Latitude
            <input value={neoLat} onChange={e=>setNeoLat(e.target.value)} />
          </label>
          <label> Longitude
            <input value={neoLon} onChange={e=>setNeoLon(e.target.value)} />
          </label>

          <h3>Google Reference</h3>
          <label>Latitude
            <input value={refLat} onChange={e=>setRefLat(e.target.value)} placeholder="Enter reference latitude" />
          </label>
          <label>Longitude
            <input value={refLon} onChange={e=>setRefLon(e.target.value)} placeholder="Enter reference longitude" />
          </label>

          <div className="button-group">
            <button className="compute-button" onClick={handleCompute}>Compute Distance Error</button>
            <button className="download-button" onClick={handleDownload} title="Download error results as CSV">⬇️ Download</button>
          </div>
        </div>

        <div className="view-pane">
          <KalmanView gpsData={gpsData} onFilteredUpdate={handleFilteredUpdate} refLat={refLat} refLon={refLon} neoLat={neoLat} neoLon={neoLon} manualComputeTrigger={manualTrigger} errorHistory={errorHistory} />
        </div>
      </div>
    </div>
  );
};

export default KalmanPage;
