/**
 * ============================================================================
 * NEO-6M GPS Backend Server
 * ============================================================================
 * Reads GPS data from Arduino NEO-6M module via serial port and broadcasts
 * real-time updates to connected clients over WebSocket.
 * 
 * Features:
 * - Serial port communication with Arduino
 * - NMEA GPS sentence parsing (GPGGA, GPRMC)
 * - Labeled key-value GPS data parsing
 * - WebSocket server for real-time client updates
 * - Auto-reconnection with mock data fallback
 * - Health check endpoints for monitoring
 * ============================================================================
 */

// ============== IMPORTS & DEPENDENCIES ==============
const WebSocket = require('ws');           // WebSocket server for real-time communication
const express = require('express');        // Express.js framework for HTTP endpoints
const http = require('http');              // HTTP server to attach WebSocket to
const cors = require('cors');              // CORS middleware for cross-origin requests
const GPSData = require('./gpsModel');     // MongoDB GPS data model (stub)

// SerialPort modules loaded dynamically to allow server to run without hardware
let SerialPort = null;
let ReadlineParser = null;

// ============== ENVIRONMENT & CONFIGURATION ==============
require('dotenv').config(); // Load environment variables from .env file

// ============== EXPRESS SERVER SETUP ==============
const app = express();
app.use(cors()); // Enable CORS for all routes

// Custom CORS middleware for explicit header handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============== HTTP & WEBSOCKET SERVER ==============
const server = http.createServer(app);     // Create HTTP server
const wss = new WebSocket.Server({ server }); // Attach WebSocket server to HTTP

console.log('🚀 WebSocket server attached to http server');

// Handle HTTP server errors
server.on('error', (err) => {
  console.error('HTTP server error:', err && err.stack ? err.stack : err);
});
// ============== HTTP ENDPOINTS ==============

/**
 * GET /health
 * Health check endpoint for clients to verify server is running and ready
 * Returns: { status: 'ok' }
 */
app.get('/health', (req, res) => {
  try {
    const remote = req.ip || req.headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress) || 'unknown';
    console.log(`/health requested from ${remote}`);
  } catch (e) {}

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ status: 'ok' });
});

/**
 * POST /disconnect
 * Closes the serial port connection and all active WebSocket clients
 * Used when user wants to stop GPS tracking
 */
app.post('/disconnect', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    console.log('🔴 Disconnect request received');
    
    // Close serial port if it's currently open
    if (port && port.isOpen) {
      port.close((err) => {
        if (err) {
          console.error('❌ Error closing serial port:', err.message);
        } else {
          console.log('✅ Serial port closed');
        }
      });
    }
    
    // Close all active WebSocket connections
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server disconnect requested');
      }
    });
    console.log('✅ All WebSocket clients disconnected');
    
    res.status(200).json({ status: 'disconnected', message: 'Arduino disconnected successfully' });
  } catch (err) {
    console.error('❌ Error during disconnect:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /connect
 * Reconnects to Arduino serial port and resumes GPS data broadcasting
 * Used when user wants to resume GPS tracking
 */
app.post('/connect', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    console.log('🟢 Connect request received');
    
    // Attempt to initialize serial port connection
    const parser = await tryInitSerial();
    if (parser) {
      console.log('✅ Serial port reconnected successfully');
      setupSerialParser(parser);
      res.status(200).json({ status: 'connected', message: 'Arduino connected successfully' });
    } else {
      console.warn('⚠️  Could not reconnect to serial port, using mock data');
      res.status(200).json({ status: 'connected', message: 'Connected (mock mode)' });
    }
  } catch (err) {
    console.error('❌ Error during connect:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============== SERIAL PORT CONFIGURATION ==============
const PREFERRED_PORT = process.env.SERIAL_PORT || 'COM3';  // Default: COM3 (Windows)
const BAUD_RATE = parseInt(process.env.BAUD_RATE, 10) || 9600; // Default: 9600

// ============== GLOBAL VARIABLES ==============
let parser = null;                  // Current serial port parser instance
let port = null;                    // Reference to open serial port
let mockInterval = null;            // Interval for mock GPS data generation
let lastBroadcastJson = null;       // Last broadcast JSON to detect duplicates
let lastRawInput = null;            // Last raw input line to skip duplicates

/**
 * ============================================================================
 * SERIAL PORT INITIALIZATION
 * ============================================================================
 * Attempts to initialize connection to Arduino via serial port
 * - Loads serialport libraries dynamically
 * - Lists available serial ports
 * - Connects to preferred port or first available
 * - Sets up readline parser to read GPS data line-by-line
 * 
 * Returns: parser object if successful, null if failed (will use mock data)
 */
async function tryInitSerial() {
  // Allow skipping serial for development/testing
  if (process.env.SKIP_SERIAL === '1') {
    console.log('SKIP_SERIAL is set; skipping serial port initialization.');
    return null;
  }
  try {
    // Dynamically require serialport modules (allows app to run without native modules)
    try {
      const sp = require('serialport');
      SerialPort = sp.SerialPort || sp;
    } catch (e) {
      console.warn('serialport module not available:', e && e.message ? e.message : e);
      return null;
    }

    // Load readline parser for parsing line-delimited GPS data
    try {
      ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
    } catch (e) {
      // Try fallback for older versions
      try {
        ReadlineParser = require('@serialport/parser-readline');
      } catch (e2) {
        console.warn('@serialport/parser-readline not available:', e2 && e2.message ? e2.message : e2);
        return null;
      }
    }
    const ports = await SerialPort.list();
    const available = ports.map(p => p.path || p.comName || p.path).filter(Boolean);

    console.log('Available serial ports:', available);

    const selected = available.find(p => p.toLowerCase() === PREFERRED_PORT.toLowerCase()) || available[0];

    if (!selected) {
      console.warn('No serial ports found. Falling back to mock GPS data.');
      return null;
    }

    console.log(`Opening serial port: ${selected} @ ${BAUD_RATE}`);
    
    try {
      port = new SerialPort({ path: selected, baudRate: BAUD_RATE, autoOpen: true });
      const rp = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      port.on('error', (err) => {
        console.error('Serial port error:', err.message || err);
      });

      return rp;
    } catch (portErr) {
      console.error(`❌ Failed to open ${selected}:`, portErr.message || portErr);
      
      // Try fallback to first available port if preferred port fails
      if (available.length > 0 && available[0].toLowerCase() !== selected.toLowerCase()) {
        console.log(`🔄 Trying fallback port: ${available[0]}`);
        try {
          port = new SerialPort({ path: available[0], baudRate: BAUD_RATE, autoOpen: true });
          const rp = port.pipe(new ReadlineParser({ delimiter: '\n' }));
          
          port.on('error', (err) => {
            console.error('Fallback serial port error:', err.message || err);
          });
          
          return rp;
        } catch (fallbackErr) {
          console.error(`❌ Fallback port also failed:`, fallbackErr.message || fallbackErr);
          return null;
        }
      }
      return null;
    }
  } catch (err) {
    console.error('Error initializing serial port:', err && err.message ? err.message : err);
    return null;
  }
}


/**
 * ============================================================================
 * BROADCAST TO CONNECTED CLIENTS
 * ============================================================================
 * Sends GPS data to all connected WebSocket clients
 * Features:
 * - Filters out raw/noise data (source === 'raw')
 * - Deduplicates identical consecutive messages
 * - Logs all broadcasts with message preview
 * - Counts recipients for monitoring
 */
function broadcastToClients(obj) {
  if (!obj) return;
  
  // Don't broadcast raw noise lines to clients
  if (obj.source === 'raw') return;
  
  const msg = JSON.stringify(obj);
  
  // Skip if this is identical to the last broadcast (reduce noise)
  if (msg === lastBroadcastJson) {
    console.log('[BROADCAST] Skipped duplicate');
    return;
  }
  lastBroadcastJson = msg;
  console.log('✅ Broadcasting to clients:', msg.substring(0, 100) + '...');
  let sentCount = 0;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
      sentCount++;
    }
  });
  console.log(`   Sent to ${sentCount} client(s)`);
}

/**
 * ============================================================================
 * COMPUTE LOCAL TIME FROM LONGITUDE
 * ============================================================================
 * Calculates approximate local time and timezone offset based on GPS longitude
 * Formula: timezone offset = longitude / 15 degrees per hour
 * 
 * Parameters:
 * - latitude, longitude: GPS coordinates (for timezone calculation)
 * - dateIso: Date string in format YYYY-MM-DD
 * - timeStr: Time string in format HH:MM:SS
 * 
 * Returns: { localTime: formatted string, tzOffset: UTC offset string }
 */
function computeLocalTimeFromLon(latitude, longitude, dateIso, timeStr) {
  // Calculate timezone offset: each 15 degrees of longitude = 1 hour
  const lon = parseFloat(longitude);
  if (isNaN(lon)) return { localTime: null, tzOffset: null };

  const offsetHours = lon / 15.0; // Can be fractional (e.g., India ~5.5)
  const offsetMinutes = Math.round(offsetHours * 60);

  // Build a Date object in UTC from provided date and time
  let utcDate = null;
  try {
    if (dateIso && timeStr) {
      // Ensure time is formatted HH:MM:SS
      const t = timeStr.split(':').slice(0,3).map(s => s.padStart(2,'0')).join(':');
      utcDate = new Date(`${dateIso}T${t}Z`);
      if (isNaN(utcDate.getTime())) utcDate = null;
    }
  } catch (e) {
    utcDate = null;
  }

  // Fallback to current UTC time if parsing failed
  if (!utcDate) utcDate = new Date();

  // Apply offset minutes to get local time
  const localMs = utcDate.getTime() + offsetMinutes * 60 * 1000;
  const localDate = new Date(localMs);

  // Format local time as YYYY-MM-DD HH:MM:SS
  const pad = (n) => String(n).padStart(2, '0');
  const localDateIso = `${localDate.getUTCFullYear()}-${pad(localDate.getUTCMonth()+1)}-${pad(localDate.getUTCDate())}`;
  const localTimeStr = `${pad(localDate.getUTCHours())}:${pad(localDate.getUTCMinutes())}:${pad(localDate.getUTCSeconds())}`;

  // Format timezone offset as UTC±HH:MM
  const tzSign = offsetMinutes >= 0 ? '+' : '-';
  const tzAbs = Math.abs(offsetMinutes);
  const tzH = Math.floor(tzAbs / 60);
  const tzM = tzAbs % 60;
  const tzOffsetStr = `UTC${tzSign}${String(tzH).padStart(2,'0')}:${String(tzM).padStart(2,'0')}`;

  return { localTime: `${localDateIso} ${localTimeStr}`, tzOffset: tzOffsetStr };
}

/**
 * ============================================================================
 * WEBSOCKET CONNECTION HANDLER
 * ============================================================================
 * Handles new WebSocket client connections
 * - Sets up GPS data stream for each client
 * - Attaches serial parser listener for real-time data
 * - Cleans up listeners when client disconnects
 */
wss.on('connection', (ws) => {
  console.log('✅ Client connected');

  if (parser) {
    // Create data handler for this client connection
    const onData = (data) => {
      try {
        const gpsData = parseGPSData(data);
        if (gpsData) {
          console.log('📡 Broadcasting to WebSocket client:', JSON.stringify(gpsData));
          ws.send(JSON.stringify(gpsData));
        }
      } catch (error) {
        console.error('❌ Error parsing GPS data:', error);
      }
    };

    // Attach data listener to serial parser
    parser.on('data', onData);

    // Clean up listener when client disconnects
    ws.on('close', () => {
      console.log('🔌 Client disconnected');
      parser.removeListener('data', onData);
    });
  } else {
    // If no real parser, inform client that we're using mock GPS data
    console.log('ℹ️  No serial parser; using mock GPS data broadcaster');
    ws.send(JSON.stringify({ message: 'No serial device; sending mock GPS data' }));
  }
});

/**
 * ============================================================================
 * NMEA COORDINATE CONVERTER
 * ============================================================================
 * Converts NMEA-0183 latitude/longitude format to decimal degrees
 * 
 * NMEA Format: ddmm.mmmm where dd=degrees, mm=minutes, .mmmm=decimal minutes
 * Examples:
 * - 4807.038 N = 48° 07.038' North = 48.11730° decimal
 * - 01131.000 E = 11° 31.000' East = 11.51667° decimal
 * 
 * Parameters:
 * - coord: NMEA coordinate string (e.g., "4807.038")
 * - hemi: Hemisphere indicator ('N'=North, 'S'=South, 'E'=East, 'W'=West)
 * 
 * Returns: Decimal degrees as number (negative if S or W)
 */
function nmeaToDecimal(coord, hemi) {
  if (!coord) return null;
  
  const f = parseFloat(coord);
  if (isNaN(f)) return null;
  
  // Extract degrees (first 2-3 digits)
  const deg = Math.floor(f / 100);
  // Extract minutes (remaining digits after degrees)
  const min = f - deg * 100;
  // Convert to decimal: degrees + (minutes/60)
  let dec = deg + (min / 60);
  
  // Apply hemisphere: S=South (-), W=West (-)
  if (hemi === 'S' || hemi === 'W') dec = -dec;
  
  return parseFloat(dec.toFixed(6));
}

// ============== GPS DATA PARSING ==============
// Buffer for labeled (key:value) GPS data from Arduino
let labeledBuffer = {};
let labeledLastBroadcast = 0;        // Timestamp of last labeled broadcast
const LABELED_BROADCAST_INTERVAL = 2000; // Broadcast labeled data every 2 seconds
let lastBroadcastedStr = null;      // Last broadcast string to detect duplicates

/**
 * ============================================================================
 * GPS DATA PARSER
 * ============================================================================
 * Parses GPS data in multiple formats:
 * 1. NMEA sentences ($GPGGA, $GPRMC)
 * 2. Labeled key-value format from Arduino
 * 3. Raw lines (stored but not broadcast)
 * 
 * Supports:
 * - GPGGA: Position, altitude, satellite count, HDOP
 * - GPRMC: Position, speed, course, date
 * - Labeled: Key: Value format (e.g., "Latitude: 17.385")
 * 
 * Returns: Parsed GPS object or null if invalid/raw data
 */
function parseGPSData(rawData) {
  if (!rawData) return null;
  const s = rawData.trim();
  if (s.length === 0) return null;

  // Skip duplicate consecutive lines (common with serial data)
  if (s === lastRawInput) {
    return null;
  }
  lastRawInput = s;

  console.log(`[PARSING] Raw input: "${s}"`);

  // ==================== NMEA SENTENCE PARSING ====================
  if (s.startsWith('$')) {
    const parts = s.split(',');
    const type = parts[0].slice(1);

    /**
     * GPGGA - Global Positioning System Fix Data
     * Format: $GPGGA,hhmmss,ddmm.mmmm,a,dddmm.mmmm,a,x,xx,x.x,x.x,M,x.x,M,,*hh
     * Example: $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
     * 
     * Fields:
     * 1: Time (hhmmss)
     * 2-3: Latitude and hemisphere
     * 4-5: Longitude and hemisphere
     * 6: Fix quality (0=invalid, 1=GPS fix, 2=DGPS fix)
     * 7: Satellite count
     * 8: HDOP (Horizontal dilution of precision)
     * 9: Altitude above mean sea level
     */
    if (type === 'GPGGA' || type.endsWith('GGA')) {
      const time = parts[1];
      const lat = nmeaToDecimal(parts[2], parts[3]);
      const lon = nmeaToDecimal(parts[4], parts[5]);
      const fix = parts[6] && parts[6] !== '0';
      const sats = parseInt(parts[7], 10) || 0;
      const hdop = parseFloat(parts[8]) || null;
      const altitude = parseFloat(parts[9]) || null;

      // Format time from hhmmss to HH:MM:SS
      let hhmmss = '';
      if (time && time.length >= 6) {
        hhmmss = `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;
      }

      const local = computeLocalTimeFromLon(lat, lon, null, hhmmss);
      const result = {
        source: 'nmea',
        latitude: lat,
        longitude: lon,
        altitude: altitude,
        satellites: sats,
        hdop: hdop,
        speed: null,
        course: null,
        date: null,
        time: hhmmss,
        fix: !!fix,
        local_time: local.localTime,
        timezone: local.tzOffset
      };
      console.log(`[PARSED NMEA GGA] Lat: ${lat}, Lon: ${lon}, Sats: ${sats}, Alt: ${altitude}m`);
      return result;
    }

    // GPRMC - Recommended Minimum Specific GPS/Transit Data
    if (type === 'GPRMC' || type.endsWith('RMC')) {
      // Example: $GPRMC,hhmmss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,,*hh
      const time = parts[1];
      const status = parts[2];
      const lat = nmeaToDecimal(parts[3], parts[4]);
      const lon = nmeaToDecimal(parts[5], parts[6]);
      const speedKnots = parseFloat(parts[7]) || 0;
      const course = parseFloat(parts[8]) || 0;
      const date = parts[9]; // ddmmyy

      // convert date/time
      let isoDate = null;
      if (date && date.length === 6) {
        const dd = date.slice(0,2);
        const mm = date.slice(2,4);
        const yy = date.slice(4,6);
        // Assume 20yy for yy < 80 else 19yy — simple heuristic
        const year = parseInt(yy,10) < 80 ? `20${yy}` : `19${yy}`;
        isoDate = `${year}-${mm}-${dd}`;
      }

      let hhmmss = '';
      if (time && time.length >= 6) hhmmss = `${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}`;

      const speedKmh = +(speedKnots * 1.852).toFixed(2);

      const result = {
        source: 'nmea',
        latitude: lat,
        longitude: lon,
        altitude: null,
        satellites: null,
        hdop: null,
        speed: speedKmh,
        course: course,
        date: isoDate,
        time: hhmmss,
        fix: status === 'A'
      };
      console.log(`[PARSED NMEA RMC] Lat: ${lat}, Lon: ${lon}, Speed: ${speedKmh} km/h, Date: ${isoDate}`);
      return result;
    }

    // Unhandled NMEA type: return raw sentence
    return { source: 'nmea', raw: s };
  }

  // If labeled `Key: Value` lines (e.g., from Arduino Serial Monitor)
  if (s.includes(':')) {
    // labeled format
    // Support lines like "Latitude: 17.392955" or "HDOP: 98"
    const [rawKey, ...rest] = s.split(':');
    const key = rawKey.trim().toLowerCase();
    const val = rest.join(':').trim();

    // Map common labels to canonical keys
    const map = {
      'latitude': 'latitude',
      'lat': 'latitude',
      'longitude': 'longitude',
      'lon': 'longitude',
      'altitude': 'altitude',
      'satellites': 'satellites',
      'hdop': 'hdop',
      'speed': 'speed',
      'course': 'course',
      'date': 'date',
      'time': 'time',
      'fix': 'fix'
    };

    const canon = map[key] || key;

    // parse numeric when appropriate
    if (['latitude','longitude','altitude','hdop','speed','course'].includes(canon)) {
      const num = parseFloat(val.replace(/[^0-9+\-.eE]/g, ''));
      labeledBuffer[canon] = isNaN(num) ? val : num;
    } else if (canon === 'satellites') {
      labeledBuffer[canon] = parseInt(val, 10) || 0;
    } else if (canon === 'fix') {
      labeledBuffer[canon] = /true|1|yes/i.test(val);
    } else {
      labeledBuffer[canon] = val;
    }

    // If we have at least latitude and longitude, check if we should broadcast
    if (labeledBuffer.latitude != null && labeledBuffer.longitude != null) {
      const now = Date.now();
      // Broadcast if interval has elapsed
      if (now - labeledLastBroadcast >= LABELED_BROADCAST_INTERVAL) {
        // Copy and keep buffer (don't clear yet in case more fields come in next cycle)
        const out = { ...labeledBuffer };
        labeledLastBroadcast = now;

        // Normalize HDOP if it looks scaled (e.g., 870 -> 8.70, 98 -> 0.98)
        if (out.hdop != null && out.hdop > 10) {
          out.hdop = +(out.hdop / 100).toFixed(2);
          console.log(`[HDOP NORMALIZED] ${out.hdop}`);
        }

        // Normalize time/date if needed (simple heuristics)
        if (out.date && /^[0-9]{6}$/.test(String(out.date))) {
          const d = String(out.date);
          const dd = d.slice(0,2), mm = d.slice(2,4), yy = d.slice(4,6);
          const year = parseInt(yy,10) < 80 ? `20${yy}` : `19${yy}`;
          out.date = `${year}-${mm}-${dd}`;
        }

        if (out.time && /^[0-9]{6,9}$/.test(String(out.time))) {
          const t = String(out.time).padStart(6,'0');
          const hh = t.slice(0,2), mi = t.slice(2,4), ss = t.slice(4,6);
          out.time = `${hh}:${mi}:${ss}`;
        }

        // If speed looks like m/s (small decimals), provide km/h conversion
        if (out.speed != null && Math.abs(out.speed) < 50) {
          out.speed_kmh = +(out.speed * 3.6).toFixed(2);
        }

        // Ensure types and rounding
        if (typeof out.latitude === 'number') out.latitude = +out.latitude.toFixed(6);
        if (typeof out.longitude === 'number') out.longitude = +out.longitude.toFixed(6);
        if (typeof out.altitude === 'number') out.altitude = +out.altitude.toFixed(2);
        if (typeof out.hdop === 'number') out.hdop = +out.hdop.toFixed(2);

        const local = computeLocalTimeFromLon(out.latitude, out.longitude, out.date, out.time);
        const finalObj = {
          source: 'labeled',
          latitude: out.latitude,
          longitude: out.longitude,
          altitude: out.altitude || null,
          satellites: out.satellites || null,
          hdop: out.hdop || null,
          speed: out.speed != null ? out.speed : null,
          speed_kmh: out.speed_kmh || null,
          course: out.course || null,
          date: out.date || null,
          time: out.time || null,
          fix: out.fix ? true : false,
          local_time: local.localTime,
          timezone: local.tzOffset
        };

        const finalStr = JSON.stringify(finalObj);
        if (finalStr === lastBroadcastedStr) {
          // Duplicate of last broadcast — do not emit again
          console.log(`[LABELED] Duplicate broadcast suppressed`);
          return null;
        }
        lastBroadcastedStr = finalStr;

        console.log(`[PARSED LABELED] Lat: ${out.latitude}, Lon: ${out.longitude}, Sats: ${out.satellites}, Alt: ${out.altitude}m, HDOP: ${out.hdop}, Speed: ${out.speed}km/h`);
        return finalObj;
      }
    }

    // Not ready to broadcast yet (or interval not elapsed)
    return null;
  }

  // Fallback: if the rawData looks numeric or simple, return as raw
  // Filter out common noise/separator lines (e.g., '-----', '___') and very short lines
  if (/^[\-_=\s]{2,}$/.test(s) || s.length < 3) return null;

  return { source: 'raw', raw: s };
}

// Function to setup serial parser with event listeners
function setupSerialParser(newParser) {
erver.listen(8080, () => {
  console.log(`Server started on port 8080 (pid=${process.pid})`);
});

// Initialize serial or mock data broadcaster
(async () => {
  parser = await tryInitSerial();

  if (!parser) {
    // Periodically broadcast a simple mock GPS object to all connected clients
    mockInterval = setInterval(() => {
      const mock = {
        source: 'mock',
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: null,
        satellites: null,
        hdop: null,
        speed: null,
        course: null,
        date: null,
        time: null,
        fix: null
      };
      broadcastToClients(mock);
    }, 2000);
  } else {
    // If parser exists, also listen and broadcast to all clients (in case multiple clients)
    parser.on('data', (data) => {
      try {
        const gpsData = parseGPSData(data);
        broadcastToClients(gpsData);
      } catch (err) {
        console.error('Error parsing/broadcasting GPS data:', err);
      }
    });
  }

  // Cleanup on process exit
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (mockInterval) clearInterval(mockInterval);
    server.close(() => process.exit(0));
  });
})();
