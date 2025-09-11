# 🔧 새로고침 시 필지 지워지는 문제 해결 가이드

## 📋 문제 상황
- 필지를 클릭해서 색칠한 후 새로고침하면 모든 필지가 사라짐
- Supabase 연동을 했는데도 데이터가 유지되지 않음

## 🔍 원인 분석
**핵심 원인**: Supabase에 `parcels` 테이블이 존재하지 않음
- 콘솔에서 확인되는 오류: `❌ Supabase 저장 실패: Could not find the 'c...`
- 애플리케이션은 Supabase 테이블을 찾을 수 없어서 localStorage로만 저장
- 새로고침 시 데이터를 Supabase에서 불러오려 하지만 테이블이 없어 실패

## ✅ 해결 방법

### 1단계: Supabase 테이블 생성
1. **Supabase Dashboard 접속**
   - 브라우저에서 https://supabase.com/dashboard 접속
   - 프로젝트 로그인

2. **SQL Editor에서 테이블 생성**
   - 좌측 메뉴에서 "SQL Editor" 클릭
   - `supabase-parcels-table.sql` 파일의 내용을 복사해서 실행
   
3. **실행 확인**
   ```sql
   SELECT '✅ parcels 테이블 생성 완료!' as status;
   ```

### 2단계: 애플리케이션 재시작
1. 서버 재시작 (이미 실행 중이면 Ctrl+C 후 다시 실행)
   ```bash
   node server.js
   ```

2. 브라우저에서 페이지 새로고침

### 3단계: 연결 상태 확인
- 페이지 상단에 "🟢 Supabase 연결됨" 표시 확인
- 콘솔에서 "✅ Supabase 연결 및 테이블 확인 완료" 메시지 확인

## 🧪 테스트 방법
1. 지도에서 필지 클릭 → 빨간색으로 색칠 확인
2. F5 또는 Ctrl+R로 페이지 새로고침
3. **색칠된 필지가 그대로 유지되는지 확인** ✅

## 📁 수정된 파일들

### 새로 생성된 파일
- `supabase-parcels-table.sql` - Supabase 테이블 생성 스크립트
- `public/js/app-init.js` - 앱 초기화 및 데이터 로딩 로직

### 수정된 파일
- `public/js/supabase-config.js` - 연결 상태 확인 및 테이블 검증 로직 추가
- `public/index.html` - app-init.js 스크립트 추가

## 🔧 주요 개선사항

### 1. 테이블 존재 여부 자동 확인
```javascript
async checkAndCreateTables() {
    // parcels 테이블 존재 확인
    // 없으면 명확한 오류 메시지 출력
}
```

### 2. 연결 상태 UI 표시
- 🟢 Supabase 연결됨
- 🔴 오프라인 모드

### 3. 자동 데이터 복원
- 앱 시작 시 Supabase에서 저장된 필지 자동 로드
- localStorage와 Supabase 데이터 동기화

### 4. 에러 핸들링 강화
- Supabase 연결 실패 시 localStorage 백업 사용
- 재시도 로직으로 안정성 향상

## 🚨 주의사항

1. **SQL 스크립트 실행 필수**
   - `supabase-parcels-table.sql` 반드시 실행해야 함
   - 테이블이 없으면 여전히 새로고침 시 데이터 손실됨

2. **권한 확인**
   - Supabase 프로젝트 관리자 권한 필요
   - RLS(Row Level Security) 정책 적용됨

3. **브라우저 캐시**
   - 강제 새로고침 (Ctrl+Shift+R) 권장
   - 캐시된 구버전 스크립트 방지

## 🎯 결과
- ✅ 필지 색칠 후 새로고침해도 데이터 유지
- ✅ Supabase와 localStorage 자동 동기화
- ✅ 연결 상태 실시간 모니터링
- ✅ 오프라인에서도 기본 기능 동작

---

**최종 확인**: 필지를 클릭 → 색칠 → 새로고침 → 필지가 그대로 유지되면 성공! 🎉