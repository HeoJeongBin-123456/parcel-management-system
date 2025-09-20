# Critical
- 모든 답변은 반드시 한국어로 말합니다.

# Repository Guidelines

## 프로젝트 구조 및 모듈 구성
- 정적 클라이언트는 `public/`에 위치하며 HTML 엔트리와 기능별 스크립트(`public/js`)를 포함합니다.
- Express 기반 서버는 `server.js`로, `.env`의 `PORT`를 읽어 `/api/vworld` 프록시를 제공합니다.
- Playwright 자동화 스펙은 `tests/contract`, `tests/integration`, `tests/e2e`로 분리되며 실행 산출물은 `test-results/`에 저장됩니다.
- Supabase DDL은 `supabase_schema*.sql`로 버전 관리하며, 진단 및 유틸 스크립트는 `dev-tools/`에 있습니다.

## 빌드·테스트·개발 명령어
- `npm install`: Node 의존성과 Playwright 브라우저를 설치합니다.
- `npm start`: 개발 서버를 `http://localhost:3000`에서 실행하고 VWorld 프록시를 활성화합니다.
- `npm run build`: CI 확인용 더미 빌드이므로 항상 성공해야 합니다.
- `npm test` 또는 `npx playwright test`: 헤드리스 회귀 테스트를 실행하고 실패 시 비디오·트레이스를 `test-results/`에 남깁니다.

## 코딩 스타일 및 네이밍 규칙
- ES2020 이상 문법과 4칸 스페이스, 세미콜론 유지 규칙을 따릅니다.
- 파일은 케밥 케이스(`parcel-manager.js`), 내보낸 심볼은 카멜 케이스, 클래스명은 역할을 분명히 드러내야 합니다.
- 디버그 로그는 이모지와 한국어 설명을 유지하되 필요 시 조건부 출력으로 조정합니다.
- 린트는 `npx eslint public/js/**/*.js`로 확인하고 규칙 예외는 파일 상단 주석에 근거를 명시합니다.

## 테스트 지침
- 모든 테스트 파일은 `*.spec.js` 패턴을 사용하며 기존 폴더 구조를 재사용합니다.
- 테스트 전후 제공 헬퍼로 필지 데이터를 초기화해 환경 간섭을 차단합니다.
- `window.CONFIG` 기본값과 명시적 타임아웃을 이용해 비결정성 요소를 제거합니다.
- 실패 시 `test-results/` 산출물을 첨부해 리뷰어가 트레이스를 재현할 수 있도록 합니다.

## 커밋 및 PR 가이드
- 커밋 메시지는 이모지 + 타입 태그(`fix:`, `style:` 등) + 간결한 한국어 요약 형식을 따릅니다.
- 변경 단위를 좁게 유지하고 관련 이슈는 `Refs #123` 형태로 연결합니다.
- Supabase 스키마를 수정하면 관련 SQL 파일명을 커밋 본문에 명시합니다.
- PR에는 사용자 영향, 외부 API 수정 여부, 수동 테스트 체크리스트, UI 변경 시 전후 스크린샷을 포함합니다.
- Playwright 테스트를 미리 통과시키고 스킵 시 사유와 후속 조치를 기록합니다.

## 보안 및 환경 변수
- `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VWORLD_KEY`, `NAVER_CLIENT_ID`를 저장하고 `process.env`로 접근합니다.
- 공개 키는 `public/js/config-client.js`, `supabase-config.js`에 데모 값으로만 유지하며 실제 키는 커밋하지 않습니다.
- 새 외부 서비스를 추가하면 `README.md`에 요구 환경 변수와 로컬 대체 값을 업데이트합니다.
