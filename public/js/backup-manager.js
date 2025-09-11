// 백업 관리자 - 일일 Supabase 백업 + 월간 Google 백업
class BackupManager {
    constructor() {
        this.lastDailyBackup = null;
        this.lastMonthlyBackup = null;
        this.isBackupRunning = false;
        this.backupHistory = [];
        this.maxHistorySize = 50;
        
        console.log('💾 BackupManager 초기화');
        this.loadBackupSettings();
        this.scheduleBackups();
    }

    // 백업 설정 로드
    async loadBackupSettings() {
        try {
            const settings = JSON.parse(await window.migratedGetItem('backup_settings') || '{}');
            this.lastDailyBackup = settings.lastDailyBackup ? new Date(settings.lastDailyBackup) : null;
            this.lastMonthlyBackup = settings.lastMonthlyBackup ? new Date(settings.lastMonthlyBackup) : null;
            this.backupHistory = settings.backupHistory || [];
            
            console.log('💾 백업 설정 로드 완료:', {
                lastDaily: this.lastDailyBackup,
                lastMonthly: this.lastMonthlyBackup,
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
                lastMonthlyBackup: this.lastMonthlyBackup?.toISOString(),
                backupHistory: this.backupHistory.slice(-this.maxHistorySize)
            };
            await window.migratedSetItem('backup_settings', JSON.stringify(settings));
            console.log('💾 백업 설정 저장 완료');
        } catch (error) {
            console.error('❌ 백업 설정 저장 실패:', error);
        }
    }

    // 백업 스케줄링
    scheduleBackups() {
        // 페이지 로드 시 즉시 체크
        setTimeout(() => this.checkBackupSchedule(), 5000);
        
        // 30분마다 백업 체크
        setInterval(() => this.checkBackupSchedule(), 30 * 60 * 1000);
        
        console.log('⏰ 백업 스케줄 설정 완료');
    }

    // 백업 스케줄 체크
    async checkBackupSchedule() {
        if (this.isBackupRunning) {
            console.log('💾 백업이 이미 실행 중입니다.');
            return;
        }

        const now = new Date();
        
        // 일일 백업 체크 (마지막 백업이 24시간 이전인 경우)
        if (this.shouldRunDailyBackup(now)) {
            await this.runDailyBackup();
        }
        
        // 월간 백업 체크 (마지막 백업이 30일 이전인 경우)
        if (this.shouldRunMonthlyBackup(now)) {
            await this.runMonthlyBackup();
        }
    }

    // 일일 백업이 필요한지 체크
    shouldRunDailyBackup(now) {
        if (!this.lastDailyBackup) return true;
        
        const hoursSinceLastBackup = (now - this.lastDailyBackup) / (1000 * 60 * 60);
        return hoursSinceLastBackup >= 24;
    }

    // 월간 백업이 필요한지 체크
    shouldRunMonthlyBackup(now) {
        if (!this.lastMonthlyBackup) return true;
        
        const daysSinceLastBackup = (now - this.lastMonthlyBackup) / (1000 * 60 * 60 * 24);
        return daysSinceLastBackup >= 30;
    }

    // 일일 백업 실행 (Supabase daily_backups 테이블)
    async runDailyBackup() {
        this.isBackupRunning = true;
        const startTime = new Date();
        
        try {
            console.log('💾 일일 백업 시작...');
            
            // 현재 필지 데이터 가져오기
            const parcelData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            
            if (parcelData.length === 0) {
                console.log('💾 백업할 데이터가 없습니다.');
                this.addBackupHistory('daily', 'success', '백업할 데이터 없음', 0);
                return;
            }

            // Supabase에 백업 데이터 저장
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                const backupRecord = {
                    backup_date: startTime.toISOString(),
                    data_count: parcelData.length,
                    backup_data: parcelData,
                    backup_size: JSON.stringify(parcelData).length
                };

                const { data, error } = await window.SupabaseManager.supabase
                    .from('daily_backups')
                    .insert([backupRecord]);

                if (error) {
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
            } else {
                throw new Error('Supabase 연결이 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 일일 백업 실패:', error);
            this.addBackupHistory('daily', 'error', error.message, new Date() - startTime);
        } finally {
            this.isBackupRunning = false;
        }
    }

    // 월간 백업 실행 (Google Sheets 연동)
    async runMonthlyBackup() {
        this.isBackupRunning = true;
        const startTime = new Date();
        
        try {
            console.log('💾 월간 백업 시작...');
            
            // 현재 필지 데이터 가져오기
            const parcelData = JSON.parse(await window.migratedGetItem(CONFIG.STORAGE_KEY) || '[]');
            
            if (parcelData.length === 0) {
                console.log('💾 백업할 데이터가 없습니다.');
                this.addBackupHistory('monthly', 'success', '백업할 데이터 없음', 0);
                return;
            }

            // Google Sheets로 백업 (sheets.js의 기존 함수 활용)
            if (typeof exportDataToGoogleSheets === 'function') {
                await exportDataToGoogleSheets(parcelData, `월간백업_${startTime.toISOString().slice(0, 10)}`);
                
                // 월간 백업 로그 Supabase에 저장
                if (window.SupabaseManager && window.SupabaseManager.supabase) {
                    const logRecord = {
                        backup_date: startTime.toISOString(),
                        data_count: parcelData.length,
                        backup_method: 'google_sheets',
                        status: 'success'
                    };

                    await window.SupabaseManager.supabase
                        .from('monthly_backup_logs')
                        .insert([logRecord]);
                }
                
                this.lastMonthlyBackup = startTime;
                await this.saveBackupSettings();
                
                const endTime = new Date();
                const duration = endTime - startTime;
                
                this.addBackupHistory('monthly', 'success', `Google Sheets 백업 완료: ${parcelData.length}개 필지`, duration);
                console.log(`✅ 월간 백업 완료: ${parcelData.length}개 필지, ${duration}ms`);
            } else {
                throw new Error('Google Sheets 연동 함수를 찾을 수 없습니다.');
            }
            
        } catch (error) {
            console.error('❌ 월간 백업 실패:', error);
            this.addBackupHistory('monthly', 'error', error.message, new Date() - startTime);
            
            // 실패 로그도 Supabase에 저장
            if (window.SupabaseManager && window.SupabaseManager.supabase) {
                try {
                    const logRecord = {
                        backup_date: startTime.toISOString(),
                        data_count: 0,
                        backup_method: 'google_sheets',
                        status: 'failed',
                        error_message: error.message
                    };

                    await window.SupabaseManager.supabase
                        .from('monthly_backup_logs')
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

    // 백업 복원 (일일 백업에서)
    async restoreFromBackup(backupDate) {
        try {
            if (!window.SupabaseManager || !window.SupabaseManager.supabase) {
                throw new Error('Supabase 연결이 없습니다.');
            }

            const { data, error } = await window.SupabaseManager.supabase
                .from('daily_backups')
                .select('backup_data')
                .eq('backup_date', backupDate)
                .single();

            if (error) {
                throw new Error(`백업 데이터 조회 실패: ${error.message}`);
            }

            if (!data || !data.backup_data) {
                throw new Error('백업 데이터가 없습니다.');
            }

            // 현재 데이터를 백업 데이터로 교체
            await window.migratedSetItem(CONFIG.STORAGE_KEY, JSON.stringify(data.backup_data));
            
            // 페이지 새로고침으로 데이터 반영
            if (confirm('백업 복원이 완료되었습니다. 페이지를 새로고침하시겠습니까?')) {
                window.location.reload();
            }
            
            console.log(`✅ 백업 복원 완료: ${data.backup_data.length}개 필지`);
            
        } catch (error) {
            console.error('❌ 백업 복원 실패:', error);
            alert(`백업 복원 실패: ${error.message}`);
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