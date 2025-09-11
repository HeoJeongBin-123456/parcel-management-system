// 유틸리티 함수들

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
    
    // 색상 팔레트 이벤트 설정
    document.querySelectorAll('.color-item').forEach(item => {
        item.addEventListener('click', function() {
            currentColor = this.dataset.color;
            document.getElementById('currentColor').style.background = currentColor;
    // console.log('색상 선택:', currentColor);
            
            // 활성 색상 표시
            document.querySelectorAll('.color-item').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // 초기 색상 설정
    document.querySelector('.color-item[data-color="#FF0000"]')?.click();
    
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
    
    // 필지 삭제 버튼 이벤트 리스너
    const deleteParcelBtn = document.getElementById('deleteParcelBtn');
    if (deleteParcelBtn) {
        deleteParcelBtn.addEventListener('click', function() {
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

// 현재 선택된 필지 삭제 함수
function deleteCurrentParcel() {
    const currentPNU = window.currentSelectedPNU;
    const parcelNumber = document.getElementById('parcelNumber').value;
    
    if (!currentPNU && !parcelNumber) {
        alert('삭제할 필지가 선택되지 않았습니다.');
        return;
    }
    
    const confirmDelete = confirm(`필지 "${parcelNumber}"을(를) 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmDelete) {
        return;
    }
    
    try {
        // 1. 지도에서 폴리곤 제거
        if (currentPNU && window.clickParcels && window.clickParcels.has(currentPNU)) {
            const parcelData = window.clickParcels.get(currentPNU);
            if (parcelData && parcelData.polygon) {
                // 폴리곤 색상 완전히 제거
                parcelData.polygon.setOptions({
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    strokeColor: '#0000FF',
                    strokeOpacity: 0.6,
                    strokeWeight: 0.5
                });
                parcelData.color = 'transparent';
            }
        }
        
        // 2. LocalStorage에서 제거
        const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
        const updatedData = savedData.filter(item => 
            item.pnu !== currentPNU && 
            item.parcelNumber !== parcelNumber
        );
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(updatedData));
        
        // 3. 폼 초기화
        document.getElementById('parcelNumber').value = '';
        document.getElementById('ownerName').value = '';
        document.getElementById('ownerAddress').value = '';
        document.getElementById('ownerContact').value = '';
        document.getElementById('memo').value = '';
        window.currentSelectedPNU = null;
        
        // 4. 필지 목록 업데이트
        if (window.parcelManager && window.parcelManager.renderParcelList) {
            window.parcelManager.renderParcelList();
        }
        
    // console.log('✅ 필지 삭제 완료:', currentPNU || parcelNumber);
        alert(`필지 "${parcelNumber}"이(가) 삭제되었습니다.`);
        
    } catch (error) {
        console.error('❌ 필지 삭제 실패:', error);
        alert('필지 삭제 중 오류가 발생했습니다.');
    }
}