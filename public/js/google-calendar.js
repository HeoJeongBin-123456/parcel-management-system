// 구글 캘린더 연동 모듈
class GoogleCalendar {
    constructor() {
        this.isOpen = false;
        this.calendarId = 'primary'; // 기본 캘린더 ID (사용자가 변경 가능)
        this.embedUrl = null;
        this.initializeCalendar();
    }

    // 캘린더 초기화
    initializeCalendar() {
        // 저장된 캘린더 ID 가져오기
        const savedCalendarId = localStorage.getItem('googleCalendarId');
        if (savedCalendarId) {
            this.calendarId = savedCalendarId;
        }

        // iframe URL 생성
        this.updateEmbedUrl();

        // 이벤트 바인딩
        this.bindEvents();

        console.log('📅 구글 캘린더 연동 초기화 완료');
    }

    // iframe 임베드 URL 업데이트
    updateEmbedUrl() {
        // 구글 캘린더 임베드 파라미터
        const params = new URLSearchParams({
            height: '600',
            wkst: '2', // 주 시작일 (1=일요일, 2=월요일)
            bgcolor: '#ffffff',
            ctz: 'Asia/Seoul', // 시간대
            showTitle: '0', // 제목 표시 여부
            showNav: '1', // 네비게이션 표시
            showDate: '1', // 날짜 표시
            showPrint: '0', // 인쇄 버튼
            showTabs: '1', // 탭 표시
            showCalendars: '0', // 캘린더 목록
            showTz: '0', // 시간대 표시
            mode: 'MONTH', // 기본 보기 모드
            src: this.calendarId
        });

        // 기본 구글 캘린더 URL
        this.embedUrl = `https://calendar.google.com/calendar/embed?${params.toString()}`;
    }

    // 이벤트 바인딩
    bindEvents() {
        // 캘린더 버튼 클릭
        const calendarBtn = document.getElementById('calendarBtn');
        if (calendarBtn) {
            calendarBtn.addEventListener('click', () => this.toggle());
        }

        // 닫기 버튼
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('google-calendar-close-btn')) {
                this.close();
            }
        });

        // ESC 키로 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // 사이드바 외부 클릭으로 닫기
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('googleCalendarSidebar');
            const calendarBtn = document.getElementById('calendarBtn');

            if (this.isOpen && sidebar && !sidebar.contains(e.target) &&
                e.target !== calendarBtn && !calendarBtn?.contains(e.target)) {
                this.close();
            }
        });
    }

    // 캘린더 열기/닫기 토글
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    // 캘린더 열기
    open() {
        let sidebar = document.getElementById('googleCalendarSidebar');

        // 사이드바가 없으면 생성
        if (!sidebar) {
            this.createSidebar();
            sidebar = document.getElementById('googleCalendarSidebar');
        }

        // iframe 업데이트
        this.updateIframe();

        // 사이드바 열기
        if (sidebar) {
            sidebar.classList.add('open');
            this.isOpen = true;
            console.log('📅 구글 캘린더 열림');
        }
    }

    // 캘린더 닫기
    close() {
        const sidebar = document.getElementById('googleCalendarSidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
            this.isOpen = false;
            console.log('📅 구글 캘린더 닫힘');
        }
    }

    // 사이드바 생성
    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'googleCalendarSidebar';
        sidebar.className = 'google-calendar-sidebar';

        sidebar.innerHTML = `
            <div class="google-calendar-header">
                <h2>📅 팀 캘린더</h2>
                <button class="google-calendar-close-btn">&times;</button>
            </div>
            <div class="google-calendar-content">
                <div class="calendar-settings">
                    <div class="setting-group">
                        <label>캘린더 ID:</label>
                        <input type="text" id="calendarIdInput"
                               placeholder="your-calendar-id@group.calendar.google.com"
                               value="${this.calendarId}">
                        <button id="updateCalendarBtn">적용</button>
                    </div>
                    <div class="setting-help">
                        <details>
                            <summary>🔧 캘린더 설정 방법</summary>
                            <ol>
                                <li>Google Calendar에서 공유 캘린더 생성</li>
                                <li>캘린더 설정 → 액세스 권한에서 '공개' 설정</li>
                                <li>캘린더 ID 복사 (설정 → 캘린더 통합)</li>
                                <li>위 입력란에 캘린더 ID 붙여넣기</li>
                            </ol>
                        </details>
                    </div>
                </div>
                <div class="calendar-iframe-container">
                    <iframe id="googleCalendarIframe"
                            src="${this.embedUrl}"
                            style="border: 0"
                            width="100%"
                            height="600"
                            frameborder="0"
                            scrolling="no">
                    </iframe>
                </div>
                <div class="calendar-actions">
                    <a href="https://calendar.google.com/calendar"
                       target="_blank"
                       class="calendar-link">
                       ↗ Google Calendar에서 열기
                    </a>
                </div>
            </div>
        `;

        document.body.appendChild(sidebar);

        // 캘린더 ID 업데이트 이벤트
        const updateBtn = document.getElementById('updateCalendarBtn');
        const calendarInput = document.getElementById('calendarIdInput');

        if (updateBtn && calendarInput) {
            updateBtn.addEventListener('click', () => {
                const newId = calendarInput.value.trim();
                if (newId) {
                    this.updateCalendarId(newId);
                }
            });

            calendarInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const newId = calendarInput.value.trim();
                    if (newId) {
                        this.updateCalendarId(newId);
                    }
                }
            });
        }
    }

    // 캘린더 ID 업데이트
    updateCalendarId(newCalendarId) {
        this.calendarId = newCalendarId;
        localStorage.setItem('googleCalendarId', newCalendarId);
        this.updateEmbedUrl();
        this.updateIframe();

        // 성공 메시지
        this.showToast('캘린더 ID가 업데이트되었습니다');
    }

    // iframe 업데이트
    updateIframe() {
        const iframe = document.getElementById('googleCalendarIframe');
        if (iframe) {
            iframe.src = this.embedUrl;
        }
    }

    // 토스트 메시지 표시
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'google-calendar-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 2000);
        }, 100);
    }

    // 캘린더 공유 설정 도움말
    showSetupGuide() {
        const guide = `
        🔧 구글 캘린더 공유 설정 가이드:

        1. Google Calendar 접속 (calendar.google.com)
        2. 새 캘린더 만들기:
           - 왼쪽 사이드바 > 다른 캘린더 > + 버튼
           - '새 캘린더 만들기' 선택
           - 캘린더 이름 입력 (예: "팀 프로젝트")

        3. 공유 설정:
           - 생성한 캘린더 > 설정 및 공유
           - 액세스 권한 > '공개 사용 설정' 체크
           - 특정 사용자와 공유 > 팀원 이메일 추가
           - 권한: '일정 변경' 선택

        4. 캘린더 ID 확인:
           - 설정 > 캘린더 통합
           - 캘린더 ID 복사 (xxxxx@group.calendar.google.com)

        5. 이 시스템에 적용:
           - 캘린더 ID 입력란에 붙여넣기
           - '적용' 버튼 클릭
        `;

        alert(guide);
    }
}

// 전역 인스턴스 생성
window.googleCalendar = null;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 약간의 지연 후 초기화 (다른 모듈 로드 대기)
    setTimeout(() => {
        window.googleCalendar = new GoogleCalendar();
        console.log('📅 구글 캘린더 모듈 로드 완료');
    }, 1000);
});