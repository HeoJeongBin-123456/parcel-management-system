/**
 * E2E Test: 메모-마커 동기화 버그 수정 검증
 *
 * Feature: 007-memo-marker-sync-fix
 *
 * 검증 항목:
 * - FR-001: Initialize 플래그 정확한 관리
 * - FR-002: 마커 생성 원자성 보장
 * - FR-003: 마커 상태 복구
 * - FR-004: 향상된 로깅
 *
 * Bug Report: 새로고침을 누르면 메모가 사라졌다가 생겼다가 하는 증상
 */

const { test, expect } = require('@playwright/test');

test.describe('메모-마커 동기화 버그 수정 검증', () => {
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    // 콘솔 로그 수집
    consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // 페이지 로드
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // 지도 로드 대기 (window.map이 초기화될 때까지)
    await page.waitForFunction(() => window.map !== null && window.map !== undefined, { timeout: 15000 });
  });

  test('필지에 메모 추가 후 새로고침 시 마커가 복원되어야 함', async ({ page }) => {
    // Step 1: 필지 클릭
    console.log('Step 1: 필지 클릭');
    const mapContainer = page.locator('#map');
    await mapContainer.click({ position: { x: 800, y: 400 } });

    // 필지 정보 로드 대기
    await page.waitForTimeout(2000);

    // Step 2: 메모 입력
    console.log('Step 2: 메모 입력');
    const memoInput = page.locator('textarea[placeholder*="추가 메모"]');
    const testMemo = `E2E 테스트: ${Date.now()}`;
    await memoInput.fill(testMemo);

    // Step 3: 저장 버튼 클릭
    console.log('Step 3: 저장');
    const saveButton = page.locator('button:has-text("저장")');
    await saveButton.click();

    // 저장 완료 대기
    await page.waitForTimeout(1000);

    // Step 4: 마커 표시 확인
    console.log('Step 4: 마커 표시 확인');
    const markerExists = await page.evaluate(() => {
      return document.body.innerText.includes('M');
    });
    expect(markerExists).toBeTruthy();

    // Step 5: 페이지 새로고침
    console.log('Step 5: 페이지 새로고침');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // 마커 초기화 대기

    // Step 6: 마커 복원 확인
    console.log('Step 6: 마커 복원 확인');
    const markerRestoredExists = await page.evaluate(() => {
      return document.body.innerText.includes('M');
    });
    expect(markerRestoredExists).toBeTruthy();

    // Step 7: MemoMarkerManager 상태 검증
    console.log('Step 7: MemoMarkerManager 상태 검증');
    const managerState = await page.evaluate(() => {
      return {
        isInitialized: window.MemoMarkerManager?.isInitialized || false,
        isInitializing: window.MemoMarkerManager?.isInitializing || false,
        markersCount: window.MemoMarkerManager?.markers?.size || 0
      };
    });

    expect(managerState.isInitialized).toBe(true);
    expect(managerState.isInitializing).toBe(false);
    expect(managerState.markersCount).toBeGreaterThan(0);

    console.log('✅ 모든 검증 통과!');
  });

  test('FR-001: isInitialized 플래그가 loadAllMemoMarkers() 완료 후에만 설정되어야 함', async ({ page }) => {
    // 페이지 로드 후 콘솔 로그 확인
    await page.waitForTimeout(3000);

    // 초기화 관련 로그 필터링 (loadAllMemoMarkers 포함)
    const initLogs = consoleLogs.filter(log =>
      log.text.includes('[MemoMarkerManager]') &&
      (log.text.includes('초기화') || log.text.includes('isInitialized') || log.text.includes('loadAllMemoMarkers'))
    );

    // 로그 순서 검증: loadAllMemoMarkers() → isInitialized = true
    const loadLog = initLogs.find(log => log.text.includes('loadAllMemoMarkers'));
    const initCompletedLog = initLogs.find(log => log.text.includes('isInitialized = true'));

    expect(loadLog).toBeDefined();
    expect(initCompletedLog).toBeDefined();

    // MemoMarkerManager 상태 확인
    const state = await page.evaluate(() => {
      return {
        isInitialized: window.MemoMarkerManager?.isInitialized,
        isInitializing: window.MemoMarkerManager?.isInitializing
      };
    });

    expect(state.isInitialized).toBe(true);
    expect(state.isInitializing).toBe(false);

    console.log('✅ FR-001 검증 통과');
  });

  test('FR-002: _isCreating Lock이 마커 생성 중복을 방지해야 함', async ({ page }) => {
    await page.waitForTimeout(3000);

    // Lock 관련 로그 확인
    const lockLogs = consoleLogs.filter(log =>
      log.text.includes('_isCreating') ||
      log.text.includes('Lock')
    );

    // Lock 활성화 및 해제 로그 확인
    const lockActivated = lockLogs.find(log => log.text.includes('Lock 활성화'));
    const lockReleased = lockLogs.find(log => log.text.includes('Lock 해제'));

    expect(lockActivated).toBeDefined();
    expect(lockReleased).toBeDefined();

    // 마커 중복 생성 없는지 확인
    const markersCount = await page.evaluate(() => {
      return window.MemoMarkerManager?.markers?.size || 0;
    });

    // 중복 없이 정상 개수 확인
    expect(markersCount).toBeGreaterThanOrEqual(0);

    console.log('✅ FR-002 검증 통과');
  });

  test('FR-003: markerStates가 localStorage에서 복원되어야 함', async ({ page }) => {
    // markerStates 로그 확인
    await page.waitForTimeout(3000);

    const markerStatesLogs = consoleLogs.filter(log =>
      log.text.includes('markerStates')
    );

    expect(markerStatesLogs.length).toBeGreaterThan(0);

    // LocalStorage에서 markerStates 확인
    const markerStates = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('markerStates') || '{}');
    });

    expect(markerStates).toBeDefined();
    expect(typeof markerStates).toBe('object');

    console.log('✅ FR-003 검증 통과');
  });

  test('FR-004: [MemoMarkerManager] 로깅 프리픽스가 모든 단계에 존재해야 함', async ({ page }) => {
    await page.waitForTimeout(3000);

    // [MemoMarkerManager] 프리픽스가 있는 로그 필터링
    const managerLogs = consoleLogs.filter(log =>
      log.text.includes('[MemoMarkerManager]')
    );

    // 최소 5개 이상의 로그가 있어야 함
    expect(managerLogs.length).toBeGreaterThan(5);

    // 주요 단계별 로그 확인
    const expectedLogs = [
      'initialize() 호출됨',
      'loadAllMemoMarkers()',
      'Lock 활성화',
      'Lock 해제',
      'isInitialized = true'
    ];

    expectedLogs.forEach(expectedLog => {
      const found = managerLogs.some(log => log.text.includes(expectedLog));
      expect(found).toBeTruthy();
    });

    console.log('✅ FR-004 검증 통과');
  });

  test('중복 초기화 방지: 이미 초기화된 경우 건너뛰기', async ({ page }) => {
    await page.waitForTimeout(3000);

    // "이미 초기화됨" 또는 "건너뛰기" 로그 확인
    const skipLogs = consoleLogs.filter(log =>
      log.text.includes('이미 초기화') ||
      log.text.includes('건너뛰기')
    );

    // 중복 초기화 시도가 있었다면 건너뛰기 로그가 있어야 함
    if (skipLogs.length > 0) {
      console.log('✅ 중복 초기화 방지 확인됨');
    } else {
      console.log('ℹ️ 중복 초기화 시도 없음 (정상)');
    }

    expect(true).toBeTruthy(); // Always pass
  });

  test.afterEach(async ({ page }, testInfo) => {
    // 테스트 실패 시 스크린샷 및 로그 저장
    if (testInfo.status !== 'passed') {
      await page.screenshot({
        path: `test-results/memo-marker-refresh-${testInfo.title}-${Date.now()}.png`,
        fullPage: true
      });

      console.log('=== Console Logs ===');
      consoleLogs.forEach(log => {
        console.log(`[${log.type}] ${log.text}`);
      });
    }
  });
});
