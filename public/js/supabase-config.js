// 최적화된 Supabase 설정 - 무한 루프 제거
class SupabaseManager {
    constructor() {
        this.supabaseUrl = 'https://cqfszcbifonxpfasodto.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZnN6Y2JpZm9ueHBmYXNvZHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MTM2NzUsImV4cCI6MjA3Mjk4OTY3NX0.gaEIzHhU8d7e1T8WDzxK-YDW7DPU2aLkD3XBU7TtncI';
        
        this.isConnected = false;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 5; // 최대 시도 제한
        
        // 무한 루프 방지 강화
        this._loadCallCount = 0;
        this._maxLoadCalls = 50; // 최대 호출 횟수 제한
        this._resetTime = Date.now();
        
        this.initializeSupabase();
    }

    async initializeSupabase() {
        // 🎯 무한 루프 방지 - 최대 시도 횟수 제한
        if (this.initializationAttempts >= this.maxInitializationAttempts) {
            console.warn('⚠️ Supabase 초기화 최대 시도 횟수 초과 - 오프라인 모드로 진행');
            this.isConnected = false;
            this.updateConnectionStatus(false);
            return;
        }

        this.initializationAttempts++;

        try {
            // Supabase 클라이언트 초기화
            if (typeof window !== 'undefined' && window.supabase) {
                this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
                
                // 테이블 존재 여부 확인
                await this.checkAndCreateTables();
                
                this.isConnected = true;
                console.log('✅ Supabase 연결 완료 - 시도:', this.initializationAttempts);
                
                this.updateConnectionStatus(true);
                return; // 성공 시 즉시 반환
            } else {
                console.log(`⏳ Supabase 라이브러리 로드 대기 중... (${this.initializationAttempts}/${this.maxInitializationAttempts})`);
                
                // 🎯 지수적 백오프 적용 - 재시도 간격 증가
                const delay = Math.min(1000 * Math.pow(2, this.initializationAttempts - 1), 5000);
                setTimeout(() => this.initializeSupabase(), delay);
            }
        } catch (error) {
            console.error(`❌ Supabase 연결 실패 (시도 ${this.initializationAttempts}):`, error);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // 재시도 로직 (최대 횟수 내에서만)
            if (this.initializationAttempts < this.maxInitializationAttempts) {
                const delay = Math.min(2000 * this.initializationAttempts, 10000);
                setTimeout(() => this.initializeSupabase(), delay);
            }
        }
    }

    async checkAndCreateTables() {
        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('id')
                .limit(1);

            if (error && error.code === 'PGRST116') {
                console.log('⚠️ parcels 테이블이 존재하지 않습니다. 오프라인 모드로 진행');
                throw new Error('parcels 테이블이 존재하지 않습니다.');
            } else if (error) {
                throw error;
            }
            
            console.log('✅ parcels 테이블 확인 완료');
        } catch (error) {
            console.error('❌ 테이블 확인 실패:', error);
            throw error;
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            if (connected) {
                statusEl.textContent = '🟢 Supabase 연결됨';
                statusEl.className = 'connection-status connected';
            } else {
                statusEl.textContent = '🔴 오프라인 모드';
                statusEl.className = 'connection-status disconnected';
            }
        }
    }

    // 🎯 배치 처리로 성능 최적화
    async loadParcels() {
        // 🚨 강화된 무한 루프 방지
        const now = Date.now();
        
        // 1시간마다 카운터 리셋
        if (now - this._resetTime > 3600000) {
            this._loadCallCount = 0;
            this._resetTime = now;
        }
        
        // 최대 호출 횟수 초과 시 차단
        if (this._loadCallCount >= this._maxLoadCalls) {
            console.error('🚨 loadParcels 호출 한계 초과! 무한 루프 차단');
            return this._lastResult || [];
        }
        
        this._loadCallCount++;
        
        // 무한 루프 방지 - 쿨다운 적용
        if (this._lastLoadTime && (now - this._lastLoadTime) < 1000) {
            console.log(`⏳ 로드 쿨다운 중... (${this._loadCallCount}/${this._maxLoadCalls})`);
            return this._lastResult || [];
        }
        
        // 로드 중복 방지
        if (this._isLoading) {
            console.log(`📡 Supabase 로드 이미 진행 중... (${this._loadCallCount}/${this._maxLoadCalls})`);
            return this._loadingPromise;
        }

        this._isLoading = true;
        this._lastLoadTime = now;
        
        this._loadingPromise = this._performLoad();
        
        try {
            const result = await this._loadingPromise;
            this._lastResult = result; // 결과 캐싱
            return result;
        } finally {
            this._isLoading = false;
            this._loadingPromise = null;
        }
    }

    async _performLoad() {
        if (!this.isConnected) {
            const stored = localStorage.getItem('parcels');
            const parcels = stored ? JSON.parse(stored) : [];
            console.log('📁 로컬 로드:', parcels.length, '개 필지');
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
            const stored = localStorage.getItem('parcels');
            return stored ? JSON.parse(stored) : [];
        }
    }

    // 나머지 메서드들은 기존과 동일...
    createParcelData(lat, lng, parcelName, memo = '', isColored = true, colorType = 'click') {
        return {
            id: this.generateId(),
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            parcel_name: parcelName,
            memo: memo,
            is_colored: isColored,
            color_type: colorType,
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
        let sessionId = localStorage.getItem('user_session');
        if (!sessionId) {
            sessionId = 'user_' + Date.now().toString(36);
            localStorage.setItem('user_session', sessionId);
        }
        return sessionId;
    }

    async saveParcels(parcels) {
        if (!this.isConnected) {
            localStorage.setItem('parcels', JSON.stringify(parcels));
            console.log('💾 로컬 저장 완료');
            return true;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .upsert(parcels, { onConflict: 'id' });

            if (error) throw error;
            
            console.log('✅ Supabase 저장 완료:', data?.length || parcels.length, '개 필지');
            return true;
        } catch (error) {
            console.error('❌ Supabase 저장 실패:', error);
            localStorage.setItem('parcels', JSON.stringify(parcels));
            return false;
        }
    }

    async getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            url: this.supabaseUrl,
            timestamp: new Date().toISOString(),
            attempts: this.initializationAttempts
        };
    }
}

// 전역 인스턴스 생성 - 중복 생성 방지
if (!window.SupabaseManager) {
    window.SupabaseManager = new SupabaseManager();
    console.log('🚀 최적화된 SupabaseManager 초기화 완료');
} else {
    console.log('✅ SupabaseManager 이미 존재 - 중복 생성 방지');
}