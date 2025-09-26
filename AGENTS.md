# Repository Guidelines

## 프로젝트 구조 및 모듈 구성
- 정적 클라이언트는 `public/`에 있으며, `public/index.html`과 기능별 스크립트가 `public/js/`에 모듈 단위로 배치됩니다.
- Express 서버 엔트리는 `server.js`로, `.env`의 `PORT`를 사용해 `/api/vworld` 프록시를 노출하고 필요 시 미들웨어를 추가합니다.
- 테스트 스위트는 `tests/contract`, `tests/integration`, `tests/e2e`로 분리되며, 실행 산출물은 항상 `test-results/`에 생성됩니다.
- 데이터 스키마는 `supabase_schema*.sql` 파일에서 버전 관리되고, 도구성 스크립트는 `dev-tools/`에 집중되어 있습니다.

## 빌드 · 테스트 · 개발 명령어
- `npm install`: Node 의존성과 Playwright 브라우저 바이너리를 한 번에 설치합니다.
- `npm start`: 개발 서버를 `http://localhost:3000`에서 구동하며 VWorld 프록시와 정적 자산을 동시에 제공합니다.
- `npm run build`: CI 건강 검사용 더미 빌드로, 실패하지 않도록 의존성이 최신 상태인지 확인합니다.
- `npm test` / `npx playwright test`: 모든 Playwright 스펙을 헤드리스로 실행하고 실패 시 비디오·트레이스를 `test-results/`에 남깁니다.

## 코딩 스타일 및 네이밍 규칙
- ES2020 이상의 문법을 사용하고 4칸 스페이스와 세미콜론을 유지하며 엄격 모드에서 동작하도록 작성합니다.
- 파일명은 케밥 케이스(`parcel-manager.js`), 내보내는 함수·상수는 카멜 케이스, 클래스명은 역할이 드러나는 명사형을 사용합니다.
- 디버그 로그는 이모지와 한국어 설명을 유지하되 `NODE_ENV !== 'production'` 조건으로 감싸 발생량을 제어합니다.
- 스타일 검증은 `npx eslint public/js/**/*.js`로 수행하고 예외 허용 시 상단에 사유를 주석으로 남깁니다.

## 테스트 지침
- 신규 스펙 파일은 `*.spec.js` 패턴을 따르며 기존 폴더 구성을 재사용합니다.
- 테스트 전후 헬퍼로 필지 데이터를 초기화해 상태 공유를 방지하고, `await resetParcels()` 예제 스니펫을 참고합니다.
- 비결정성 방지를 위해 `window.CONFIG` 기본값과 명시적 타임아웃(`page.waitForTimeout(2000)`)을 조율합니다.
- 실패한 케이스는 `test-results/`에서 비디오·트레이스를 추출해 PR에 첨부합니다.

## 커밋 및 PR 가이드
- 커밋 메시지는 `✨ fix: 지도 줌 복구`처럼 이모지 + 타입 태그 + 간결한 한국어 요약 형식을 지킵니다.
- 변경 단위를 좁게 유지하고 관련 이슈는 `Refs #123` 형식으로 본문에 연결합니다.
- Supabase 스키마 변경 시 커밋 본문에 수정된 `supabase_schema*.sql` 파일명을 명시합니다.
- PR 본문에는 사용자 영향, 외부 API 조정 여부, 수동 테스트 체크리스트, UI 변경 시 전후 스크린샷을 포함합니다.
- Playwright 테스트를 사전에 통과시키고 스킵이 필요하면 사유와 후속 조치를 기록합니다.

## 보안 및 환경 구성
- `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VWORLD_KEY`, `NAVER_CLIENT_ID`를 저장하고 런타임에서는 `process.env`로만 접근합니다.
- `public/js/config-client.js`와 `supabase-config.js`에는 데모 키만 유지하며 실제 키는 절대 커밋하지 않습니다.
- 새 외부 서비스를 도입하면 `README.md`에 요구 변수와 로컬 대체 값을 업데이트합니다.
- 보안 관련 변경은 서버 재기동(`npm start`) 후 프록시 및 CORS 설정이 기대대로 작동하는지 빠르게 점검하십시오.
