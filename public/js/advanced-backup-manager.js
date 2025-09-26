/* eslint-disable */
// 고급 백업 관리자 - 일일 Supabase + 월간 Google Sheets 백업
class AdvancedBackupManager {
    constructor() {
        this.lastDailyBackup = null;
        this.lastMonthlyBackup = null;
        this.isBackupRunning = false;
        this.backupHistory = [];
        this.maxHistorySize = 100;
        this.retryAttempts = 3;
        
        console.log('💾 AdvancedBackupManager 초기화');
        this.loadBackupSettings();
        this.initializeBackupSystem();
    }

    // 백업 시스템 초기화
    async initializeBackupSystem() {
        try {
            // 설정 로드
            await this.loadBackupSettings();
            
            // 스케줄러 설정
            this.setupBackupScheduler();
            
            // 페이지 이벤트 핸들러 설정
            this.setupEventHandlers();
            
            // 초기 백업 상태 확인
            await this.checkBackupStatus();
            
            console.log('✅ 고급 백업 시스템 초기화 완료');
            
        } catch (error) {
            console.error('❌ 백업 시스템 초기화 실패:', error);
        }
    }

    // 백업 설정 로드
    async loadBackupSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('advanced_backup_settings') || '{}');
            
            this.lastDailyBackup = settings.lastDailyBackup ? new Date(settings.lastDailyBackup) : null;
            this.lastMonthlyBackup = settings.lastMonthlyBackup ? new Date(settings.lastMonthlyBackup) : null;
            this.backupHistory = settings.backupHistory || [];
            
            // 설정 검증
            this.validateBackupSettings();
            
            console.log('📋 백업 설정 로드 완료:', {
                lastDaily: this.lastDailyBackup,
                lastMonthly: this.lastMonthlyBackup,
                historyCount: this.backupHistory.length
            });
            
        } catch (error) {
            console.error('❌ 백업 설정 로드 실패:', error);
            this.initializeDefaultSettings();
        }
    }

    // 기본 설정 초기화
    initializeDefaultSettings() {
        this.lastDailyBackup = null;
        this.lastMonthlyBackup = null;
        this.backupHistory = [];
        console.log('🔧 백업 설정 기본값으로 초기화');
    }

    // 백업 설정 검증
    validateBackupSettings() {
        // 히스토리 크기 제한
        if (this.backupHistory.length > this.maxHistorySize) {
            this.backupHistory = this.backupHistory.slice(-this.maxHistorySize);
        }
        
        // 날짜 유효성 검증
        if (this.lastDailyBackup && isNaN(this.lastDailyBackup.getTime())) {
            this.lastDailyBackup = null;
        }
        
        if (this.lastMonthlyBackup && isNaN(this.lastMonthlyBackup.getTime())) {
            this.lastMonthlyBackup = null;
        }
    }

    // 백업 스케줄러 설정
    setupBackupScheduler() {
        // 1분마다 백업 필요성 확인
        setInterval(() => {
            this.checkAndPerformScheduledBackups();
        }, 60000);
        
        // 페이지 로드 시 즉시 확인
        setTimeout(() => {
            this.checkAndPerformScheduledBackups();
        }, 5000);
        
        console.log('⏰ 백업 스케줄러 설정 완료');
    }

    // 예약된 백업 확인 및 실행
    async checkAndPerformScheduledBackups() {
        if (this.isBackupRunning) {
            return; // 이미 백업 진행 중
        }

        const now = new Date();
        
        try {
            // 🚫 백업 비활성화 설정 확인
            if (localStorage.getItem('disable_auto_backup') === 'true') {
                console.log('⚠️ 자동 백업이 비활성화되어 있습니다');
                return;
            }

            // 일일 백업 확인
            if (this.shouldPerformDailyBackup(now)) {
                console.log('📅 일일 백업 시간입니다');
                await this.performDailyBackup();
            }

            // 월간 백업 확인
            if (this.shouldPerformMonthlyBackup(now)) {
                console.log('📆 월간 백업 시간입니다');
                await this.performMonthlyBackup();
            }
            
        } catch (error) {
            console.error('❌ 예약 백업 실행 실패:', error);
        }
    }

    // 일일 백업 필요 여부 확인
    shouldPerformDailyBackup(now) {
        if (!this.lastDailyBackup) {
            return true; // 첫 백업
        }
        
        const daysDiff = Math.floor((now - this.lastDailyBackup) / (1000 * 60 * 60 * 24));
        return daysDiff >= 1;
    }

    // 월간 백업 필요 여부 확인
    shouldPerformMonthlyBackup(now) {
        if (!this.lastMonthlyBackup) {
            return true; // 첫 백업
        }
        
        const monthsDiff = (now.getFullYear() - this.lastMonthlyBackup.getFullYear()) * 12 + 
                          (now.getMonth() - this.lastMonthlyBackup.getMonth());
        return monthsDiff >= 1;
    }

    // 일일 Supabase 백업 실행
    async performDailyBackup() {
        if (this.isBackupRunning) {
            console.log('⚠️ 백업이 이미 진행 중입니다');
            return { success: false, message: '백업 진행 중' };
        }

        this.isBackupRunning = true;
        console.log('🏃‍♂️ 일일 Supabase 백업 시작...');

        const backupId = `daily_${Date.now()}`;
        const startTime = new Date();

        try {
            // 1. 현재 데이터 수집
            const data = await this.collectCurrentData();
            if (!data || data.length === 0) {
                console.log('ℹ️ 일일 백업: 현재 저장된 필지 데이터가 없습니다');
                const metadata = {
                    id: backupId,
                    type: 'daily',
                    timestamp: startTime.toISOString(),
                    dataCount: 0,
                    status: 'skipped',
                    message: '백업할 데이터 없음',
                    duration: Date.now() - startTime.getTime()
                };
                this.addToBackupHistory(metadata);
                return {
                    success: true,
                    skipped: true,
                    metadata: metadata,
                    message: '백업 건너뜀: 저장된 데이터 없음'
                };
            }

            console.log(`📊 백업 대상 데이터: ${data.length}개 필지`);

            // 2. Supabase 백업 테이블에 저장
            const backupResult = await this.saveToSupabaseBackup(data, backupId);
            
            // 3. 백업 메타데이터 생성
            const metadata = {
                id: backupId,
                type: 'daily',
                timestamp: startTime.toISOString(),
                dataCount: data.length,
                size: JSON.stringify(data).length,
                checksum: this.generateChecksum(data),
                status: 'completed',
                duration: Date.now() - startTime.getTime()
            };

            // 4. 백업 히스토리에 추가
            this.addToBackupHistory(metadata);

            // 5. 설정 업데이트
            this.lastDailyBackup = startTime;
            await this.saveBackupSettings();

            // 6. 오래된 백업 정리
            await this.cleanupOldBackups('daily');

            console.log(`✅ 일일 백업 완료: ${data.length}개 필지, ${metadata.duration}ms`);

            return {
                success: true,
                metadata: metadata,
                message: `일일 백업 완료 (${data.length}개 필지)`
            };

        } catch (error) {
            console.error('❌ 일일 백업 실패:', error);
            
            // 실패 메타데이터 기록
            const failureMetadata = {
                id: backupId,
                type: 'daily',
                timestamp: startTime.toISOString(),
                status: 'failed',
                error: error.message,
                duration: Date.now() - startTime.getTime()
            };
            
            this.addToBackupHistory(failureMetadata);
            
            return {
                success: false,
                error: error.message,
                metadata: failureMetadata
            };

        } finally {
            this.isBackupRunning = false;
        }
    }

    // 월간 백업 실행 (구글 드라이브 비활성화)
    async performMonthlyBackup() {
        if (this.isBackupRunning) {
            console.log('⚠️ 백업이 이미 진행 중입니다');
            return { success: false, message: '백업 진행 중' };
        }

        this.isBackupRunning = true;
        console.log('🏃‍♂️ 월간 Google Sheets 백업 시작...');

        const backupId = `monthly_${Date.now()}`;
        const startTime = new Date();

        try {
            // 1. 현재 데이터 수집
            const data = await this.collectCurrentData();
            if (!data || data.length === 0) {
                console.log('ℹ️ 월간 백업: 현재 저장된 필지 데이터가 없습니다');
                const metadata = {
                    id: backupId,
                    type: 'monthly',
                    timestamp: startTime.toISOString(),
                    dataCount: 0,
                    status: 'skipped',
                    message: '백업할 데이터 없음',
                    duration: Date.now() - startTime.getTime()
                };
                this.addToBackupHistory(metadata);
                return {
                    success: true,
                    skipped: true,
                    metadata: metadata,
                    message: '백업 건너뜀: 저장된 데이터 없음'
                };
            }

            console.log(`📊 백업 대상 데이터: ${data.length}개 필지`);

            // 2. Google Sheets 백업 실행
            const sheetsResult = await this.uploadToGoogleSheets(data, backupId);

            // 3. 로컬 백업도 병행 수행 (비상 대비)
            const localBackupResult = await this.saveToLocalStorage(data, backupId);

            // 4. 백업 메타데이터 생성
            const metadata = {
                id: backupId,
                type: 'monthly',
                timestamp: startTime.toISOString(),
                dataCount: data.length,
                sheetsBackupStatus: sheetsResult?.success ? 'success' : 'failed',
                sheetsUrl: sheetsResult?.spreadsheetUrl || null,
                sheetName: sheetsResult?.sheetName || null,
                localBackupStatus: localBackupResult ? 'success' : 'failed',
                status: sheetsResult?.success ? 'completed' : 'partially_failed',
                duration: Date.now() - startTime.getTime(),
                error: sheetsResult?.success ? null : sheetsResult?.error
            };

            // 5. 백업 히스토리에 추가
            this.addToBackupHistory(metadata);

            // 6. 설정 업데이트
            this.lastMonthlyBackup = startTime;
            await this.saveBackupSettings();

            if (sheetsResult?.success) {
                console.log(`✅ 월간 백업 완료: Google Sheets (🔗 ${sheetsResult.spreadsheetUrl})`);
                return {
                    success: true,
                    metadata: metadata,
                    message: `월간 백업 완료 (Google Sheets)`,
                    spreadsheetUrl: sheetsResult.spreadsheetUrl
                };
            } else {
                console.log(`⚠️ 월간 백업 부분 실패: Google Sheets 업로드 실패, 로컬 백업만 성공`);
                return {
                    success: false,
                    metadata: metadata,
                    message: `Google Sheets 백업 실패 (로컬 백업만 성공)`,
                    error: sheetsResult?.error
                };
            }

        } catch (error) {
            console.error('❌ 월간 백업 실패:', error);
            
            const failureMetadata = {
                id: backupId,
                type: 'monthly',
                timestamp: startTime.toISOString(),
                status: 'failed',
                error: error.message,
                duration: Date.now() - startTime.getTime()
            };
            
            this.addToBackupHistory(failureMetadata);
            
            return {
                success: false,
                error: error.message,
                metadata: failureMetadata
            };

        } finally {
            this.isBackupRunning = false;
        }
    }

    // 현재 데이터 수집
    async collectCurrentData() {
        console.log('📋 백업용 데이터 수집 중...');
        
        let data = [];
        
        // 1. 전역 데이터에서 수집
        if (window.parcelsData && Array.isArray(window.parcelsData)) {
            data = [...window.parcelsData];
        }
        
        // 2. DataPersistenceManager에서 수집
        if (data.length === 0 && window.dataPersistenceManager) {
            data = window.dataPersistenceManager.getCurrentData();
        }
        
        // 3. localStorage에서 직접 수집
        if (data.length === 0) {
            try {
                const stored = localStorage.getItem('parcelData');
                if (stored) {
                    data = JSON.parse(stored);
                }
            } catch (error) {
                console.warn('localStorage 데이터 수집 실패:', error);
            }
        }

        // 데이터 검증 및 정제
        if (Array.isArray(data)) {
            data = data.filter(item => item && (item.pnu || item.lat));
        } else {
            data = [];
        }

        console.log(`📊 수집된 데이터: ${data.length}개 항목`);
        return data;
    }

    // Supabase 백업 테이블에 저장
    async saveToSupabaseBackup(data, backupId) {
        if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
            console.warn('⚠️ Supabase 연결되지 않음 - 로컬 백업으로 대체');
            return await this.saveToLocalBackup(data, backupId);
        }

        console.log('💾 Supabase 백업 테이블 확인 및 저장 중...');

        try {
            const supabase = window.SupabaseManager.supabase;

            // 🔍 백업 테이블 존재 여부 확인
            const tablesExist = await this.checkBackupTablesExist(supabase);
            if (!tablesExist) {
                console.warn('⚠️ Supabase 백업 테이블이 없음 - 로컬 백업으로 대체');
                return await this.saveToLocalBackup(data, backupId);
            }

            // 백업 메인 레코드 생성
            const { data: backupRecord, error: backupError } = await supabase
                .from('backups')
                .insert({
                    id: backupId,
                    type: 'daily',
                    created_at: new Date().toISOString(),
                    data_count: data.length,
                    status: 'processing'
                })
                .select()
                .single();

            if (backupError) {
                console.warn('⚠️ Supabase 백업 테이블 접근 실패 - 로컬 백업으로 대체:', backupError);
                return await this.saveToLocalBackup(data, backupId);
            }

            // 데이터를 압축하여 저장
            const compressedData = this.compressData(data);

            // 백업 데이터 저장
            const { error: dataError } = await supabase
                .from('backup_data')
                .insert({
                    backup_id: backupId,
                    data: compressedData,
                    checksum: this.generateChecksum(data)
                });

            if (dataError) {
                console.warn('⚠️ Supabase 백업 데이터 저장 실패 - 로컬 백업으로 대체:', dataError);
                return await this.saveToLocalBackup(data, backupId);
            }

            // 백업 완료 상태 업데이트
            const { error: updateError } = await supabase
                .from('backups')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', backupId);

            if (updateError) {
                console.warn('백업 상태 업데이트 실패:', updateError);
            }

            console.log('✅ Supabase 백업 저장 완료');
            return { success: true, backupId, method: 'supabase' };

        } catch (error) {
            console.warn('⚠️ Supabase 백업 저장 중 오류 발생 - 로컬 백업으로 대체:', error);
            return await this.saveToLocalBackup(data, backupId);
        }
    }

    // 백업 테이블 존재 여부 확인
    async checkBackupTablesExist(supabase) {
        try {
            // backups 테이블 확인 (빈 쿼리로 테이블 존재 여부만 확인)
            const { error: backupsError } = await supabase
                .from('backups')
                .select('id')
                .limit(1);

            if (backupsError) {
                console.log('❌ backups 테이블 없음:', backupsError.message);
                return false;
            }

            // backup_data 테이블 확인
            const { error: backupDataError } = await supabase
                .from('backup_data')
                .select('backup_id')
                .limit(1);

            if (backupDataError) {
                console.log('❌ backup_data 테이블 없음:', backupDataError.message);
                return false;
            }

            console.log('✅ 백업 테이블들이 존재함');
            return true;

        } catch (error) {
            console.log('❌ 백업 테이블 확인 중 오류:', error);
            return false;
        }
    }

    // 로컬 스토리지 백업
    async saveToLocalBackup(data, backupId) {
        console.log('💾 로컬 스토리지 백업 저장 중...');

        try {
            // 기존 로컬 백업들 가져오기
            const existingBackups = JSON.parse(localStorage.getItem('local_backups') || '[]');

            // 새 백업 데이터 생성
            const newBackup = {
                id: backupId,
                type: 'daily',
                created_at: new Date().toISOString(),
                data_count: data.length,
                data: this.compressData(data),
                checksum: this.generateChecksum(data),
                method: 'localStorage'
            };

            // 백업 목록에 추가
            existingBackups.push(newBackup);

            // 오래된 백업 정리 (최근 10개만 유지)
            if (existingBackups.length > 10) {
                existingBackups.splice(0, existingBackups.length - 10);
            }

            // 로컬 스토리지에 저장
            localStorage.setItem('local_backups', JSON.stringify(existingBackups));

            console.log('✅ 로컬 스토리지 백업 완료');
            return { success: true, backupId, method: 'localStorage' };

        } catch (error) {
            console.error('❌ 로컬 스토리지 백업 실패:', error);
            throw error;
        }
    }

    // Excel/CSV 형태로 변환
    async convertToExportFormat(data) {
        console.log('📊 Excel/CSV 변환 중...');
        
        // CSV 헤더
        const headers = [
            'PNU', '지번', '소유자명', '소유자주소', '연락처', 
            '메모', '색상', '위도', '경도', '생성일시', '수정일시'
        ];
        
        // CSV 데이터 생성
        const csvRows = [headers.join(',')];
        
        data.forEach(item => {
            const row = [
                item.pnu || '',
                `"${item.parcelNumber || ''}"`,
                `"${item.ownerName || ''}"`,
                `"${item.ownerAddress || ''}"`,
                item.ownerContact || '',
                `"${(item.memo || '').replace(/"/g, '""')}"`,
                item.color || '',
                item.lat || '',
                item.lng || '',
                item.createdAt || item.created_at || '',
                item.updatedAt || item.updated_at || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        console.log(`📄 CSV 변환 완료: ${data.length}행`);
        
        return csvContent;
    }

    // 지도 스크린샷 캡처
    async captureMapScreenshot() {
        console.log('📸 지도 스크린샷 캡처 중...');
        
        if (!window.map) {
            throw new Error('지도가 로드되지 않음');
        }

        try {
            // html2canvas 라이브러리가 있다면 사용
            if (window.html2canvas) {
                const mapElement = document.getElementById('map');
                const canvas = await window.html2canvas(mapElement);
                return canvas.toDataURL('image/png');
            } else {
                console.warn('html2canvas 라이브러리가 없어 스크린샷 건너뜀');
                return null;
            }
        } catch (error) {
            console.warn('스크린샷 캡처 실패:', error);
            return null;
        }
    }

    // Google Sheets 업로드
    async uploadToGoogleSheets(data, backupId) {
        console.log('📋 Google Sheets 백업 시작...');

        try {
            // Google 인증 확인
            if (!window.GoogleAuth || !window.GoogleAuth.isAuthenticated()) {
                throw new Error('Google 인증이 필요합니다');
            }

            // 스프레드시트 가져오기 또는 생성
            const spreadsheetId = await window.GoogleAuth.getOrCreateSpreadsheet();
            if (!spreadsheetId) {
                throw new Error('스프레드시트 생성 실패');
            }

            // 월별 시트명 생성
            const now = new Date();
            const sheetName = `${now.getFullYear()}년_${String(now.getMonth() + 1).padStart(2, '0')}월`;

            console.log(`📊 시트 생성 중: ${sheetName}`);

            // 새 시트 생성
            await this.createMonthlySheet(spreadsheetId, sheetName);

            // 데이터 변환
            const formattedData = this.formatDataForSheets(data);

            // 데이터 삽입
            const appendResult = await window.GoogleAuth.appendToSheet(spreadsheetId, formattedData, sheetName);

            if (!appendResult) {
                throw new Error('데이터 삽입 실패');
            }

            // 시트 포맷팅 적용
            await this.formatMonthlySheet(spreadsheetId, sheetName);

            // 오래된 시트 정리 (12개월 이상)
            await this.cleanupOldSheets(spreadsheetId);

            const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

            console.log(`✅ Google Sheets 백업 완료: ${spreadsheetUrl}`);

            return {
                success: true,
                spreadsheetId: spreadsheetId,
                spreadsheetUrl: spreadsheetUrl,
                sheetName: sheetName,
                dataCount: data.length
            };

        } catch (error) {
            console.error('❌ Google Sheets 백업 실패:', error);
            return {
                success: false,
                error: error.message || error
            };
        }
    }

    // 월별 시트 생성
    async createMonthlySheet(spreadsheetId, sheetName) {
        try {
            const requests = [{
                addSheet: {
                    properties: {
                        title: sheetName,
                        gridProperties: {
                            rowCount: 1000,
                            columnCount: 8
                        }
                    }
                }
            }];

            const result = await window.GoogleAuth.callSheetsAPI(
                'POST',
                `/spreadsheets/${spreadsheetId}:batchUpdate`,
                { requests }
            );

            console.log(`✅ 시트 '${sheetName}' 생성 완료`);
            return result;

        } catch (error) {
            // 시트가 이미 존재하는 경우 무시
            if (error.message && error.message.includes('already exists')) {
                console.log(`시트 '${sheetName}'이 이미 존재합니다`);
                return;
            }
            throw error;
        }
    }

    // 데이터 포맷팅 (Google Sheets용)
    formatDataForSheets(data) {
        // 헤더 추가
        const headers = ['지번', '소유자이름', '소유자주소', '연락처', '메모', '색상', '백업일시'];

        const formattedData = [headers];

        // 데이터 행 추가
        data.forEach(item => {
            const row = [
                item.지번 || '',
                item.소유자이름 || '',
                item.소유자주소 || '',
                item.연락처 || '',
                item.메모 || '',
                item.color || '미지정',
                new Date().toISOString().split('T')[0] // 백업 날짜
            ];
            formattedData.push(row);
        });

        return formattedData;
    }

    // 시트 포맷팅 적용
    async formatMonthlySheet(spreadsheetId, sheetName) {
        try {
            // 시트 ID 가져오기
            const sheetId = await this.getSheetId(spreadsheetId, sheetName);
            if (sheetId === null) return;

            const requests = [
                // 헤더 행 포맷팅
                {
                    repeatCell: {
                        range: {
                            sheetId: sheetId,
                            startRowIndex: 0,
                            endRowIndex: 1
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.02, green: 0.78, blue: 0.35 }, // 초록색
                                textFormat: {
                                    foregroundColor: { red: 1, green: 1, blue: 1 },
                                    bold: true
                                },
                                horizontalAlignment: 'CENTER'
                            }
                        },
                        fields: 'userEnteredFormat'
                    }
                },
                // 열 너비 자동 조정
                {
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: sheetId,
                            dimension: 'COLUMNS',
                            startIndex: 0,
                            endIndex: 7
                        }
                    }
                }
            ];

            await window.GoogleAuth.callSheetsAPI(
                'POST',
                `/spreadsheets/${spreadsheetId}:batchUpdate`,
                { requests }
            );

            console.log(`✅ 시트 '${sheetName}' 포맷팅 완료`);

        } catch (error) {
            console.warn('시트 포맷팅 실패:', error);
        }
    }

    // 시트 ID 가져오기
    async getSheetId(spreadsheetId, sheetName) {
        try {
            const response = await window.GoogleAuth.callSheetsAPI(
                'GET',
                `/spreadsheets/${spreadsheetId}`,
                null
            );

            if (response && response.sheets) {
                const sheet = response.sheets.find(s => s.properties.title === sheetName);
                return sheet ? sheet.properties.sheetId : null;
            }

            return null;
        } catch (error) {
            console.error('시트 ID 가져오기 실패:', error);
            return null;
        }
    }

    // 오래된 시트 정리 (12개월 이상 보존)
    async cleanupOldSheets(spreadsheetId) {
        try {
            const response = await window.GoogleAuth.callSheetsAPI(
                'GET',
                `/spreadsheets/${spreadsheetId}`,
                null
            );

            if (!response || !response.sheets) return;

            // 날짜 형식의 시트만 필터링
            const monthlySheets = response.sheets
                .filter(sheet => {
                    const title = sheet.properties.title;
                    return /\d{4}년_\d{2}월/.test(title) && title !== '필지정보';
                })
                .sort((a, b) => {
                    // 날짜순으로 정렬
                    const dateA = this.parseSheetDate(a.properties.title);
                    const dateB = this.parseSheetDate(b.properties.title);
                    return dateB - dateA; // 최신순
                });

            // 12개월 이상 오래된 시트 삭제
            if (monthlySheets.length > 12) {
                const sheetsToDelete = monthlySheets.slice(12);
                const deleteRequests = sheetsToDelete.map(sheet => ({
                    deleteSheet: {
                        sheetId: sheet.properties.sheetId
                    }
                }));

                await window.GoogleAuth.callSheetsAPI(
                    'POST',
                    `/spreadsheets/${spreadsheetId}:batchUpdate`,
                    { requests: deleteRequests }
                );

                console.log(`🗑️ 오래된 시트 ${sheetsToDelete.length}개 삭제 완료`);
            }

        } catch (error) {
            console.warn('오래된 시트 정리 실패:', error);
        }
    }

    // 시트명에서 날짜 파싱
    parseSheetDate(sheetName) {
        const match = sheetName.match(/(\d{4})년_(\d{2})월/);
        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1; // JavaScript에서는 0부터 시작
            return new Date(year, month);
        }
        return new Date(0); // 파싱 실패시 가장 오래된 날짜
    }

    // 로컬 저장소에 백업 저장
    async saveToLocalStorage(exportData, backupId) {
        try {
            const backupKey = `monthly_backup_${backupId}`;
            const backupData = {
                id: backupId,
                timestamp: new Date().toISOString(),
                data: exportData
            };

            localStorage.setItem(backupKey, JSON.stringify(backupData));

            // 오래된 월간 백업 정리 (최대 3개만 유지)
            this.cleanupOldMonthlyBackups();

            console.log('✅ 월간 백업을 로컬 저장소에 저장했습니다.');
            return true;
        } catch (error) {
            console.error('❌ 로컬 저장소 백업 실패:', error);
            return false;
        }
    }

    // 오래된 월간 백업 정리
    cleanupOldMonthlyBackups() {
        const monthlyBackupKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('monthly_backup_')) {
                monthlyBackupKeys.push(key);
            }
        }

        // 날짜순으로 정렬
        monthlyBackupKeys.sort().reverse();

        // 3개 초과시 오래된 백업 삭제
        if (monthlyBackupKeys.length > 3) {
            for (let i = 3; i < monthlyBackupKeys.length; i++) {
                localStorage.removeItem(monthlyBackupKeys[i]);
                console.log(`🗑️ 오래된 월간 백업 삭제: ${monthlyBackupKeys[i]}`);
            }
        }
    }

    // Google Drive에 CSV 파일 업로드
    async uploadToGoogleDrive(csvData, backupId) {
        try {
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const fileName = `필지관리_백업_${dateStr}_${backupId}.csv`;

            // Google Drive 백업 폴더 ID 가져오기
            const driveFolderId = localStorage.getItem('google_drive_folder_id') || null;

            // CSV 파일 업로드
            const fileMetadata = {
                name: fileName,
                parents: driveFolderId ? [driveFolderId] : []
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(fileMetadata)], {type: 'application/json'}));
            form.append('file', new Blob([csvData], {type: 'text/csv'}));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: new Headers({
                    'Authorization': `Bearer ${window.GoogleAuth.getAccessToken()}`
                }),
                body: form
            });

            if (!response.ok) {
                throw new Error(`Google Drive 업로드 실패: ${response.status}`);
            }

            const result = await response.json();

            console.log('✅ Google Drive 업로드 완료:', result.id);

            return {
                success: true,
                fileId: result.id,
                url: `https://drive.google.com/file/d/${result.id}/view`
            };

        } catch (error) {
            console.error('❌ Google Drive 업로드 실패:', error);
            throw error;
        }
    }

    // 오래된 백업 정리
    async cleanupOldBackups(type) {
        console.log(`🗑️ 오래된 ${type} 백업 정리 중...`);

        const retentionDays = type === 'daily' ? 30 : 365; // 일일 30일, 월간 1년 보관
        const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

        try {
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                const supabase = window.SupabaseManager.supabase;
                
                const { error } = await supabase
                    .from('backups')
                    .delete()
                    .eq('type', type)
                    .lt('created_at', cutoffDate.toISOString());

                if (error) {
                    console.warn('백업 정리 실패:', error);
                } else {
                    console.log(`✅ 오래된 ${type} 백업 정리 완료`);
                }
            }
        } catch (error) {
            console.error('백업 정리 오류:', error);
        }
    }

    // 백업 히스토리에 추가
    addToBackupHistory(metadata) {
        this.backupHistory.push(metadata);
        
        // 히스토리 크기 제한
        if (this.backupHistory.length > this.maxHistorySize) {
            this.backupHistory = this.backupHistory.slice(-this.maxHistorySize);
        }
        
        console.log(`📝 백업 히스토리 추가: ${metadata.type} ${metadata.status}`);
    }

    // 백업 설정 저장
    async saveBackupSettings() {
        try {
            const settings = {
                lastDailyBackup: this.lastDailyBackup?.toISOString(),
                lastMonthlyBackup: this.lastMonthlyBackup?.toISOString(),
                backupHistory: this.backupHistory.slice(-this.maxHistorySize)
            };
            
            localStorage.setItem('advanced_backup_settings', JSON.stringify(settings));
            console.log('💾 백업 설정 저장 완료');
            
        } catch (error) {
            console.error('❌ 백업 설정 저장 실패:', error);
        }
    }

    // 백업 상태 확인
    async checkBackupStatus() {
        const now = new Date();
        const status = {
            dailyBackup: {
                lastBackup: this.lastDailyBackup,
                nextBackup: this.getNextBackupTime('daily'),
                isOverdue: this.isDailyBackupOverdue(now)
            },
            monthlyBackup: {
                lastBackup: this.lastMonthlyBackup,
                nextBackup: this.getNextBackupTime('monthly'),
                isOverdue: this.isMonthlyBackupOverdue(now)
            }
        };
        
        console.log('📊 백업 상태:', status);
        return status;
    }

    // 다음 백업 시간 계산
    getNextBackupTime(type) {
        if (type === 'daily') {
            const next = this.lastDailyBackup ? new Date(this.lastDailyBackup) : new Date();
            next.setDate(next.getDate() + 1);
            next.setHours(2, 0, 0, 0); // 새벽 2시
            return next;
        } else if (type === 'monthly') {
            const next = this.lastMonthlyBackup ? new Date(this.lastMonthlyBackup) : new Date();
            next.setMonth(next.getMonth() + 1);
            next.setDate(1);
            next.setHours(3, 0, 0, 0); // 새벽 3시
            return next;
        }
        return null;
    }

    // 백업 지연 여부 확인
    isDailyBackupOverdue(now) {
        if (!this.lastDailyBackup) return true;
        return (now - this.lastDailyBackup) > (25 * 60 * 60 * 1000); // 25시간
    }

    isMonthlyBackupOverdue(now) {
        if (!this.lastMonthlyBackup) return true;
        const daysDiff = Math.floor((now - this.lastMonthlyBackup) / (1000 * 60 * 60 * 24));
        return daysDiff > 35; // 35일
    }

    // 수동 백업 실행
    async performManualBackup(type = 'manual') {
        console.log(`🔧 수동 ${type} 백업 시작...`);
        
        if (type === 'daily' || type === 'manual') {
            return await this.performDailyBackup();
        } else if (type === 'monthly') {
            return await this.performMonthlyBackup();
        }
    }

    // 이벤트 핸들러 설정
    setupEventHandlers() {
        // 페이지 언로드 시 긴급 백업
        window.addEventListener('beforeunload', () => {
            if (!this.isBackupRunning) {
                console.log('💾 페이지 종료 전 긴급 백업');
                this.performEmergencyBackup();
            }
        });

        console.log('🎣 백업 이벤트 핸들러 설정 완료');
    }

    // 긴급 백업 (동기)
    performEmergencyBackup() {
        try {
            const data = this.getCurrentData();
            if (data && data.length > 0) {
                // localStorage에 타임스탬프와 함께 저장
                const emergencyBackup = {
                    timestamp: new Date().toISOString(),
                    data: data,
                    type: 'emergency'
                };
                localStorage.setItem('emergency_backup', JSON.stringify(emergencyBackup));
                console.log('⚡ 긴급 백업 완료:', data.length, '개 항목');
            }
        } catch (error) {
            console.error('❌ 긴급 백업 실패:', error);
        }
    }

    // 유틸리티 함수들
    generateChecksum(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    compressData(data) {
        try {
            const jsonStr = JSON.stringify(data);
            return btoa(encodeURIComponent(jsonStr));
        } catch (error) {
            console.warn('데이터 압축 실패:', error);
            return JSON.stringify(data);
        }
    }

    getCurrentData() {
        if (window.parcelsData) return window.parcelsData;
        
        try {
            const stored = localStorage.getItem('parcelData');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            return [];
        }
    }

    // 백업 상태 정보 제공
    getStatus() {
        return {
            isBackupRunning: this.isBackupRunning,
            lastDailyBackup: this.lastDailyBackup,
            lastMonthlyBackup: this.lastMonthlyBackup,
            backupHistory: this.backupHistory,
            nextDailyBackup: this.getNextBackupTime('daily'),
            nextMonthlyBackup: this.getNextBackupTime('monthly')
        };
    }

    // 백업 히스토리 가져오기
    getBackupHistory(limit = 20) {
        return this.backupHistory
            .slice(-limit)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

// 전역 인스턴스 생성
if (!window.advancedBackupManager) {
    window.advancedBackupManager = new AdvancedBackupManager();
    console.log('💾 AdvancedBackupManager 전역 인스턴스 생성 완료');
}
