// 캘린더 기능 관리
let isCalendarVisible = false;
let isCalendarMaximized = false;

// 구글 캘린더 자동 연동
async function initGoogleCalendar() {
    // 로그인된 경우에만 실행
    if (!GoogleAuth || !GoogleAuth.isAuthenticated()) return;
    
    try {
        // 액세스 토큰이 없으면 기늤 (처음에는 자동 연동 안함)
        if (!GoogleAuth.getAccessToken()) {
    // console.log('캘린더 자동 연동을 위해 구글 시트 또는 캘린더 버튼을 클릭해주세요.');
            return;
        }
        
        // 주 캘린더 ID 가져오기
        const primaryCalendarId = await GoogleAuth.getPrimaryCalendarId();
        if (primaryCalendarId) {
            const iframe = document.getElementById('calendarIframe');
            if (iframe) {
                const calendarUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(primaryCalendarId)}&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=1&showCalendars=1&showTz=0&mode=MONTH`;
                iframe.src = calendarUrl;
    // console.log('구글 캘린더 자동 연동 완료:', primaryCalendarId);
                
                // URL 입력란에도 표시
                const input = document.getElementById('calendarUrl');
                if (input) {
                    input.value = primaryCalendarId;
                }
            }
        }
    } catch (error) {
    // console.log('캘린더 자동 연동 실패 (정상):', error);
    }
}

// 캘린더 모달 열기
function openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    isCalendarVisible = true;
    
    // 구글 캘린더 자동 연동 시도
    initGoogleCalendar();
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

// 드래그 기능 추가
document.addEventListener('DOMContentLoaded', function() {
    // 구글 캘린더 자동 연동 시도 (지연 실행)
    setTimeout(() => {
        initGoogleCalendar();
    }, 2000);
    const calendar = document.getElementById('floatingCalendar');
    const header = document.getElementById('calendarHeader');
    const resizeHandle = document.querySelector('.calendar-resize-handle');
    
    if (!calendar || !header) return;
    
    let isDragging = false;
    let isResizing = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    // 드래그 시작
    header.addEventListener('mousedown', dragStart);
    
    // 리사이즈 시작
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', resizeStart);
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
    
    document.addEventListener('mousemove', function(e) {
        if (isDragging) {
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            calendar.style.transform = `translate(${currentX}px, ${currentY}px)`;
        } else if (isResizing) {
            e.preventDefault();
            
            const width = Math.max(300, e.clientX - calendar.offsetLeft);
            const height = Math.max(400, e.clientY - calendar.offsetTop);
            
            calendar.style.width = width + 'px';
            calendar.style.height = height + 'px';
        }
    });
    
    document.addEventListener('mouseup', function() {
        isDragging = false;
        isResizing = false;
    });
});