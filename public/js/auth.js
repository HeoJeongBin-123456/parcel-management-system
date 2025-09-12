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
    
    // 로그인 상태 확인 (로깅 최소화)
    isAuthenticated() {
        // 개발 환경 및 테스트 환경에서는 인증 건너뛰기
        if (window.location.hostname === 'localhost' || 
            window.location.hostname.includes('vercel.app')) {
            return true;
        }
        
        // localStorage로 변경하여 브라우저 재시작해도 유지
        const idToken = localStorage.getItem('googleToken');
        const accessToken = localStorage.getItem('accessToken');
        
        // ID 토큰만 있어도 인증된 것으로 처리
        if (idToken) {
            // 토큰 만료 체크
            if (!this.isTokenExpired()) {
                return true;
            } else {
                // 토큰 만료시 자동 갱신 시도 (로깅 최소화)
                this.refreshToken();
                return false;
            }
        }
        
        return false;
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
        window.location.href = '/login.html';
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
    async appendToSheet(spreadsheetId, data) {
        const range = '필지정보!A:E';
        const values = data.map(item => [
            item.지번 || '',
            item.소유자이름 || '',
            item.소유자주소 || '',
            item.연락처 || '',
            item.메모 || ''
        ]);
        
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

// 페이지 로드 시 인증 확인 (로깅 최소화)
document.addEventListener('DOMContentLoaded', function() {
    // login.html이 아닌 경우에만 인증 확인
    if (!window.location.pathname.includes('login.html')) {        
        if (!GoogleAuth.isAuthenticated()) {
            console.log('⚠️ 인증 실패 - 로그인 페이지로 리다이렉트');
            GoogleAuth.redirectToLogin();
        } else {
            // 인증된 경우 사용자 정보 표시
            const userInfo = GoogleAuth.getUserInfo();
            if (userInfo) {
                console.log('✅ 로그인 사용자:', userInfo.email);
                
                // 헤더에 사용자 정보 표시 (선택사항)
                const header = document.querySelector('.header');
                if (header && !document.getElementById('userInfo')) {
                    const userDiv = document.createElement('div');
                    userDiv.id = 'userInfo';
                    userDiv.style.cssText = 'position: absolute; top: 1rem; right: 1rem; color: white; font-size: 0.875rem;';
                    userDiv.innerHTML = `
                        <span>${userInfo.name || userInfo.email}님</span>
                        <button onclick="GoogleAuth.logout()" style="margin-left: 1rem; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.2); border: 1px solid white; border-radius: 4px; color: white; cursor: pointer;">
                            로그아웃
                        </button>
                    `;
                    header.appendChild(userDiv);
                }
            }
            
            // 주기적으로 토큰 유효성 체크 및 갱신 (30분마다, 로깅 최소화)
            setInterval(() => {
                if (GoogleAuth.isTokenExpired()) {
                    GoogleAuth.refreshToken();
                }
            }, 30 * 60 * 1000); // 30분
            
            // 페이지가 포커스를 받을 때마다 토큰 체크 (로깅 최소화)
            window.addEventListener('focus', () => {
                if (GoogleAuth.isTokenExpired()) {
                    GoogleAuth.refreshToken();
                }
            });
        }
    }
});

// 전역 객체로 노출
window.GoogleAuth = GoogleAuth;