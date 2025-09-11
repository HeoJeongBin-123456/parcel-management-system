// Supabase 설정 및 데이터베이스 관리
class SupabaseManager {
    constructor() {
        // Supabase 설정 (Pro 계정)
        this.supabaseUrl = 'https://cqfszcbifonxpfasodto.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZnN6Y2JpZm9ueHBmYXNvZHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTM2NzUsImV4cCI6MjA3Mjk4OTY3NX0.gaEIzHhU8d7e1T8WDzxK-YDW7DPU2aLkD3XBU7TtncI';
        
        // 임시로 로컬 환경에서는 localStorage 사용, 실제로는 Supabase 연결
        this.isConnected = false;
        this.initializeSupabase();
    }

    async initializeSupabase() {
        try {
            // Supabase 클라이언트 초기화
            if (typeof window !== 'undefined' && window.supabase) {
                this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
                this.isConnected = true;
                console.log('✅ Supabase 연결 성공');
            } else {
                console.log('⚠️ Supabase 라이브러리 로드 대기 중...');
                // CDN 로딩 대기
                setTimeout(() => this.initializeSupabase(), 500);
            }
        } catch (error) {
            console.error('❌ Supabase 연결 실패:', error);
            this.isConnected = false;
        }
    }

    // 필지 데이터 구조
    createParcelData(lat, lng, parcelName, memo = '', isColored = true, colorType = 'click') {
        return {
            id: this.generateId(),
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            parcel_name: parcelName,
            memo: memo,
            is_colored: isColored,
            color_type: colorType, // 'click' (빨강) 또는 'search' (보라)
            has_memo: memo.trim() !== '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_session: this.getUserSession()
        };
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getUserSession() {
        // 간단한 세션 ID 생성 (실제로는 더 정교한 사용자 인증 필요)
        let sessionId = localStorage.getItem('user_session');
        if (!sessionId) {
            sessionId = 'user_' + Date.now().toString(36);
            localStorage.setItem('user_session', sessionId);
        }
        return sessionId;
    }

    // ========================================
    // 필지 데이터 CRUD 작업
    // ========================================

    async saveParcels(parcels) {
        if (!this.isConnected) {
            // Fallback: localStorage 사용
            localStorage.setItem('parcels', JSON.stringify(parcels));
            console.log('💾 로컬 저장 완료 (Supabase 미연결)');
            return true;
        }

        try {
            // Supabase에 저장
            const { data, error } = await this.supabase
                .from('parcels')
                .upsert(parcels, { onConflict: 'id' });

            if (error) throw error;
            
            console.log('✅ Supabase 저장 완료:', data?.length || parcels.length, '개 필지');
            
            // 실시간 업데이트 알림
            this.broadcastUpdate('parcels_updated', parcels);
            
            return true;
        } catch (error) {
            console.error('❌ Supabase 저장 실패:', error);
            // Fallback to localStorage
            localStorage.setItem('parcels', JSON.stringify(parcels));
            return false;
        }
    }

    async loadParcels() {
        if (!this.isConnected) {
            // Fallback: localStorage 사용
            const stored = localStorage.getItem('parcels');
            const parcels = stored ? JSON.parse(stored) : [];
            console.log('📁 로컬 로드 완료:', parcels.length, '개 필지');
            return parcels;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('📡 Supabase 로드 완료:', data?.length || 0, '개 필지');
            return data || [];
        } catch (error) {
            console.error('❌ Supabase 로드 실패:', error);
            // Fallback to localStorage
            const stored = localStorage.getItem('parcels');
            return stored ? JSON.parse(stored) : [];
        }
    }

    async deleteParcel(parcelId) {
        if (!this.isConnected) {
            // localStorage에서 삭제
            const parcels = await this.loadParcels();
            const filtered = parcels.filter(p => p.id !== parcelId);
            localStorage.setItem('parcels', JSON.stringify(filtered));
            console.log('🗑️ 로컬 삭제 완료:', parcelId);
            return true;
        }

        try {
            const { error } = await this.supabase
                .from('parcels')
                .delete()
                .eq('id', parcelId);

            if (error) throw error;

            console.log('🗑️ Supabase 삭제 완료:', parcelId);
            
            // 실시간 업데이트 알림
            this.broadcastUpdate('parcel_deleted', { id: parcelId });
            
            return true;
        } catch (error) {
            console.error('❌ Supabase 삭제 실패:', error);
            return false;
        }
    }

    // ========================================
    // 실시간 동기화 (최대 5명)
    // ========================================

    setupRealTimeSync() {
        if (!this.isConnected) {
            console.log('⚠️ 실시간 동기화 불가 (Supabase 미연결)');
            return;
        }

        // Supabase Realtime 구독
        const subscription = this.supabase
            .channel('parcels_realtime')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'parcels' },
                (payload) => {
                    console.log('📡 실시간 업데이트:', payload);
                    this.handleRealTimeUpdate(payload);
                }
            )
            .subscribe();

        console.log('📡 실시간 동기화 활성화');
        return subscription;
    }

    handleRealTimeUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        switch (eventType) {
            case 'INSERT':
                this.onParcelAdded(newRecord);
                break;
            case 'UPDATE':
                this.onParcelUpdated(newRecord);
                break;
            case 'DELETE':
                this.onParcelDeleted(oldRecord);
                break;
        }
    }

    onParcelAdded(parcel) {
        // 지도에 새 필지 추가
        if (window.ParcelManager) {
            window.ParcelManager.addRealtimeParcel(parcel);
        }
        console.log('➕ 실시간 필지 추가:', parcel.parcel_name);
    }

    onParcelUpdated(parcel) {
        // 지도의 필지 업데이트
        if (window.ParcelManager) {
            window.ParcelManager.updateRealtimeParcel(parcel);
        }
        console.log('🔄 실시간 필지 업데이트:', parcel.parcel_name);
    }

    onParcelDeleted(parcel) {
        // 지도에서 필지 제거
        if (window.ParcelManager) {
            window.ParcelManager.deleteRealtimeParcel(parcel);
        }
        console.log('➖ 실시간 필지 삭제:', parcel.parcel_name);
    }

    broadcastUpdate(type, data) {
        // BroadcastChannel로 다른 탭들에게도 알림
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('parcels_sync');
            channel.postMessage({ type, data, timestamp: Date.now() });
        }
    }

    // ========================================
    // 백업 관리
    // ========================================

    async createDailyBackup() {
        const parcels = await this.loadParcels();
        const backupData = {
            backup_date: new Date().toISOString().split('T')[0],
            data: parcels,
            count: parcels.length,
            created_at: new Date().toISOString()
        };

        if (this.isConnected) {
            try {
                const { error } = await this.supabase
                    .from('daily_backups')
                    .insert(backupData);

                if (error) throw error;
                console.log('💾 일일 백업 완료:', parcels.length, '개 필지');
                return true;
            } catch (error) {
                console.error('❌ 일일 백업 실패:', error);
            }
        }

        // Fallback: 로컬 백업
        localStorage.setItem(`backup_${backupData.backup_date}`, JSON.stringify(backupData));
        console.log('💾 로컬 백업 완료:', parcels.length, '개 필지');
        return false;
    }

    async exportToGoogleSheets(parcels) {
        // Google Sheets API 호출 (월간 백업용)
        const csvData = this.convertToCSV(parcels);
        
        try {
            // 실제로는 Google Sheets API 키와 시트 ID 필요
            console.log('📊 Google Sheets 백업 준비:', csvData.length, '바이트');
            
            // 임시로 CSV 다운로드
            this.downloadCSV(csvData, `parcels_backup_${new Date().toISOString().split('T')[0]}.csv`);
            
            return true;
        } catch (error) {
            console.error('❌ Google Sheets 백업 실패:', error);
            return false;
        }
    }

    convertToCSV(parcels) {
        const headers = ['ID', '위도', '경도', '필지명', '메모', '색칠여부', '색상타입', '생성일'];
        const rows = parcels.map(p => [
            p.id,
            p.lat,
            p.lng,
            p.parcel_name,
            p.memo.replace(/"/g, '""'), // CSV 이스케이프
            p.is_colored ? '예' : '아니오',
            p.color_type === 'click' ? '클릭(빨강)' : '검색(보라)',
            p.created_at
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        return '\uFEFF' + csvContent; // UTF-8 BOM 추가
    }

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // ========================================
    // 유틸리티 메서드
    // ========================================

    async getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            url: this.supabaseUrl,
            timestamp: new Date().toISOString()
        };
    }

    async getParcelsWithMemo() {
        const parcels = await this.loadParcels();
        return parcels.filter(p => p.has_memo);
    }

    async searchParcels(query) {
        const parcels = await this.loadParcels();
        return parcels.filter(p => 
            p.parcel_name.includes(query) || 
            p.memo.includes(query)
        );
    }
}

// 전역 인스턴스 생성
window.SupabaseManager = new SupabaseManager();

console.log('🚀 SupabaseManager 초기화 완료');