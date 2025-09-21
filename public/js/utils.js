/* eslint-disable */
// 유틸리티 함수들

const COLOR_PALETTE_DEFINITION = [
    { index: 0, hex: '#FF0000', name: '빨강' },
    { index: 1, hex: '#FFA500', name: '주황' },
    { index: 2, hex: '#FFFF00', name: '노랑' },
    { index: 3, hex: '#90EE90', name: '연두' },
    { index: 4, hex: '#0000FF', name: '파랑' },
    { index: 5, hex: '#000000', name: '검정' },
    { index: 6, hex: '#FFFFFF', name: '흰색' },
    { index: 7, hex: '#87CEEB', name: '하늘색' }
];

(function initializeParcelColorStorage() {
    if (window.ParcelColorStorage) {
        return;
    }

    const STORAGE_KEY = 'parcelColors';

    function normaliseColorValue(value) {
        if (value === undefined || value === null) {
            return null;
        }

        if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < COLOR_PALETTE_DEFINITION.length) {
            return value;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed || trimmed.toLowerCase() === 'transparent') {
                return null;
            }
            const paletteEntry = COLOR_PALETTE_DEFINITION.find(item => item.hex.toLowerCase() === trimmed.toLowerCase() || String(item.index) === trimmed);
            if (paletteEntry) {
                return paletteEntry.index;
            }
        }

        if (typeof value === 'object') {
            if (typeof value.colorIndex === 'number') {
                return normaliseColorValue(value.colorIndex);
            }
            if (typeof value.index === 'number') {
                return normaliseColorValue(value.index);
            }
            if (typeof value.color === 'string') {
                return normaliseColorValue(value.color);
            }
            if (typeof value.hex === 'string') {
                return normaliseColorValue(value.hex);
            }
        }

        return null;
    }

    function parseStoredColors(raw) {
        if (!raw || raw === 'null' || raw === 'undefined') {
            return new Map();
        }

        try {
            const data = JSON.parse(raw);
            const map = new Map();

            if (Array.isArray(data)) {
                data.forEach(entry => {
                    if (Array.isArray(entry) && entry.length >= 2) {
                        const [key, value] = entry;
                        const normalised = normaliseColorValue(value);
                        if (normalised !== null) {
                            map.set(String(key), normalised);
                        }
                    }
                });
                return map;
            }

            if (typeof data === 'object' && data !== null) {
                Object.entries(data).forEach(([key, value]) => {
                    const normalised = normaliseColorValue(value);
                    if (normalised !== null) {
                        map.set(String(key), normalised);
                    }
                });
                return map;
            }
        } catch (error) {
            console.warn('parcelColors 파싱 실패:', error);
        }

        return new Map();
    }

    function serializeColors(map) {
        if (!(map instanceof Map)) {
            return '[]';
        }
        return JSON.stringify(Array.from(map.entries()));
    }

    function persist(map) {
        try {
            localStorage.setItem(STORAGE_KEY, serializeColors(map));
        } catch (error) {
            console.error('parcelColors 저장 실패:', error);
        }
    }

    window.ParcelColorStorage = {
        palette: COLOR_PALETTE_DEFINITION,
        getAll() {
            return parseStoredColors(localStorage.getItem(STORAGE_KEY));
        },
        setAll(map) {
            if (!(map instanceof Map)) {
                map = new Map(map);
            }
            persist(map);
        },
        getIndex(pnu) {
            const map = this.getAll();
            return map.get(pnu) ?? null;
        },
        setIndex(pnu, colorIndex) {
            const map = this.getAll();
            const normalised = normaliseColorValue(colorIndex);
            if (normalised === null) {
                map.delete(pnu);
            } else {
                map.set(pnu, normalised);
            }
            persist(map);
        },
        setHex(pnu, hex) {
            if (!hex) {
                this.remove(pnu);
                return;
            }
            const paletteEntry = COLOR_PALETTE_DEFINITION.find(item => item.hex.toLowerCase() === hex.toLowerCase());
            if (paletteEntry) {
                this.setIndex(pnu, paletteEntry.index);
            } else {
                this.remove(pnu);
            }
        },
        getHex(pnu) {
            const index = this.getIndex(pnu);
            if (typeof index === 'number' && COLOR_PALETTE_DEFINITION[index]) {
                return COLOR_PALETTE_DEFINITION[index].hex;
            }
            return null;
        },
        remove(pnu) {
            const map = this.getAll();
            map.delete(pnu);
            persist(map);
        },
        clear() {
            persist(new Map());
        },
        toLegacyObject() {
            const legacy = {};
            const map = this.getAll();
            map.forEach((index, key) => {
                const paletteEntry = COLOR_PALETTE_DEFINITION[index];
                if (paletteEntry) {
                    legacy[key] = {
                        color: paletteEntry.hex,
                        colorIndex: index
                    };
                }
            });
            return legacy;
        }
    };
})();

// 페이지 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // console.log('초기화 시작');
    
    // 지도 초기화
    if (typeof initMap === 'function') {
        initMap();
    // console.log('지도 초기화 완료');
    }
    
    // 구글 캘린더 자동 연동은 사용자가 명시적으로 요청할 때만 수행
    // 자동 연동 비활성화 (두 번 로그인 방지)
    // if (typeof GoogleAuth !== 'undefined' && GoogleAuth.isAuthenticated()) {
    //     // 캘린더 연동 코드...
    // }
    
    // 🎨 페이지 로드시 저장된 색상 및 지도 상태 복원
    async function loadSavedColorAndState() {
        if (window.SupabaseManager) {
            try {
                // 🎨 색상 복원
                const savedColor = await window.SupabaseManager.loadCurrentColor();
                console.log('🎨 저장된 색상 복원:', savedColor);

                if (savedColor) {
                    // savedColor가 색상 인덱스(숫자)인 경우 hex 값으로 변환
                    if (!isNaN(parseInt(savedColor)) && savedColor.length === 1) {
                        const colors = COLOR_PALETTE_DEFINITION.map(item => item.hex);
                        const hexColor = colors[parseInt(savedColor)] || savedColor;
                        currentColor = hexColor;
                        window.currentColor = hexColor;
                    } else {
                        currentColor = savedColor;
                        window.currentColor = savedColor;
                    }
                    document.getElementById('currentColor').style.background = currentColor;

                    const targetItem = document.querySelector(`.color-item[data-hex="${savedColor}"]`);
                    const colorIndex = targetItem ? targetItem.dataset.color : null;
                    if (window.ColorPaletteManager && !isNaN(parseInt(colorIndex))) {
                        window.ColorPaletteManager.selectColor(parseInt(colorIndex));
                    } else if (targetItem) {
                        document.querySelectorAll('.color-item').forEach(c => c.classList.remove('active'));
                        targetItem.classList.add('active');
                    }
                }

                // 🗺️ 지도 모드 복원
                const savedMode = await window.SupabaseManager.loadCurrentMode();
                if (savedMode && window.currentMode !== savedMode) {
                    window.currentMode = savedMode;

                    // 검색 버튼 상태 업데이트
                    const searchToggleBtn = document.getElementById('searchToggleBtn');
                    if (searchToggleBtn) {
                        searchToggleBtn.textContent = savedMode === 'search' ? '검색 ON' : '검색 OFF';
                    }

                    // 🚫 검색 모드에서도 보라색으로 자동 설정하지 않음 (보라색은 검색 필지 전용)
                    if (savedMode === 'search') {
                        // 검색 모드여도 색상은 그대로 유지 (보라색으로 변경하지 않음)
                        console.log('🔍 검색 모드 복원 - 기존 색상 유지');

                        // 🔍 검색 모드일 때 검색 결과 복원
                        if (typeof loadSearchResultsFromStorage === 'function') {
                            try {
                                loadSearchResultsFromStorage();
                                console.log('🔍 검색 결과 복원 완료');
                            } catch (error) {
                                console.error('❌ 검색 결과 복원 실패:', error);
                            }
                        } else {
                            console.warn('⚠️ loadSearchResultsFromStorage 함수가 없습니다');
                        }
                    } else {
                        // 🧹 클릭 모드일 때 보라색 필지 완전 제거
                        if (window.cleanupSearchParcelsFromClickMap) {
                            setTimeout(() => {
                                window.cleanupSearchParcelsFromClickMap();
                                console.log('🧹 클릭 모드 - 보라색 필지 완전 제거 완료');
                            }, 1000); // 지도 초기화 후 실행
                        }
                    }

                    console.log('🔄 지도 모드 복원:', savedMode);
                }

                // 🗺️ 지도 위치 복원 (지도가 로드된 후에 실행)
                if (window.map) {
                    const savedPosition = await window.SupabaseManager.loadMapPosition();
                    if (savedPosition && savedPosition.lat && savedPosition.lng) {
                        window.map.setCenter(new naver.maps.LatLng(savedPosition.lat, savedPosition.lng));
                        if (savedPosition.zoom) {
                            window.map.setZoom(savedPosition.zoom);
                        }
                        console.log('🗺️ 지도 위치 복원:', savedPosition);
                    }
                }

                return;
            } catch (error) {
                console.error('상태 복원 실패:', error);
            }
        }

        // 기본 색상 설정 (빨간색)
        if (window.ColorPaletteManager) {
            window.ColorPaletteManager.selectColor(0);
        } else {
            document.querySelector('.color-item[data-color="0"]')?.click();
        }
    }

    // 색상 팔레트 이벤트 설정
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', async function() {
            // ColorPaletteManager가 초기화된 경우 해당 매니저가 전체 흐름을 관리하도록 위임
            if (window.ColorPaletteManager) {
                return;
            }

            const hexColor = this.dataset.hex || this.style.background;
            currentColor = hexColor;
            window.currentColor = hexColor;

            const colorIndex = this.dataset.color;
            document.getElementById('currentColor').style.background = hexColor;
            console.log('🎨 색상 선택:', hexColor, '(인덱스:', colorIndex, ')');

            if (window.SupabaseManager) {
                try {
                    await window.SupabaseManager.saveCurrentColor(currentColor);
                    console.log('✅ 색상 저장 완료:', currentColor);
                } catch (error) {
                    console.error('❌ 색상 저장 실패:', error);
                }
            }

            document.querySelectorAll('.color-item').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });

    function registerColorPaletteBridge() {
        if (!window.ColorPaletteManager || window.ColorPaletteManager.__utilsBridgeBound) {
            return;
        }

        window.ColorPaletteManager.__utilsBridgeBound = true;
        window.ColorPaletteManager.onColorSelection(async (index, color) => {
            const hexColor = color ? color.hex : null;

            if (hexColor) {
                currentColor = hexColor;
                window.currentColor = hexColor;
                const chip = document.getElementById('currentColor');
                if (chip) {
                    chip.style.background = hexColor;
                }
            } else {
                currentColor = null;
                window.currentColor = null;
                const chip = document.getElementById('currentColor');
                if (chip) {
                    chip.style.background = 'transparent';
                }
            }

            if (window.SupabaseManager && hexColor) {
                try {
                    await window.SupabaseManager.saveCurrentColor(hexColor || '');
                    console.log('✅ 색상 저장 완료:', hexColor);
                } catch (error) {
                    console.error('❌ 색상 저장 실패:', error);
                }
            }
        });
    }

    registerColorPaletteBridge();
    window.addEventListener('color-palette-ready', registerColorPaletteBridge);

    // 페이지 로드시 저장된 색상 및 상태 복원 (SupabaseManager 로드 후 실행)
    setTimeout(loadSavedColorAndState, 1000);
    
    // 저장 버튼과 초기화 버튼 이벤트는 parcel.js에서 처리됨
    // 중복 이벤트 리스너 제거
    
    // 저장된 캘린더 URL 복원
    const savedCalendarUrl = localStorage.getItem('googleCalendarUrl');
    if (savedCalendarUrl) {
        const iframe = document.querySelector('#calendarContainer iframe');
        if (iframe) {
            // URL 형식에 따라 처리
            let calendarSrc = '';
            if (savedCalendarUrl.includes('calendar.google.com')) {
                calendarSrc = savedCalendarUrl;
            } else {
                calendarSrc = `https://calendar.google.com/calendar/embed?height=400&wkst=2&bgcolor=%23ffffff&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&src=${encodeURIComponent(savedCalendarUrl)}&color=%230B8043`;
            }
            iframe.src = calendarSrc;
        }
    }
    
    // 필지 정보 삭제 버튼 이벤트 리스너
    const deleteParcelInfoBtn = document.getElementById('deleteParcelInfoBtn');
    if (deleteParcelInfoBtn) {
        deleteParcelInfoBtn.addEventListener('click', function() {
            deleteCurrentParcel();
        });
    }
    
    // console.log('이벤트 리스너 설정 완료');
});

// 저장된 필지 데이터 가져오기
function getSavedParcelData(pnu) {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    return savedData.find(item => item.pnu === pnu);
}

// 지번 정보 포맷팅
function formatJibun(properties) {
    if (!properties) return '';
    
    let dong = '';
    let jibun = '';
    let san = '';
    
    // 디버깅용 로그
    // console.log('📋 formatJibun 입력 properties:', properties);
    
    // 1. ADDR 필드에서 동 정보 우선 추출 (가장 정확함)
    if (properties.ADDR || properties.addr) {
        const fullAddr = properties.ADDR || properties.addr;
        
        // "서울특별시 종로구 사직동 980" 형태에서 동 추출
        // 패턴1: "구/군" 다음에 오는 동/리/가/로 (공백 옵션)
        const dongAfterGuMatch = fullAddr.match(/[구군]\s*([가-힣]+(동|리|가|로))/);
        if (dongAfterGuMatch) {
            dong = dongAfterGuMatch[1];
    // console.log('🔍 패턴1으로 동 추출:', dong);
        } else {
            // 패턴2: 숫자 앞에 있는 동/리/가/로
            const dongBeforeNumberMatch = fullAddr.match(/([가-힣]+(동|리|가|로))[\s\d]/);
            if (dongBeforeNumberMatch) {
                dong = dongBeforeNumberMatch[1];
    // console.log('🔍 패턴2로 동 추출:', dong);
            } else {
                // 패턴3: 마지막에 나오는 동/리/가/로 (더 정확한 패턴)
                const lastDongMatch = fullAddr.match(/([가-힣]+(동|리|가|로))(?!.*[동리가로])/);
                if (lastDongMatch) {
                    dong = lastDongMatch[1];
    // console.log('🔍 패턴3으로 동 추출:', dong);
                } else {
                    // 패턴4: 그냥 동/리/가/로 찾기
                    const simpleDongMatch = fullAddr.match(/([가-힣]+(동|리|가|로))/);
                    if (simpleDongMatch) {
                        dong = simpleDongMatch[1];
    // console.log('🔍 패턴4로 동 추출:', dong);
                    }
                }
            }
        }
    }
    
    // 2. 기본 필드에서 동 정보 추출 (ADDR에서 못 찾은 경우)
    if (!dong) {
        dong = properties.EMD_NM || properties.emd_nm ||           // 읍면동명
               properties.LDONG_NM || properties.ldong_nm ||       // 법정동명
               properties.LI_NM || properties.li_nm ||             // 리명
               properties.NU_NM || properties.nu_nm ||             // 지명
               properties.dong || properties.DONG ||               // 일반 동
               properties.ri || properties.RI ||                   // 리
               properties.lee || properties.LEE || '';             // 리(다른표기)
    }
    
    // 3. JIBUN 필드 처리
    if (properties.JIBUN || properties.jibun) {
        const fullJibun = properties.JIBUN || properties.jibun;
        
        // "사직동 344" 또는 "980답" 형태 처리
        const dongInJibun = fullJibun.match(/^([가-힣]+(동|리|가|로))\s+/);
        if (dongInJibun) {
            // JIBUN에 동 정보가 포함된 경우
            if (!dong) dong = dongInJibun[1];
            const jibunPart = fullJibun.replace(dongInJibun[0], '');
            jibun = jibunPart.replace(/[^0-9-]/g, '').trim();
        } else {
            // JIBUN에 동 정보가 없는 경우 (예: "980답", "344단")
            jibun = fullJibun.replace(/[^0-9-]/g, '').trim();
        }
    }
    
    // 4. 산 여부 확인
    if (properties.SAN || properties.san) {
        const sanValue = properties.SAN || properties.san;
        if (sanValue === '2' || sanValue === 2 || sanValue === '산') {
            san = '산';
        }
    }
    
    // 5. 본번-부번 추출 (지번이 아직 없는 경우에만)
    if (!jibun) {
        const bonbun = properties.BONBUN || properties.bonbun || 
                       properties.JIBUN_BONBUN || properties.jibun_bonbun || '';
        const bubun = properties.BUBUN || properties.bubun || 
                      properties.JIBUN_BUBUN || properties.jibun_bubun || '';
        
        if (bonbun) {
            // 본번에서 숫자만 추출
            const bonbunNum = bonbun.toString().replace(/[^0-9]/g, '');
            jibun = bonbunNum;
            
            // 부번이 있고 0이 아닌 경우 추가
            if (bubun && bubun !== '0' && bubun !== '00' && bubun !== '000' && bubun !== '0000') {
                const bubunNum = bubun.toString().replace(/[^0-9]/g, '');
                if (bubunNum && bubunNum !== '0') {
                    jibun += '-' + bubunNum;
                }
            }
        }
    }
    
    // 6. 여전히 지번이 없으면 ADDR에서 추출
    if (!jibun && (properties.ADDR || properties.addr)) {
        const fullAddr = properties.ADDR || properties.addr;
        // 숫자와 하이픈 패턴 찾기 (예: 344, 344-1, 344-12)
        const numberPattern = fullAddr.match(/(\d+)(-\d+)?(?![가-힣])/);
        if (numberPattern) {
            jibun = numberPattern[0];
        }
    }
    
    // 7. 지번에서 한글(지목: 단, 답, 전 등) 제거
    if (jibun) {
        jibun = jibun.replace(/[가-힣]/g, '').trim();
    }
    
    // 8. PNU에서 동 정보 추출 시도 (최후의 수단)
    if (!dong && (properties.PNU || properties.pnu)) {
        const pnu = properties.PNU || properties.pnu;
        // PNU는 일반적으로 법정동코드(10자리) + 구분(1) + 본번(4) + 부번(4) 형태
        // 하지만 동 이름은 포함하지 않으므로 이 방법은 제한적
        
        // ADDR이나 다른 필드에서 시군구 정보와 함께 사용
        if (properties.SGG_NM || properties.sgg_nm) {
            // 시군구명이 있으면 그것을 참고
            const sgg = properties.SGG_NM || properties.sgg_nm;
            // 종로구 -> 종로, 강남구 -> 강남 등으로 간략화는 하지 않음
        }
    }
    
    // console.log('🏠 추출 결과 - 동:', dong || '없음', ', 지번:', jibun || '없음');
    if (properties.ADDR || properties.addr) {
    // console.log('   ADDR 필드:', properties.ADDR || properties.addr);
    }
    
    // 최종 포맷팅
    let result = '';
    if (dong) {
        result = dong;
        if (san) {
            result += ' ' + san;
        }
        if (jibun) {
            result += ' ' + jibun;
        }
    } else if (jibun) {
        // 동 정보가 없으면 지번만이라도 표시
        if (san) {
            result = san + ' ' + jibun;
        } else {
            result = jibun;
        }
    } else {
        // 아무 정보도 없으면 빈 문자열
        result = '';
    }
    
    return result;
}

// 주소 포맷팅
function formatAddress(properties) {
    if (!properties) return '';
    
    if (properties.addr) {
        return properties.addr;
    }
    
    // addr이 없으면 다른 필드들로 조합
    let parts = [];
    if (properties.sido) parts.push(properties.sido);
    if (properties.sigungu) parts.push(properties.sigungu);
    if (properties.dong) parts.push(properties.dong);
    if (properties.jibun) parts.push(properties.jibun);
    
    return parts.join(' ');
}

// 구글 캘린더 토글
function toggleCalendar() {
    const container = document.getElementById('calendarContainer');
    const toggle = document.getElementById('calendarToggle');
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        toggle.textContent = '▲';
        
        // 저장된 캘린더 URL이 있으면 로드
        const savedUrl = localStorage.getItem('googleCalendarUrl');
        if (savedUrl) {
            document.getElementById('calendarUrl').value = savedUrl;
        }
    } else {
        container.style.display = 'none';
        toggle.textContent = '▼';
    }
}

// 구글 캘린더 업데이트
function updateCalendar() {
    const urlInput = document.getElementById('calendarUrl').value.trim();
    
    if (!urlInput) {
        alert('구글 캘린더 공유 URL을 입력해주세요.');
        return;
    }
    
    // URL에서 캘린더 ID 추출
    let calendarSrc = '';
    
    if (urlInput.includes('calendar.google.com')) {
        // 이미 완전한 URL인 경우
        if (urlInput.includes('/embed')) {
            calendarSrc = urlInput;
        } else if (urlInput.includes('src=')) {
            // URL에서 src 파라미터 추출
            const match = urlInput.match(/src=([^&]+)/);
            if (match) {
                const calendarId = decodeURIComponent(match[1]);
                calendarSrc = `https://calendar.google.com/calendar/embed?height=400&wkst=2&bgcolor=%23ffffff&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&src=${encodeURIComponent(calendarId)}&color=%230B8043`;
            }
        } else {
            // 캘린더 ID만 있는 경우
            calendarSrc = `https://calendar.google.com/calendar/embed?height=400&wkst=2&bgcolor=%23ffffff&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&src=${encodeURIComponent(urlInput)}&color=%230B8043`;
        }
    } else {
        // 이메일 형식의 캘린더 ID
        calendarSrc = `https://calendar.google.com/calendar/embed?height=400&wkst=2&bgcolor=%23ffffff&ctz=Asia%2FSeoul&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=AGENDA&src=${encodeURIComponent(urlInput)}&color=%230B8043`;
    }
    
    // iframe 업데이트
    const iframe = document.querySelector('#calendarContainer iframe');
    if (iframe && calendarSrc) {
        iframe.src = calendarSrc;
        localStorage.setItem('googleCalendarUrl', urlInput);
        alert('캘린더가 업데이트되었습니다.');
    }
}

// 현재 선택된 필지 정보 초기화 함수 (색상은 유지, 마커는 제거)
async function deleteCurrentParcel() {
    const currentPNU = window.currentSelectedPNU;
    const parcelNumber = document.getElementById('parcelNumber').value;

    if (!currentPNU && !parcelNumber) {
        alert('초기화할 필지가 선택되지 않았습니다.');
        return;
    }

    const confirmReset = confirm(`필지 "${parcelNumber}"를 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.\n색상, 정보, 마커가 모두 제거되며 새로고침 후에도 복원되지 않습니다.`);
    if (!confirmReset) {
        return;
    }

    try {
        // 1. 모든 LocalStorage 키에서 해당 필지를 완전히 삭제
        // 동적으로 localStorage의 모든 키를 확인하여 필지 관련 키 찾기
        const allStorageKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
                key.includes('parcel') ||
                key.includes('Parcel') ||
                key === 'parcels' ||
                key === 'clickParcelData' ||
                key === 'searchParcels'
            )) {
                allStorageKeys.push(key);
            }
        }

        // 기본 키들도 추가 (혹시 누락된 것이 있을 수 있음)
        const defaultKeys = [
            CONFIG.STORAGE_KEY,           // 'parcelData'
            'parcels_current_session',    // 실제 저장되는 키
            'parcels',                    // 다른 가능한 키
            'parcelData_backup',          // 백업 키
            'clickParcelData',            // 클릭 모드 데이터
            'searchParcels'               // 검색 필지 데이터
        ];

        const storageKeys = [...new Set([...allStorageKeys, ...defaultKeys])]; // 중복 제거
        console.log(`🔍 완전 삭제 대상 localStorage 키: ${storageKeys.join(', ')}`);

        // 각 키에서 데이터 완전 삭제
        storageKeys.forEach(key => {
            try {
                const data = localStorage.getItem(key);
                if (!data || data === 'null' || data === 'undefined') {
                    return; // 이 키는 건너뛰기
                }

                // clickParcelData는 문자열일 수 있음
                if (key === 'clickParcelData' && typeof JSON.parse(data) === 'string') {
                    localStorage.removeItem(key); // 잘못된 데이터 제거
                    return;
                }

                const savedData = JSON.parse(data);
                if (!Array.isArray(savedData)) {
                    return; // 배열이 아니면 건너뛰기
                }

                // 해당 필지를 배열에서 완전히 제거
                const updatedData = savedData.filter(item => {
                    // PNU, parcelNumber, parcel_name, id 등 다양한 식별자로 매칭
                    const matches = (
                        item.pnu === currentPNU ||
                        item.parcelNumber === parcelNumber ||
                        item.parcel_name === parcelNumber ||
                        (currentPNU && item.id && item.id.toString().includes(currentPNU.slice(-6))) // ID 부분 매칭
                    );
                    return !matches; // 매칭되지 않는 것만 유지 (매칭되는 것은 삭제)
                });

                localStorage.setItem(key, JSON.stringify(updatedData));
                console.log(`✅ ${key}에서 필지 완전 삭제: ${savedData.length} -> ${updatedData.length}개`);
            } catch (e) {
                console.warn(`⚠️ ${key} 처리 중 오류:`, e);
            }
        });

        // 2. 색상 정보 완전 삭제 (parcelColors에서 제거)
        if (currentPNU) {
            try {
                const parcelColors = JSON.parse(localStorage.getItem('parcelColors') || '{}');
                if (parcelColors && parcelColors[currentPNU] !== undefined) {
                    delete parcelColors[currentPNU];
                    localStorage.setItem('parcelColors', JSON.stringify(parcelColors));
                    console.log(`✅ parcelColors에서 필지 색상 삭제: ${currentPNU}`);
                }

                // ColorPaletteManager를 통한 색상 제거
                if (window.ColorPaletteManager && window.ColorPaletteManager.removeColorFromParcel) {
                    window.ColorPaletteManager.removeColorFromParcel(currentPNU);
                    console.log(`✅ ColorPaletteManager에서 색상 제거: ${currentPNU}`);
                }
            } catch (e) {
                console.warn('색상 정보 삭제 중 오류:', e);
            }
        }

        // 3. Supabase에서도 완전히 삭제
        if (window.SupabaseManager && window.SupabaseManager.deleteParcel && currentPNU) {
            try {
                await window.SupabaseManager.deleteParcel(currentPNU);
                console.log('✅ Supabase에서 필지 완전 삭제:', currentPNU);
            } catch (supabaseError) {
                console.error('⚠️ Supabase 삭제 실패 (로컬은 성공):', supabaseError);
                // Supabase 실패해도 계속 진행 (로컬은 이미 업데이트됨)
            }
        }

        // 4. 폼 초기화 (마커 생성 방지를 위해 지번도 초기화)
        document.getElementById('parcelNumber').value = ''; // 지번도 초기화해야 마커가 생성되지 않음
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';

        // 4. 마커 제거 (정보가 없으므로)
        if (window.MemoMarkerManager && currentPNU) {
            try {
                window.MemoMarkerManager.removeMemoMarker(currentPNU);
                // 보조: markerStates 로컬 캐시에서도 제거 (존재 시)
                try {
                    const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
                    if (markerStates && markerStates[currentPNU]) {
                        delete markerStates[currentPNU];
                        localStorage.setItem('markerStates', JSON.stringify(markerStates));
                    }
                } catch (e) {
                    // ignore
                }
            } catch (err) {
                console.warn('마커 제거 중 오류:', err);
            }
        }

        // 5. 필지 목록 업데이트
        if (window.parcelManager && window.parcelManager.renderParcelList) {
            window.parcelManager.renderParcelList();
        }

    // console.log('✅ 필지 완전 삭제 완료:', currentPNU || parcelNumber);
        // 성공 메시지는 콘솔에만 표시 (알림 제거)
        console.log(`✅ 필지 "${parcelNumber}"가 완전히 삭제되었습니다. (색상, 정보, 마커 모두 제거)`);

    } catch (error) {
        console.error('❌ 필지 정보 초기화 실패:', error);
        alert('필지 정보 초기화 중 오류가 발생했습니다.');
    }
}

// ===========================
// 삭제된 필지 추적 시스템
// ===========================

/**
 * 삭제된 필지 목록 가져오기
 */
function getDeletedParcels() {
    try {
        const deleted = localStorage.getItem('deletedParcels');
        return deleted ? JSON.parse(deleted) : [];
    } catch (error) {
        console.error('❌ 삭제 목록 로드 실패:', error);
        return [];
    }
}

/**
 * 필지를 삭제 목록에 추가
 */
function addToDeletedParcels(pnu) {
    try {
        const deleted = getDeletedParcels();
        if (!deleted.includes(pnu)) {
            deleted.push(pnu);
            localStorage.setItem('deletedParcels', JSON.stringify(deleted));
            console.log(`🗑️ 삭제 목록에 추가: ${pnu}`);
        }
    } catch (error) {
        console.error('❌ 삭제 목록 추가 실패:', error);
    }
}

/**
 * 필지를 삭제 목록에서 제거 (재생성 시)
 */
function removeFromDeletedParcels(pnu) {
    try {
        const deleted = getDeletedParcels();
        const index = deleted.indexOf(pnu);
        if (index > -1) {
            deleted.splice(index, 1);
            localStorage.setItem('deletedParcels', JSON.stringify(deleted));
            console.log(`♻️ 삭제 목록에서 제거: ${pnu}`);
        }
    } catch (error) {
        console.error('❌ 삭제 목록 제거 실패:', error);
    }
}

/**
 * 필지가 삭제되었는지 확인
 */
function isParcelDeleted(pnu) {
    const deleted = getDeletedParcels();
    return deleted.includes(pnu);
}

/**
 * 모든 localStorage 키에서 필지 완전 삭제
 */
function removeParcelFromAllStorage(pnu) {
    const storageKeys = ['parcelData', 'clickParcelData', 'parcels', 'parcels_current_session', 'parcelData_backup'];
    let totalRemoved = 0;

    for (const key of storageKeys) {
        try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const originalLength = data.length;
            const filtered = data.filter(item => {
                const itemPNU = item.pnu || item.id ||
                    (item.properties && (item.properties.PNU || item.properties.pnu));
                return itemPNU !== pnu;
            });

            if (filtered.length < originalLength) {
                localStorage.setItem(key, JSON.stringify(filtered));
                totalRemoved += originalLength - filtered.length;
                console.log(`✅ ${key}에서 ${originalLength - filtered.length}개 항목 제거`);
            }
        } catch (error) {
            console.error(`❌ ${key} 처리 실패:`, error);
        }
    }

    // parcelColors에서도 제거
    try {
        ParcelColorStorage.remove(pnu);
        console.log('✅ parcelColors에서 제거');
    } catch (error) {
        console.error('❌ parcelColors 처리 실패:', error);
    }

    // markerStates에서도 제거
    try {
        const markerStates = JSON.parse(localStorage.getItem('markerStates') || '{}');
        if (markerStates[pnu]) {
            delete markerStates[pnu];
            localStorage.setItem('markerStates', JSON.stringify(markerStates));
            console.log('✅ markerStates에서 제거');
        }
    } catch (error) {
        console.error('❌ markerStates 처리 실패:', error);
    }

    console.log(`🗑️ 총 ${totalRemoved}개 항목이 모든 저장소에서 제거됨`);
    return totalRemoved;
}

// 전역으로 노출
window.getDeletedParcels = getDeletedParcels;
window.addToDeletedParcels = addToDeletedParcels;
window.removeFromDeletedParcels = removeFromDeletedParcels;
window.isParcelDeleted = isParcelDeleted;
window.removeParcelFromAllStorage = removeParcelFromAllStorage;
