/* eslint-disable */
// Google Calendar 위젯 - 사용자의 캘린더 일정을 표시

window.CalendarWidget = {
    // 위젯 초기화
    async init() {
        // Google 로그인 상태 확인
        if (!GoogleAuth.isAuthenticated() || localStorage.getItem('authProvider') !== 'google') {
            console.log('📅 Google 로그인이 필요합니다');
            return;
        }

        // 캘린더 위젯 생성
        this.createWidget();

        // 오늘의 일정 로드
        await this.loadTodayEvents();

        // 30분마다 자동 새로고침
        setInterval(() => {
            this.loadTodayEvents();
        }, 30 * 60 * 1000);
    },

    // 캘린더 위젯 UI 생성
    createWidget() {
        // 기존 위젯 제거
        const existing = document.getElementById('calendarWidget');
        if (existing) existing.remove();

        // 위젯 컨테이너 생성
        const widget = document.createElement('div');
        widget.id = 'calendarWidget';
        widget.className = 'calendar-widget';
        widget.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 320px;
            max-height: 400px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 999;
            overflow: hidden;
            transition: all 0.3s ease;
        `;

        // 위젯 헤더
        widget.innerHTML = `
            <div class="widget-header" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 15px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
            ">
                <span>📅 오늘의 일정</span>
                <div class="widget-controls">
                    <button id="refreshCalendarBtn" style="
                        background: transparent;
                        border: none;
                        color: white;
                        cursor: pointer;
                        padding: 5px;
                        margin-right: 10px;
                    " title="새로고침">🔄</button>
                    <button id="toggleCalendarBtn" style="
                        background: transparent;
                        border: none;
                        color: white;
                        cursor: pointer;
                        padding: 5px;
                    " title="최소화">−</button>
                </div>
            </div>
            <div class="widget-body" id="calendarWidgetBody" style="
                padding: 15px;
                max-height: 320px;
                overflow-y: auto;
            ">
                <div class="loading-spinner" style="
                    text-align: center;
                    padding: 20px;
                    color: #666;
                ">
                    <div style="
                        width: 30px;
                        height: 30px;
                        border: 3px solid #f3f4f6;
                        border-top: 3px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 10px;
                    "></div>
                    일정을 불러오는 중...
                </div>
            </div>
            <div class="widget-footer" style="
                background: #f9fafb;
                padding: 10px 15px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #6b7280;
                text-align: center;
            ">
                <a href="https://calendar.google.com" target="_blank" style="
                    color: #667eea;
                    text-decoration: none;
                ">Google Calendar에서 더보기 →</a>
            </div>
        `;

        document.body.appendChild(widget);

        // 애니메이션 추가
        this.addAnimations();

        // 이벤트 리스너 추가
        this.addEventListeners();

        // 드래그 기능 추가
        this.makeDraggable(widget);
    },

    // 오늘의 일정 로드
    async loadTodayEvents() {
        try {
            const calendarId = await GoogleAuth.getPrimaryCalendarId();
            if (!calendarId) {
                this.showError('캘린더를 찾을 수 없습니다');
                return;
            }

            // 오늘 날짜 범위 설정
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            const params = new URLSearchParams({
                timeMin: startOfDay.toISOString(),
                timeMax: endOfDay.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 10
            });

            const result = await GoogleAuth.callCalendarAPI(
                `/calendars/${calendarId}/events?${params}`
            );

            if (result && result.items) {
                this.displayEvents(result.items);
            } else {
                this.displayEvents([]);
            }

        } catch (error) {
            console.error('❌ 캘린더 로드 실패:', error);
            this.showError('일정을 불러올 수 없습니다');
        }
    },

    // 일정 표시
    displayEvents(events) {
        const body = document.getElementById('calendarWidgetBody');
        if (!body) return;

        if (events.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
                    <div style="font-size: 48px; margin-bottom: 10px;">📅</div>
                    <div style="font-size: 14px;">오늘은 일정이 없습니다</div>
                </div>
            `;
            return;
        }

        // 일정 목록 생성
        const eventsList = events.map(event => {
            const startTime = this.formatTime(event.start);
            const endTime = this.formatTime(event.end);
            const isAllDay = event.start.date ? true : false;

            return `
                <div class="calendar-event" style="
                    padding: 12px;
                    margin-bottom: 10px;
                    background: #f3f4f6;
                    border-left: 4px solid ${this.getEventColor(event.colorId)};
                    border-radius: 8px;
                    transition: all 0.2s ease;
                    cursor: pointer;
                " onmouseover="this.style.background='#e5e7eb'"
                   onmouseout="this.style.background='#f3f4f6'"
                   onclick="window.open('${event.htmlLink}', '_blank')">
                    <div style="font-weight: 600; color: #1f2937; margin-bottom: 5px;">
                        ${event.summary || '제목 없음'}
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                        ${isAllDay ? '종일' : `${startTime} - ${endTime}`}
                    </div>
                    ${event.location ? `
                        <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">
                            📍 ${event.location}
                        </div>
                    ` : ''}
                    ${event.description ? `
                        <div style="font-size: 12px; color: #6b7280; margin-top: 5px;
                                    overflow: hidden; text-overflow: ellipsis;
                                    display: -webkit-box; -webkit-line-clamp: 2;
                                    -webkit-box-orient: vertical;">
                            ${event.description}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        body.innerHTML = `
            <div style="margin-bottom: 10px; font-size: 12px; color: #6b7280;">
                ${events.length}개의 일정
            </div>
            ${eventsList}
        `;
    },

    // 시간 포맷
    formatTime(timeObj) {
        if (!timeObj) return '';

        if (timeObj.date) {
            // 종일 이벤트
            return '종일';
        }

        if (timeObj.dateTime) {
            const date = new Date(timeObj.dateTime);
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${minutes}`;
        }

        return '';
    },

    // 이벤트 색상
    getEventColor(colorId) {
        const colors = {
            '1': '#7986cb',  // 라벤더
            '2': '#33b679',  // 세이지
            '3': '#8e24aa',  // 포도
            '4': '#e67c73',  // 플라밍고
            '5': '#f6c026',  // 바나나
            '6': '#f5511d',  // 귤
            '7': '#039be5',  // 공작
            '8': '#616161',  // 흑연
            '9': '#3f51b5',  // 블루베리
            '10': '#0b8043', // 바질
            '11': '#d60000'  // 토마토
        };
        return colors[colorId] || '#667eea';
    },

    // 에러 표시
    showError(message) {
        const body = document.getElementById('calendarWidgetBody');
        if (body) {
            body.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #ef4444;">
                    <div style="font-size: 24px; margin-bottom: 10px;">⚠️</div>
                    <div style="font-size: 14px;">${message}</div>
                </div>
            `;
        }
    },

    // 이벤트 리스너
    addEventListeners() {
        // 새로고침 버튼
        const refreshBtn = document.getElementById('refreshCalendarBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadTodayEvents();
            });
        }

        // 최소화/최대화 토글
        const toggleBtn = document.getElementById('toggleCalendarBtn');
        const body = document.getElementById('calendarWidgetBody');
        const footer = document.querySelector('.widget-footer');

        if (toggleBtn && body) {
            toggleBtn.addEventListener('click', () => {
                if (body.style.display === 'none') {
                    body.style.display = 'block';
                    if (footer) footer.style.display = 'block';
                    toggleBtn.textContent = '−';
                } else {
                    body.style.display = 'none';
                    if (footer) footer.style.display = 'none';
                    toggleBtn.textContent = '+';
                }
            });
        }
    },

    // 드래그 가능하게 만들기
    makeDraggable(element) {
        const header = element.querySelector('.widget-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;

            isDragging = true;
            initialX = e.clientX - element.offsetLeft;
            initialY = e.clientY - element.offsetTop;

            header.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
            element.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            header.style.cursor = 'move';
        });
    },

    // CSS 애니메이션 추가
    addAnimations() {
        if (!document.getElementById('calendarWidgetStyles')) {
            const style = document.createElement('style');
            style.id = 'calendarWidgetStyles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .calendar-widget {
                    animation: slideIn 0.3s ease;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .calendar-event:hover {
                    transform: translateX(5px);
                }
            `;
            document.head.appendChild(style);
        }
    },

    // 위젯 숨기기/보이기
    toggle() {
        const widget = document.getElementById('calendarWidget');
        if (widget) {
            if (widget.style.display === 'none') {
                widget.style.display = 'block';
                this.loadTodayEvents();
            } else {
                widget.style.display = 'none';
            }
        } else {
            this.init();
        }
    }
};

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // login.html이 아닌 경우에만 초기화 시도
    if (window.location.pathname.includes('login.html')) {
        return;
    }

    // Google 로그인 완료 후 자동 초기화
    setTimeout(() => {
        if (window.GoogleAuth && GoogleAuth.isAuthenticated() && localStorage.getItem('authProvider') === 'google') {
            console.log('📅 Google Calendar 위젯 초기화 시작');
            window.CalendarWidget.init();
        } else {
            console.log('📅 Google Calendar: 로그인 대기 중');
        }
    }, 3000);
});

// 전역 객체로 노출
window.CalendarWidget = CalendarWidget;