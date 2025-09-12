# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

앞으로 모든 언어를 한국말로 말하라.

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

## 핵심 아키텍처

### 전체 시스템 구조
이 프로젝트는 **네이버 지도 기반 필지 관리 시스템**으로 다음과 같은 3-tier 아키텍처를 가집니다:

```
Frontend (Vanilla JS) → Express Proxy Server → External APIs
           ↓
    LocalStorage ← → Supabase DB → Google Sheets
```

### 데이터 플로우
1. **필지 조회**: 사용자 클릭 → VWorld API (서버 프록시 → JSONP 백업) → 필지 데이터 파싱
2. **데이터 저장**: UI 입력 → Supabase 저장 → LocalStorage 백업
3. **실시간 동기화**: Supabase 실시간 구독 → UI 자동 업데이트
4. **백업 체인**: LocalStorage ↔ Supabase ↔ Google Sheets

### 핵심 모듈 구조

**parcel.js (59KB)**: 메인 비즈니스 로직 - 과도하게 비대화되어 있음
- VWorld API 호출 및 필지 데이터 처리
- 지도 폴리곤 렌더링 및 상호작용
- 필지 정보 UI 업데이트

**SupabaseManager**: 실시간 데이터베이스 관리
- 무한루프 방지 로직 (`_loadCallCount` 제한)
- 지수적 백오프 재시도 메커니즘
- 오프라인 모드 자동 전환

**ParcelManager**: 필지 목록 및 필터링 관리
- 그리드/리스트 뷰 모드
- 색상별 필터링 및 검색
- 다중 선택 및 배치 작업

**BackupManager**: 자동 백업 시스템
- 일일 Supabase 백업
- 월간 Google Sheets 백업
- 백업 히스토리 관리

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

### 디버깅
- `RightClickDebugger.showLogs()`로 실시간 로그 확인
- 브라우저 개발자 도구에서 컬러 코딩된 로그 제공
- Supabase 연결 상태는 UI 우상단에서 확인

### 데이터 백업
- 로컬 개발시에도 자동 백업 시스템 작동
- 백업 설정은 `BackupManager`에서 관리
- 데이터 손실 방지를 위해 다중 백업 레이어 유지