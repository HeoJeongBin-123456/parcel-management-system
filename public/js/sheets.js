// Google Sheets 연동

// Google Apps Script URL (배포 후 설정 필요)
const GOOGLE_SCRIPT_URL = CONFIG.GOOGLE_SHEETS_URL || '';

// 색상 HEX를 한글명으로 변환
function getColorName(hexColor) {
    const colorMap = {
        '#FF0000': '빨강',
        '#FFA500': '주황',
        '#FFFF00': '노랑',
        '#90EE90': '연두',
        '#0000FF': '파랑',
        '#000000': '검정',
        '#FFFFFF': '흰색',
        '#87CEEB': '하늘',
        'transparent': '없음'
    };
    return colorMap[hexColor] || hexColor;
}

// 현재 필지만 구글 시트로 전송
async function exportCurrentParcelToGoogleSheets() {
    // 로그인 확인
    if (!GoogleAuth.isAuthenticated()) {
        alert('구글 로그인이 필요합니다.\n로그인 페이지로 이동합니다.');
        GoogleAuth.redirectToLogin();
        return;
    }
    
    // 현재 선택된 필지 확인
    if (!currentSelectedPNU) {
        alert('선택된 필지가 없습니다.\n필지를 먼저 선택해주세요.');
        return;
    }
    
    // 폼에 입력된 현재 데이터 가져오기
    const currentData = {
        지번: document.getElementById('parcelNumber').value,
        소유자이름: document.getElementById('ownerName').value,
        소유자주소: document.getElementById('ownerAddress').value,
        연락처: document.getElementById('ownerContact').value,
        메모: document.getElementById('memo').value || ''
    };
    
    // 필수 정보 확인
    if (!currentData.지번 || !currentData.소유자이름) {
        alert('지번과 소유자 이름은 필수 입니다.');
        return;
    }
    
    // 액세스 토큰 확인 및 요청
    if (!GoogleAuth.getAccessToken()) {
    // console.log('액세스 토큰이 없습니다. 권한 요청을 시작합니다.');
        
        // Google OAuth2 토큰 요청
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GoogleAuth.CLIENT_ID,
            scope: GoogleAuth.SCOPES,
            callback: async (tokenResponse) => {
    // console.log('액세스 토큰 획득 성공');
                GoogleAuth.saveTokens(tokenResponse);
                
                // 토큰 획득 후 다시 시도
                await exportCurrentParcelToGoogleSheets();
            },
            error_callback: (error) => {
                console.error('액세스 토큰 획듍 실패:', error);
                alert('구글 시트 접근 권한 승인에 실패했습니다.\n다시 시도해주세요.');
            }
        });
        
        tokenClient.requestAccessToken();
        return;
    }
    
    try {
    // console.log('현재 필지를 Google Sheets로 전송 시작...');
        
        // 스프레드시트 ID 가져오기 또는 생성
        let spreadsheetId = localStorage.getItem('googleSpreadsheetId');
        
        if (!spreadsheetId) {
    // console.log('새 스프레드시트 생성 중...');
            spreadsheetId = await GoogleAuth.getOrCreateSpreadsheet();
            
            if (spreadsheetId) {
                localStorage.setItem('googleSpreadsheetId', spreadsheetId);
    // console.log('스프레드시트 생성 완료:', spreadsheetId);
            } else {
                throw new Error('스프레드시트 생성 실패');
            }
        }
        
        // 데이터 추가
        const result = await GoogleAuth.appendToSheet(spreadsheetId, [currentData]);
        
        if (result) {
    // console.log('전송 완료:', result);
            alert(`현재 필지(고련${currentData.지번})가 구글 시트에 저장되었습니다!\n\n시트 열기: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
            
            // 시트 URL 자동으로 열기 (선택사항)
            if (confirm('구글 시트를 새 탭에서 열까요?')) {
                window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
            }
        } else {
            throw new Error('데이터 전송 실패');
        }
        
    } catch (error) {
        console.error('전송 실패:', error);
        alert('전송 중 오류가 발생했습니다.\n\n가능한 원인:\n1. 액세스 토큰 만료\n2. 네트워크 연결 문제\n3. API 권한 부족\n\n다시 로그인 해주세요.');
        
        // 토큰 만료 시 재로그인
        if (error.message.includes('401') || error.message.includes('403')) {
            GoogleAuth.refreshToken();
            GoogleAuth.redirectToLogin();
        }
    }
}

// 전체 필지 구글 시트로 전송 (dataToExport 매개변수 추가)
async function exportToGoogleSheets(dataToExport = null) {
    // 로그인 확인
    if (!GoogleAuth.isAuthenticated()) {
        alert('구글 로그인이 필요합니다.\n로그인 페이지로 이동합니다.');
        GoogleAuth.redirectToLogin();
        return;
    }
    
    // 액세스 토큰 확인 및 요청
    if (!GoogleAuth.getAccessToken()) {
    // console.log('액세스 토큰이 없습니다. 권한 요청을 시작합니다.');
        
        // Google OAuth2 토큰 요청
        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GoogleAuth.CLIENT_ID,
            scope: GoogleAuth.SCOPES,
            callback: async (tokenResponse) => {
    // console.log('액세스 토큰 획득 성공');
                GoogleAuth.saveTokens(tokenResponse);
                
                // 토큰 획득 후 다시 시도
                await exportToGoogleSheets(dataToExport);
            },
            error_callback: (error) => {
                console.error('액세스 토큰 획득 실패:', error);
                alert('구글 시트 접근 권한 승인에 실패했습니다.\n다시 시도해주세요.');
            }
        });
        
        tokenClient.requestAccessToken();
        return;
    }
    
    // 데이터 준비: 매개변수로 받은 데이터 또는 localStorage에서 가져오기
    const savedData = dataToExport || JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    
    if (savedData.length === 0) {
        alert('전송할 필지 데이터가 없습니다.');
        return;
    }
    
    // 전송할 데이터 준비 - 필수 5가지 정보
    const dataToSend = savedData.map(item => ({
        지번: item.parcelNumber || item.지번 || '',
        소유자이름: item.ownerName || item.소유자이름 || '',
        소유자주소: item.ownerAddress || item.소유자주소 || '',
        연락처: item.ownerContact || item.연락처 || '',
        메모: item.memo || item.메모 || ''
    }));
    
    try {
    // console.log('Google Sheets로 자동 전송 시작...');
        
        // 스프레드시트 ID 가져오기 또는 생성
        let spreadsheetId = localStorage.getItem('googleSpreadsheetId');
        
        if (!spreadsheetId) {
    // console.log('새 스프레드시트 생성 중...');
            spreadsheetId = await GoogleAuth.getOrCreateSpreadsheet();
            
            if (spreadsheetId) {
                localStorage.setItem('googleSpreadsheetId', spreadsheetId);
    // console.log('스프레드시트 생성 완료:', spreadsheetId);
            } else {
                throw new Error('스프레드시트 생성 실패');
            }
        }
        
        // 데이터 추가
        const result = await GoogleAuth.appendToSheet(spreadsheetId, dataToSend);
        
        if (result) {
    // console.log('전송 완료:', result);
            alert(`구글 시트로 ${savedData.length}개의 데이터가 전송되었습니다!\n\n시트 열기: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
            
            // 시트 URL 자동으로 열기 (선택사항)
            if (confirm('구글 시트를 새 탭에서 열까요?')) {
                window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
            }
        } else {
            throw new Error('데이터 전송 실패');
        }
        
    } catch (error) {
        console.error('전송 실패:', error);
        alert('전송 중 오류가 발생했습니다.\n\n가능한 원인:\n1. 액세스 토큰 만료\n2. 네트워크 연결 문제\n3. API 권한 부족\n\n다시 로그인 해주세요.');
        
        // 토큰 만료 시 재로그인
        if (error.message.includes('401') || error.message.includes('403')) {
            GoogleAuth.refreshToken();
            GoogleAuth.redirectToLogin();
        }
    }
}

// Google Apps Script 가이드 표시
function showGoogleAppsScriptGuide() {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modalBody');
    
    modalBody.innerHTML = `
        <h2>Google Apps Script 설정 가이드</h2>
        <ol>
            <li>
                <strong>Google Sheets 생성</strong>
                <p>새 Google Sheets를 만들고 첫 번째 행에 다음 헤더를 추가:</p>
                <code>지번 | 소유자이름 | 소유자주소 | 연락처 | 메모</code>
            </li>
            <li>
                <strong>Apps Script 생성</strong>
                <p>도구 → 스크립트 편집기 클릭</p>
            </li>
            <li>
                <strong>코드 붙여넣기</strong>
                <pre style="background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto;">
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'addData') {
      // 헤더가 없으면 추가
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          '지번', '소유자이름', '소유자주소', 
          '연락처', '메모'
        ]);
        // 지번 열(A열) 왼쪽 정렬
        sheet.getRange('A:A').setHorizontalAlignment('left');
      }
      
      // 데이터 추가
      data.data.forEach(row => {
        sheet.appendRow([
          row.지번 || '',
          row.소유자이름 || '',
          row.소유자주소 || '',
          row.연락처 || '',
          row.메모 || ''
        ]);
      });
      
      // 지번 열 왼쪽 정렬 유지
      sheet.getRange('A:A').setHorizontalAlignment('left');
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({status: 'success', rows: data.data.length}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({status: 'error', message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({status: 'ready'}))
    .setMimeType(ContentService.MimeType.JSON);
}
                </pre>
            </li>
            <li>
                <strong>배포 (중요!)</strong>
                <p>배포 → 새 배포 → 웹 앱으로 배포</p>
                <p><strong style="color: red;">실행 사용자: 나</strong></p>
                <p><strong style="color: red;">액세스 권한: 모든 사용자</strong></p>
                <p style="color: orange;">⚠️ 반드시 위 설정대로 해야 CORS 오류 없이 작동합니다!</p>
            </li>
            <li>
                <strong>URL 복사</strong>
                <p>배포된 URL을 복사하여 config.js의 GOOGLE_SHEETS_URL에 설정</p>
            </li>
        </ol>
        <button onclick="document.getElementById('modal').style.display='none'" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">닫기</button>
    `;
    
    modal.style.display = 'block';
}

// 모달 닫기
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close');
    
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    }
    
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
});

// 데이터를 클립보드에 복사 (엑셀 붙여넣기용)
function copyDataToClipboard() {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    
    if (savedData.length === 0) {
        alert('저장된 필지 정보가 없습니다.\n필지를 먼저 저장해주세요.');
        return;
    }
    
    let currentParcelData;
    
    // 1. 현재 선택된 필지가 있다면 우선 사용
    if (currentSelectedPNU) {
        currentParcelData = savedData.find(item => item.pnu === currentSelectedPNU);
    }
    
    // 2. 선택된 필지가 없거나 찾을 수 없다면, 입력 폼의 데이터를 기준으로 찾기
    if (!currentParcelData) {
        const formParcelNumber = document.getElementById('parcelNumber')?.value?.trim();
        const formOwnerName = document.getElementById('ownerName')?.value?.trim();
        
        if (formParcelNumber) {
            // 지번으로 찾기
            currentParcelData = savedData.find(item => item.parcelNumber === formParcelNumber);
        }
        
        if (!currentParcelData && formOwnerName) {
            // 소유자명으로 찾기
            currentParcelData = savedData.find(item => item.ownerName === formOwnerName);
        }
    }
    
    // 3. 그래도 없다면 가장 최근 저장된 데이터 사용
    if (!currentParcelData) {
        // timestamp나 createdAt 기준으로 최신 데이터 찾기
        currentParcelData = savedData.sort((a, b) => {
            const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
            const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
            return timeB - timeA;
        })[0];
        
        if (currentParcelData) {
    // console.log('📋 가장 최근 저장된 필지 정보를 복사합니다:', currentParcelData.parcelNumber);
        }
    }
    
    if (!currentParcelData) {
        alert('복사할 필지 정보를 찾을 수 없습니다.');
        return;
    }
    
    // 탭으로 구분된 데이터 (헤더 제외, 실제 내용만)
    let tableData = `${currentParcelData.parcelNumber || ''}\t${currentParcelData.ownerName || ''}\t${currentParcelData.ownerAddress || ''}\t${currentParcelData.ownerContact || ''}`;
    
    // 클립보드에 복사
    navigator.clipboard.writeText(tableData).then(() => {
        alert(`선택된 필지(${currentParcelData.parcelNumber})의 정보가 클립보드에 복사되었습니다.\n\n엑셀에서 Ctrl+V로 붙여넣기 하세요.`);
    }).catch(err => {
        // 폴백: textarea를 사용한 복사
        const textarea = document.createElement('textarea');
        textarea.value = tableData;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert(`${savedData.length}개의 필지 정보가 클립보드에 복사되었습니다.\n\n엑셀에서 Ctrl+V로 붙여넣기 하세요.`);
    });
}

// CSV 다운로드 (대체 방법) - 필요시 사용 가능
function downloadAsCSV() {
    const savedData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    
    if (savedData.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
    }
    
    // CSV 헤더
    let csv = '\uFEFF지번,소유자이름,소유자주소,연락처,메모,색상,저장일시\n';
    
    // 데이터 추가
    savedData.forEach(item => {
        csv += `"${item.parcelNumber || ''}","${item.ownerName || ''}","${item.ownerAddress || ''}","${item.ownerContact || ''}","${item.memo || ''}","${item.color || ''}","${item.timestamp || ''}"\n`;
    });
    
    // 다운로드
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `필지정보_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}