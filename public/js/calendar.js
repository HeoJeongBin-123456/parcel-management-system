// 최적화된 캘린더 기능 - GoogleAuth 오류 완전 제거
let isCalendarVisible = false;
let isCalendarMaximized = false;

// 🎯 GoogleAuth 안전 체크 함수
function isGoogleAuthAvailable() {
    return typeof window.GoogleAuth !== 'undefined' && 
           window.GoogleAuth !== null && 
           typeof window.GoogleAuth.isAuthenticated === 'function';
}

// 구글 캘린더 자동 연동 - 오류 방지 개선
async function initGoogleCalendar() {
    // 🛡️ 안전한 GoogleAuth 체크
    if (!isGoogleAuthAvailable()) {
        console.log('ℹ️ GoogleAuth를 사용할 수 없습니다. 기본 캘린더를 사용합니다.');
        return;
    }
    
    try {
        // 인증 상태 확인
        if (!window.GoogleAuth.isAuthenticated()) {
            console.log('ℹ️ Google 계정이 연결되지 않았습니다.');
            return;
        }
        
        // 액세스 토큰 확인
        if (!window.GoogleAuth.getAccessToken()) {
            console.log('ℹ️ 구글 캘린더 자동 연동을 위해 구글 시트 버튼을 클릭해주세요.');
            return;
        }
        
        // 주 캘린더 ID 가져오기
        const primaryCalendarId = await window.GoogleAuth.getPrimaryCalendarId();
        if (primaryCalendarId) {
            const iframe = document.getElementById('calendarIframe');
            if (iframe) {
                const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(primaryCalendarId)}&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=MONTH`;
                iframe.src = calendarUrl;
                console.log('✅ 구글 캘린더 자동 연동 완료');
                
                // URL 입력란에도 표시
                const input = document.getElementById('calendarUrl');
                if (input) {
                    input.value = primaryCalendarId;
                }
            }
        }
    } catch (error) {
        console.log('ℹ️ 캘린더 자동 연동 실패 (정상):', error.message);
    }
}

// 캘린더 모달 열기
function openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    isCalendarVisible = true;
    
    // 🎯 비동기 캘린더 초기화 - 블로킹 방지
    setTimeout(() => {
        initGoogleCalendar();
    }, 100);
}

// 캘린더 모달 닫기
function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    isCalendarVisible = false;
}

// 캘린더 URL 업데이트
function updateCalendar() {
    const input = document.getElementById('calendarUrl');
    const iframe = document.getElementById('calendarIframe');
    
    if (!input || !iframe) return;
    
    const value = input.value.trim();
    if (!value) return;
    
    let calendarUrl = '';
    
    // 이메일 주소인 경우
    if (value.includes('@') && !value.includes('http')) {
        calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(value)}&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=MONTH`;
    } 
    // 캘린더 ID인 경우
    else if (!value.includes('http')) {
        calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(value)}&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=MONTH`;
    }
    // 이미 완전한 URL인 경우
    else {
        calendarUrl = value;
    }
    
    iframe.src = calendarUrl;
    alert('캘린더가 업데이트되었습니다.');
}

// 🎯 최적화된 DOM 로드 이벤트 처리
document.addEventListener('DOMContentLoaded', function() {
    // 🛡️ 지연된 Google Calendar 초기화 - 블로킹 방지
    setTimeout(() => {
        // GoogleAuth가 로드된 후에만 시도
        if (isGoogleAuthAvailable()) {
            initGoogleCalendar();
        } else {
            console.log('ℹ️ GoogleAuth 미사용 - 기본 캘린더로 진행');
        }
    }, 3000); // 3초 지연으로 다른 스크립트 로딩 대기

    // 드래그 기능 초기화
    initializeDragAndResize();
});

// 🎯 성능 최적화 - 드래그 기능 분리
function initializeDragAndResize() {
    const calendar = document.getElementById('floatingCalendar');
    const header = document.getElementById('calendarHeader');
    const resizeHandle = document.querySelector('.calendar-resize-handle');
    
    if (!calendar || !header) return;
    
    let isDragging = false;
    let isResizing = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    // 🎯 이벤트 리스너 최적화 - passive 사용
    header.addEventListener('mousedown', dragStart, { passive: false });
    
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', resizeStart, { passive: false });
    }
    
    function dragStart(e) {
        if (e.target.closest('.calendar-controls')) return;
        
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === header || e.target.closest('.calendar-title')) {
            isDragging = true;
        }
    }
    
    function resizeStart(e) {
        isResizing = true;
        initialX = e.clientX;
        initialY = e.clientY;
        e.preventDefault();
    }
    
    // 🎯 throttle로 성능 최적화
    let animationFrameId;
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging || isResizing) {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            animationFrameId = requestAnimationFrame(() => {
                if (isDragging) {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                    
                    xOffset = currentX;
                    yOffset = currentY;
                    
                    calendar.style.transform = `translate(${currentX}px, ${currentY}px)`;
                } else if (isResizing) {
                    const width = Math.max(300, e.clientX - calendar.offsetLeft);
                    const height = Math.max(400, e.clientY - calendar.offsetTop);
                    
                    calendar.style.width = width + 'px';
                    calendar.style.height = height + 'px';
                }
            });
        }
    }, { passive: true });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
        isResizing = false;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }, { passive: true });
}

console.log('✅ 최적화된 캘린더 모듈 로드 완료');