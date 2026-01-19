/**
 * Kalman Filter for GPS Data Smoothing
 * Used to filter noisy GPS measurements and provide smooth position estimates
 */

class KalmanFilter {
  constructor(options = {}) {
    // Process noise - how much we expect the state to change per time step
    this.processNoise = options.processNoise || 0.001;
    
    // Measurement noise - how much we trust the GPS measurements
    // Higher value = less trust in measurements
    this.measurementNoise = options.measurementNoise || 10;
    
    // Initial estimate error (uncertainty in initial state)
    this.estimateError = options.estimateError || 1;
    
    // Initialize state (position and velocity)
    this.position = options.initialPosition || 0;
    this.velocity = options.initialVelocity || 0;
    
    // Kalman gain - will be updated dynamically
    this.kalmanGain = 0;
    
    // Timestamp of last update
    this.lastTimestamp = Date.now();
  }

  /**
   * Predict next state based on motion model
   * @param {number} deltaTime - Time elapsed since last update (seconds)
   */
  predict(deltaTime = 1) {
    // Update position based on velocity: position = position + velocity * dt
    this.position = this.position + this.velocity * deltaTime;
    
    // Velocity remains constant (constant velocity model)
    // this.velocity stays the same unless we use acceleration
    
    // Update estimate error (uncertainty grows over time)
    this.estimateError = this.estimateError + this.processNoise;
  }

  /**
   * Update filter with new measurement
   * @param {number} measurement - New measured position value
   * @returns {number} Filtered position estimate
   */
  update(measurement) {
    // Calculate Kalman gain (how much we trust the measurement)
    this.kalmanGain = this.estimateError / (this.estimateError + this.measurementNoise);
    
    // Update position estimate
    this.position = this.position + this.kalmanGain * (measurement - this.position);
    
    // Update velocity estimate (how fast position is changing)
    // This helps predict future positions better
    this.velocity = this.velocity + this.kalmanGain * (measurement - this.position);
    
    // Update estimate error (confidence in our estimate)
    this.estimateError = (1 - this.kalmanGain) * this.estimateError;
    
    return this.position;
  }

  /**
   * Apply Kalman filter to a measurement
   * @param {number} measurement - New GPS measurement
   * @param {number} deltaTime - Time since last measurement
   * @returns {number} Smoothed estimate
   */
  filter(measurement, deltaTime = 1) {
    this.predict(deltaTime);
    return this.update(measurement);
  }

  /**
   * Get current filter state
   */
  getState() {
    return {
      position: this.position,
      velocity: this.velocity,
      error: this.estimateError,
      gain: this.kalmanGain
    };
  }

  /**
   * Reset filter to initial state
   */
  reset(initialPosition = 0) {
    this.position = initialPosition;
    this.velocity = 0;
    this.estimateError = 1;
    this.kalmanGain = 0;
    this.lastTimestamp = Date.now();
  }
}

/**
 * Multi-dimensional Kalman Filter for GPS coordinates
 * Handles latitude, longitude, and altitude smoothing
 */
class GPSKalmanFilter {
  constructor(options = {}) {
    // Create separate filters for each coordinate
    this.filters = {
      latitude: new KalmanFilter({
        processNoise: options.processNoise || 0.0001,
        measurementNoise: options.measurementNoise || 5,
        estimateError: options.estimateError || 1
      }),
      longitude: new KalmanFilter({
        processNoise: options.processNoise || 0.0001,
        measurementNoise: options.measurementNoise || 5,
        estimateError: options.estimateError || 1
      }),
      altitude: new KalmanFilter({
        processNoise: options.processNoise || 0.01,
        measurementNoise: options.measurementNoise || 10,
        estimateError: options.estimateError || 1
      }),
      speed: new KalmanFilter({
        processNoise: options.processNoise || 0.01,
        measurementNoise: options.measurementNoise || 1,
        estimateError: options.estimateError || 1
      }),
      course: new KalmanFilter({
        processNoise: options.processNoise || 0.1,
        measurementNoise: options.measurementNoise || 5,
        estimateError: options.estimateError || 1
      })
    };
    
    this.lastUpdateTime = Date.now();
  }

  /**
   * Filter GPS data point
   * @param {Object} gpsData - GPS data containing lat, lon, alt, speed, course
   * @returns {Object} Filtered GPS data
   */
  filterGPS(gpsData) {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    this.lastUpdateTime = currentTime;
    
    // Ensure deltaTime is reasonable (avoid huge jumps)
    const dt = Math.min(Math.max(deltaTime, 0.01), 10);
    
    return {
      latitude: this.filters.latitude.filter(parseFloat(gpsData.latitude) || 0, dt),
      longitude: this.filters.longitude.filter(parseFloat(gpsData.longitude) || 0, dt),
      altitude: this.filters.altitude.filter(parseFloat(gpsData.altitude) || 0, dt),
      speed: this.filters.speed.filter(parseFloat(gpsData.speed) || 0, dt),
      course: this.filters.course.filter(parseFloat(gpsData.course) || 0, dt),
      satellites: gpsData.satellites,
      hdop: gpsData.hdop,
      fix: gpsData.fix,
      // Include raw measurements for comparison
      raw: {
        latitude: parseFloat(gpsData.latitude),
        longitude: parseFloat(gpsData.longitude),
        altitude: parseFloat(gpsData.altitude)
      }
    };
  }

  /**
   * Get current filter states for all coordinates
   */
  getStates() {
    return {
      latitude: this.filters.latitude.getState(),
      longitude: this.filters.longitude.getState(),
      altitude: this.filters.altitude.getState(),
      speed: this.filters.speed.getState(),
      course: this.filters.course.getState()
    };
  }

  /**
   * Reset all filters
   */
  reset(initialGPS = {}) {
    this.filters.latitude.reset(parseFloat(initialGPS.latitude) || 0);
    this.filters.longitude.reset(parseFloat(initialGPS.longitude) || 0);
    this.filters.altitude.reset(parseFloat(initialGPS.altitude) || 0);
    this.filters.speed.reset(parseFloat(initialGPS.speed) || 0);
    this.filters.course.reset(parseFloat(initialGPS.course) || 0);
    this.lastUpdateTime = Date.now();
  }

  /**
   * Tune filter sensitivity
   * @param {string} type - 'aggressive' (more filtering), 'normal', or 'sensitive' (less filtering)
   */
  tune(type = 'normal') {
    const config = {
      aggressive: { processNoise: 0.00005, measurementNoise: 15 },
      normal: { processNoise: 0.0001, measurementNoise: 5 },
      sensitive: { processNoise: 0.0002, measurementNoise: 2 }
    };
    
    const settings = config[type] || config.normal;
    
    Object.values(this.filters).forEach(filter => {
      filter.processNoise = settings.processNoise;
      filter.measurementNoise = settings.measurementNoise;
    });
  }
}

module.exports = {
  KalmanFilter,
  GPSKalmanFilter
};
