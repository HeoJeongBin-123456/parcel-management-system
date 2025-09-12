// 백업 관리 UI 컨트롤러
class BackupUI {
    constructor() {
        this.isBackupModalOpen = false;
        this.refreshInterval = null;
        
        console.log('🎛️ BackupUI 초기화');
        this.initializeBackupUI();
    }

    // 백업 UI 초기화
    initializeBackupUI() {
        // 페이지 로드 시 초기화
        document.addEventListener('DOMContentLoaded', () => {
            this.loadBackupSettings();
            this.setupEventListeners();
        });
    }

    // 백업 모달 열기
    openBackupModal() {
        const modal = document.getElementById('backupModal');
        if (modal) {
            modal.style.display = 'block';
            this.isBackupModalOpen = true;
            
            // 백업 상태 새로고침
            this.refreshBackupStatus();
            this.refreshBackupHistory();
            
            // 주기적 새로고침 시작 (30초마다)
            this.refreshInterval = setInterval(() => {
                this.refreshBackupStatus();
            }, 30000);
            
            console.log('📦 백업 관리 모달 열림');
        }
    }

    // 백업 모달 닫기
    closeBackupModal() {
        const modal = document.getElementById('backupModal');
        if (modal) {
            modal.style.display = 'none';
            this.isBackupModalOpen = false;
            
            // 주기적 새로고침 중단
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            
            console.log('📦 백업 관리 모달 닫힘');
        }
    }

    // 백업 상태 새로고침
    async refreshBackupStatus() {
        if (!window.advancedBackupManager) {
            console.warn('AdvancedBackupManager가 없습니다');
            return;
        }

        try {
            const status = window.advancedBackupManager.getStatus();
            
            // 일일 백업 상태 업데이트
            const dailyStatusEl = document.getElementById('dailyBackupStatus');
            const dailyTimeEl = document.getElementById('dailyBackupTime');
            
            if (dailyStatusEl && dailyTimeEl) {
                if (status.lastDailyBackup) {
                    const daysSince = Math.floor((new Date() - status.lastDailyBackup) / (1000 * 60 * 60 * 24));
                    dailyStatusEl.textContent = daysSince === 0 ? '✅ 최신' : 
                                              daysSince === 1 ? '⚠️ 1일 전' : 
                                              `❌ ${daysSince}일 전`;
                    dailyTimeEl.textContent = `마지막: ${status.lastDailyBackup.toLocaleString('ko-KR')}`;
                } else {
                    dailyStatusEl.textContent = '❌ 백업 없음';
                    dailyTimeEl.textContent = '백업이 필요합니다';
                }
            }

            // 월간 백업 상태 업데이트
            const monthlyStatusEl = document.getElementById('monthlyBackupStatus');
            const monthlyTimeEl = document.getElementById('monthlyBackupTime');
            
            if (monthlyStatusEl && monthlyTimeEl) {
                if (status.lastMonthlyBackup) {
                    const monthsSince = Math.floor((new Date() - status.lastMonthlyBackup) / (1000 * 60 * 60 * 24 * 30));
                    monthlyStatusEl.textContent = monthsSince === 0 ? '✅ 최신' : 
                                                monthsSince === 1 ? '⚠️ 1개월 전' : 
                                                `❌ ${monthsSince}개월 전`;
                    monthlyTimeEl.textContent = `마지막: ${status.lastMonthlyBackup.toLocaleString('ko-KR')}`;
                } else {
                    monthlyStatusEl.textContent = '❌ 백업 없음';
                    monthlyTimeEl.textContent = '백업이 필요합니다';
                }
            }

        } catch (error) {
            console.error('❌ 백업 상태 새로고침 실패:', error);
        }
    }

    // 백업 히스토리 새로고침
    refreshBackupHistory() {
        if (!window.advancedBackupManager) return;

        try {
            const history = window.advancedBackupManager.getBackupHistory(10);
            const historyList = document.getElementById('backupHistoryList');
            
            if (historyList) {
                if (history.length === 0) {
                    historyList.innerHTML = '<p>백업 히스토리가 없습니다.</p>';
                    return;
                }

                const historyHTML = history.map(item => {
                    const statusIcon = item.status === 'completed' ? '✅' : 
                                     item.status === 'failed' ? '❌' : 
                                     item.status === 'skipped' ? 'ℹ️' : '⏳';
                    const typeIcon = item.type === 'daily' ? '📅' : 
                                   item.type === 'monthly' ? '📆' : '⚡';
                    
                    return `
                        <div class="history-item ${item.status}">
                            <div class="history-header">
                                <span class="history-type">${typeIcon} ${item.type}</span>
                                <span class="history-status">${statusIcon} ${item.status}</span>
                                <span class="history-time">${new Date(item.timestamp).toLocaleString('ko-KR')}</span>
                            </div>
                            <div class="history-details">
                                ${item.status === 'skipped' ? `사유: ${item.message || '백업할 데이터가 없음'}` : ''}
                                ${item.dataCount !== undefined ? `데이터: ${item.dataCount}개` : ''}
                                ${item.duration ? `소요시간: ${item.duration}ms` : ''}
                                ${item.error ? `오류: ${item.error}` : ''}
                                ${item.driveUrl ? `<a href="${item.driveUrl}" target="_blank">Google Drive 열기</a>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');

                historyList.innerHTML = historyHTML;
            }

        } catch (error) {
            console.error('❌ 백업 히스토리 새로고침 실패:', error);
        }
    }

    // 수동 백업 실행
    async performManualBackup(type) {
        if (!window.advancedBackupManager) {
            alert('백업 매니저가 초기화되지 않았습니다.');
            return;
        }

        // 버튼 비활성화
        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = '백업 중...';

        try {
            console.log(`🔧 수동 ${type} 백업 시작`);
            
            const result = await window.advancedBackupManager.performManualBackup(type);
            
            if (result.success) {
                if (result.skipped) {
                    this.showBackupNotification(`ℹ️ ${type} 백업 건너뜀: 저장된 데이터 없음`, 'info');
                } else {
                    this.showBackupNotification(`✅ ${type} 백업 완료`, 'success');
                }
                this.refreshBackupStatus();
                this.refreshBackupHistory();
            } else {
                this.showBackupNotification(`❌ ${type} 백업 실패`, 'error');
            }

        } catch (error) {
            console.error(`❌ 수동 ${type} 백업 실패:`, error);
            this.showBackupNotification('❌ 백업 중 오류 발생', 'error');
        } finally {
            // 버튼 복원
            button.disabled = false;
            button.textContent = originalText;
        }
    }

    // 긴급 백업 실행
    performEmergencyBackup() {
        if (!window.advancedBackupManager) {
            alert('백업 매니저가 초기화되지 않았습니다.');
            return;
        }

        try {
            window.advancedBackupManager.performEmergencyBackup();
            this.showBackupNotification('⚡ 긴급 백업 완료', 'success');
        } catch (error) {
            console.error('❌ 긴급 백업 실패:', error);
            this.showBackupNotification('❌ 긴급 백업 실패', 'error');
        }
    }

    // Google Drive 폴더 선택
    async selectGoogleDriveFolder() {
        if (!window.GoogleAuth || !window.GoogleAuth.isAuthenticated()) {
            alert('Google 인증이 필요합니다.');
            return;
        }

        try {
            // Google Picker API를 사용하여 폴더 선택
            // 간단한 구현: 폴더 ID를 직접 입력받도록 함
            const folderId = prompt('Google Drive 폴더 ID를 입력하세요:\n(폴더 URL에서 /folders/ 다음 부분)');
            
            if (folderId && folderId.trim()) {
                localStorage.setItem('google_drive_folder_id', folderId.trim());
                document.getElementById('driveFolder').value = folderId.trim();
                this.showBackupNotification('Google Drive 폴더 설정 완료', 'success');
                console.log('📁 Google Drive 폴더 설정:', folderId.trim());
            }

        } catch (error) {
            console.error('❌ Google Drive 폴더 선택 실패:', error);
            this.showBackupNotification('폴더 선택 실패', 'error');
        }
    }

    // 백업 설정 로드
    loadBackupSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('backup_ui_settings') || '{}');
            
            // 설정값 적용
            const autoBackupEl = document.getElementById('autoBackupEnabled');
            const dailyTimeEl = document.getElementById('dailyBackupTime');
            const driveFolderEl = document.getElementById('driveFolder');
            const notifySuccessEl = document.getElementById('notifySuccess');
            const notifyFailureEl = document.getElementById('notifyFailure');
            const browserNotificationEl = document.getElementById('browserNotification');

            if (autoBackupEl) autoBackupEl.checked = settings.autoBackupEnabled !== false;
            if (dailyTimeEl) dailyTimeEl.value = settings.dailyBackupTime || '02:00';
            if (driveFolderEl) {
                const savedFolderId = localStorage.getItem('google_drive_folder_id');
                driveFolderEl.value = savedFolderId || '';
            }
            if (notifySuccessEl) notifySuccessEl.checked = settings.notifySuccess !== false;
            if (notifyFailureEl) notifyFailureEl.checked = settings.notifyFailure !== false;
            if (browserNotificationEl) browserNotificationEl.checked = settings.browserNotification || false;

            console.log('📋 백업 설정 로드 완료');

        } catch (error) {
            console.error('❌ 백업 설정 로드 실패:', error);
        }
    }

    // 백업 설정 저장
    saveBackupSettings() {
        try {
            const settings = {
                autoBackupEnabled: document.getElementById('autoBackupEnabled')?.checked || true,
                dailyBackupTime: document.getElementById('dailyBackupTime')?.value || '02:00',
                notifySuccess: document.getElementById('notifySuccess')?.checked || true,
                notifyFailure: document.getElementById('notifyFailure')?.checked || true,
                browserNotification: document.getElementById('browserNotification')?.checked || false
            };

            localStorage.setItem('backup_ui_settings', JSON.stringify(settings));
            
            // 브라우저 알림 권한 요청
            if (settings.browserNotification && 'Notification' in window) {
                Notification.requestPermission();
            }

            this.showBackupNotification('✅ 백업 설정 저장 완료', 'success');
            console.log('💾 백업 설정 저장 완료:', settings);

        } catch (error) {
            console.error('❌ 백업 설정 저장 실패:', error);
            this.showBackupNotification('설정 저장 실패', 'error');
        }
    }

    // 백업에서 복원
    async restoreFromBackup() {
        if (!window.advancedBackupManager) {
            alert('백업 매니저가 초기화되지 않았습니다.');
            return;
        }

        const confirmRestore = confirm('⚠️ 현재 데이터가 백업 데이터로 교체됩니다.\n계속하시겠습니까?');
        if (!confirmRestore) return;

        // 복원 옵션 선택
        const restoreOption = prompt('복원 옵션을 선택하세요:\n1. 로컬 백업에서 복원\n2. Supabase에서 복원\n3. 긴급 백업에서 복원\n\n번호를 입력하세요:');
        
        try {
            let restoredData = null;
            
            switch (restoreOption) {
                case '1':
                    // localStorage에서 복원
                    restoredData = JSON.parse(localStorage.getItem('parcelData') || '[]');
                    break;
                    
                case '2':
                    // Supabase에서 복원 (dataPersistenceManager 사용)
                    if (window.dataPersistenceManager) {
                        restoredData = await window.dataPersistenceManager.restore();
                    }
                    break;
                    
                case '3':
                    // 긴급 백업에서 복원
                    const emergencyBackup = JSON.parse(localStorage.getItem('emergency_backup') || 'null');
                    if (emergencyBackup && emergencyBackup.data) {
                        restoredData = emergencyBackup.data;
                    } else {
                        throw new Error('긴급 백업 데이터가 없습니다');
                    }
                    break;
                    
                default:
                    alert('잘못된 선택입니다.');
                    return;
            }

            if (restoredData && restoredData.length > 0) {
                // 데이터 복원
                window.parcelsData = restoredData;
                
                // 화면 새로고침
                if (window.loadSavedParcels) {
                    await window.loadSavedParcels();
                }
                
                alert(`✅ 백업에서 ${restoredData.length}개의 필지 데이터를 복원했습니다.`);
                console.log('📥 백업 복원 완료:', restoredData.length, '개 항목');
                
            } else {
                alert('❌ 복원할 데이터가 없습니다.');
            }

        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);
            alert(`❌ 복원 실패: ${error.message}`);
        }
    }

    // 백업 히스토리 내보내기
    exportBackupHistory() {
        if (!window.advancedBackupManager) return;

        try {
            const history = window.advancedBackupManager.getBackupHistory();
            const csvContent = this.convertHistoryToCSV(history);
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `백업히스토리_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('📊 백업 히스토리 내보내기 완료');

        } catch (error) {
            console.error('❌ 백업 히스토리 내보내기 실패:', error);
            alert('히스토리 내보내기에 실패했습니다.');
        }
    }

    // 히스토리를 CSV로 변환
    convertHistoryToCSV(history) {
        const headers = ['일시', '타입', '상태', '데이터개수', '소요시간', '오류메시지'];
        const rows = [headers.join(',')];

        history.forEach(item => {
            const row = [
                `"${item.timestamp}"`,
                item.type,
                item.status,
                item.dataCount || '',
                item.duration || '',
                `"${(item.error || '').replace(/"/g, '""')}"`
            ];
            rows.push(row.join(','));
        });

        return '\uFEFF' + rows.join('\n'); // BOM 추가로 한글 깨짐 방지
    }

    // 백업 알림 표시
    showBackupNotification(message, type = 'info') {
        try {
            // 기존 표시기 제거
            const existing = document.getElementById('backupNotification');
            if (existing) {
                existing.remove();
            }

            // 새 알림 표시기 생성
            const notification = document.createElement('div');
            notification.id = 'backupNotification';
            notification.style.cssText = `
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 10001;
                padding: 0.75rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                color: white;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;

            // 타입별 색상 설정
            const colors = {
                success: '#4CAF50',
                error: '#f44336',
                warning: '#FF9800',
                info: '#2196F3'
            };

            notification.style.backgroundColor = colors[type] || colors.info;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
            // 페이드 인
            setTimeout(() => {
                notification.style.opacity = '1';
            }, 100);
            
            // 3초 후 페이드 아웃 및 제거
            setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }, 3000);
            
        } catch (error) {
            console.warn('⚠️ 백업 알림 표시 실패:', error);
        }
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 모달 외부 클릭 시 닫기
        window.addEventListener('click', (event) => {
            const backupModal = document.getElementById('backupModal');
            if (event.target === backupModal) {
                this.closeBackupModal();
            }
        });

        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isBackupModalOpen) {
                this.closeBackupModal();
            }
        });
    }
}

// 전역 함수들 (HTML에서 호출됨)
function openBackupModal() {
    window.backupUI?.openBackupModal();
}

function closeBackupModal() {
    window.backupUI?.closeBackupModal();
}

function performManualBackup(type) {
    window.backupUI?.performManualBackup(type);
}

function performEmergencyBackup() {
    window.backupUI?.performEmergencyBackup();
}

function selectGoogleDriveFolder() {
    window.backupUI?.selectGoogleDriveFolder();
}

function saveBackupSettings() {
    window.backupUI?.saveBackupSettings();
}

function restoreFromBackup() {
    window.backupUI?.restoreFromBackup();
}

function refreshBackupHistory() {
    window.backupUI?.refreshBackupHistory();
}

function exportBackupHistory() {
    window.backupUI?.exportBackupHistory();
}

// 전역 인스턴스 생성
window.backupUI = new BackupUI();

console.log('🎛️ BackupUI 로드 완료');