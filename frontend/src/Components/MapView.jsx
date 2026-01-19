// src/components/MapView.jsx — Leaflet map with Esri WorldImagery satellite + labels
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapView = ({ latitude, longitude }) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const firstLocationSetRef = useRef(false);

  useEffect(() => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Validate coordinates
    if (!isFinite(lat) || !isFinite(lon)) {
      return;
    }

    // Initialize Leaflet map once with Esri satellite tiles
    if (!mapRef.current && mapContainerRef.current) {
      try {
        mapRef.current = L.map(mapContainerRef.current, { scrollWheelZoom: false });
        
        // Use Esri WorldImagery for satellite view
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
        }).addTo(mapRef.current);

        // Create separate panes for detailed labels (like Google Maps)
        try {
          // Pane for area/city labels
          mapRef.current.createPane('labelsBoundaries');
          const boundariesPane = mapRef.current.getPane('labelsBoundaries');
          boundariesPane.style.zIndex = 440;
          boundariesPane.style.pointerEvents = 'none';

          // Pane for street/road labels
          mapRef.current.createPane('labelsStreets');
          const streetsPane = mapRef.current.getPane('labelsStreets');
          streetsPane.style.zIndex = 445;
          streetsPane.style.pointerEvents = 'none';

          // Pane for POI and detailed place names
          mapRef.current.createPane('labelsPOI');
          const poiPane = mapRef.current.getPane('labelsPOI');
          poiPane.style.zIndex = 450;
          poiPane.style.pointerEvents = 'none';

          // Layer 1: Boundaries and place names (cities, regions)
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Labels © Esri',
            pane: 'labelsBoundaries'
          }).addTo(mapRef.current);

          // Layer 2: Transportation (streets, roads, highways with labels)
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Transport © Esri',
            pane: 'labelsStreets',
            opacity: 0.9
          }).addTo(mapRef.current);

          // Layer 3: Detailed map names (POI, neighborhoods, landmarks) - overlay on top
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'References © Esri',
            pane: 'labelsPOI',
            opacity: 0.85
          }).addTo(mapRef.current);
        } catch (e) {
          console.warn('Error creating label panes:', e);
        }

        // Create marker (red pin SVG icon)
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='40' viewBox='0 0 32 40'><path d='M16 0C9.4 0 4 5.4 4 12c0 7 12 28 12 28s12-21 12-28c0-6.6-5.4-12-12-12z' fill='%23E53935' stroke='white' stroke-width='1.5'/><circle cx='16' cy='12' r='5' fill='white'/></svg>`;
        const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        try {
          const icon = L.icon({
            iconUrl: svgUrl,
            iconSize: [32, 40],
            iconAnchor: [16, 40]
          });
          markerRef.current = L.marker([lat, lon], { icon }).addTo(mapRef.current);
        } catch (e) {
          // fallback: simple red circle if icon fails
          markerRef.current = L.circleMarker([lat, lon], {
            radius: 6,
            color: '#E53935',
            fillColor: '#E53935',
            fillOpacity: 0.9,
            pane: 'markerPane'
          }).addTo(mapRef.current);
        }

        // Set initial view
        mapRef.current.setView([lat, lon], 13);
        firstLocationSetRef.current = true;
      } catch (e) {
        console.error('Error initializing map:', e);
      }
    }

    return () => {
      // cleanup on unmount
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {}
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when props change without reinitializing map
  useEffect(() => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    // Skip if coordinates are invalid
    if (!isFinite(lat) || !isFinite(lon)) {
      return;
    }

    if (!mapRef.current) return;

    if (markerRef.current && markerRef.current.setLatLng) {
      markerRef.current.setLatLng([lat, lon]);
    }

    // Pan map to marker on every update (smooth following)
    try {
      mapRef.current.panTo([lat, lon], { animate: true, duration: 0.5 });
    } catch (e) {
      console.warn('Error panning map:', e);
    }
  }, [latitude, longitude]);

  return (
    <div className="map-view">
      <h3>🗺️ Location Map</h3>
      <div className="map-container" style={{ position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '360px', borderRadius: 8 }} />
        <div className="map-coordinates" style={{ marginTop: 8 }}>
          <span>Lat: {latitude}°</span>
          <span style={{ marginLeft: 12 }}>Lon: {longitude}°</span>
        </div>
      </div>
    </div>
  );
};

export default MapView;
