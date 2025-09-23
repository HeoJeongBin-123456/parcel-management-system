/* eslint-disable */
// 백업 관리자 - 일일 Supabase 백업 + 월간 Google 백업
class BackupManager {
    constructor() {
        this.lastDailyBackup = null;      // Supabase 일일 백업
        this.lastWeeklyBackup = null;     // Google 주간 백업 (변경)
        this.isBackupRunning = false;
        this.backupHistory = [];
        this.maxHistorySize = 50;

        // 백업 스케줄 설정
        this.backupSchedule = {
            supabase: {
                interval: 'daily',
                hour: 0,              // 자정
                retention: 7          // 7일 보관
            },
            google: {
                interval: 'weekly',
                day: 0,               // 일요일 (0 = Sunday)
                hour: 0,              // 자정
                retention: 90         // 90일 보관
            }
        };

        console.log('💾 BackupManager 초기화 (Supabase: 일일, Google: 주간)');
        this.loadBackupSettings();
        this.scheduleBackups();
    }

    // 백업 설정 로드
    async loadBackupSettings() {
        try {
            const settings = JSON.parse(await window.migratedGetItem('backup_settings') || '{}');
            this.lastDailyBackup = settings.lastDailyBackup ? new Date(settings.lastDailyBackup) : null;
            this.lastWeeklyBackup = settings.lastWeeklyBackup ? new Date(settings.lastWeeklyBackup) : null;
            this.backupHistory = settings.backupHistory || [];

            console.log('💾 백업 설정 로드 완료:', {
                lastSupabase: this.lastDailyBackup,
                lastGoogle: this.lastWeeklyBackup,
                historyCount: this.backupHistory.length
            });
        } catch (error) {
            console.error('❌ 백업 설정 로드 실패:', error);
        }
    }

    // 백업 설정 저장
    async saveBackupSettings() {
        try {
            const settings = {
                lastDailyBackup: this.lastDailyBackup?.toISOString(),
                lastWeeklyBackup: this.lastWeeklyBackup?.toISOString(),
                backupHistory: this.backupHistory.slice(-this.maxHistorySize)
            };
            await window.migratedSetItem('backup_settings', JSON.stringify(settings));
            console.log('💾 백업 설정 저장 완료');
        } catch (error) {
            console.error('❌ 백업 설정 저장 실패:', error);
        }
    }

    // 백업 스케줄링 - 개선된 버전
    scheduleBackups() {
        // 페이지 로드 시 즉시 체크
        setTimeout(() => this.checkBackupSchedule(), 5000);

        // 30분마다 백업 체크
        this.backupInterval = setInterval(() => this.checkBackupSchedule(), 30 * 60 * 1000);

        // 페이지 비활성화 시 백업 수행
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 페이지가 숨겨질 때 백업 예약
                this.scheduleBackupOnHidden();
            }
        });

        // 페이지 언로드 시 긴급 백업
        window.addEventListener('beforeunload', () => {
            this.performEmergencyBackup();
        });

        console.log('⏰ 백업 스케줄 설정 완료 (개선판)');
    }

    // 페이지 숨겨질 때 백업 예약
    scheduleBackupOnHidden() {
        const now = new Date();
        if (this.shouldRunDailyBackup(now)) {
            console.log('💾 페이지 비활성화 - 백업 예약');
            // 5초 후 백업 실행 (페이지가 다시 활성화되면 취소)
            this.hiddenBackupTimeout = setTimeout(() => {
                this.runDailyBackup();
            }, 5000);
        }
    }

    // 긴급 백업 (동기 방식)
    performEmergencyBackup() {
        try {
            const parcelData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
            if (parcelData.length > 0) {
                // localStorage에 긴급 백업 저장
                const emergencyBackup = {
                    timestamp: new Date().toISOString(),
                    data: parcelData
                };
                localStorage.setItem('emergency_backup', JSON.stringify(emergencyBackup));
                console.log('🆘 긴급 백업 완료');
            }
        } catch (error) {
            console.error('❌ 긴급 백업 실패:', error);
        }
    }

    // 백업 스케줄 체크
    async checkBackupSchedule() {
        if (this.isBackupRunning) {
            console.log('💾 백업이 이미 실행 중입니다.');
            return;
        }

        const now = new Date();

        // Supabase 일일 백업 체크
        if (this.shouldRunDailyBackup(now)) {
            console.log('📅 Supabase 일일 백업 시작');
            await this.runDailyBackup();
        }

        // Google 주간 백업 체크
        if (this.shouldRunWeeklyGoogleBackup(now)) {
            console.log('📅 Google 주간 백업 시작');
            await this.runWeeklyGoogleBackup();
        }
    }

    // Supabase 일일 백업이 필요한지 체크
    shouldRunDailyBackup(now) {
        if (!this.lastDailyBackup) return true;

        const hoursSinceLastBackup = (now - this.lastDailyBackup) / (1000 * 60 * 60);
        return hoursSinceLastBackup >= 24;
    }

    // Google 주간 백업이 필요한지 체크
    shouldRunWeeklyGoogleBackup(now) {
        // 마지막 백업이 없으면 즉시 실행
        if (!this.lastWeeklyBackup) return true;

        // 마지막 백업으로부터 경과 시간 계산
        const daysSinceLastBackup = (now - this.lastWeeklyBackup) / (1000 * 60 * 60 * 24);

        // 오늘이 일요일인지 확인 (0 = 일요일)
        const isSunday = now.getDay() === 0;

        // 일요일이고, 마지막 백업으로부터 6일 이상 지났으면 백업 실행
        if (isSunday && daysSinceLastBackup >= 6) {
            return true;
        }

        // 마지막 백업이 14일 이상 전이면 무조건 실행 (안전장치)
        if (daysSinceLastBackup >= 14) {
            console.log('⚠️ 2주 이상 백업이 없어 강제 실행');
            return true;
        }

        return false;
    }

    // 일일 백업 실행 (Supabase daily_backups 테이블) - 개선판
    async runDailyBackup(retryCount = 0) {
        this.isBackupRunning = true;
        const startTime = new Date();
        const maxRetries = 3;

        try {
            console.log('💾 일일 백업 시작...');

            // 현재 필지 데이터 가져오기
            const parcelData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');

            if (parcelData.length === 0) {
                console.log('💾 백업할 데이터가 없습니다.');
                this.addBackupHistory('daily', 'success', '백업할 데이터 없음', 0);
                return;
            }

            // 먼저 로컬 백업 수행 (폴백)
            const localBackup = {
                timestamp: startTime.toISOString(),
                data: parcelData,
                version: '2.0'
            };
            localStorage.setItem('daily_backup_local', JSON.stringify(localBackup));
            console.log('💾 로컬 백업 완료');

            // Supabase에 백업 데이터 저장
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                const backupRecord = {
                    backup_date: startTime.toISOString(),
                    data_count: parcelData.length,
                    backup_data: parcelData,
                    backup_size: JSON.stringify(parcelData).length,
                    backup_version: '2.0'
                };

                const { data, error } = await window.SupabaseManager.supabase
                    .from('daily_backups')
                    .insert([backupRecord]);

                if (error) {
                    // 재시도 로직
                    if (retryCount < maxRetries) {
                        console.warn(`⚠️ 백업 실패, 재시도 ${retryCount + 1}/${maxRetries}`);
                        await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
                        return await this.runDailyBackup(retryCount + 1);
                    }
                    throw new Error(`Supabase 백업 실패: ${error.message}`);
                }

                // 30일 이상 된 백업 삭제
                await this.cleanupOldDailyBackups();

                this.lastDailyBackup = startTime;
                await this.saveBackupSettings();

                const endTime = new Date();
                const duration = endTime - startTime;

                this.addBackupHistory('daily', 'success', `${parcelData.length}개 필지 백업 완료`, duration);
                console.log(`✅ 일일 백업 완료: ${parcelData.length}개 필지, ${duration}ms`);

                // 백업 성공 알림 (비시각적)
                this.notifyBackupSuccess('daily', parcelData.length);
            } else {
                console.warn('⚠️ Supabase 연결 없음 - 로컬 백업만 수행');
                this.addBackupHistory('daily', 'partial', '로컬 백업만 성공', new Date() - startTime);
            }

        } catch (error) {
            console.error('❌ 일일 백업 실패:', error);
            this.addBackupHistory('daily', 'error', error.message, new Date() - startTime);

            // 실패 시 오프라인 백업 활성화
            this.enableOfflineBackup();
        } finally {
            this.isBackupRunning = false;
        }
    }

    // 백업 성공 알림
    notifyBackupSuccess(type, count) {
        // 콘솔에만 표시 (비시각적)
        console.log(`🎆 ${type === 'daily' ? '일일' : '월간'} 백업 성공: ${count}개 필지`);
    }

    // 오프라인 백업 활성화
    enableOfflineBackup() {
        console.log('🔄 오프라인 백업 모드 활성화');
        // IndexedDB를 이용한 대용량 오프라인 백업
        this.useIndexedDBBackup = true;
    }

    // Google 주간 백업 실행 (Google Sheets/Drive 연동)
    async runWeeklyGoogleBackup() {
        this.isBackupRunning = true;
        const startTime = new Date();
        
        try {
            console.log('📊 Google 주간 백업 시작...');
            
            // 현재 필지 데이터 가져오기
            const parcelData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            
            if (parcelData.length === 0) {
                console.log('💾 백업할 데이터가 없습니다.');
                this.addBackupHistory('weekly', 'success', '백업할 데이터 없음', 0);
                return;
            }

            // Google Sheets로 백업 (sheets.js의 기존 함수 활용)
            if (typeof exportDataToGoogleSheets === 'function') {
                await exportDataToGoogleSheets(parcelData, `주간백업_${startTime.toISOString().slice(0, 10)}`);
                
                // 주간 백업 로그 Supabase에 저장
                if (window.SupabaseManager && window.SupabaseManager.supabase) {
                    const logRecord = {
                        backup_date: startTime.toISOString(),
                        data_count: parcelData.length,
                        backup_method: 'google_sheets',
                        backup_type: 'weekly',
                        status: 'success'
                    };

                    await window.SupabaseManager.supabase
                        .from('backup_logs')
                        .insert([logRecord]);
                }
                
                this.lastWeeklyBackup = startTime;
                await this.saveBackupSettings();
                
                const endTime = new Date();
                const duration = endTime - startTime;
                
                this.addBackupHistory('weekly', 'success', `Google Sheets 백업 완료: ${parcelData.length}개 필지`, duration);
                console.log(`✅ Google 주간 백업 완료: ${parcelData.length}개 필지, ${duration}ms`);
            } else {
                throw new Error('Google Sheets 연동 함수를 찾을 수 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ Google 주간 백업 실패:', error);
            this.addBackupHistory('weekly', 'error', error.message, new Date() - startTime);
            
            // 실패 로그도 Supabase에 저장
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                try {
                    const logRecord = {
                        backup_date: startTime.toISOString(),
                        data_count: 0,
                        backup_method: 'google_sheets',
                        backup_type: 'weekly',
                        status: 'failed',
                        error_message: error.message
                    };

                    await window.SupabaseManager.supabase
                        .from('backup_logs')
                        .insert([logRecord]);
                } catch (logError) {
                    console.error('❌ 백업 로그 저장 실패:', logError);
                }
            }
        } finally {
            this.isBackupRunning = false;
        }
    }

    // 오래된 일일 백업 정리 (30일 이상)
    async cleanupOldDailyBackups() {
        try {
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const { error } = await window.SupabaseManager.supabase
                    .from('daily_backups')
                    .delete()
                    .lt('backup_date', thirtyDaysAgo.toISOString());

                if (error) {
                    console.warn('⚠️ 오래된 백업 삭제 실패:', error);
                } else {
                    console.log('🧹 30일 이상 된 백업 삭제 완료');
                }
            }
        } catch (error) {
            console.warn('⚠️ 백업 정리 실패:', error);
        }
    }

    // 백업 히스토리 추가
    addBackupHistory(type, status, message, duration) {
        const entry = {
            timestamp: new Date().toISOString(),
            type: type,
            status: status,
            message: message,
            duration: duration
        };
        
        this.backupHistory.push(entry);
        
        // 최대 히스토리 크기 유지
        if (this.backupHistory.length > this.maxHistorySize) {
            this.backupHistory = this.backupHistory.slice(-this.maxHistorySize);
        }
        
        this.saveBackupSettings();
    }

    // 수동 백업 실행
    async runManualBackup(type = 'both') {
        if (this.isBackupRunning) {
            alert('백업이 이미 실행 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        console.log(`💾 수동 백업 시작: ${type}`);
        
        if (type === 'daily' || type === 'both') {
            await this.runDailyBackup();
        }
        
        if (type === 'monthly' || type === 'both') {
            await this.runMonthlyBackup();
        }
        
        alert('백업이 완료되었습니다. 콘솔에서 상세 결과를 확인하세요.');
    }

    // 백업 상태 확인
    getBackupStatus() {
        const now = new Date();
        
        return {
            isRunning: this.isBackupRunning,
            lastDaily: this.lastDailyBackup,
            lastMonthly: this.lastMonthlyBackup,
            dailyOverdue: this.lastDailyBackup ? (now - this.lastDailyBackup) / (1000 * 60 * 60) > 24 : true,
            monthlyOverdue: this.lastMonthlyBackup ? (now - this.lastMonthlyBackup) / (1000 * 60 * 60 * 24) > 30 : true,
            historyCount: this.backupHistory.length,
            recentHistory: this.backupHistory.slice(-5)
        };
    }

    // 백업 히스토리 표시
    showBackupHistory() {
        console.group('💾 백업 히스토리');
        console.log('백업 상태:', this.getBackupStatus());
        console.log('최근 백업 이력:');
        this.backupHistory.slice(-10).forEach(entry => {
            const icon = entry.status === 'success' ? '✅' : '❌';
            const typeIcon = entry.type === 'daily' ? '📅' : '📊';
            console.log(`${icon} ${typeIcon} [${entry.timestamp}] ${entry.message} (${entry.duration}ms)`);
        });
        console.groupEnd();
    }

    // 백업 복원 (일일 백업에서) - 개선판
    async restoreFromBackup(backupDate) {
        try {
            // 먼저 현재 데이터 백업
            const currentData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            if (currentData.length > 0) {
                const backupBeforeRestore = {
                    timestamp: new Date().toISOString(),
                    data: currentData,
                    reason: 'before_restore'
                };
                localStorage.setItem('backup_before_restore', JSON.stringify(backupBeforeRestore));
                console.log('💾 복원 전 현재 데이터 백업 완료');
            }

            let restoreData = null;
            let restoreSource = '';

            // 1차: Supabase에서 복원 시도
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                const { data, error } = await window.SupabaseManager.supabase
                    .from('daily_backups')
                    .select('backup_data')
                    .eq('backup_date', backupDate)
                    .single();

                if (!error && data && data.backup_data) {
                    restoreData = data.backup_data;
                    restoreSource = 'Supabase';
                }
            }

            // 2차: 로컬 백업에서 복원 시도
            if (!restoreData) {
                const localBackup = localStorage.getItem('daily_backup_local');
                if (localBackup) {
                    const parsed = JSON.parse(localBackup);
                    if (parsed.timestamp === backupDate) {
                        restoreData = parsed.data;
                        restoreSource = 'Local';
                    }
                }
            }

            // 3차: 긴급 백업에서 복원 시도
            if (!restoreData) {
                const emergencyBackup = localStorage.getItem('emergency_backup');
                if (emergencyBackup) {
                    const parsed = JSON.parse(emergencyBackup);
                    restoreData = parsed.data;
                    restoreSource = 'Emergency';
                }
            }

            if (!restoreData) {
                throw new Error('복원할 백업 데이터를 찾을 수 없습니다.');
            }

            // 현재 데이터를 백업 데이터로 교체
            await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(restoreData));

            // 복원 성공 로그
            this.addBackupHistory('restore', 'success', `${restoreSource}에서 ${restoreData.length}개 필지 복원`, 0);

            // 페이지 새로고침으로 데이터 반영
            if (confirm(`백업 복원 완료 (${restoreSource})
${restoreData.length}개 필지가 복원되었습니다.
페이지를 새로고침하시겠습니까?`)) {
                window.location.reload();
            }

            console.log(`✅ 백업 복원 완료 (${restoreSource}): ${restoreData.length}개 필지`);

        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);

            // 복원 실패 시 이전 데이터로 롤백
            const rollbackData = localStorage.getItem('backup_before_restore');
            if (rollbackData) {
                const parsed = JSON.parse(rollbackData);
                await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(parsed.data));
                alert(`백업 복원 실패: ${error.message}\n이전 데이터로 롤백하였습니다.`);
            } else {
                alert(`백업 복원 실패: ${error.message}`);
            }
        }
    }

    // 백업 목록 가져오기
    async getBackupList() {
        const backups = [];

        try {
            // Supabase에서 백업 목록 가져오기
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                const { data, error } = await window.SupabaseManager.supabase
                    .from('daily_backups')
                    .select('backup_date, data_count, backup_size')
                    .order('backup_date', { ascending: false })
                    .limit(10);

                if (!error && data) {
                    data.forEach(backup => {
                        backups.push({
                            date: backup.backup_date,
                            count: backup.data_count,
                            size: backup.backup_size,
                            source: 'Supabase'
                        });
                    });
                }
            }

            // 로컬 백업 추가
            const localBackup = localStorage.getItem('daily_backup_local');
            if (localBackup) {
                const parsed = JSON.parse(localBackup);
                backups.push({
                    date: parsed.timestamp,
                    count: parsed.data.length,
                    size: JSON.stringify(parsed).length,
                    source: 'Local'
                });
            }

            return backups;
        } catch (error) {
            console.error('❌ 백업 목록 조회 실패:', error);
            return [];
        }
    }
}

// 전역 인스턴스 생성
window.BackupManager = new BackupManager();

// 전역 함수들
window.runManualBackup = (type = 'both') => window.BackupManager.runManualBackup(type);
window.showBackupHistory = () => window.BackupManager.showBackupHistory();
window.getBackupStatus = () => window.BackupManager.getBackupStatus();
window.restoreFromBackup = (date) => window.BackupManager.restoreFromBackup(date);

// 페이지 로드 시 백업 상태 표시
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const status = window.BackupManager.getBackupStatus();
        console.log('💾 백업 시스템 초기화 완료');
        console.log('사용법: runManualBackup(), showBackupHistory(), getBackupStatus()');
        
        if (status.dailyOverdue || status.monthlyOverdue) {
            console.warn('⚠️ 백업이 필요합니다:', {
                dailyOverdue: status.dailyOverdue,
                monthlyOverdue: status.monthlyOverdue
            });
        }
    }, 3000);
});

console.log('💾 BackupManager 로드 완료');
