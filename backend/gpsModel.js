// In-memory stub replacement for MongoDB-backed GPS model.
// This allows the backend to run without a MongoDB connection.

class GPSData {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  save() {
    // No-op save; resolve immediately
    return Promise.resolve(this);
  }

  static countDocuments() {
    // Always report 0 documents when not using a DB
    return Promise.resolve(0);
  }

  static deleteMany() {
    // No-op delete
    return Promise.resolve({ acknowledged: true, deletedCount: 0 });
  }
}

module.exports = GPSData;
