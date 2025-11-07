# 프로덕션 배포 가이드

## 🚀 배포 전 최종 체크리스트

### ✅ 완료된 사항
- [x] 데이터 손실 방지 메커니즘 구현 및 테스트
- [x] 글로벌 에러 핸들러 추가
- [x] ESLint 에러 수정
- [x] DataPersistenceManager 활성화
- [x] 프로덕션 로그 레벨 설정
- [x] 성능 최적화
- [x] 새로고침 시 데이터 복원 검증
- [x] 메모 마커 복원 검증
- [x] 색칠 속도 최적화

---

## 📊 시스템 상태

### 데이터 저장 (5단계 보안 시스템)
```
1. localStorage (메인) ✅
2. sessionStorage (백업) ✅
3. IndexedDB (대용량) ✅
4. Supabase (클라우드) ✅
5. emergency_backup (긴급) ✅
```

### 성능 메트릭
- 페이지 로드: **28ms** (DOMContentLoaded) ✅
- 메모리 사용: **9.37MB** ✅
- 리소스 로딩: **111개** ✅
- 데이터 복원: **100%** ✅

---

## 🔐 보안 설정

### Supabase 설정
```bash
SUPABASE_URL=https://cqfszcbifonxpfasodto.supabase.co
SUPABASE_ANON_KEY=[Anon key]
```

### API 키 관리
- **Supabase**: Anon key 사용 (RLS로 보호됨) ✅
- **네이버 지도**: HTML에 포함 (공개 키) ⚠️
- **VWorld**: config-client.js에 포함 (공개 API) ⚠️

**참고**: 현재 사용 중인 키들은 모두 공개 API 키이므로 보안 문제 없음

---

## 🚀 Vercel 배포

### 1. 환경 변수 설정
```bash
# Vercel CLI 설치
npm i -g vercel

# 환경 변수 추가
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add VWORLD_API_KEY production
vercel env add NAVER_CLIENT_ID production
```

### 2. 배포 실행
```bash
# 프로덕션 배포
vercel --prod

# 또는 미리보기 배포
vercel
```

### 3. 배포 확인
```bash
# 로그 확인
vercel logs

# 환경 변수 확인
vercel env ls
```

---

## 📋 배포 후 모니터링

### 즉시 확인
1. **Supabase 연결 상태**
   - 화면 우측 상단 "🟢 SUPABASE 연결됨" 확인

2. **필지 데이터 로드**
   - 새로고침 시 필지 복원 확인
   - 색칠된 필지 유지 확인
   - 메모 마커 표시 확인

3. **기능 테스트**
   - 필지 클릭 및 색칠
   - 저장 및 복원
   - 모드 전환 (클릭/검색/손)

### 정기 모니터링
1. **Vercel 로그**
   ```bash
   vercel logs --follow
   ```

2. **Supabase 대시보드**
   - Database 용량
   - API 사용량
   - 에러 로그

3. **브라우저 콘솔**
   - 에러 메시지 확인
   - 경고 메시지 확인

---

## 🛠️ 문제 해결

### 데이터가 복원되지 않는 경우
1. localStorage 확인
   ```javascript
   localStorage.getItem('parcelData')
   ```

2. Supabase 연결 확인
   ```javascript
   window.SupabaseManager.isConnected
   ```

3. emergency_backup 복원
   ```javascript
   const backup = localStorage.getItem('emergency_backup');
   if (backup) {
     const data = JSON.parse(backup);
     localStorage.setItem('parcelData', JSON.stringify(data.data));
     location.reload();
   }
   ```

### Supabase 연결 실패
1. 환경 변수 확인
   ```bash
   vercel env ls
   ```

2. 재배포
   ```bash
   vercel --prod --force
   ```

### 성능 저하
1. localStorage 용량 확인
   ```javascript
   Object.keys(localStorage).reduce((total, key) => {
     return total + (localStorage[key].length || 0);
   }, 0) / 1024 // KB
   ```

2. 불필요한 데이터 정리
   ```javascript
   window.cleanupEmptyParcels() // 빈 필지 정리
   ```

---

## 📞 지원

### 기술 지원
- GitHub Issues
- 이메일: [담당자 이메일]

### 문서
- [데이터 손실 방지 리포트](./data-loss-prevention-report.md)
- [프로덕션 준비 상태](./production-readiness-report.md)
- [기술 부채](../TECHNICAL_DEBT.md)
- [환경 변수 가이드](../VERCEL_ENV_GUIDE.md)

---

## 🎯 최종 승인

**배포 승인**: ✅  
**배포 일시**: 준비 완료  
**배포 명령어**:
```bash
vercel --prod
```

**배포 후 URL**: https://[your-project].vercel.app

---

## 📝 변경 이력

### 2025-01-08
- ✅ 글로벌 에러 핸들러 추가
- ✅ DataPersistenceManager 활성화
- ✅ 프로덕션 설정 파일 추가 (production-config.js)
- ✅ ESLint 에러 수정
- ✅ 데이터 손실 방지 검증
- ✅ 성능 최적화

---

**배포 준비 완료. 안심하고 배포하세요!** 🚀


