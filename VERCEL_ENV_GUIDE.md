# Vercel 환경 변수 설정 가이드

## 필수 환경 변수

Vercel 대시보드(https://vercel.com)에서 프로젝트 설정 > Environment Variables 섹션에 다음 환경 변수를 추가하세요:

### 1. Supabase 설정
```
SUPABASE_URL=https://cqfszcbifonxpfasodto.supabase.co
SUPABASE_ANON_KEY=[Supabase 프로젝트의 anon key]
```

### 2. VWorld API 설정
```
VWORLD_API_KEY=E5B1657B-9B6F-3A4B-91EF-98512BE931A1
```
또는 새로운 API 키를 https://www.vworld.kr/dev/v4api.do 에서 발급받으세요.

### 3. Google OAuth 설정 (선택사항)
```
GOOGLE_CLIENT_ID=[Google Cloud Console에서 발급받은 OAuth 2.0 클라이언트 ID]
```

### 4. 네이버 지도 API 설정
```
NAVER_CLIENT_ID=[네이버 클라우드 플랫폼의 Client ID]
NAVER_CLIENT_SECRET=[네이버 클라우드 플랫폼의 Client Secret]
```

## 설정 방법

1. [Vercel 대시보드](https://vercel.com/dashboard) 접속
2. 해당 프로젝트 선택
3. Settings 탭 클릭
4. 좌측 메뉴에서 "Environment Variables" 선택
5. 각 변수를 추가:
   - Key: 환경 변수명 입력
   - Value: 해당 값 입력
   - Environment: Production, Preview, Development 모두 체크
6. "Save" 클릭

## 중요 사항

- **보안**: API 키와 시크릿은 절대 코드에 하드코딩하지 마세요.
- **재배포**: 환경 변수 변경 후에는 재배포가 필요합니다.
- **로컬 개발**: 로컬에서는 `.env` 파일을 사용하세요 (`.gitignore`에 포함되어 있음).

## 환경 변수 확인

배포 후 다음 명령어로 환경 변수가 제대로 설정되었는지 확인할 수 있습니다:

```bash
vercel env ls
```

## 문제 해결

환경 변수가 제대로 작동하지 않는 경우:

1. Vercel 대시보드에서 환경 변수가 올바르게 설정되었는지 확인
2. 프로젝트를 재배포 (`vercel --prod`)
3. 브라우저 개발자 도구에서 네트워크 탭 확인
4. Vercel Functions 로그 확인: `vercel logs`