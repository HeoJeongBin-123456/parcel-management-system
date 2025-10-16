# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

앞으로 모든 언어를 한국말로 말하라.

## 🚨 필수 테스트 규칙 (CRITICAL)

### 모든 구현 완료 시 반드시 수행해야 할 사항:
1. **Playwright로 스크린샷 확인** - 실제 화면이 예상대로 동작하는지 확인
2. **콘솔 로그 확인** - 에러나 경고 메시지 체크
3. **2중 테스트 검증** - 자동 테스트와 수동 확인 모두 수행
4. **절대 로그만 보고 판단하지 말 것** - 실제 동작을 눈으로 확인

### 테스트 체크리스트:
- [ ] Playwright 테스트 작성
- [ ] 스크린샷 캡처 및 확인
- [ ] 콘솔 로그 분석
- [ ] 실제 UI 동작 확인
- [ ] 에러 케이스 테스트

### Playwright 테스트 템플릿:
```javascript
test('기능 테스트', async ({ page }) => {
    // 1. 페이지 로드
    await page.goto('http://localhost:4000');

    // 2. 콘솔 로그 캡처
    page.on('console', msg => console.log('[브라우저]:', msg.text()));

    // 3. 동작 수행
    // ...

    // 4. 스크린샷 캡처
    await page.screenshot({ path: 'test-result.png', fullPage: true });

    // 5. 결과 검증
    // ...
});
```

## 개발 명령어

### 서버 실행
```bash
# 개발 서버 실행 (포트 3000)
node server.js

# 또는 정적 파일 서버 (포트 8000)
npx http-server public -p 8000
```

### 테스트
```bash
# Playwright 테스트 실행
npm test

# 개별 테스트 파일 실행
npx playwright test tests/specific-test.spec.js
```

### 린팅
프로젝트는 ESLint가 설정되어 있지만 실행 스크립트가 없으므로 수동으로 실행:
```bash
npx eslint public/js/*.js
```

## 핵심 아키텍처 ⚠️ 중요 - 2025년 9월 14일 기준

### 현재 저장소 구조 (필독!)
**⚠️ 중요: 2개 저장소만 사용**
1. **Supabase** - 메인 저장소 (실시간 동기화)
2. **LocalStorage** - 로컬 백업 (오프라인 대비)

**❌ 사용하지 않음:**
- SessionStorage
- IndexedDB
- DataPersistenceManager (HTML에서 비활성화됨, index.html:297-298 주석처리)

### 전체 시스템 구조
이 프로젝트는 **네이버 지도 기반 필지 관리 시스템**으로 단순화된 2-tier 아키텍처를 사용합니다:

```
Frontend (Vanilla JS) → Express Proxy Server → External APIs
           ↓
    LocalStorage ← → Supabase DB
```

### 데이터 플로우
1. **필지 조회**: 사용자 클릭 → VWorld API (서버 프록시 → JSONP 백업) → 필지 데이터 파싱
2. **데이터 저장**: UI 입력 → Supabase 저장 + LocalStorage 백업
3. **실시간 동기화**: Supabase 실시간 구독 → UI 자동 업데이트
4. **데이터 삭제**: Supabase + LocalStorage 동시 삭제

### 핵심 모듈 구조

**parcel.js (59KB)**: 메인 비즈니스 로직 - 과도하게 비대화되어 있음
- VWorld API 호출 및 필지 데이터 처리
- 지도 폴리곤 렌더링 및 상호작용
- 필지 정보 UI 업데이트
- **[NEW] 색상 토글 기능 (같은 색상 재클릭 시 삭제)**
- **[NEW] 완전 삭제 로직 (Supabase + LocalStorage)**

**SupabaseManager**: 실시간 데이터베이스 관리
- 무한루프 방지 로직 (`_loadCallCount` 제한)
- 지수적 백오프 재시도 메커니즘
- 오프라인 모드 자동 전환
- **[NEW] deleteParcel() 메서드 추가**

**ParcelManager**: 필지 목록 및 필터링 관리
- 그리드/리스트 뷰 모드
- 색상별 필터링 및 검색
- 다중 선택 및 배치 작업

**BackupManager**: 자동 백업 시스템
- 일일 Supabase 백업
- 월간 Google Sheets 백업
- 백업 히스토리 관리

**memo-markers.js**: 마커 관리 시스템
- 확장된 마커 생성 조건 (지번, 소유자명, 주소, 연락처, 메모)
- 조건 기반 마커 표시/숨김
- 마커 상태 영속성

### API 통합 패턴

**VWorld API 안정성 전략**:
```javascript
// 1차: Express 서버 프록시 (CORS 우회)
await getParcelInfoViaProxy(lat, lng)
// 2차: JSONP 백업 (서버 실패시)
await getParcelInfoViaJSONP(lat, lng, apiKey)
```

**Google OAuth & Sheets 연동**:
- 개발환경에서는 인증 건너뛰기
- 토큰 만료 자동 감지 및 갱신
- Sheets API를 통한 데이터 내보내기

### 상태 관리 패턴

**전역 상태** (개선 필요):
- `parcelsData`: 모든 필지 정보 배열
- `selectedParcel`: 현재 선택된 필지
- `currentColor`: 선택된 색상
- 다수의 전역 변수들 (`streetLayer`, `cadastralLayer` 등)

**LocalStorage 키**:
- `parcelData`: 필지 정보
- `parcelColors`: 필지별 색상 상태 맵
- `markerStates`: 마커 표시 상태
- `backup_settings`: 백업 설정
- `user_session`: 사용자 세션 ID

### 주요 설계 패턴

**방어적 프로그래밍**:
- API 호출 실패시 자동 폴백
- 무한루프 방지 메커니즘 (시도 횟수 제한)
- 데이터 손실 방지를 위한 다중 백업

**에러 회복성**:
- Supabase 연결 실패시 로컬 저장소로 자동 전환
- API 키 순환 시도 (여러 키 자동 테스트)
- 실시간 디버깅 시스템 (`RightClickDebugger`)

## 환경 설정

### 필수 환경 변수 (.env)
```
SUPABASE_URL=https://cqfszcbifonxpfasodto.supabase.co
SUPABASE_ANON_KEY=[키값]
VWORLD_API_KEY=E5B1657B-9B6F-3A4B-91EF-98512BE931A1
GOOGLE_CLIENT_ID=[Google OAuth 클라이언트 ID]
```

### Supabase 테이블 구조
`parcels` 테이블이 반드시 존재해야 함:
- `id`: UUID 기본키
- `lat`, `lng`: 위치 좌표
- `parcel_name`: 필지명
- `memo`: 메모
- `is_colored`: 색상 적용 여부
- `created_at`, `updated_at`: 타임스탬프

## 최근 변경사항 (2025-01-14)

### 저장 시스템 단순화 ⭐
- **기존**: 5단계 다중 저장 (LocalStorage, SessionStorage, IndexedDB, Supabase, 스냅샷)
- **현재**: 2단계만 사용 (Supabase + LocalStorage)
- **이유**: 실시간 공유 필수 + 시스템 복잡도 감소
- **중요**: `data-persistence-manager.js` 비활성화됨 (index.html:297-298)

### 색상 영속성 개선
- 색상 선택 즉시 자동 저장 (저장 버튼 불필요)
- 새로고침 후에도 색상 상태 유지
- LocalStorage와 Supabase 이중 백업

### 마커 생성 조건 확장
- 기존: 메모만 있을 때 마커 표시
- 개선: 지번, 소유자명, 소유자 주소, 연락처, 메모 중 하나라도 있으면 마커 표시
- 모든 정보 삭제 시 마커 자동 제거

### 색상 토글 기능 추가 🎨
- **같은 색상 재클릭 시**: 색상 제거 (토글)
- **삭제 시 처리**:
  - 삭제 확인 알림 표시
  - 폴리곤 테두리도 함께 제거 (strokeColor: transparent)
  - 필지 정보, 마커 모두 삭제
  - Supabase + LocalStorage에서 동시 삭제

### 버튼 변경
- "현재 필지 삭제" → "필지 정보 초기화"
- 초기화 시: 색상 유지, 정보만 삭제

## 필지 삭제 로직 (중요!)

### 완전 삭제 시 (applyColorToParcel - 같은 색상 재클릭)
```javascript
// 1. Supabase에서 삭제
await window.SupabaseManager.deleteParcel(pnu);

// 2. LocalStorage에서 삭제
const savedData = JSON.parse(localStorage.getItem('parcelData') || '[]');
const updatedData = savedData.filter(item => item.pnu !== pnu);
localStorage.setItem('parcelData', JSON.stringify(updatedData));

// 3. 색상 정보 삭제
const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
delete parcelColors[pnu];
localStorage.setItem('parcelColors', JSON.stringify(parcelColors));

// 4. 마커 상태 삭제
const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
delete markerStates[pnu];
localStorage.setItem('markerStates', JSON.stringify(markerStates));

// 5. 지도에서 마커 제거
if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
    const markerInfo = window.MemoMarkerManager.markers.get(pnu);
    if (markerInfo && markerInfo.marker) {
        markerInfo.marker.setMap(null);
        window.MemoMarkerManager.markers.delete(pnu);
    }
}

// 6. clickParcels Map에서 제거
if (window.clickParcels) {
    window.clickParcels.delete(pnu);
}
```

### Supabase deleteParcel 메서드
```javascript
async deleteParcel(pnu) {
    // parcels 테이블에서 삭제
    await this.supabase.from('parcels').delete().or(`pnu.eq.${pnu},id.eq.${pnu}`);

    // parcel_polygons 테이블에서도 삭제
    await this.supabase.from('parcel_polygons').delete().eq('parcel_id', pnu);
}
```

## 알려진 제한사항

### 성능 이슈
- `parcel.js` 파일이 59KB로 과도하게 비대함
- 대량 필지 렌더링시 UI 블로킹 가능성
- 실시간 동기화 과부하 시 쿨다운 적용됨

### 보안 고려사항
- API 키가 클라이언트 코드에 하드코딩됨 (개선 필요)
- CORS 우회를 위한 서버 프록시 사용

### 브라우저 호환성
- Chrome/Firefox/Safari/Edge 지원
- IE는 지원하지 않음 (ES6+ 사용)

## 개발시 주의사항

### 코드 수정시
1. `parcel.js` 수정시 파일 크기 증가 주의
2. 실시간 동기화 로직 수정시 무한루프 방지 확인
3. API 호출 추가시 에러 핸들링 및 폴백 로직 포함
4. **중요**: 모든 저장/삭제는 Supabase + LocalStorage 2곳에서만 처리

### 디버깅
- `RightClickDebugger.showLogs()`로 실시간 로그 확인
- 브라우저 개발자 도구에서 컬러 코딩된 로그 제공
- Supabase 연결 상태는 UI 우상단에서 확인

### 데이터 백업
- 로컬 개발시에도 자동 백업 시스템 작동
- 백업 설정은 `BackupManager`에서 관리
- 실시간 공유를 위해 Supabase 우선 사용
