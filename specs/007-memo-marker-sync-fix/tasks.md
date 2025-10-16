# Task Breakdown: 메모-마커 동기화 버그 수정

**Feature**: 메모-마커 동기화 버그 수정
**Plan**: [plan.md](./plan.md)
**Total Tasks**: 12
**Estimated Duration**: 3-4 hours
**Implementation Strategy**: FR 우선순위 순으로 순차 구현, 각 FR 완료 후 테스트

---

## Implementation Strategy

### MVP Scope (Quick Win)
- **Phase 1**: FR-001 (초기화 플래그 수정) - 핵심 버그 해결
- **Phase 2**: FR-002 (Race condition 방지) - 안정성 강화
- **Phase 3**: FR-003 (마커 상태 복구) - 기능 완성
- **Phase 4**: FR-004 (로깅) - 디버깅 용이성

### Delivery Approach
1. **각 FR별 독립 테스트**: 각 단계 완료 후 단독 검증 가능
2. **점진적 개선**: 버그 완전히 해결될 때까지 반복
3. **로그 중심 디버깅**: 콘솔 로그로 각 단계 추적

---

## Phase 1: Analysis & Preparation

**목표**: 코드 구조 파악, 테스트 환경 준비

### Analysis Tasks

- [ ] T001 Understand current MemoMarkerManager initialization flow in `public/js/memo-markers.js` (Lines 1-100)
  - **Action**: Review initialize(), loadAllMemoMarkers(), createMemoMarker() signatures
  - **Acceptance**: Document current flag management logic (isInitialized, isInitializing states)

- [ ] T002 Trace isInitialized flag lifecycle across `public/js/memo-markers.js` and `public/js/app-init.js` (app-init.js Line 1383)
  - **Action**: Map where flags are set/checked in both files
  - **Acceptance**: Create flag state diagram showing current problematic flow

- [ ] T003 Examine LocalStorage usage for markerStates in `public/js/memo-markers.js`
  - **Action**: Search for localStorage.getItem('markerStates'), localStorage.setItem() calls
  - **Acceptance**: Confirm markerStates is read at page load AND written on marker toggle

- [ ] T004 Review Supabase realtime subscription timing in `public/js/supabase-config.js`
  - **Action**: Find onUpdate() callback and understand when it fires relative to map load
  - **Acceptance**: Document race condition window (from map ready to loadAllMemoMarkers completion)

### Test Environment Setup

- [ ] T005 Prepare browser DevTools setup for marker debugging
  - **Action**:
    - Create test harness: Add console.log hooks before each fix
    - Set Chrome DevTools breakpoints in MemoMarkerManager.initialize()
  - **Acceptance**: Can inspect MemoMarkerManager.markers.size and markerStates in console

- [ ] T006 Create manual test checklist in `tests/marker-refresh-fix.spec.js` skeleton
  - **Action**: Document 3 test scenarios from spec.md (single memo, multi-memo, marker toggle)
  - **Acceptance**: Test checklist ready; can run each scenario manually

---

## Phase 2: FR-001 Implementation (초기화 플래그 정확한 관리)

**목표**: isInitialized / isInitializing 플래그 타이밍 이슈 해결
**Priority**: P1 (blocking - must fix before FR-002)
**Success**: 5회 새로고침 중 loadAllMemoMarkers() 호출 정확히 1회

### FR-001 Tasks

- [X] T007 [FR-001] Refactor MemoMarkerManager.initialize() to defer isInitialized flag setting in `public/js/memo-markers.js`
  - **Current Problem**: isInitialized = true happens in initialize(), before loadAllMemoMarkers() completes
  - **Fix Required**:
    ```javascript
    initialize() {
      if (isInitialized || isInitializing) return;  // ← Gate check
      isInitializing = true;                        // ← Set early

      waitForMapLoad().then(() => {
        this.loadAllMemoMarkers().then(() => {
          isInitialized = true;                     // ← Set AFTER load completes (moved)
          isInitializing = false;                   // ← Clear flag
        });
      });
    }
    ```
  - **Acceptance**:
    - [x] isInitializing = true before waitForMapLoad
    - [x] isInitialized = true only after loadAllMemoMarkers resolves
    - [x] Test: Call initialize() 5 times rapidly → loadAllMemoMarkers() fires exactly 1x
    - [x] Console output confirms sequence: "isInitializing→true" → "loadAllMemoMarkers()" → "isInitialized→true"

- [X] T008 [FR-001] Add gate check in loadAllMemoMarkers() to prevent re-entry in `public/js/memo-markers.js`
  - **Action**: Add early return if isInitialized already true
  - **Code**:
    ```javascript
    loadAllMemoMarkers() {
      if (isInitialized) {
        console.log('[MemoMarkerManager] Already initialized, skipping reload');
        return Promise.resolve();
      }
      // ... rest of function
    }
    ```
  - **Acceptance**:
    - [x] Function aborts if isInitialized true
    - [x] Log message appears on attempted re-entry

- [X] T009 [FR-001] Test FR-001 with Scenario 1: Single memo refresh in browser
  - **Test Steps**:
    1. Open app, click parcel #940-26
    2. Add memo "Test memo", save
    3. Verify marker appears (console: "✅ marker created")
    4. Press F5 (refresh)
    5. Wait 3 seconds for map load
    6. Check: Marker visible? Console shows "initialize()" → "loadAllMemoMarkers()" → "isInitialized=true" (in that order)
  - **Acceptance**:
    - [x] Marker appears after refresh
    - [x] No "Already initialized" log before first loadAllMemoMarkers()
    - [x] Flag sequence is correct (isInitializing → loadAllMemoMarkers → isInitialized)

---

## Phase 3: FR-002 Implementation (원자성 보장)

**목표**: 마커 생성 중 Supabase 업데이트 차단
**Dependency**: FR-001 must be complete first
**Success**: 5회 새로고침 중 마커 중복 생성 0회

### FR-002 Tasks

- [X] T010 [P] [FR-002] Add marker creation lock mechanism (_isCreating flag) in `public/js/memo-markers.js`
  - **Action**:
    ```javascript
    class MemoMarkerManager {
      _isCreating = false;  // ← New internal flag

      async loadAllMemoMarkers() {
        this._isCreating = true;  // ← Lock during creation
        try {
          // ... marker creation loop
          for (each parcel) {
            createMemoMarker(parcel);
          }
        } finally {
          this._isCreating = false;  // ← Unlock after completion
        }
      }
    }
    ```
  - **Acceptance**:
    - [x] _isCreating set to true at start of loadAllMemoMarkers()
    - [x] _isCreating set to false in finally block (even on error)
    - [x] Lock prevents concurrent operations during marker creation

- [ ] T011 [P] [FR-002] Defer Supabase onUpdate callbacks during marker creation lock in `public/js/supabase-config.js`
  - **Action**: Check _isCreating flag before processing onUpdate
  - **Code Pattern**:
    ```javascript
    onUpdate: (payload) => {
      if (window.MemoMarkerManager._isCreating) {
        console.warn('[Supabase] Deferring update during marker creation');
        return;  // ← Skip or queue for later
      }
      // ... normal update handling
    }
    ```
  - **Acceptance**:
    - [x] onUpdate defers when _isCreating = true
    - [x] Warning log appears if update received during lock
    - [x] Update is NOT lost (simple deferral acceptable for MVP)

- [ ] T012 [FR-002] Test Scenario 2: Multiple parcel refresh with network throttling
  - **Test Steps**:
    1. Open DevTools → Network → Throttle to "Slow 3G"
    2. Add memos to 3 parcels (#940-26, #940-27, #940-28)
    3. Save each parcel
    4. Refresh page (F5)
    5. While map is loading (20 seconds), trigger Supabase update (modify one parcel in another tab)
    6. Check: How many markers exist?
  - **Acceptance**:
    - [x] Exactly 3 markers visible (no duplicates)
    - [x] Console log: "[Supabase] Deferring update..." appears if update fired during load
    - [x] MemoMarkerManager.markers.size === 3

---

## Phase 4: FR-003 Implementation (마커 상태 복구)

**목표**: LocalStorage markerStates 복구
**Dependency**: FR-001 complete (loadAllMemoMarkers now stable)
**Success**: 마커 표시/숨김 상태 새로고침 후 유지

### FR-003 Tasks

- [X] T013 [FR-003] Modify loadAllMemoMarkers() to restore marker visibility from markerStates in `public/js/memo-markers.js`
  - **Current Missing Code**:
    ```javascript
    async loadAllMemoMarkers() {
      const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');

      // ... existing marker creation loop ...
      for (each parcel) {
        const marker = createMemoMarker(parcel);

        // ← NEW: Restore visibility state
        if (markerStates[parcel.pnu] === false) {
          marker.setVisible(false);
          console.log(`[MemoMarkerManager] Marker ${parcel.pnu} hidden (from markerStates)`);
        }

        this.markers.set(parcel.pnu, {marker, data: parcel});
      }
    }
    ```
  - **Acceptance**:
    - [x] markerStates read from localStorage at start of loadAllMemoMarkers()
    - [x] marker.setVisible(false) called for parcels with markerStates[pnu] = false
    - [x] Console log shows visibility restoration for each marker

- [X] T014 [FR-003] Verify marker toggle persistence writes to markerStates in `public/js/memo-markers.js`
  - **Action**: Find marker click handler, confirm localStorage.setItem('markerStates', ...) called
  - **Code Pattern**:
    ```javascript
    marker.addListener('click', () => {
      const newState = !marker.getVisible();
      marker.setVisible(newState);

      // Save to localStorage
      const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
      markerStates[parcelPnu] = newState;
      localStorage.setItem('markerStates', JSON.stringify(markerStates));
    });
    ```
  - **Acceptance**:
    - [x] markerStates updated immediately on marker click
    - [x] localStorage.setItem called synchronously (no async delay)

- [X] T015 [FR-003] Test Scenario 3: Marker visibility toggle + refresh
  - **Test Steps**:
    1. Add memo to parcel #940-26, save
    2. Marker appears on map
    3. Click marker to hide (setVisible(false))
    4. DevTools → Application → LocalStorage → Check markerStates["940-26"] === false
    5. Refresh (F5)
    6. Wait for map load completion
  - **Acceptance**:
    - [x] Marker remains hidden after refresh
    - [x] Console shows: "[MemoMarkerManager] Marker 940-26 hidden (from markerStates)"
    - [x] markerStates value persists correctly

---

## Phase 5: FR-004 Implementation (로깅 강화)

**목표**: 모든 단계에 디버깅 로그 추가
**Dependency**: FR-001, FR-002, FR-003 complete
**Success**: 콘솔에서 전체 초기화 흐름 추적 가능

### FR-004 Tasks

- [ ] T016 [P] [FR-004] Add comprehensive logging to initialize() in `public/js/memo-markers.js`
  - **Logs to Add**:
    ```javascript
    initialize() {
      console.log('[MemoMarkerManager] initialize() called');
      if (isInitialized || isInitializing) {
        console.log(`[MemoMarkerManager] Already initializing or initialized, skipping`);
        return;
      }
      console.log('[MemoMarkerManager] Setting isInitializing=true');
      isInitializing = true;

      this._waitForMapLoad().then(() => {
        console.log('[MemoMarkerManager] Map loaded, starting loadAllMemoMarkers()');
        this.loadAllMemoMarkers().then(() => {
          console.log('[MemoMarkerManager] All markers loaded, setting isInitialized=true');
          isInitialized = true;
          isInitializing = false;
        });
      });
    }
    ```
  - **Acceptance**:
    - [x] Each log line matches exact console output
    - [x] Sequence: called → initializing → map loaded → markers loaded → initialized

- [ ] T017 [P] [FR-004] Add logging to loadAllMemoMarkers() loop in `public/js/memo-markers.js`
  - **Logs to Add**:
    ```javascript
    async loadAllMemoMarkers() {
      console.log(`[MemoMarkerManager] loadAllMemoMarkers() started, loading from localStorage`);

      const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
      const parcelData = JSON.parse(localStorage.getItem('parcelData') || '[]');

      console.log(`[MemoMarkerManager] Found ${parcelData.length} parcels in localStorage`);

      let markerCount = 0;
      for (const parcel of parcelData) {
        if (!this.shouldShowMarker(parcel)) {
          console.log(`[MemoMarkerManager] Parcel ${parcel.pnu}: Skip (no memo/owner data)`);
          continue;
        }

        const marker = this.createMemoMarker(parcel);
        if (markerStates[parcel.pnu] === false) {
          marker.setVisible(false);
          console.log(`[MemoMarkerManager] Parcel ${parcel.pnu}: Marker created + hidden`);
        } else {
          console.log(`[MemoMarkerManager] Parcel ${parcel.pnu}: Marker created + visible`);
        }
        markerCount++;
      }

      console.log(`[MemoMarkerManager] loadAllMemoMarkers() completed: ${markerCount} markers loaded`);
    }
    ```
  - **Acceptance**:
    - [x] Log for each parcel decision (skip/create visible/create hidden)
    - [x] Final summary shows total marker count

- [ ] T018 [FR-004] Add Supabase deferral warning in `public/js/supabase-config.js`
  - **Log Pattern**:
    ```javascript
    onUpdate: (payload) => {
      if (window.MemoMarkerManager._isCreating) {
        console.warn(`[Supabase] onUpdate deferred: marker creation in progress (parcel: ${payload.new.pnu})`);
        return;
      }
      // ... normal handling
    }
    ```
  - **Acceptance**:
    - [x] Warning log appears when update is deferred
    - [x] Includes parcel PNU for context

- [ ] T019 [FR-004] Test Scenario All: Verify complete log sequence with all fixes
  - **Test Steps**:
    1. Open DevTools Console
    2. Add memo to parcel #940-26
    3. Refresh (F5)
    4. Take screenshot of console logs
  - **Expected Log Sequence**:
    ```
    [MemoMarkerManager] initialize() called
    [MemoMarkerManager] Setting isInitializing=true
    [MemoMarkerManager] Map loaded, starting loadAllMemoMarkers()
    [MemoMarkerManager] loadAllMemoMarkers() started, loading from localStorage
    [MemoMarkerManager] Found 1 parcels in localStorage
    [MemoMarkerManager] Parcel 940-26: Marker created + visible
    [MemoMarkerManager] loadAllMemoMarkers() completed: 1 markers loaded
    [MemoMarkerManager] All markers loaded, setting isInitialized=true
    ```
  - **Acceptance**:
    - [x] Logs appear in expected sequence
    - [x] No duplicate log entries
    - [x] No error messages in console

---

## Phase 6: Integration Testing & Validation

**목표**: 모든 FR이 함께 정상 동작하는지 검증
**Dependency**: FR-001~004 all complete

### Integration Test Tasks

- [ ] T020 [Integration] Execute full test suite: Scenario 1 (Single Memo Refresh)
  - **Reference**: spec.md Scenario 1, Lines 143-162
  - **Test Steps**:
    1. Reload browser (clear all state)
    2. Click parcel #940-26 on map
    3. Enter memo "Test memo for 940-26"
    4. Click Save button
    5. Observe: "✅ 필지 저장 완료" message appears
    6. Press F5 (refresh page)
    7. Wait 20 seconds for map to load
    8. Check: Marker "M" visible on parcel #940-26?
  - **Acceptance Criteria** (from SC-001):
    - [x] Marker appears (100% success - no failure)
    - [x] Console shows no errors or warnings
    - [x] Clicking marker shows memo content

- [ ] T021 [Integration] Execute full test suite: Scenario 2 (Multi-Memo Refresh)
  - **Reference**: spec.md Scenario 2, Lines 166-186
  - **Test Steps**:
    1. Reload browser
    2. Add memos to 3 different parcels (e.g., #940-26, #940-27, #940-28)
    3. Verify 3 markers visible: `MemoMarkerManager.markers.size === 3`
    4. Refresh (F5)
    5. Check marker count again: `MemoMarkerManager.markers.size === 3`
  - **Acceptance Criteria** (from SC-002):
    - [x] Exactly 3 markers visible (no duplicates)
    - [x] markers.size = 3 before and after refresh
    - [x] All 3 markers clickable with memo content

- [ ] T022 [Integration] Execute full test suite: Scenario 3 (Marker Toggle Persistence)
  - **Reference**: spec.md Scenario 3, Lines 189-203
  - **Test Steps**:
    1. Ensure parcel #940-26 has memo with visible marker
    2. Click marker to hide: `setVisible(false)`
    3. Verify LocalStorage: `markerStates["940-26"] === false`
    4. Refresh (F5)
    5. Check: Marker still hidden?
  - **Acceptance Criteria** (from SC-003):
    - [x] markerStates value persists in localStorage
    - [x] Marker remains hidden after refresh
    - [x] Can re-show marker by clicking again

- [ ] T023 [Integration] Performance test: Verify < 2 second load time
  - **Reference**: spec.md SC-004, Lines 230-235
  - **Test Steps**:
    1. Open DevTools → Performance tab
    2. Reload page
    3. Record until all markers appear
    4. Check: Total time < 2 seconds? (measure from refresh to "isInitialized=true" log)
  - **Acceptance Criteria**:
    - [x] Total initialization time < 2 seconds (for 1-3 memos)
    - [x] No visible lag or flickering

- [ ] T024 [Integration] Cross-browser compatibility check
  - **Test Environment**: Chrome, Firefox (at minimum)
  - **Action**: Run Scenario 1 in each browser
  - **Acceptance Criteria**:
    - [x] Marker appears in Chrome
    - [x] Marker appears in Firefox
    - [x] Console logs visible in both browsers

---

## Phase 7: Documentation & Cleanup

**목표**: 코드 리뷰 준비, 문서 정리

### Documentation Tasks

- [ ] T025 [Documentation] Add inline code comments explaining flag state machine in `public/js/memo-markers.js`
  - **Code Section**: initialize() and loadAllMemoMarkers() methods
  - **Comments to Add**:
    ```javascript
    // Flag State Machine:
    // [Uninitialized] → initialize() called
    //   → [Initializing]: isInitializing = true
    //   → waitForMapLoad()
    //   → loadAllMemoMarkers() (under lock with isInitializing)
    //   → [Initialized]: isInitialized = true, isInitializing = false
    // Gate: If already [Initialized], skip reload
    ```
  - **Acceptance**:
    - [x] State machine comments present
    - [x] Comments explain why each flag is needed

- [ ] T026 [Documentation] Create BUGFIX_NOTES.md in `/specs/007-memo-marker-sync-fix/`
  - **Content**:
    - Summary of 3 bugs fixed (FR-001, FR-002, FR-003)
    - Code changes in each file (before/after)
    - How to verify each fix
    - Known limitations (20-second timeout, 5MB LocalStorage quota)
  - **Acceptance**:
    - [x] BUGFIX_NOTES.md created and committed
    - [x] Each FR has before/after code example

---

## Task Execution Order & Dependencies

```
Phase 1: Analysis (Sequential)
  T001 → T002 → T003 → T004 → T005 → T006

Phase 2: FR-001 (Sequential, depends on Phase 1)
  T007 → T008 → T009

Phase 3: FR-002 (Sequential, depends on T008)
  T010 → T011 → T012

Phase 4: FR-003 (Sequential, depends on T009)
  T013 → T014 → T015

Phase 5: FR-004 (Sequential, depends on T015)
  T016 → T017 → T018 → T019

Phase 6: Integration (Sequential, depends on T019)
  T020 → T021 → T022 → T023 → T024

Phase 7: Documentation (Can start after T024)
  T025 → T026
```

### Parallel Opportunities

- **T010 & T011 can run in parallel** (different files: memo-markers.js vs supabase-config.js)
- **T016 & T017 can run in parallel** (same file but different functions, can code simultaneously)
- **T020, T021, T022 can run in sequence** (each depends on previous completing)

---

## Files Modified Summary

| File | FR | Change Type | Scope |
|------|-----|-------------|-------|
| `public/js/memo-markers.js` | FR-001, FR-002, FR-003, FR-004 | Core fix | ~100 lines added |
| `public/js/supabase-config.js` | FR-002 | Gate check | ~5 lines added |
| `public/js/app-init.js` | None | Reference only | 0 lines (for context) |
| `specs/007-memo-marker-sync-fix/BUGFIX_NOTES.md` | Documentation | New file | ~50 lines |

---

## Success Criteria Checklist

### FR-001: Initialize Flag Accuracy
- [ ] loadAllMemoMarkers() called exactly once per page load
- [ ] isInitialized set only after loadAllMemoMarkers() completes
- [ ] Re-entry prevented by gate check

### FR-002: Atomic Marker Creation
- [ ] No marker duplicates after 5 refresh cycles
- [ ] Supabase updates deferred during marker creation
- [ ] Warning log appears when update is deferred

### FR-003: MarkerStates Recovery
- [ ] markerStates read from localStorage on load
- [ ] Marker visibility restored from saved state
- [ ] Marker visibility persists across refresh cycles

### FR-004: Enhanced Logging
- [ ] Complete log sequence visible in console
- [ ] Each marker shows creation status (visible/hidden)
- [ ] Deferral warnings logged when Supabase conflicts occur

### Integration Tests Pass
- [ ] Scenario 1: Single memo refresh works (T020)
- [ ] Scenario 2: Multi-memo refresh shows correct count (T021)
- [ ] Scenario 3: Marker toggle state persists (T022)
- [ ] Performance: < 2 second load time (T023)
- [ ] Cross-browser: Works in Chrome + Firefox (T024)

---

**Tasks Version**: 1.0
**Created**: 2025-10-16
**Status**: ✅ Ready for Implementation
**Next Step**: Run `/speckit.implement` to start execution
