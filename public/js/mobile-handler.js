// 모바일 UI 핸들러
class MobileHandler {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.touchStartY = 0;
        this.touchEndY = 0;
        this.activePanel = null;
        this.init();
    }
    
    init() {
        this.setupMobileNav();
        this.setupTouchGestures();
        this.setupResizeHandler();
        this.detectDevice();
    }
    
    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        this.isIOS = /iphone|ipad|ipod/.test(userAgent);
        this.isAndroid = /android/.test(userAgent);
        this.isTouchDevice = 'ontouchstart' in window;
        
        // 디바이스별 최적화
        if (this.isIOS) {
            document.body.classList.add('ios-device');
            this.preventIOSBounce();
        }
        
        if (this.isAndroid) {
            document.body.classList.add('android-device');
        }
        
        if (this.isTouchDevice) {
            document.body.classList.add('touch-device');
        }
    }
    
    setupMobileNav() {
        if (!this.isMobile) return;
        
        // 모바일 네비게이션 바 생성
        const mobileNav = document.createElement('div');
        mobileNav.className = 'mobile-nav';
        mobileNav.innerHTML = `
            <button class="mobile-nav-item active" data-action="map">
                <span>🗺️</span>
                <span>지도</span>
            </button>
            <button class="mobile-nav-item" data-action="form">
                <span>📝</span>
                <span>입력</span>
            </button>
            <button class="mobile-nav-item" data-action="list">
                <span>📋</span>
                <span>목록</span>
            </button>
            <button class="mobile-nav-item" data-action="calendar">
                <span>📅</span>
                <span>캘린더</span>
            </button>
            <button class="mobile-nav-item" data-action="menu">
                <span>☰</span>
                <span>메뉴</span>
            </button>
        `;
        
        document.body.appendChild(mobileNav);
        
        // 네비게이션 이벤트
        mobileNav.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.handleNavClick(e.currentTarget);
            });
        });
    }
    
    handleNavClick(item) {
        // 활성 상태 변경
        document.querySelectorAll('.mobile-nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        item.classList.add('active');
        
        const action = item.dataset.action;
        
        switch(action) {
            case 'map':
                this.closeAllPanels();
                break;
            case 'form':
                this.openSidebar();
                break;
            case 'list':
                this.openParcelList();
                break;
            case 'calendar':
                this.openCalendar();
                break;
            case 'menu':
                this.openMenu();
                break;
        }
        
        // 햅틱 피드백 (지원하는 경우)
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }
    
    openSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.add('open');
            this.activePanel = sidebar;
            this.showSwipeHint('아래로 스와이프하여 닫기');
        }
        this.closeOtherPanels(sidebar);
    }
    
    openParcelList() {
        if (window.parcelManager) {
            const panel = document.getElementById('advancedParcelPanel');
            if (panel) {
                panel.classList.add('open');
                this.activePanel = panel;
                window.parcelManager.render();
            }
        }
        this.closeOtherPanels(document.getElementById('advancedParcelPanel'));
    }
    
    openCalendar() {
        if (window.toggleFloatingCalendar) {
            window.toggleFloatingCalendar();
        }
    }
    
    openMenu() {
        // 메뉴 모달 생성
        const menuModal = document.createElement('div');
        menuModal.className = 'mobile-menu-modal';
        menuModal.innerHTML = `
            <div class="mobile-menu-content">
                <div class="mobile-menu-header">
                    <h3>메뉴</h3>
                    <button onclick="mobileHandler.closeMenu()">✕</button>
                </div>
                <div class="mobile-menu-items">
                    <button onclick="mobileHandler.toggleMapType()">
                        <span>🗺️</span> 지도 타입 변경
                    </button>
                    <button onclick="window.location.href='/login.html'">
                        <span>🔒</span> 로그아웃
                    </button>
                    <button onclick="mobileHandler.showHelp()">
                        <span>❓</span> 도움말
                    </button>
                    <button onclick="mobileHandler.showSettings()">
                        <span>⚙️</span> 설정
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(menuModal);
        
        // 배경 클릭 시 닫기
        menuModal.addEventListener('click', (e) => {
            if (e.target === menuModal) {
                this.closeMenu();
            }
        });
    }
    
    closeMenu() {
        const menu = document.querySelector('.mobile-menu-modal');
        if (menu) {
            menu.remove();
        }
    }
    
    closeAllPanels() {
        document.querySelector('.sidebar')?.classList.remove('open');
        document.getElementById('advancedParcelPanel')?.classList.remove('open');
        this.activePanel = null;
    }
    
    closeOtherPanels(except) {
        if (!except || except !== document.querySelector('.sidebar')) {
            document.querySelector('.sidebar')?.classList.remove('open');
        }
        if (!except || except !== document.getElementById('advancedParcelPanel')) {
            document.getElementById('advancedParcelPanel')?.classList.remove('open');
        }
    }
    
    setupTouchGestures() {
        if (!this.isTouchDevice) return;
        
        // 스와이프 제스처 설정
        document.addEventListener('touchstart', (e) => {
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe();
        }, { passive: true });
        
        // 패널별 스와이프 핸들러
        this.setupPanelSwipe('.sidebar');
        this.setupPanelSwipe('.advanced-panel');
    }
    
    setupPanelSwipe(selector) {
        const panel = document.querySelector(selector);
        if (!panel) return;
        
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        const handle = panel.querySelector('.panel-handle, .ap-header');
        if (!handle) return;
        
        handle.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            panel.style.transition = 'none';
        }, { passive: true });
        
        handle.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) {
                panel.style.transform = `translateY(${deltaY}px)`;
            }
        }, { passive: true });
        
        handle.addEventListener('touchend', () => {
            if (!isDragging) return;
            
            isDragging = false;
            panel.style.transition = '';
            panel.style.transform = '';
            
            const deltaY = currentY - startY;
            if (deltaY > 100) {
                panel.classList.remove('open');
            }
        });
    }
    
    handleSwipe() {
        const swipeDistance = this.touchStartY - this.touchEndY;
        const threshold = 50;
        
        // 위로 스와이프 (패널 열기)
        if (swipeDistance > threshold && Math.abs(swipeDistance) > threshold) {
            if (this.activePanel === null) {
                // 기본적으로 사이드바 열기
                this.openSidebar();
            }
        }
        
        // 아래로 스와이프 (패널 닫기)
        if (swipeDistance < -threshold && Math.abs(swipeDistance) > threshold) {
            if (this.activePanel) {
                this.activePanel.classList.remove('open');
                this.activePanel = null;
            }
        }
    }
    
    showSwipeHint(message) {
        if (!this.isMobile) return;
        
        const hint = document.createElement('div');
        hint.className = 'swipe-hint';
        hint.textContent = message;
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 3000);
    }
    
    setupResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const wasMobile = this.isMobile;
                this.isMobile = window.innerWidth <= 768;
                
                if (wasMobile !== this.isMobile) {
                    // 모바일/데스크탑 전환 시 UI 재설정
                    if (this.isMobile) {
                        this.setupMobileNav();
                    } else {
                        document.querySelector('.mobile-nav')?.remove();
                        this.closeAllPanels();
                    }
                }
            }, 250);
        });
    }
    
    preventIOSBounce() {
        // iOS 바운스 스크롤 방지
        document.addEventListener('touchmove', (e) => {
            if (e.target.closest('.sidebar, .advanced-panel, .floating-calendar-panel')) {
                return; // 패널 내부는 스크롤 허용
            }
            e.preventDefault();
        }, { passive: false });
    }
    
    toggleMapType() {
        // 모바일에서 지도 타입 순환
        const types = ['normal', 'satellite', 'cadastral'];
        const currentBtn = document.querySelector('.map-type-btn.active');
        const currentType = currentBtn?.dataset.type || 'normal';
        const currentIndex = types.indexOf(currentType);
        const nextIndex = (currentIndex + 1) % types.length;
        const nextType = types[nextIndex];
        
        const nextBtn = document.querySelector(`.map-type-btn[data-type="${nextType}"]`);
        if (nextBtn) {
            nextBtn.click();
        }
        
        this.closeMenu();
        
        // 토스트 메시지
        this.showToast(`지도 타입: ${this.getMapTypeName(nextType)}`);
    }
    
    getMapTypeName(type) {
        const names = {
            'normal': '일반지도',
            'satellite': '위성지도',
            'cadastral': '지적편집도',
            'street': '거리뷰'
        };
        return names[type] || type;
    }
    
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'mobile-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    showHelp() {
        alert('도움말\n\n' +
              '• 지도: 손가락으로 이동/확대\n' +
              '• 필지 선택: 지도에서 탭\n' +
              '• 입력: 하단 메뉴에서 📝 탭\n' +
              '• 목록: 하단 메뉴에서 📋 탭\n' +
              '• 스와이프: 패널 열기/닫기');
        this.closeMenu();
    }
    
    showSettings() {
        // 설정 패널 표시
        alert('설정 기능은 준비 중입니다.');
        this.closeMenu();
    }
}

// 전역 인스턴스 생성
document.addEventListener('DOMContentLoaded', () => {
    window.mobileHandler = new MobileHandler();
});

// 모바일 관련 스타일 추가
const mobileStyles = `
<style>
.mobile-menu-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 3000;
    display: flex;
    align-items: flex-end;
    animation: fadeIn 0.3s;
}

.mobile-menu-content {
    background: white;
    width: 100%;
    border-radius: 20px 20px 0 0;
    padding: 20px;
    animation: slideUp 0.3s;
}

.mobile-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.mobile-menu-header h3 {
    margin: 0;
    font-size: 18px;
}

.mobile-menu-header button {
    background: none;
    border: none;
    font-size: 24px;
    padding: 0;
    width: 30px;
    height: 30px;
}

.mobile-menu-items {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.mobile-menu-items button {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px;
    background: #f8f9fa;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    text-align: left;
    cursor: pointer;
    transition: all 0.3s;
}

.mobile-menu-items button:active {
    transform: scale(0.95);
    background: #e9ecef;
}

.mobile-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 14px;
    z-index: 4000;
    transition: transform 0.3s;
}

.mobile-toast.show {
    transform: translateX(-50%) translateY(0);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', mobileStyles);
