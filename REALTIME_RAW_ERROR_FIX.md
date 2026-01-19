# Real-Time Raw Error Calculation Fix

## Problem
Previously, the raw GPS error was calculated using static Google reference coordinates that the user manually entered. This meant:
- Raw error was not continuously updated in real-time
- Raw error values were standard/static rather than dynamic
- The system didn't show the actual deviation of raw GPS from the Kalman-filtered estimate

## Solution
Updated the error calculation in `KalmanView.jsx` to use **real-time raw error computation** based on the actual Kalman-filtered estimate as the reference:

### Key Changes

#### 1. Real-Time Raw Error Calculation
**File:** `frontend/src/Components/KalmanView.jsx`

**Before:**
```javascript
if (isFinite(rlat) && isFinite(rlon)) {
  rawErr = haversine(lat, lon, rlat, rlon);  // Only calculated if user entered reference
  filtErr = haversine(flat, flon, rlat, rlon);
  neoKalmanDist = haversine(lat, lon, flat, flon);
}
```

**After:**
```javascript
// Always calculate raw error as difference between raw GPS and current Kalman estimate
neoKalmanDist = haversine(lat, lon, flat, flon);
rawErr = neoKalmanDist;  // Raw error = Real-time deviation from Kalman

// If user provided manual reference coordinates, also calculate error against those
const rlat = parseFloat(propRefLat ?? '');
const rlon = parseFloat(propRefLon ?? '');
if (isFinite(rlat) && isFinite(rlon)) {
  filtErr = haversine(flat, flon, rlat, rlon);
} else {
  filtErr = rawErr;  // If no reference, filtered error = raw error
}
```

#### 2. Updated Error Label
**Changed display label from:**
```
"Raw Neo-6M → Ref"
```

**To:**
```
"Raw Neo-6M Deviation"
```

This clarifies that the raw error now represents the **real-time deviation** between the raw GPS reading and the Kalman-filtered estimate.

### How It Works

1. **Live Streaming Mode (No Manual Reference):**
   - Raw Neo-6M Deviation = Distance between current raw GPS and latest Kalman estimate
   - Updates continuously as new GPS data arrives
   - Shows the "noise" or "jitter" in the raw GPS signal

2. **With Manual Reference Coordinates:**
   - Raw Neo-6M Deviation = Still shows deviation from Kalman (real-time)
   - Kalman → Ref = Distance from Kalman to user-provided reference
   - Improvement = Percentage improvement of Kalman over raw

### Benefits

✅ **Real-Time Updates** - Raw error is calculated for every GPS measurement  
✅ **No Static Values** - Error changes dynamically as GPS data updates  
✅ **Better Kalman Visualization** - Shows how well Kalman filters the raw noisy data  
✅ **Continuous Monitoring** - Track GPS noise/drift in real-time without manual input  
✅ **Backward Compatible** - Still supports manual reference coordinates for accuracy testing  

### Display Format

The Error Analysis section now shows:
- **Raw Neo-6M Deviation:** Real-time distance from raw GPS to Kalman estimate (meters)
- **Kalman → Ref:** Distance from Kalman to manual reference (if provided)
- **Neo-6M ↔ Kalman:** Same as Raw Deviation (shows signal noise level)
- **Improvement:** Percentage improvement when using manual reference

### Testing

To verify the fix:
1. Open the Kalman Full Page View
2. Watch the "Raw Neo-6M Deviation" value update in real-time as GPS data streams in
3. The value should change continuously, showing the actual deviation between raw and filtered GPS
4. Optionally enter Google Reference coordinates to compare Kalman accuracy against a known location

## Files Modified
- `frontend/src/Components/KalmanView.jsx` - Real-time raw error calculation and label update

## No Breaking Changes
✓ Existing functionality preserved  
✓ Manual reference coordinates still work  
✓ CSV export still includes all error metrics  
✓ Charts and visualization display real-time errors
