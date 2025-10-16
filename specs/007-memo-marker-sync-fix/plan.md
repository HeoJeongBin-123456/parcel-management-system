# Implementation Plan: 메모-마커 동기화 버그 수정

**Feature**: [메모-마커 동기화 버그 수정](./spec.md)
**Version**: 1.0
**Status**: Planning Phase
**Target**: memo-markers.js, app-init.js
**Complexity**: Medium (3 concurrent issues, timing-critical fixes)

---

## Technical Context

### Current Architecture
- **Frontend**: Vanilla JS with Naver Maps API
- **Backend**: Supabase (realtime subscriptions)
- **Storage**: Dual-layer (LocalStorage + Supabase)
- **Marker System**: MemoMarkerManager class managing 1+ memo markers per parcel

### Key Components
1. **MemoMarkerManager** (memo-markers.js):
   - `initialize()`: Sets up marker manager, waits for map load
   - `loadAllMemoMarkers()`: Loads markers from LocalStorage on page refresh
   - `shouldShowMarker()`: 5-condition check (memo, owner_name, owner_address, owner_contact, parcel_name)
   - `createMemoMarker()`: Creates marker and adds to Map

2. **SupabaseManager** (supabase-config.js):
   - Realtime subscriptions via `onUpdate()` callbacks
   - Can trigger concurrent marker creation during page load

3. **app-init.js** (Line 1383):
   - Calls `MemoMarkerManager.initialize()`
   - Initiates 20-second map load wait period

### Data Model
```javascript
// LocalStorage
{
  parcelData: [{pnu, lat, lng, memo, owner_name, ...}],
  parcelColors: {[pnu]: colorCode},
  markerStates: {[pnu]: boolean}  // ← FR-003: Currently not recovered
}

// MemoMarkerManager internal
{
  markers: Map<pnu, {marker: Marker, data: ParcelData}>,
  isInitialized: boolean,        // ← FR-001: Timing issue
  isInitializing: boolean,       // ← FR-001: Needs refinement
}
```

### Known Limitations
- **20-second timeout**: Map load wait is hard-coded; slow networks may fail
- **LocalStorage quota**: 5MB limit; large memo datasets may cause issues
- **Supabase sync delay**: Realtime callbacks may not fire immediately after save

---

## Constitution Check

### Code Reusability (DRY Principle)
- ✅ `shouldShowMarker()` centralized condition check
- ⚠️ Flag management scattered (isInitialized, isInitializing, isDeleted)
  - **Fix**: Centralize flag state transitions in dedicated method

### Clean Code (Max File Lines: 500, Max Function Lines: 50)
- ⚠️ `memo-markers.js`: 52KB file (over 500 lines)
  - **Status**: Already non-compliant; bug fix should not worsen
  - **Fix**: Keep new code minimal; consider future refactoring

### Production Quality (Error Handling)
- ❌ No console logging for marker load process
  - **Fix**: Add logging per FR-004

### Security & Robustness
- ✅ No hard-coded credentials in marker logic
- ✅ LocalStorage access wrapped with try-catch
- ⚠️ Race condition exposure
  - **Fix**: FR-002 addresses atomic marker creation

**Violations**: ⚠️ 1 warning (oversized file) - Bug fix should prioritize functionality over structural refactoring

---

## Phase 0: Research & Unknowns

### Identified Unknowns

#### U1: Marker DOM Element Lifecycle
**Unknown**: How are Naver Map markers cleaned up when `isInitialized` flag resets?
**Impact**: May cause memory leaks or orphaned markers
**Research Task**: Trace marker.setMap(null) cleanup logic

#### U2: LocalStorage Persistence Timing
**Unknown**: Are `markerStates` persisted immediately when user toggles marker visibility?
**Impact**: If async, state may be lost before recovery in loadAllMemoMarkers()
**Research Task**: Verify markerStates save timing in UI toggle handlers

#### U3: Supabase onUpdate Callback Timing
**Unknown**: When exactly does onUpdate() fire relative to window.map load completion?
**Impact**: Race condition severity depends on timing overlap window
**Research Task**: Measure callback timing in Chrome DevTools

### Research Output (research.md)

#### Decision 1: Marker DOM Cleanup Strategy
- **Choice**: Use flag-based gate (isInitializing) to prevent concurrent marker creation
- **Rationale**: Preserves existing architecture; no DOM cleanup needed if creation is serialized
- **Alternatives Considered**: Full marker cache invalidation (complex), marker IDs registry (new dependency)

#### Decision 2: LocalStorage Persistence Model
- **Choice**: Assume immediate persistence (verified via CLAUDE.md: "마커 상태 영속성")
- **Rationale**: Existing code relies on synchronous localStorage.setItem()
- **Alternatives Considered**: Async persisency tracking (would require major refactor)

#### Decision 3: Supabase Callback Serialization
- **Choice**: Lock markers Map during loadAllMemoMarkers() execution
- **Rationale**: Simplest fix; uses flag-based gate already present in codebase
- **Alternatives Considered**: Event queue (complex), debouncing (might miss updates)

---

## Phase 1: Design & Contracts

### 1.1 Data Model Refinement (data-model.md)

#### MemoMarkerManager State Machine

```
[Uninitialized]
       ↓
   initialize()
       ↓
[Initializing] ← isInitializing = true
       ↓
   window.map ready (20s timeout)
       ↓
   loadAllMemoMarkers() ← isInitializing = true (lock)
       ├─ Load LocalStorage (parcelData, markerStates, parcelColors)
       ├─ For each parcel:
       │  ├─ shouldShowMarker() check
       │  ├─ createMemoMarker() call
       │  └─ Restore marker visibility from markerStates
       └─ Complete
       ↓
[Initialized] ← isInitialized = true, isInitializing = false (unlock)
       ↓
   Supabase onUpdate() allowed (realtime updates can proceed)
```

#### Marker Creation Lock Protocol

```
During loadAllMemoMarkers():
  markers.isLocked = true

  Concurrent Supabase updates:
    if (markers.isLocked) {
      // Queue or defer update
    }

After loadAllMemoMarkers():
  markers.isLocked = false
  // Process queued updates if any
```

#### MarkerStates Recovery Format

```javascript
// Before: loadAllMemoMarkers() ignores markerStates
// After: Applies visibility from LocalStorage

markerStates = {
  "940-26": false,  // Hidden
  "940-27": true,   // Visible
}

For each created marker:
  if (markerStates[pnu] === false) {
    marker.setVisible(false)
  }
```

### 1.2 API Contracts

#### Internal API: MemoMarkerManager Methods

**Method**: `initialize()`
```
Input: (none)
Output: Promise<void>

Behavior:
  1. Check isInitialized / isInitializing flags
  2. If either true, return early (prevent re-entry)
  3. Set isInitializing = true
  4. Wait for window.map (20s timeout)
  5. Call loadAllMemoMarkers()
  6. Set isInitialized = true, isInitializing = false
  7. Resolve promise

Error Handling:
  - Map timeout: Log warning, return gracefully
  - LocalStorage access error: Catch + log, continue with empty data
```

**Method**: `loadAllMemoMarkers()`
```
Input: (none)
Output: Promise<void>

Behavior:
  1. Gate check: Abort if isInitialized already true
  2. Lock markers: Set internal _isCreating = true
  3. Read LocalStorage:
     - parcelData (array)
     - parcelColors (map)
     - markerStates (map) ← NEW: FR-003
  4. Iterate parcels:
     a. Check shouldShowMarker(parcel)
     b. Create marker via createMemoMarker(parcel)
     c. Read markerStates[pnu] → Apply visibility ← NEW: FR-003
     d. Add to markers Map
  5. Unlock markers: Set internal _isCreating = false
  6. Resolve promise

Error Handling:
  - Missing LocalStorage: Use empty defaults
  - Marker creation failure: Log + skip parcel
  - Supabase conflict: Deferred via _isCreating flag
```

**Method**: `createMemoMarker(parcelData)`
```
Input: parcelData object
Output: Marker (naver.maps.Marker)

Behavior:
  1. Validate parcelData (memo, owner_name, address, contact, parcel_name)
  2. Create marker with content (display "M" badge)
  3. Attach click listener (show parcel details)
  4. Return marker

Error Handling:
  - Invalid data: Return null, log warning
  - Map not ready: Throw error (caller handles)
```

**Method**: `shouldShowMarker(parcelData)` (existing, unchanged)
```
Input: parcelData object
Output: boolean

Logic:
  return !!(
    parcelData.memo ||
    parcelData.owner_name ||
    parcelData.owner_address ||
    parcelData.owner_contact ||
    parcelData.parcel_name
  )
```

### 1.3 Functional Requirements Mapping

| FR | Implementation Method | API Impact |
|----|----------------------|-----------|
| FR-001: Initialize flag accuracy | Refactor initialize() + loadAllMemoMarkers() gate | Internal state machine |
| FR-002: Atomic marker creation | Add _isCreating lock, defer Supabase updates | Internal lock mechanism |
| FR-003: Recover markerStates | Read markerStates[pnu] after createMemoMarker() | New LocalStorage access |
| FR-004: Enhanced logging | Add console.log per stage (gate, load, create, recover) | Logging only |

### 1.4 Quickstart Guide (quickstart.md)

#### Testing the Fix

**Setup**:
1. Open parcel-management-system in Chrome
2. Add memo to parcel #940-26 → See marker appear
3. Toggle marker visibility (hide)
4. Observe LocalStorage: `markerStates["940-26"] = false`

**Test Case 1: Simple Refresh**
```
1. Page reload (F5)
2. Observe marker appears ✓ (FR-001, FR-002)
3. Marker is hidden ✓ (FR-003)
```

**Test Case 2: Concurrent Supabase Update**
```
1. Open DevTools → Network tab
2. Simulate slow 3G (DevTools → Throttling)
3. Add memo to parcel
4. Immediately reload before network completes
5. Observe marker appears correctly (FR-002)
```

**Debug**: Check console logs per FR-004
```javascript
// Expected log sequence:
"[MemoMarkerManager] initialize() called"
"[MemoMarkerManager] Waiting for window.map..."
"[MemoMarkerManager] Map loaded, starting loadAllMemoMarkers()"
"[MemoMarkerManager] Loading 3 parcels with markers"
"[MemoMarkerManager] Parcel 940-26: marker created, visibility = false"
"[MemoMarkerManager] All markers loaded, isInitialized = true"
```

---

## Phase 1 Output Summary

### Generated Artifacts
✅ `data-model.md` - State machine + data structures
✅ `api-contract.md` - Method signatures + behavior
✅ `quickstart.md` - Testing guide

### Next Phase
**Phase 2 will generate**:
- `tasks.md` - Implementation task breakdown (likely 8-12 tasks)
- Task sequencing (dependency order)
- Acceptance test cases per task

### Files to Modify
1. `public/js/memo-markers.js` - Main fixes (FR-001, FR-002, FR-003, FR-004)
2. `public/js/app-init.js` - Minimal change (flag initialization)

### Estimated Effort
- **Complexity**: Medium
- **Lines to change**: ~80-120 lines in memo-markers.js
- **Risk**: Low (isolated to marker initialization flow)
- **Test time**: 30-60 minutes (manual + Playwright tests)

---

**Plan Version**: 1.0
**Created**: 2025-10-16
**Status**: ✅ Phase 1 Complete - Ready for Phase 2 (Task Breakdown)
