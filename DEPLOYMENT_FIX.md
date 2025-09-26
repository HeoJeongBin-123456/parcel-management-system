# 🚨 배포 사이트 에러 수정 가이드

## 문제 요약

배포된 Vercel 사이트에서 3가지 주요 에러 발생:

1. **VWorld API 502 에러** - Supabase Edge Function 프록시 실패
2. **CORS 차단** - Vercel 배포 URL이 허용 목록에 없음
3. **is_colored 컬럼 누락** - Supabase DB 스키마 불일치

---

## 🔧 해결 방법

### 1️⃣ Supabase Edge Function 업데이트 (필수)

**문제**: Vercel 배포 URL이 CORS 허용 목록에 없어서 502 에러 발생

**해결**:
```bash
# 1. Supabase CLI 설치 (없으면)
npm install -g supabase

# 2. Supabase 로그인
supabase login

# 3. 프로젝트 링크
supabase link --project-ref cqfszcbifonxpfasodto

# 4. vworld Function 재배포
supabase functions deploy vworld

# 5. 환경 변수 확인/설정 (선택사항)
supabase secrets list
supabase secrets set VWORLD_KEY=your_key_here
```

**수정된 파일**: `/supabase/functions/vworld/index.ts`
- Vercel URL 추가: `https://parcel-management-system-wheat.vercel.app`

---

### 2️⃣ Supabase DB 스키마 수정 (필수)

**문제**: `is_colored` 컬럼이 없어서 400 에러 발생

**해결**:
1. Supabase Dashboard 접속
2. SQL Editor 열기
3. `/supabase-migration-add-is-colored.sql` 파일 내용 복사
4. 실행

**또는 명령어로:**
```bash
supabase db push --db-url "your_database_url"
```

**마이그레이션 내용**:
- `is_colored` Boolean 컬럼 추가
- 기존 데이터 마이그레이션 (color_info → is_colored)
- 인덱스 추가
- 잘못된 color_type 인덱스 제거

---

### 3️⃣ 검증 (필수)

배포 후 다음을 확인:

```bash
# 1. Edge Function 상태 확인
curl -I https://cqfszcbifonxpfasodto.supabase.co/functions/v1/vworld

# 2. 실제 요청 테스트
curl "https://cqfszcbifonxpfasodto.supabase.co/functions/v1/vworld?geomFilter=POINT(126.845+37.540)&size=1" \
  -H "Origin: https://parcel-management-system-wheat.vercel.app"

# 3. Supabase DB 쿼리 테스트
# Supabase Dashboard > SQL Editor에서:
SELECT is_colored, COUNT(*) FROM parcels GROUP BY is_colored;
```

---

## 📊 에러 로그 분석

### 에러 1: 502 Bad Gateway
```
GET https://cqfszcbifonxpfasodto.supabase.co/functions/v1/vworld 502
```
**원인**: Vercel URL이 ALLOWED_ORIGINS에 없음
**해결**: ✅ vworld/index.ts 수정 완료
**조치 필요**: Supabase Function 재배포

---

### 에러 2: CORS Blocked
```
Access-Control-Allow-Origin header is present on the requested resource
```
**원인**: 직접 VWorld API 호출 시 CORS 차단
**해결**: ✅ 프록시 사용 (위의 502 해결 시 자동 해결됨)

---

### 에러 3: is_colored Column Missing
```
GET /rest/v1/parcels?select=is_colored&limit=1 400 (Bad Request)
Could not find the 'is_colored' column
```
**원인**: Supabase DB에 is_colored 컬럼 없음
**해결**: ✅ 마이그레이션 스크립트 작성 완료
**조치 필요**: SQL 실행

---

## 🎯 우선순위

### 즉시 실행 (높음)
1. ✅ Supabase Edge Function 재배포
2. ✅ is_colored 컬럼 마이그레이션

### 확인 사항 (중간)
3. 배포 사이트에서 필지 클릭 테스트
4. 색칠 기능 동작 확인
5. 에러 로그 재확인

### 선택 사항 (낮음)
6. 추가 API 키 설정
7. 모니터링 설정

---

## 💡 참고사항

### Supabase CLI 설치 문제 시
```bash
# NPM으로 안 되면 직접 다운로드
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

### 환경 변수 설정
```bash
# .env 파일에서 가져오기
supabase secrets set --env-file .env
```

### 로그 확인
```bash
# Supabase Function 로그 실시간 확인
supabase functions logs vworld --tail
```

---

## ✅ 완료 체크리스트

- [ ] Supabase Edge Function 재배포 완료
- [ ] is_colored 컬럼 추가 완료
- [ ] 배포 사이트에서 필지 클릭 테스트
- [ ] 502 에러 해결 확인
- [ ] CORS 에러 해결 확인
- [ ] is_colored 에러 해결 확인

---

## 🆘 문제 지속 시

1. **Supabase Dashboard 확인**
   - Functions > vworld > Logs
   - Database > Tables > parcels 스키마 확인

2. **브라우저 콘솔 확인**
   - F12 > Console 탭
   - Network 탭에서 요청/응답 확인

3. **재배포**
   ```bash
   # Vercel 재배포
   git commit --allow-empty -m "Trigger deployment"
   git push
   ```

---

**생성일**: 2025-09-26
**마지막 업데이트**: 2025-09-26