# 기술 부채 현황 보고서

**생성 일시**: 2025-10-16T06:49:04.611Z
**스캔 대상**: 105 files
**소요 시간**: 0.04초

## 📊 요약

| 심각도 | 개수 |
|--------|------|
| 🔴 Critical | 4 |
| 🟠 High | 19 |
| 🟡 Medium | 0 |
| 🟢 Low | 100 |
| **합계** | **123** |

---

## 🔴 Critical 심각도 (4개)

### FILE-001: File exceeds 500 lines (2926 lines, 5.9x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~2926 |

#### 🎯 개선 계획

**전략**: 필지 관리 기능을 5개 모듈로 분할
- ParcelMap: 지도 렌더링 관련
- ParcelData: 데이터 조회 및 캐싱
- ParcelUI: UI 업데이트 로직
- ParcelSync: 실시간 동기화
- ParcelUtils: 유틸리티 함수

| 속성 | 값 |
|------|-----|
| **예상 소요시간** | 2주 |
| **우선순위** | P1 (높음) |
| **기한** | 2025-11-15 |

**담당자**: TBD

**추진 단계**:
1. 기능별 분석 및 모듈 설계 (2일)
2. ParcelMap 모듈 구현 (3일)
3. ParcelData 모듈 구현 (3일)
4. ParcelUI, ParcelSync, ParcelUtils 구현 (5일)
5. 테스트 및 통합 (2일)

### FILE-002: File exceeds 500 lines (2304 lines, 4.6x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel.backup.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~2304 |

#### 🎯 개선 계획

**전략**: 백업 관련 로직을 BackupManager 클래스로 리팩토링 후 parcel.js에서 제거

| 속성 | 값 |
|------|-----|
| **예상 소요시간** | 1주 |
| **우선순위** | P2 (중간) |
| **기한** | 2025-11-30 |

### FILE-003: File exceeds 500 lines (2044 lines, 4.1x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~2044 |

#### 🎯 개선 계획

**전략**: 클릭 핸들러를 ModeClickHandler 클래스로 분해
- SearchModeHandler: 검색 모드 클릭 처리
- NormalModeHandler: 일반 모드 클릭 처리
- CommonHandler: 공통 클릭 로직

| 속성 | 값 |
|------|-----|
| **예상 소요시간** | 1.5주 |
| **우선순위** | P2 (중간) |
| **기한** | 2025-11-30 |

### FILE-004: File exceeds 500 lines (1660 lines, 3.3x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/app-init.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1660 |

#### 🎯 개선 계획

**전략**: 초기화 로직을 AppBootstrapper, FeatureInitializer 모듈로 분할

| 속성 | 값 |
|------|-----|
| **예상 소요시간** | 1주 |
| **우선순위** | P2 (중간) |
| **기한** | 2025-11-30 |

## 🟠 High 심각도 (19개)

### FILE-001: File exceeds 500 lines (1287 lines, 2.6x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1287 |

#### 🎯 개선 계획

**전략**: 유틸리티 함수를 기능별로 분류
- dateUtils: 날짜/시간 관련
- stringUtils: 문자열 처리
- arrayUtils: 배열 작업
- geoUtils: 지리 좌표 관련

| 속성 | 값 |
|------|-----|
| **예상 소요시간** | 5일 |
| **우선순위** | P2 (중간) |
| **기한** | 2025-11-20 |

### FILE-002: File exceeds 500 lines (797 lines, 1.6x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/unified-backup-manager.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~797 |

### FILE-003: File exceeds 500 lines (1364 lines, 2.7x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-config.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1364 |

### FILE-004: File exceeds 500 lines (624 lines, 1.2x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~624 |

### FILE-005: File exceeds 500 lines (1250 lines, 2.5x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/search.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1250 |

### FILE-006: File exceeds 500 lines (508 lines, 1.0x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/search-mode.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~508 |

### FILE-007: File exceeds 500 lines (521 lines, 1.0x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-sync.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~521 |

### FILE-008: File exceeds 500 lines (1107 lines, 2.2x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-autosave.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1107 |

### FILE-009: File exceeds 500 lines (1117 lines, 2.2x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel-manager.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1117 |

### FILE-010: File exceeds 500 lines (690 lines, 1.4x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-search-handler.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~690 |

### FILE-011: File exceeds 500 lines (668 lines, 1.3x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-manager.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~668 |

### FILE-012: File exceeds 500 lines (1237 lines, 2.5x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/memo-markers.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1237 |

### FILE-013: File exceeds 500 lines (784 lines, 1.6x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/map.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~784 |

### FILE-014: File exceeds 500 lines (775 lines, 1.6x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/map-instances.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~775 |

### FILE-015: File exceeds 500 lines (1016 lines, 2.0x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1016 |

### FILE-016: File exceeds 500 lines (627 lines, 1.3x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/config-client.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~627 |

### FILE-017: File exceeds 500 lines (552 lines, 1.1x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `lib/createExpressApp.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~552 |

### FILE-018: File exceeds 500 lines (646 lines, 1.3x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_complete_checklist.spec.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~646 |

### FILE-019: File exceeds 500 lines (1138 lines, 2.3x limit)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/full-system-regression.spec.js` |
| **위반 원칙** | I. Clean Code Principles |
| **유형** | FILE_SIZE |
| **줄 번호** | 1~1138 |

## 🟢 Low 심각도 (100개)

### NAMING-001: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 4~4 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-002: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 12~12 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-003: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 532~532 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-004: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 706~706 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-005: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 816~816 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-006: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1048~1048 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-007: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1093~1093 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-008: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/unified-backup-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 574~574 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-009: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/unified-backup-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 576~576 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-010: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/unified-backup-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 591~591 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-011: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-config.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1116~1116 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-012: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-config.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1222~1222 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-013: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 260~260 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-014: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 325~325 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-015: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 416~416 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-016: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 445~445 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-017: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/supabase-adapter.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 606~606 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-018: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/search.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 901~901 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-019: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/search.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 945~945 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-020: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-sync.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 16~16 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-021: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-sync.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 206~206 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-022: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-sync.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 240~240 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-023: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-sync.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 260~260 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-024: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-autosave.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 979~979 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-025: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-autosave.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 980~980 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-026: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/realtime-autosave.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1029~1029 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-027: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 344~344 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-028: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 345~345 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-029: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel-validation-utils.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 66~66 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-030: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/parcel-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 145~145 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-031: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 248~248 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-032: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 864~864 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-033: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 929~929 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-034: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1885~1885 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-035: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1894~1894 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-036: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mode-click-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 1908~1908 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-037: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/mobile-handler.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 324~324 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-038: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/memo-markers.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 19~19 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-039: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/memo-markers.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 504~504 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-040: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/map.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 3~3 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-041: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/map.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 4~4 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-042: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 185~185 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-043: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 260~260 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-044: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 390~390 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-045: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 421~421 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-046: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 467~467 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-047: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 516~516 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-048: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 518~518 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-049: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 519~519 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-050: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 529~529 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-051: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 545~545 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-052: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 902~902 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-053: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 939~939 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-054: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 955~955 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-055: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 984~984 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-056: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/data-persistence-manager.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 998~998 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-057: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/config-client.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 50~50 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-058: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `public/js/app-init.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 184~184 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-059: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `lib/createExpressApp.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 176~176 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-060: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/verify-fixes.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 12~12 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-061: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/test-marker-deletion-persistence.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 7~7 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-062: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/test-color-toggle-only.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 7~7 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-063: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/simple-deletion-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 11~11 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-064: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/simple-delete-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 14~14 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-065: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/right-click-delete.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 11~11 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-066: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/realtime-sync-with-login.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 42~42 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-067: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/realtime-sync-with-login.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 50~50 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-068: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/realtime-sync-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 20~20 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-069: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/realtime-sync-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 26~26 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-070: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/quick-performance-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 11~11 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-071: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/production-bugfix.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 18~18 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-072: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/production-bugfix.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 19~19 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-073: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/performance-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 10~10 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-074: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/marker-refresh-fix.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 14~14 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-075: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/marker-refresh-fix.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 130~130 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-076: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/marker-deletion-fix.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 9~9 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-077: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/fixed-deletion-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 15~15 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-078: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/extended-30min-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 25~25 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-079: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e-performance-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 24~24 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-080: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e-performance-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 214~214 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-081: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/deletion-persistence.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 10~10 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-082: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/deletion-debug.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 7~7 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-083: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/delete-test-with-login.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 14~14 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-084: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/comprehensive-validation-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 18~18 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-085: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/comprehensive-e2e-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 19~19 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-086: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/click-mode-colored-parcel.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 7~7 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-087: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/backup-restore-ui-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 147~147 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-088: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/backup-restore-ui-test.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 148~148 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-089: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/analyze-naver-map.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 55~55 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-090: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/integration/test_persistence.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 160~160 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-091: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_complete_checklist.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 366~366 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-092: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_complete_checklist.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 392~392 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-093: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_complete_checklist.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 405~405 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-094: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_bulk_rendering.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 407~407 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-095: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_bulk_rendering.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 460~460 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-096: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/test_bulk_rendering.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 465~465 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-097: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/full-system-regression.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 282~282 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-098: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/full-system-regression.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 283~283 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-099: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/full-system-regression.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 296~296 |
| **권장사항** | Use full words: user, password, message, etc. |

### NAMING-100: Abbreviation detected in naming (usr, pwd, msg, etc.)

| 속성 | 값 |
|------|-----|
| **파일** | `tests/e2e/full-system-regression.spec.js` |
| **위반 원칙** | IV. Clear Naming Conventions |
| **유형** | NAMING |
| **줄 번호** | 297~297 |
| **권장사항** | Use full words: user, password, message, etc. |


---

## 📋 사용 방법

### 기술 부채 항목 추가
```bash
npm run debt:add
```

### 진행 상황 업데이트
```bash
npm run debt:update -- TD-001 --status "In Progress" --note "작업 진행 중"
```

### 통계 조회
```bash
npm run debt:stats
```

### 문서 검증
```bash
npm run validate:debt
```

---

## 📖 헌법 원칙 참고

각 위반 항목은 다음 헌법 원칙 중 하나 이상을 위반합니다:

- **I. Clean Code Principles**: 코드 가독성, 파일 크기, 함수 길이
- **II. No Hard Coding**: API 키, 비밀번호 등의 하드코딩
- **III. Code Reusability**: 중복 로직
- **IV. Clear Naming Conventions**: 변수/함수명 명확성
- **V. Consistent Coding Style**: 일관된 스타일
- **VI. Production Quality Standards**: 에러 처리, 성능 등

---

*이 보고서는 자동 생성되었습니다.*
