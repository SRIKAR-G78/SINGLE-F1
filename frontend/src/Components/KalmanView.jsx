import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../Styles/Kalman.css';

// Simple 2D Kalman filter for latitude/longitude (degrees)
function createKalman2D(q = 1e-5, r = 1e-2) {
  // state: [lat, lon]
  let x = null; // column vector
  let P = null; // 2x2 covariance

  const Q = [[q, 0], [0, q]]; // process noise
  const R = [[r, 0], [0, r]]; // measurement noise

  const predict = () => {
    if (!x) return;
    // constant model: state remains same, add process noise to covariance
    P = matAdd(P, Q);
  };

  const update = (z) => {
    if (!x) {
      x = [[z[0]], [z[1]]];
      P = [[1, 0], [0, 1]];
      return [x[0][0], x[1][0]];
    }

    // Kalman gain K = P * (P + R)^-1
    const S = matAdd(P, R);
    const S_inv = matInv2(S);
    const K = matMul(P, S_inv);

    const y = [[z[0] - x[0][0]], [z[1] - x[1][0]]];
    const K_y = matMul(K, y);
    x = matAdd(x, K_y);

    // P = (I - K) * P
    const I = [[1,0],[0,1]];
    const I_K = matSub(I, K);
    P = matMul(I_K, P);

    return [x[0][0], x[1][0]];
  };

  return { predict, update };
}

// small matrix helpers for 2x2 and 2x1
function matAdd(A, B) {
  if (!A) return B;
  if (!B) return A;
  // support 2x2 or 2x1
  return A.map((row, i) => row.map((v, j) => v + B[i][j]));
}

function matSub(A, B) {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]));
}

function matMul(A, B) {
  // A: m x n, B: n x p
  const m = A.length;
  const n = A[0].length;
  const p = B[0].length;
  const C = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i=0;i<m;i++) for (let k=0;k<n;k++) for (let j=0;j<p;j++) C[i][j] += A[i][k]*B[k][j];
  return C;
}

function matInv2(M) {
  // inverse for 2x2
  const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
  const det = a*d - b*c || 1e-12;
  return [[d/det, -b/det], [-c/det, a/det]];
}

// Haversine distance in meters
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => v * Math.PI/180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const KalmanView = ({ gpsData, onFilteredUpdate, refLat: propRefLat, refLon: propRefLon, neoLat: propNeoLat, neoLon: propNeoLon, manualComputeTrigger }) => {
  const canvasRef = useRef(null);
  const [rawPoints, setRawPoints] = useState([]); // [{lat,lon}]
  const [filteredPoints, setFilteredPoints] = useState([]);
  const kfRef = useRef(null);
  // external control props will be passed from KalmanPage
  // refLat/refLon: reference (Google) location
  // neoLat/neoLon: manual Neo-6M input to compute errors
  // manualComputeTrigger: integer increment to trigger a manual compute
  // props are destructured in the function signature: propRefLat, propRefLon, propNeoLat, propNeoLon, manualComputeTrigger
  // keep internal state for plotting/errors
  const [lastErrors, setLastErrors] = useState({ rawToRef: null, filtToRef: null, neoKalman: 0 });
  const [rawErrorSeries, setRawErrorSeries] = useState([]);
  const [filteredErrorSeries, setFilteredErrorSeries] = useState([]);
  const errorCanvasRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const rawMarkerRef = useRef(null);
  const kalmanMarkerRef = useRef(null);
  const kalmanHighlightRef = useRef(null);
  const [applyKalmanOnMap, setApplyKalmanOnMap] = useState(false);
  // hasErrors state removed (unused)
  const [errorImprovement, setErrorImprovement] = useState(0);

  useEffect(() => { kfRef.current = createKalman2D(1e-6, 1e-4); }, []);

  // push new point when gpsData changes
  useEffect(() => {
    const lat = parseFloat(gpsData.latitude);
    const lon = parseFloat(gpsData.longitude);
    if (!isFinite(lat) || !isFinite(lon)) return;

    setRawPoints(prev => {
      const next = [...prev, { lat, lon }].slice(-300);
      return next;
    });

    // compute filtered
    const kf = kfRef.current;
    if (kf) {
      kf.predict();
      const [flat, flon] = kf.update([lat, lon]);
      setFilteredPoints(prev => {
        const next = [...prev, { lat: flat, lon: flon }].slice(-300);
        return next;
      });

      // compute distance errors to reference
      // REAL-TIME: compute both
      //  - rawToKalman: deviation between raw GPS and current Kalman estimate (real-time noise)
      //  - rawToRef: distance between raw GPS and user-provided Google reference (if provided)
      //  - filtToRef: distance between Kalman estimate and Google reference (if provided)
      let rawToKalman = 0, rawToRef = NaN, filtToRef = NaN;

      rawToKalman = haversine(lat, lon, flat, flon);

      // Parse reference coordinates: check that they are non-empty and valid numbers
      if (propRefLat != null && propRefLon != null && 
          String(propRefLat).trim() !== '' && String(propRefLon).trim() !== '') {
        const rlat = Number(propRefLat);
        const rlon = Number(propRefLon);
        if (Number.isFinite(rlat) && Number.isFinite(rlon)) {
          // Always compute raw and filt errors using latest GPS and Kalman values
          rawToRef = haversine(lat, lon, rlat, rlon);
          filtToRef = haversine(flat, flon, rlat, rlon);
        }
      }

      // Values used for plotting / improvement calculations: prefer ref-based when available, else use kalman deviation
      const plotRaw = Number.isFinite(rawToRef) ? rawToRef : rawToKalman;
      const plotFilt = Number.isFinite(filtToRef) ? filtToRef : rawToKalman;

      setLastErrors({ rawToRef: Number.isFinite(rawToRef) ? rawToRef : null, filtToRef: Number.isFinite(filtToRef) ? filtToRef : null, neoKalman: rawToKalman });

      // keep plotting series consistent
      setRawErrorSeries(prev => [...prev.slice(-399), plotRaw]);
      setFilteredErrorSeries(prev => [...prev.slice(-399), plotFilt]);

      const improvement = plotRaw ? (((plotRaw - plotFilt) / plotRaw) * 100).toFixed(1) : '0.0';
      setErrorImprovement(improvement);

      // notify parent about latest filtered state (live update)
      if (typeof onFilteredUpdate === 'function') {
        onFilteredUpdate({ lat: flat, lon: flon, rawError: plotRaw, filteredError: plotFilt, neoKalman: rawToKalman, rawToRef: Number.isFinite(rawToRef) ? rawToRef : null, filtToRef: Number.isFinite(filtToRef) ? filtToRef : null, source: 'live' });
      }
    }
  }, [gpsData.latitude, gpsData.longitude, propRefLat, propRefLon, onFilteredUpdate]);

  // draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // background
    ctx.fillStyle = '#0f1720';
    ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);

    const all = [...rawPoints, ...filteredPoints];
    if (all.length === 0) return;
    const lats = all.map(p => p.lat);
    const lons = all.map(p => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    const pad = 0.0001; // small padding
    const latRange = (maxLat - minLat) || pad;
    const lonRange = (maxLon - minLon) || pad;

    const toX = (lon) => ((lon - minLon) / lonRange) * canvas.clientWidth;
    const toY = (lat) => canvas.clientHeight - ((lat - minLat) / latRange) * canvas.clientHeight;

    // draw filtered track
    if (filteredPoints.length > 0) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      filteredPoints.forEach((p, i) => {
        const x = toX(p.lon);
        const y = toY(p.lat);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // draw raw track
    if (rawPoints.length > 0) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(229,62,62,0.9)';
      ctx.beginPath();
      rawPoints.forEach((p, i) => {
        const x = toX(p.lon);
        const y = toY(p.lat);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // draw latest markers
    const drawMarker = (x,y,color,r=6) => {
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#0008'; ctx.lineWidth = 1; ctx.stroke();
    };
    if (rawPoints.length) {
      const p = rawPoints[rawPoints.length-1]; drawMarker(toX(p.lon), toY(p.lat), 'rgba(229,62,62,1)', 5);
    }
    if (filteredPoints.length) {
      const p = filteredPoints[filteredPoints.length-1]; drawMarker(toX(p.lon), toY(p.lat), '#3b82f6', 6);
    }

    // draw reference if present
    const rlat = parseFloat(propRefLat);
    const rlon = parseFloat(propRefLon);
    if (isFinite(rlat) && isFinite(rlon)) {
      // if outside current bounds, map to edge
      const rx = toX(clamp(rlon, minLon, maxLon));
      const ry = toY(clamp(rlat, minLat, maxLat));
      ctx.fillStyle = '#10b981';
      ctx.beginPath(); ctx.arc(rx, ry, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText('Reference', rx+8, ry-8);
    }

  }, [rawPoints, filteredPoints, propRefLat, propRefLon]);

  // initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return; // already initialized

    try {
      mapRef.current = L.map(mapContainerRef.current, { scrollWheelZoom: false });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(mapRef.current);
      mapRef.current.setView([17.385, 78.4867], 13);
    } catch (e) {
      // ignore
    }

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
    };
  }, []);

  // update markers on map when raw or filtered points change
  useEffect(() => {
    if (!mapRef.current) return;

    const latRaw = rawPoints.length ? rawPoints[rawPoints.length-1].lat : parseFloat(gpsData.latitude);
    const lonRaw = rawPoints.length ? rawPoints[rawPoints.length-1].lon : parseFloat(gpsData.longitude);

    if (isFinite(latRaw) && isFinite(lonRaw)) {
      if (!rawMarkerRef.current) {
        rawMarkerRef.current = L.circleMarker([latRaw, lonRaw], { radius:6, color:'#e53e3e', fill:true }).addTo(mapRef.current);
      } else {
        rawMarkerRef.current.setLatLng([latRaw, lonRaw]);
      }
    }

    const latestFiltered = filteredPoints.length ? filteredPoints[filteredPoints.length-1] : null;
    if (latestFiltered) {
      if (!kalmanMarkerRef.current) {
        kalmanMarkerRef.current = L.circleMarker([latestFiltered.lat, latestFiltered.lon], { radius:7, color:'#3b82f6', fill:true }).addTo(mapRef.current);
      } else {
        kalmanMarkerRef.current.setLatLng([latestFiltered.lat, latestFiltered.lon]);
      }
    }

    // if applyKalmanOnMap is true, center map on filtered; add highlight circle
    try {
      if (applyKalmanOnMap && latestFiltered) {
        // center and zoom moderately
        const zoom = Math.max(mapRef.current.getZoom(), 16);
        mapRef.current.setView([latestFiltered.lat, latestFiltered.lon], zoom);

        // add or update highlight circle around Kalman location (radius 12 meters)
        if (!kalmanHighlightRef.current) {
          kalmanHighlightRef.current = L.circle([latestFiltered.lat, latestFiltered.lon], { radius: 12, color: '#34d399', weight: 2, fill: false }).addTo(mapRef.current);
        } else {
          kalmanHighlightRef.current.setLatLng([latestFiltered.lat, latestFiltered.lon]);
        }

        // optional popup to indicate Kalman applied
        if (kalmanMarkerRef.current && !kalmanMarkerRef.current.getPopup()) {
          kalmanMarkerRef.current.bindPopup('Kalman estimate').openPopup();
        }
      } else {
        // remove highlight circle if present
        if (kalmanHighlightRef.current) {
          try { mapRef.current.removeLayer(kalmanHighlightRef.current); } catch (e) {}
          kalmanHighlightRef.current = null;
        }

        if (isFinite(latRaw) && isFinite(lonRaw)) {
          mapRef.current.setView([latRaw, lonRaw], mapRef.current.getZoom());
        }
      }
    } catch (e) {}

  }, [rawPoints, filteredPoints, gpsData.latitude, gpsData.longitude, applyKalmanOnMap]);

  // draw error plot
  useEffect(() => {
    const canvas = errorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    ctx.fillStyle = '#04121a';
    ctx.fillRect(0,0,canvas.clientWidth, canvas.clientHeight);

    const all = [...rawErrorSeries, ...filteredErrorSeries];
    if (all.length === 0) return;
    const maxVal = Math.max(1, ...all);

    const toX = (i, len) => (i / Math.max(1, len-1)) * canvas.clientWidth;
    const toY = (v) => canvas.clientHeight - (v / maxVal) * canvas.clientHeight;

    // draw filtered series
    if (filteredErrorSeries.length) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      filteredErrorSeries.forEach((v,i) => {
        const x = toX(i, filteredErrorSeries.length);
        const y = toY(v);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // draw raw series
    if (rawErrorSeries.length) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(229,62,62,0.95)';
      ctx.beginPath();
      rawErrorSeries.forEach((v,i) => {
        const x = toX(i, rawErrorSeries.length);
        const y = toY(v);
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
    }

    // draw axes / labels
    ctx.fillStyle = '#9fb6c9';
    ctx.font = '12px sans-serif';
    ctx.fillText('Errors (m)', 8, 14);
    ctx.fillText('Max: '+Math.round(maxVal)+' m', canvas.clientWidth-100, 14);

  }, [rawErrorSeries, filteredErrorSeries]);

  // when showKalmanPlot toggles, adjust map container size (medium when true)
  // useEffect(() => {
  //   const node = mapContainerRef.current;
  //   if (!node || !mapRef.current) return;
  //   try {
  //     if (showKalmanPlot) node.classList.add('medium'); else node.classList.remove('medium');
  //     // Leaflet needs invalidateSize to redraw properly after CSS height change
  //     setTimeout(() => { try { mapRef.current.invalidateSize(); } catch (e) {} }, 260);
  //   } catch (e) {}
  // }, [showKalmanPlot]);

  // handle manual compute trigger from parent (KalmanPage)
  useEffect(() => {
    if (!manualComputeTrigger) return;

    // manualComputeTrigger may be an object payload ({id, neoLat, neoLon, refLat, refLon})
    let nlat = NaN, nlon = NaN, rlat = NaN, rlon = NaN;
    if (typeof manualComputeTrigger === 'object' && manualComputeTrigger.id) {
      nlat = Number(manualComputeTrigger.neoLat);
      nlon = Number(manualComputeTrigger.neoLon);
      rlat = Number(manualComputeTrigger.refLat);
      rlon = Number(manualComputeTrigger.refLon);
    } else {
      nlat = parseFloat(propNeoLat);
      nlon = parseFloat(propNeoLon);
      rlat = parseFloat(propRefLat);
      rlon = parseFloat(propRefLon);
    }

    // if manual neo inputs are invalid, try using latest GPS data or latest raw point from live data
    if (!isFinite(nlat) || !isFinite(nlon)) {
      const gpsLat = parseFloat(gpsData && gpsData.latitude);
      const gpsLon = parseFloat(gpsData && gpsData.longitude);
      if (isFinite(gpsLat) && isFinite(gpsLon)) {
        nlat = gpsLat;
        nlon = gpsLon;
      } else {
        const latestRaw = rawPoints.length ? rawPoints[rawPoints.length-1] : null;
        if (latestRaw) {
          nlat = latestRaw.lat;
          nlon = latestRaw.lon;
        }
      }
    }

    if (!isFinite(nlat) || !isFinite(nlon) || !isFinite(rlat) || !isFinite(rlon)) return;

    const rawErr = Number(haversine(nlat, nlon, rlat, rlon));
    const latestFiltered = filteredPoints[filteredPoints.length-1];
    const filtErr = latestFiltered ? Number(haversine(latestFiltered.lat, latestFiltered.lon, rlat, rlon)) : 0;
    const neoKalman = latestFiltered ? Number(haversine(nlat, nlon, latestFiltered.lat, latestFiltered.lon)) : 0;

    setLastErrors({ rawToRef: rawErr, filtToRef: filtErr, neoKalman });
    setRawErrorSeries(prev => [...prev.slice(-399), rawErr]);
    setFilteredErrorSeries(prev => [...prev.slice(-399), filtErr]);

    const improvement = rawErr ? (((rawErr - filtErr) / rawErr) * 100).toFixed(1) : '0.0';
    setErrorImprovement(improvement);

    if (typeof onFilteredUpdate === 'function') {
      onFilteredUpdate({ lat: latestFiltered ? latestFiltered.lat : null, lon: latestFiltered ? latestFiltered.lon : null, rawError: rawErr, filteredError: filtErr, neoKalman, rawLat: nlat, rawLon: nlon, source: 'manual' });
    }
  }, [manualComputeTrigger, filteredPoints, onFilteredUpdate, propNeoLat, propNeoLon, propRefLat, propRefLon, gpsData.latitude, gpsData.longitude]);

  return (
    <div className="kalman-container">
      <div className="kalman-controls">
        <h2>Error Analysis</h2>

        <div className="legend-and-actions">
          <div className="legend">
            <span className="legend-item"><span className="dot raw"/> Raw</span>
            <span className="legend-item"><span className="dot filtered"/> Filtered</span>
            {/* <span className="legend-item"><span className="dot ref"/> Reference</span> */}
          </div>
          <div className="actions">
            <button className={applyKalmanOnMap? 'center-on active':'center-on'} onClick={() => setApplyKalmanOnMap(s => !s)}>{applyKalmanOnMap ? 'Centered on Kalman' : 'Center on Kalman'}</button>
          </div>
        </div>

        <div className="error-results-container">
            {/* <h3>📊 Error Analysis</h3> */}
            <div className="error-row">
              <span className="error-label">Neo-6M → Ref:</span>
              <span className="error-value raw">{(Number.isFinite(lastErrors.rawToRef) ? lastErrors.rawToRef.toFixed(2) : '0.00')} m</span>
            </div>
            <div className="error-row">
              <span className="error-label">Kalman → Ref:</span>
              <span className="error-value filtered">{(Number.isFinite(lastErrors.filtToRef) ? lastErrors.filtToRef.toFixed(2) : '0.00')} m</span>
            </div>
            <div className="error-row">
              <span className="error-label">Neo-6M ↔ Kalman:</span>
              <span className="error-value">{(lastErrors.neoKalman || 0).toFixed(2)} m</span>
            </div>
            <div className="error-separator"></div>
            <div className="error-row improvement-row">
              <span className="error-label">Improvement:</span>
              <span className="error-value improvement">{errorImprovement}%</span>
            </div>
            <div className="error-comparison">
              <div className="comparison-bar">
                {(() => {
                  const rVal = Number.isFinite(lastErrors.rawToRef) ? lastErrors.rawToRef : (lastErrors.neoKalman || 0);
                  const maxVal = Math.max(rVal, Number.isFinite(lastErrors.filtToRef) ? lastErrors.filtToRef : (lastErrors.neoKalman || 0), lastErrors.neoKalman || 0, 0.01);
                  return <div className="bar raw-bar" style={{width: `${Math.min(100, ((rVal) / maxVal) * 100)}%`}}></div>;
                })()}
              </div>
              <div className="comparison-bar">
                {(() => {
                  const fVal = Number.isFinite(lastErrors.filtToRef) ? lastErrors.filtToRef : (lastErrors.neoKalman || 0);
                  const maxVal = Math.max(Number.isFinite(lastErrors.rawToRef) ? lastErrors.rawToRef : (lastErrors.neoKalman || 0), fVal, lastErrors.neoKalman || 0, 0.01);
                  return <div className="bar filtered-bar" style={{width: `${Math.min(100, ((fVal) / maxVal) * 100)}%`}}></div>;
                })()}
              </div>
              <div className="comparison-bar">
                {(() => {
                  const nVal = lastErrors.neoKalman || 0;
                  const maxVal = Math.max(Number.isFinite(lastErrors.rawToRef) ? lastErrors.rawToRef : nVal, Number.isFinite(lastErrors.filtToRef) ? lastErrors.filtToRef : nVal, nVal, 0.01);
                  return <div className="bar" style={{background:'linear-gradient(90deg,#f59e0b,#f97316)', width: `${Math.min(100, ((nVal) / maxVal) * 100)}%`}}></div>;
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="kalman-canvas">
        {/* {showKalmanPlot && <canvas ref={canvasRef} className="track-canvas" />}
        <div className="error-plot-wrap">
          <canvas ref={errorCanvasRef} className="error-canvas" />
        </div> */}

        <div className="kalman-map-wrap">
          <div className="kalman-map" ref={mapContainerRef} />
        </div>
      </div>
    </div>
  );
};

export default KalmanView;
