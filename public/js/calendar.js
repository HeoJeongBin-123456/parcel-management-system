// 최적화된 캘린더 기능 - GoogleAuth 오류 완전 제거
let isCalendarVisible = false;
let isCalendarMaximized = false;

// 🎯 GoogleAuth 안전 체크 함수
function isGoogleAuthAvailable() {
    return typeof window.GoogleAuth !== 'undefined' && 
           window.GoogleAuth !== null && 
           typeof window.GoogleAuth.isAuthenticated === 'function';
}

// 🎯 단순한 캘린더 기능 - 과도한 자동 연동 제거
function initGoogleCalendar() {
    // 단순하게 기본 캘린더 표시만
    console.log('📅 캘린더 기본 설정 로드');
}

// 캘린더 모달 열기
function openCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;

    modal.style.display = 'block';
    isCalendarVisible = true;

    // 🎯 iframe 인터랙션 완전 차단 - 투명 오버레이 추가
    setTimeout(() => {
        disableCalendarInteractions();
    }, 100);

    console.log('📅 캘린더 모달 열기 - 인터랙션 차단 적용');
}

// 캘린더 모달 닫기
function closeCalendarModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    isCalendarVisible = false;
}

// 🎯 캘린더 인터랙션 완전 차단 함수
function disableCalendarInteractions() {
    const iframe = document.getElementById('calendarIframe');
    const modal = document.getElementById('calendarModal');

    if (!iframe || !modal) return;

    // 기존 오버레이 제거 (중복 방지)
    const existingOverlay = modal.querySelector('.iframe-interaction-blocker');
    if (existingOverlay) {
        existingOverlay.remove();
    }

    // 투명 오버레이 생성 - iframe 위에 덮어서 모든 인터랙션 차단
    const overlay = document.createElement('div');
    overlay.className = 'iframe-interaction-blocker';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        background: transparent;
        pointer-events: auto;
        cursor: default !important;
    `;

    // iframe의 부모 컨테이너에 relative position 적용
    const iframeContainer = iframe.parentElement;
    if (iframeContainer) {
        iframeContainer.style.position = 'relative';
        iframeContainer.appendChild(overlay);
    }

    // iframe 자체도 강제로 인터랙션 차단
    iframe.style.pointerEvents = 'none';
    iframe.style.userSelect = 'none';

    console.log('🚫 캘린더 iframe 인터랙션 완전 차단 완료');
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

    // iframe 로드 후 인터랙션 차단 재적용
    iframe.onload = function() {
        setTimeout(() => {
            disableCalendarInteractions();
        }, 500);
    };

    console.log('📅 캘린더 업데이트 완료');
}

// 🎯 DOM 로드 시 캘린더 인터랙션 완전 차단 적용
document.addEventListener('DOMContentLoaded', function() {
    console.log('📅 캘린더 모듈 로드 완료 - 단순 모드');

    // 이미 존재하는 iframe에 대해서도 인터랙션 차단 적용
    setTimeout(() => {
        const iframe = document.getElementById('calendarIframe');
        if (iframe && iframe.src) {
            disableCalendarInteractions();
        }
    }, 1000);

    // 모든 iframe 이벤트 감지 및 차단
    document.addEventListener('mouseover', function(e) {
        if (e.target.tagName === 'IFRAME' && e.target.id === 'calendarIframe') {
            disableCalendarInteractions();
        }
    });
});

console.log('✅ 최적화된 캘린더 모듈 로드 완료');