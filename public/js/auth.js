// Google OAuth 인증 관리

const GoogleAuth = {
    // OAuth 설정
    CLIENT_ID: '506368463001-um0b25os2vlep7mumonf63pcm9c9a0n3.apps.googleusercontent.com',
    DISCOVERY_DOCS: [
        'https://sheets.googleapis.com/$discovery/rest?version=v4',
        'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
    ],
    SCOPES: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.file'
    ].join(' '),
    
    // 토큰 만료 시간 확인
    isTokenExpired() {
        const expiryTime = localStorage.getItem('tokenExpiry');
        if (!expiryTime) return true;
        return new Date().getTime() > parseInt(expiryTime);
    },
    
    // 로그인 상태 확인
    isAuthenticated() {
        // 개발 환경에서는 인증 건너뛰기 (선택적)
        if (window.location.hostname === 'localhost' &&
            window.location.search.includes('dev=true')) {
            return true;
        }

        // localStorage에서 토큰 확인
        const idToken = localStorage.getItem('googleToken');
        const accessToken = localStorage.getItem('accessToken');

        // ID 토큰이 있어야 인증된 것으로 처리
        if (!idToken) {
            return false;
        }

        // 토큰 만료 체크
        if (this.isTokenExpired()) {
            console.log('⚠️ 토큰이 만료되었습니다');
            this.clearExpiredTokens();
            return false;
        }

        return true;
    },
    
    // 액세스 토큰 가져오기
    getAccessToken() {
        return localStorage.getItem('accessToken');
    },
    
    // 사용자 정보 가져오기
    getUserInfo() {
        const userInfo = localStorage.getItem('userInfo');
        return userInfo ? JSON.parse(userInfo) : null;
    },
    
    // 토큰 저장 (만료시간 함께 저장)
    saveTokens(tokenResponse) {
        localStorage.setItem('accessToken', tokenResponse.access_token);
        // 토큰 만료 시간 설정 (보통 1시간)
        const expiryTime = new Date().getTime() + (tokenResponse.expires_in || 3600) * 1000;
        localStorage.setItem('tokenExpiry', expiryTime.toString());
    },
    
    // 토큰 갱신 (오류 최소화)
    async refreshToken() {
        try {
            // Silent refresh 시도
            if (window.google && window.google.accounts) {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: this.CLIENT_ID,
                    scope: this.SCOPES,
                    prompt: '', // Silent refresh
                    callback: (tokenResponse) => {
                        this.saveTokens(tokenResponse);
                        console.log('✅ 토큰 자동 갱신 성공');
                    }
                });
                tokenClient.requestAccessToken();
            }
        } catch (error) {
            // 오류 로깅 최소화
            console.log('⚠️ 토큰 갱신 실패 (정상)');
        }
    },
    
    // 로그인 페이지로 리다이렉트
    redirectToLogin() {
        console.log('🔄 로그인 페이지로 리다이렉트 중...');
        window.location.href = '/login.html?redirected=true';
    },

    // 만료된 토큰 정리
    clearExpiredTokens() {
        localStorage.removeItem('googleToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiry');
        console.log('🗑️ 만료된 토큰 삭제 완료');
    },
    
    // 로그아웃
    logout() {
        // localStorage에서 인증 관련 데이터만 제거
        localStorage.removeItem('googleToken');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('tokenExpiry');
        sessionStorage.clear();
        this.redirectToLogin();
    },
    
    // Google Sheets API 호출
    async callSheetsAPI(method, endpoint, data = null) {
        const token = this.getAccessToken();
        if (!token) {
            console.log('⚠️ 액세스 토큰이 없습니다');
            return null;
        }
        
        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`https://sheets.googleapis.com/v4${endpoint}`, options);
            if (!response.ok) {
                throw new Error(`API 호출 실패: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.log('⚠️ Sheets API 호출 오류:', error.message || error);
            return null;
        }
    },
    
    // Google Calendar API 호출 (401 오류 방지)
    async callCalendarAPI(endpoint) {
        const token = this.getAccessToken();
        if (!token) {
            console.log('⚠️ 캘린더 API: 액세스 토큰이 없습니다');
            return null;
        }
        
        try {
            const response = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.log('⚠️ 캘린더 API: 인증 필요 (정상)');
                    return null;
                }
                throw new Error(`API 호출 실패: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.log('⚠️ Calendar API 호출 오류:', error.message || error);
            return null;
        }
    },
    
    // 스프레드시트 생성 또는 가져오기
    async getOrCreateSpreadsheet() {
        const SPREADSHEET_NAME = '네이버지도_필지관리_데이터';
        
        // 기존 스프레드시트 검색
        const files = await this.searchSpreadsheet(SPREADSHEET_NAME);
        
        if (files && files.files && files.files.length > 0) {
            // 기존 시트 사용
            return files.files[0].id;
        }
        
        // 새 스프레드시트 생성
        const createData = {
            properties: {
                title: SPREADSHEET_NAME
            },
            sheets: [{
                properties: {
                    title: '필지정보'
                },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: [
                            { userEnteredValue: { stringValue: '지번' }, userEnteredFormat: { horizontalAlignment: 'LEFT' } },
                            { userEnteredValue: { stringValue: '소유자이름' } },
                            { userEnteredValue: { stringValue: '소유자주소' } },
                            { userEnteredValue: { stringValue: '연락처' } },
                            { userEnteredValue: { stringValue: '메모' } }
                        ]
                    }]
                }]
            }]
        };
        
        const result = await this.callSheetsAPI('POST', '/spreadsheets', createData);
        return result ? result.spreadsheetId : null;
    },
    
    // 스프레드시트 검색
    async searchSpreadsheet(name) {
        const token = this.getAccessToken();
        if (!token) return null;
        
        try {
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name='${name}' and mimeType='application/vnd.google-apps.spreadsheet'`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error(`Drive API 호출 실패: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.log('⚠️ Drive API 검색 오류:', error.message || error);
            return null;
        }
    },
    
    // 스프레드시트에 데이터 추가
    async appendToSheet(spreadsheetId, data, sheetName = '필지정보') {
        const range = `${sheetName}!A:H`;

        // 데이터가 이미 배열의 배열 형태인지 확인
        let values;
        if (Array.isArray(data) && Array.isArray(data[0])) {
            // 이미 포맷된 데이터
            values = data;
        } else {
            // 객체 배열인 경우 변환
            values = data.map(item => [
                item.지번 || '',
                item.소유자이름 || '',
                item.소유자주소 || '',
                item.연락처 || '',
                item.메모 || ''
            ]);
        }
        
        const body = {
            values: values,
            majorDimension: 'ROWS'
        };
        
        // 데이터 추가 - A1부터 시작하도록 명시적으로 설정
        const result = await this.callSheetsAPI(
            'POST',
            `/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            body
        );
        
        // 지번 열(A열) 왼쪽 정렬 포맷 적용
        if (result) {
            await this.formatColumn(spreadsheetId, 0); // A열 = 0
        }
        
        return result;
    },
    
    // 특정 열 포맷 설정
    async formatColumn(spreadsheetId, columnIndex) {
        const formatRequest = {
            requests: [{
                repeatCell: {
                    range: {
                        sheetId: 0,
                        startColumnIndex: columnIndex,
                        endColumnIndex: columnIndex + 1
                    },
                    cell: {
                        userEnteredFormat: {
                            horizontalAlignment: 'LEFT'
                        }
                    },
                    fields: 'userEnteredFormat.horizontalAlignment'
                }
            }]
        };
        
        return await this.callSheetsAPI(
            'POST',
            `/spreadsheets/${spreadsheetId}:batchUpdate`,
            formatRequest
        );
    },
    
    // 사용자 캘린더 목록 가져오기
    async getUserCalendars() {
        const result = await this.callCalendarAPI('/users/me/calendarList');
        return result ? result.items : [];
    },
    
    // 주 캘린더 ID 가져오기
    async getPrimaryCalendarId() {
        const calendars = await this.getUserCalendars();
        if (!calendars || calendars.length === 0) {
            return null;
        }
        const primary = calendars.find(cal => cal.primary);
        return primary ? primary.id : null;
    }
};

// 페이지 로드 시 인증 확인
document.addEventListener('DOMContentLoaded', function() {
    // login.html이 아닌 경우에만 인증 확인
    if (window.location.pathname.includes('login.html')) {
        console.log('🔐 로그인 페이지 - 인증 건너뛰기');
        return;
    }

    console.log('🔍 인증 상태 확인 중...');

    if (!GoogleAuth.isAuthenticated()) {
        console.log('⚠️ 인증 실패 - 로그인 페이지로 리다이렉트');
        GoogleAuth.redirectToLogin();
    } else {
        console.log('✅ 인증 성공 - 메인 페이지 접근 허용');

        // 인증된 경우 사용자 정보 표시
        const userInfo = GoogleAuth.getUserInfo();
        if (userInfo) {
            console.log('👤 로그인 사용자:', userInfo.email);

            // 헤더에 간단한 로그아웃 버튼만 표시 - 중복 제거를 위해 주석처리
            // const header = document.querySelector('.header-right');
            // if (header && !document.getElementById('userInfo')) {
            //     const userDiv = document.createElement('div');
            //     userDiv.id = 'userInfo';
            //     userDiv.style.cssText = `
            //         display: flex;
            //         align-items: center;
            //         margin-right: 15px;
            //     `;
            //     userDiv.innerHTML = `
            //         <button onclick="GoogleAuth.logout()"
            //                 style="padding: 6px 12px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
            //                        border-radius: 15px; color: white; cursor: pointer; font-size: 0.8rem;
            //                        transition: all 0.3s ease;">
            //             로그아웃
            //         </button>
            //     `;
            //     header.insertBefore(userDiv, header.firstChild);
            // }
        }

        // 주기적으로 토큰 유효성 체크 (30분마다)
        setInterval(() => {
            if (GoogleAuth.isTokenExpired()) {
                console.log('⏰ 토큰 만료 - 재로그인 필요');
                GoogleAuth.redirectToLogin();
            }
        }, 30 * 60 * 1000); // 30분

        // 페이지가 포커스를 받을 때마다 토큰 체크
        window.addEventListener('focus', () => {
            if (!GoogleAuth.isAuthenticated()) {
                GoogleAuth.redirectToLogin();
            }
        });
    }
});

// 전역 객체로 노출
window.GoogleAuth = GoogleAuth;