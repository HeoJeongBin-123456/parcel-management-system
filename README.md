# parcel-management-system

네이버 지도와 Vworld API를 활용한 필지 관리 웹 애플리케이션

## 기능

- 🗺️ **지도 모드**: 일반 지도, 위성 지도, 지적편집도, 로드뷰
- 🎨 **필지 색칠**: 8가지 색상으로 필지 구분
- 📝 **필지 정보 관리**: 지번, 소유자 정보, 메모 저장
- 🔍 **검색 기능**: 주소 및 지번 검색
- 📊 **데이터 내보내기**: Google Sheets 연동

## 설치 방법

1. 프로젝트 클론
```bash
git clone [repository-url]
cd naver-map-parcel-system
```

2. API 키 설정
`js/config.js` 파일에서 다음 API 키 설정:
- 네이버 클라우드 플랫폼 Client ID
- Vworld API 키
- Google Apps Script URL (선택사항)

3. 웹 서버 실행
```bash
# Python 사용
python -m http.server 8000

# 또는 Node.js 사용
npx http-server
```

4. 브라우저에서 `http://localhost:8000` 접속

## API 키 발급

### 네이버 지도 API
1. [네이버 클라우드 플랫폼](https://console.ncloud.com/) 접속
2. Application 등록
3. Maps > Web Dynamic Map 사용 설정
4. Client ID 복사

### Vworld API
1. [Vworld](https://www.vworld.kr/dev/v4api.do) 접속
2. 회원가입 및 로그인
3. 오픈API > 인증키 발급

### Google Sheets 연동 (선택)
1. Google Sheets 생성
2. Apps Script 작성 및 배포
3. 배포 URL을 config.js에 설정

## 사용 방법

1. **지도 탐색**: 마우스로 지도 이동 및 확대/축소
2. **지도 모드 변경**: 상단 버튼으로 지도 타입 전환
3. **필지 선택**: 지도에서 필지 클릭
4. **색상 적용**: 좌측 색상 팔레트에서 색상 선택 후 필지 클릭
5. **정보 입력**: 좌측 폼에 필지 정보 입력 후 저장
6. **검색**: 상단 검색창에 주소 또는 지번 입력
7. **데이터 내보내기**: 구글시트 전송 버튼 클릭

## 기술 스택

- HTML5 / CSS3 / JavaScript (ES6+)
- 네이버 지도 API v3
- Vworld Open API
- Google Apps Script
- LocalStorage

## 브라우저 지원

- Chrome (권장)
- Firefox
- Safari
- Edge

## 라이선스

MIT License
