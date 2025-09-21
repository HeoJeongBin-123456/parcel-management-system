/* eslint-disable */
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
            // parcels 테이블 확인
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

            // Phase 1: parcel_type 필드 확인 및 추가 안내
            try {
                const { data: typeCheckData, error: typeCheckError } = await this.supabase
                    .from('parcels')
                    .select('parcel_type')
                    .limit(1);

                if (typeCheckError && typeCheckError.code === '42703') {
                    console.log('⚠️ parcel_type 필드가 존재하지 않습니다. 스키마 업데이트 필요');
                    console.log('📝 다음 SQL로 필드를 추가하세요:');
                    console.log(`
                        ALTER TABLE parcels
                        ADD COLUMN parcel_type TEXT DEFAULT 'click';

                        -- 기존 데이터 업데이트 (보라색은 검색, 나머지는 클릭)
                        UPDATE parcels
                        SET parcel_type = 'search'
                        WHERE color = '#9370DB';

                        UPDATE parcels
                        SET parcel_type = 'click'
                        WHERE color != '#9370DB' OR color IS NULL;
                    `);
                } else if (!typeCheckError) {
                    console.log('✅ parcel_type 필드 확인 완료');
                }
            } catch (typeError) {
                console.log('📝 parcel_type 필드 확인 중 오류 - 계속 진행:', typeError.message);
            }

            // parcel_polygons 테이블 확인 (폴리곤 데이터 저장용)
            try {
                const { data: polygonData, error: polygonError } = await this.supabase
                    .from('parcel_polygons')
                    .select('pnu')
                    .limit(1);

                if (polygonError && polygonError.code === 'PGRST116') {
                    console.log('⚠️ parcel_polygons 테이블이 존재하지 않습니다. 테이블 생성 필요');
                    // 테이블이 없으면 Supabase 대시보드에서 생성해야 함
                    console.log('📝 다음 SQL로 테이블을 생성하세요:');
                    console.log(`
                        CREATE TABLE parcel_polygons (
                            pnu TEXT PRIMARY KEY,
                            geometry JSONB NOT NULL,
                            properties JSONB,
                            simplified_geometry JSONB,
                            created_at TIMESTAMP DEFAULT NOW(),
                            updated_at TIMESTAMP DEFAULT NOW(),
                            created_by TEXT
                        );
                    `);
                } else {
                    console.log('✅ parcel_polygons 테이블 확인 완료');
                }
            } catch (polygonError) {
                console.log('📝 parcel_polygons 테이블 확인 중 오류 - 계속 진행');
            }

            // user_settings 테이블 확인 (없어도 계속 진행)
            try {
                const { data: settingsData, error: settingsError } = await this.supabase
                    .from('user_settings')
                    .select('id')
                    .limit(1);

                if (settingsError && settingsError.code === 'PGRST116') {
                    console.log('⚠️ user_settings 테이블이 존재하지 않습니다. 로컬 저장소 사용');
                } else {
                    console.log('✅ user_settings 테이블 확인 완료');
                }
            } catch (settingsError) {
                console.log('📝 user_settings 테이블 없음 - 로컬 저장소로 대체');
            }

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
    createParcelData(lat, lng, parcelName, memo = '', isColored = true, colorType = 'click', parcelType = 'click') {
        return {
            id: this.generateId(),
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            parcel_name: parcelName,
            memo: memo,
            is_colored: isColored,
            color_type: colorType,
            parcel_type: parcelType, // Phase 1: parcel_type 필드 추가
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
                .upsert(parcels, { onConflict: 'pnu' });

            if (error) throw error;

            console.log('✅ Supabase 저장 완료:', data?.length || parcels.length, '개 필지');
            return true;
        } catch (error) {
            console.error('❌ Supabase 저장 실패:', error);
            localStorage.setItem('parcels', JSON.stringify(parcels));
            return false;
        }
    }

    // =====================================================================
    // Phase 1: 모드별 독립 저장/로드 메서드들
    // =====================================================================

    // 클릭 필지만 로드
    async loadClickParcels() {
        if (!this.isConnected) {
            const clickData = window.getClickParcelData();
            console.log('📁 클릭 필지 로컬 로드:', clickData.length, '개');
            return clickData;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .eq('parcel_type', 'click')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('📡 클릭 필지 Supabase 로드 완료:', data?.length || 0, '개');
            return data || [];
        } catch (error) {
            console.error('❌ 클릭 필지 Supabase 로드 실패:', error);
            const clickData = window.getClickParcelData();
            return clickData;
        }
    }

    // 검색 필지만 로드
    async loadSearchParcels() {
        if (!this.isConnected) {
            const searchData = window.getSearchParcelData();
            console.log('📁 검색 필지 로컬 로드:', searchData.length, '개');
            return searchData;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .eq('parcel_type', 'search')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log('📡 검색 필지 Supabase 로드 완료:', data?.length || 0, '개');
            return data || [];
        } catch (error) {
            console.error('❌ 검색 필지 Supabase 로드 실패:', error);
            const searchData = window.getSearchParcelData();
            return searchData;
        }
    }

    // 클릭 필지 저장 (단일 또는 배치)
    async saveClickParcel(parcelData) {
        // parcel_type을 'click'으로 설정
        if (Array.isArray(parcelData)) {
            parcelData.forEach(p => p.parcel_type = 'click');
        } else {
            parcelData.parcel_type = 'click';
        }

        if (!this.isConnected) {
            // 로컬 저장소에 추가
            const currentData = window.getClickParcelData();
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];

            // 중복 제거 후 추가
            parcelsArray.forEach(newParcel => {
                const existingIndex = currentData.findIndex(p => p.id === newParcel.id || p.pnu === newParcel.pnu);
                if (existingIndex >= 0) {
                    currentData[existingIndex] = newParcel;
                } else {
                    currentData.push(newParcel);
                }
            });

            window.saveClickParcelData(currentData);
            console.log('💾 클릭 필지 로컬 저장 완료');
            return true;
        }

        try {
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];
            const { data, error } = await this.supabase
                .from('parcels')
                .upsert(parcelsArray, { onConflict: 'pnu' });

            if (error) throw error;

            console.log('✅ 클릭 필지 Supabase 저장 완료:', parcelsArray.length, '개');
            return true;
        } catch (error) {
            console.error('❌ 클릭 필지 Supabase 저장 실패:', error);
            // 로컬 저장소에 폴백
            const currentData = window.getClickParcelData();
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];
            parcelsArray.forEach(newParcel => {
                const existingIndex = currentData.findIndex(p => p.id === newParcel.id || p.pnu === newParcel.pnu);
                if (existingIndex >= 0) {
                    currentData[existingIndex] = newParcel;
                } else {
                    currentData.push(newParcel);
                }
            });
            window.saveClickParcelData(currentData);
            return false;
        }
    }

    // 검색 필지 저장 (단일 또는 배치)
    async saveSearchParcel(parcelData) {
        // parcel_type을 'search'로 설정
        if (Array.isArray(parcelData)) {
            parcelData.forEach(p => {
                p.parcel_type = 'search';
                p.color = '#9370DB'; // 검색 필지는 항상 보라색
            });
        } else {
            parcelData.parcel_type = 'search';
            parcelData.color = '#9370DB';
        }

        if (!this.isConnected) {
            // 로컬 저장소에 추가
            const currentData = window.getSearchParcelData();
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];

            // 중복 제거 후 추가
            parcelsArray.forEach(newParcel => {
                const existingIndex = currentData.findIndex(p => p.id === newParcel.id || p.pnu === newParcel.pnu);
                if (existingIndex >= 0) {
                    currentData[existingIndex] = newParcel;
                } else {
                    currentData.push(newParcel);
                }
            });

            window.saveSearchParcelData(currentData);
            console.log('💾 검색 필지 로컬 저장 완료');
            return true;
        }

        try {
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];
            const { data, error } = await this.supabase
                .from('parcels')
                .upsert(parcelsArray, { onConflict: 'pnu' });

            if (error) throw error;

            console.log('✅ 검색 필지 Supabase 저장 완료:', parcelsArray.length, '개');
            return true;
        } catch (error) {
            console.error('❌ 검색 필지 Supabase 저장 실패:', error);
            // 로컬 저장소에 폴백
            const currentData = window.getSearchParcelData();
            const parcelsArray = Array.isArray(parcelData) ? parcelData : [parcelData];
            parcelsArray.forEach(newParcel => {
                const existingIndex = currentData.findIndex(p => p.id === newParcel.id || p.pnu === newParcel.pnu);
                if (existingIndex >= 0) {
                    currentData[existingIndex] = newParcel;
                } else {
                    currentData.push(newParcel);
                }
            });
            window.saveSearchParcelData(currentData);
            return false;
        }
    }

    // 필지 삭제 메서드는 아래 1121번 라인에 통합됨

    async getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            url: this.supabaseUrl,
            timestamp: new Date().toISOString(),
            attempts: this.initializationAttempts
        };
    }

    // 🎨 사용자 설정 관리 메서드들
    async saveUserSetting(key, value) {
        const sessionId = this.getUserSession();

        // 로컬 저장소에도 백업
        localStorage.setItem(`setting_${key}`, JSON.stringify(value));

        if (!this.isConnected) {
            console.log(`💾 로컬 저장: ${key} = ${value}`);
            return true;
        }

        try {
            const settingData = {
                id: `${sessionId}_${key}`,
                user_session: sessionId,
                setting_key: key,
                setting_value: JSON.stringify(value),
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('user_settings')
                .upsert(settingData, { onConflict: 'id' });

            if (error) {
                console.log(`📝 Supabase 저장 실패, 로컬 저장 사용: ${key}`);
                return false;
            }

            console.log(`✅ 설정 저장 완료: ${key} = ${value}`);
            return true;
        } catch (error) {
            console.error(`❌ 설정 저장 실패: ${key}`, error);
            return false;
        }
    }

    async loadUserSetting(key, defaultValue = null) {
        const sessionId = this.getUserSession();

        if (!this.isConnected) {
            const stored = localStorage.getItem(`setting_${key}`);
            const value = stored ? JSON.parse(stored) : defaultValue;
            console.log(`📁 로컬 로드: ${key} = ${value}`);
            return value;
        }

        try {
            const { data, error } = await this.supabase
                .from('user_settings')
                .select('setting_value')
                .eq('user_session', sessionId)
                .eq('setting_key', key)
                .single();

            if (error || !data) {
                // Supabase에서 찾지 못하면 로컬 저장소 확인
                const stored = localStorage.getItem(`setting_${key}`);
                const value = stored ? JSON.parse(stored) : defaultValue;
                console.log(`📁 로컬 백업 로드: ${key} = ${value}`);
                return value;
            }

            const value = JSON.parse(data.setting_value);
            console.log(`📡 Supabase 로드: ${key} = ${value}`);
            return value;
        } catch (error) {
            console.error(`❌ 설정 로드 실패: ${key}`, error);
            // 에러 시 로컬 저장소로 폴백
            const stored = localStorage.getItem(`setting_${key}`);
            return stored ? JSON.parse(stored) : defaultValue;
        }
    }

    // 🎨 색상 설정 전용 메서드들
    async saveCurrentColor(color) {
        return await this.saveUserSetting('current_color', color);
    }

    async loadCurrentColor() {
        return await this.loadUserSetting('current_color', '#FF0000'); // 기본값: 빨간색
    }

    // ============================================================================
    // 🌟 새로운 올인원 Supabase 메서드들 - user_states 테이블 관리
    // ============================================================================

    // 사용자 상태 저장 (지도 위치, 선택된 필지, UI 상태 등)
    async saveUserState(stateData) {
        const sessionId = this.getUserSession();

        if (!this.isConnected) {
            // 로컬 저장소 백업
            localStorage.setItem('user_state', JSON.stringify(stateData));
            console.log('💾 로컬 상태 저장:', Object.keys(stateData));
            return true;
        }

        try {
            const stateRecord = {
                user_session: sessionId,
                ...stateData,
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('user_states')
                .upsert(stateRecord, {
                    onConflict: 'user_session',
                    ignoreDuplicates: false
                });

            if (error) {
                console.warn('📝 Supabase 상태 저장 실패, 로컬 저장 사용:', error);
                localStorage.setItem('user_state', JSON.stringify(stateData));
                return false;
            }

            console.log('✅ 사용자 상태 저장 완료:', Object.keys(stateData));
            return true;
        } catch (error) {
            console.error('❌ 사용자 상태 저장 실패:', error);
            localStorage.setItem('user_state', JSON.stringify(stateData));
            return false;
        }
    }

    // 사용자 상태 로드
    async loadUserState() {
        const sessionId = this.getUserSession();

        if (!this.isConnected) {
            const stored = localStorage.getItem('user_state');
            const state = stored ? JSON.parse(stored) : {};
            console.log('📁 로컬 상태 로드:', Object.keys(state));
            return state;
        }

        try {
            const { data, error } = await this.supabase
                .from('user_states')
                .select('*')
                .eq('user_session', sessionId)
                .single();

            if (error || !data) {
                const stored = localStorage.getItem('user_state');
                const state = stored ? JSON.parse(stored) : {};
                console.log('📁 로컬 백업 상태 로드:', Object.keys(state));
                return state;
            }

            console.log('📡 Supabase 상태 로드:', Object.keys(data));
            return data;
        } catch (error) {
            console.error('❌ 사용자 상태 로드 실패:', error);
            const stored = localStorage.getItem('user_state');
            return stored ? JSON.parse(stored) : {};
        }
    }

    // ============================================================================
    // 🗺️ 지도 상태 관리 (user_states 테이블의 특정 필드들)
    // ============================================================================

    // 지도 중심점과 줌 레벨 저장
    async saveMapPosition(lat, lng, zoom) {
        const mapCenter = { lat, lng, zoom };
        return await this.saveUserState({ map_center: mapCenter });
    }

    // 지도 중심점과 줌 레벨 로드
    async loadMapPosition() {
        const state = await this.loadUserState();
        return state.map_center || { lat: 37.5665, lng: 126.9780, zoom: 15 };
    }

    // 선택된 필지 저장
    async saveSelectedParcel(parcelId, pnu = null) {
        return await this.saveUserState({
            selected_parcel_id: parcelId,
            selected_parcel_pnu: pnu
        });
    }

    // 선택된 필지 로드
    async loadSelectedParcel() {
        const state = await this.loadUserState();
        return {
            parcelId: state.selected_parcel_id || null,
            pnu: state.selected_parcel_pnu || null
        };
    }

    // 활성 레이어 저장 (일반지도, 위성지도, 지적편집도 등)
    async saveActiveLayers(layers) {
        return await this.saveUserState({ active_layers: layers });
    }

    // 활성 레이어 로드
    async loadActiveLayers() {
        const state = await this.loadUserState();
        return state.active_layers || ['normal'];
    }

    // UI 상태 저장 (사이드바, 모달 등)
    async saveUIState(uiState) {
        return await this.saveUserState({ ui_state: uiState });
    }

    // UI 상태 로드
    async loadUIState() {
        const state = await this.loadUserState();
        return state.ui_state || {};
    }

    // 검색/클릭 모드 저장
    async saveCurrentMode(mode) {
        return await this.saveUserState({ current_mode: mode });
    }

    // 검색/클릭 모드 로드
    async loadCurrentMode() {
        const state = await this.loadUserState();
        return state.current_mode || 'click';
    }

    // ============================================================================
    // 📍 고급 필지 관리 (parcels 테이블 확장 기능)
    // ============================================================================

    // 필지에 폴리곤 데이터 저장
    async saveParcelPolygon(parcelId, polygonData) {
        if (!this.isConnected) {
            console.log('💾 오프라인 모드 - 폴리곤 데이터 로컬 저장');
            return false;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .update({
                    polygon_data: polygonData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', parcelId);

            if (error) throw error;
            console.log('✅ 필지 폴리곤 저장 완료:', parcelId);
            return true;
        } catch (error) {
            console.error('❌ 필지 폴리곤 저장 실패:', error);
            return false;
        }
    }

    // 필지에 마커 데이터 저장
    async saveParcelMarker(parcelId, markerData, markerType = 'normal') {
        if (!this.isConnected) {
            console.log('💾 오프라인 모드 - 마커 데이터 로컬 저장');
            return false;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .update({
                    marker_data: markerData,
                    marker_type: markerType,
                    updated_at: new Date().toISOString()
                })
                .eq('id', parcelId);

            if (error) throw error;
            console.log('✅ 필지 마커 저장 완료:', parcelId, markerType);
            return true;
        } catch (error) {
            console.error('❌ 필지 마커 저장 실패:', error);
            return false;
        }
    }

    // 필지 색상 정보 저장 (기존 color_type 확장)
    async saveParcelColor(parcelId, colorInfo) {
        if (!this.isConnected) {
            console.log('💾 오프라인 모드 - 색상 정보 로컬 저장');
            return false;
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .update({
                    color_info: {
                        ...colorInfo,
                        applied_at: new Date().toISOString()
                    },
                    is_colored: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', parcelId);

            if (error) throw error;
            console.log('✅ 필지 색상 저장 완료:', parcelId, colorInfo.color);
            return true;
        } catch (error) {
            console.error('❌ 필지 색상 저장 실패:', error);
            return false;
        }
    }

    // 고급 필지 정보 저장 (소유자 정보, 메타데이터 포함)
    async saveAdvancedParcelInfo(parcelId, advancedInfo) {
        if (!this.isConnected) {
            console.log('💾 오프라인 모드 - 고급 정보 로컬 저장');
            return false;
        }

        try {
            const updateData = {
                updated_at: new Date().toISOString()
            };

            // 선택적으로 업데이트할 필드들
            if (advancedInfo.ownerInfo) updateData.owner_info = advancedInfo.ownerInfo;
            if (advancedInfo.pnuCode) updateData.pnu_code = advancedInfo.pnuCode;
            if (advancedInfo.addressFull) updateData.address_full = advancedInfo.addressFull;
            if (advancedInfo.addressShort) updateData.address_short = advancedInfo.addressShort;
            if (advancedInfo.metadata) updateData.metadata = advancedInfo.metadata;

            const { data, error } = await this.supabase
                .from('parcels')
                .update(updateData)
                .eq('id', parcelId);

            if (error) throw error;
            console.log('✅ 필지 고급 정보 저장 완료:', parcelId);
            return true;
        } catch (error) {
            console.error('❌ 필지 고급 정보 저장 실패:', error);
            return false;
        }
    }

    // ============================================================================
    // 🔍 고급 쿼리 메서드들
    // ============================================================================

    // 메모가 있는 필지들만 조회
    async loadMemoparcels() {
        if (!this.isConnected) {
            const stored = localStorage.getItem('parcels');
            const parcels = stored ? JSON.parse(stored) : [];
            return parcels.filter(p => p.memo && p.memo.trim() !== '');
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .not('memo', 'is', null)
                .neq('memo', '')
                .order('updated_at', { ascending: false });

            if (error) throw error;
            console.log('📡 메모 필지 로드 완료:', data?.length || 0, '개');
            return data || [];
        } catch (error) {
            console.error('❌ 메모 필지 로드 실패:', error);
            return [];
        }
    }

    // 특정 색상의 필지들만 조회
    async loadParcelsByColor(color) {
        if (!this.isConnected) {
            const stored = localStorage.getItem('parcels');
            const parcels = stored ? JSON.parse(stored) : [];
            return parcels.filter(p =>
                (p.color_info && p.color_info.color === color) ||
                (p.color === color) // 하위 호환성
            );
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .contains('color_info', { color: color })
                .order('updated_at', { ascending: false });

            if (error) throw error;
            console.log(`📡 ${color} 색상 필지 로드 완료:`, data?.length || 0, '개');
            return data || [];
        } catch (error) {
            console.error('❌ 색상별 필지 로드 실패:', error);
            return [];
        }
    }

    // 특정 마커 타입의 필지들만 조회
    async loadParcelsByMarkerType(markerType) {
        if (!this.isConnected) {
            const stored = localStorage.getItem('parcels');
            const parcels = stored ? JSON.parse(stored) : [];
            return parcels.filter(p => p.marker_type === markerType);
        }

        try {
            const { data, error } = await this.supabase
                .from('parcels')
                .select('*')
                .eq('marker_type', markerType)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            console.log(`📡 ${markerType} 마커 필지 로드 완료:`, data?.length || 0, '개');
            return data || [];
        } catch (error) {
            console.error('❌ 마커 타입별 필지 로드 실패:', error);
            return [];
        }
    }

    // 🗺️ 폴리곤 데이터 저장 (실시간 공유용)
    async savePolygonData(pnu, geometry, properties) {
        if (!this.isConnected) {
            console.warn('⚠️ Supabase 미연결, IndexedDB에 저장');
            // IndexedDB 백업 로직은 DataPersistenceManager에서 처리
            return false;
        }

        try {
            // 폴리곤 간소화 (크기 최적화)
            const simplifiedGeometry = this.simplifyPolygon(geometry);

            const { data, error } = await this.supabase
                .from('parcel_polygons')
                .upsert({
                    pnu: pnu,
                    geometry: geometry,
                    properties: properties,
                    simplified_geometry: simplifiedGeometry,
                    updated_at: new Date().toISOString(),
                    created_by: this.getUserSession()
                }, {
                    onConflict: 'pnu'
                })
                .select();

            if (error) throw error;

            console.log('🗺️ 폴리곤 데이터 Supabase 저장 완료:', pnu);
            return data;
        } catch (error) {
            console.error('❌ 폴리곤 저장 실패:', error);
            return false;
        }
    }

    // 🗺️ 모든 폴리곤 데이터 조회
    async loadAllPolygons() {
        if (!this.isConnected) {
            console.warn('⚠️ Supabase 미연결, 로컬 데이터 사용');
            return [];
        }

        try {
            const { data, error } = await this.supabase
                .from('parcel_polygons')
                .select('*')
                .order('updated_at', { ascending: false });

            if (error) throw error;

            console.log(`🗺️ ${data.length}개 폴리곤 로드 완료`);
            return data || [];
        } catch (error) {
            console.error('❌ 폴리곤 로드 실패:', error);
            return [];
        }
    }

    // 🗺️ 특정 폴리곤 데이터 조회
    async getPolygonData(pnu) {
        if (!this.isConnected) return null;

        try {
            const { data, error } = await this.supabase
                .from('parcel_polygons')
                .select('*')
                .eq('pnu', pnu)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('❌ 폴리곤 조회 실패:', error);
            return null;
        }
    }

    // 폴리곤 간소화 (Douglas-Peucker 알고리즘 간단 버전)
    simplifyPolygon(geometry) {
        if (!geometry || !geometry.coordinates) return geometry;

        // 단순한 간소화 - 매 2번째 점만 유지 (실제로는 더 정교한 알고리즘 필요)
        try {
            const simplified = JSON.parse(JSON.stringify(geometry));
            if (geometry.type === 'Polygon') {
                simplified.coordinates[0] = geometry.coordinates[0].filter((point, index) =>
                    index % 2 === 0 || index === geometry.coordinates[0].length - 1
                );
            }
            return simplified;
        } catch (error) {
            return geometry;
        }
    }

    // 🌟 누락된 핵심 메서드: 개별 필지 저장 (확장된 JSONB 필드 활용)
    async saveParcel(pnu, parcelData) {
        if (!this.isConnected) {
            console.warn('⚠️ Supabase 미연결, localStorage에만 저장');
            // localStorage 백업
            try {
                const stored = localStorage.getItem('parcels') || '[]';
                const parcels = JSON.parse(stored);
                const existingIndex = parcels.findIndex(p => p.pnu === pnu);

                if (existingIndex >= 0) {
                    parcels[existingIndex] = { ...parcels[existingIndex], ...parcelData, pnu };
                } else {
                    parcels.push({ ...parcelData, pnu });
                }

                localStorage.setItem('parcels', JSON.stringify(parcels));
                console.log('💾 로컬 백업 저장 완료:', pnu);
            } catch (error) {
                console.error('❌ 로컬 백업 저장 실패:', error);
            }
            return false;
        }

        try {
            // Supabase에 upsert (없으면 생성, 있으면 업데이트)
            const { data, error } = await this.supabase
                .from('parcels')
                .upsert({
                    pnu: pnu,
                    parcel_name: parcelData.parcelNumber || parcelData.parcel_name,
                    lat: parseFloat(parcelData.lat) || null,
                    lng: parseFloat(parcelData.lng) || null,
                    owner_name: parcelData.ownerName || null,
                    owner_address: parcelData.ownerAddress || null,
                    owner_contact: parcelData.ownerContact || null,
                    memo: parcelData.memo || null,
                    // 🔺 새로운 JSONB 필드들
                    polygon_data: parcelData.polygon_data || parcelData.geometry || null,
                    color_info: {
                        color: parcelData.color || null,
                        mode_source: parcelData.mode_source || parcelData.source || null,
                        current_mode: parcelData.current_mode || parcelData.mode || null
                    },
                    marker_data: parcelData.marker_data || null,
                    user_session: this.getUserSession(),
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'pnu'
                })
                .select();

            if (error) throw error;

            console.log('✅ 필지 Supabase 저장 완료:', pnu);
            return data;
        } catch (error) {
            console.error('❌ 필지 Supabase 저장 실패:', error);

            // 에러 발생시 localStorage 백업
            try {
                const stored = localStorage.getItem('parcels') || '[]';
                const parcels = JSON.parse(stored);
                const existingIndex = parcels.findIndex(p => p.pnu === pnu);

                if (existingIndex >= 0) {
                    parcels[existingIndex] = { ...parcels[existingIndex], ...parcelData, pnu };
                } else {
                    parcels.push({ ...parcelData, pnu });
                }

                localStorage.setItem('parcels', JSON.stringify(parcels));
                console.log('💾 Supabase 실패로 인한 로컬 백업 저장:', pnu);
            } catch (backupError) {
                console.error('❌ 백업 저장도 실패:', backupError);
            }

            return false;
        }
    }

    // 필지 삭제 메서드
    async deleteParcel(pnu, options = {}) {
        if (!this.isConnected) {
            console.warn('⚠️ Supabase 미연결 상태');
            return false;
        }

        try {
            const candidateSet = new Set();
            const addCandidate = (value) => {
                if (!value && value !== 0) {
                    return;
                }
                const stringValue = String(value).trim();
                if (stringValue.length === 0 || stringValue === 'null' || stringValue === 'undefined') {
                    return;
                }
                candidateSet.add(stringValue);
            };

            addCandidate(pnu);
            addCandidate(options.pnu);
            addCandidate(options.id);
            addCandidate(options.pnuCode);
            addCandidate(options.parcelNumber);

            if (Array.isArray(options.candidates)) {
                options.candidates.forEach(addCandidate);
            }

            if (options.parcel && typeof options.parcel === 'object') {
                addCandidate(options.parcel.pnu);
                addCandidate(options.parcel.pnu_code);
                addCandidate(options.parcel.pnuCode);
                addCandidate(options.parcel.id);
            }

            if (candidateSet.size === 0) {
                console.warn('⚠️ Supabase 삭제를 위한 식별자가 없습니다.');
                return false;
            }

            const candidateList = Array.from(candidateSet);
            const deletedRows = [];
            const targetColumns = ['pnu', 'id', 'pnu_code'];

            for (const column of targetColumns) {
                try {
                    const { data, error } = await this.supabase
                        .from('parcels')
                        .delete()
                        .in(column, candidateList)
                        .select('id, pnu, pnu_code');

                    if (error) {
                        if (error.code && error.code !== 'PGRST116') {
                            console.error(`❌ parcels 테이블 ${column} 기준 삭제 실패:`, error);
                        }
                        continue;
                    }

                    if (Array.isArray(data) && data.length > 0) {
                        deletedRows.push(...data);
                    }
                } catch (innerError) {
                    console.error(`❌ parcels 테이블 ${column} 삭제 중 예외:`, innerError);
                }
            }

            if (deletedRows.length === 0) {
                console.warn('⚠️ Supabase에서 삭제된 필지가 없습니다.', candidateList);
                return false;
            }

            const polygonCandidates = new Set(candidateList);
            deletedRows.forEach(row => {
                if (row.pnu) {
                    polygonCandidates.add(String(row.pnu));
                }
                if (row.pnu_code) {
                    polygonCandidates.add(String(row.pnu_code));
                }
                if (row.id) {
                    polygonCandidates.add(String(row.id));
                }
            });

            if (polygonCandidates.size > 0) {
                const polygonList = Array.from(polygonCandidates);
                const { error: polygonError } = await this.supabase
                    .from('parcel_polygons')
                    .delete()
                    .in('pnu', polygonList);

                if (polygonError && polygonError.code !== 'PGRST116') {
                    console.error('❌ parcel_polygons 테이블 삭제 실패:', polygonError);
                }
            }

            console.log('✅ Supabase에서 필지 완전 삭제:', candidateList.join(', '));
            return true;
        } catch (error) {
            console.error('❌ 필지 삭제 중 오류:', error);
            return false;
        }
    }

    // 전체 필지 데이터 삭제 (관리자 기능)
    async deleteAllParcelData() {
        if (!this.isConnected) {
            console.warn('⚠️ Supabase 미연결 상태 - 원격 데이터 삭제 불가');
            return false;
        }

        try {
            const { error: parcelsError } = await this.supabase
                .from('parcels')
                .delete()
                .neq('pnu', '0');

            if (parcelsError && parcelsError.code !== 'PGRST116') {
                throw parcelsError;
            }

            const { error: polygonsError } = await this.supabase
                .from('parcel_polygons')
                .delete()
                .neq('pnu', '0');

            if (polygonsError && polygonsError.code !== 'PGRST116') {
                throw polygonsError;
            }

            console.log('🧹 Supabase 전체 필지 데이터 삭제 완료');
            return true;
        } catch (error) {
            console.error('❌ Supabase 전체 데이터 삭제 실패:', error);
            return false;
        }
    }
}

// 전역 인스턴스 생성 - 중복 생성 방지
if (!window.SupabaseManager) {
    window.SupabaseManager = new SupabaseManager();
    console.log('🚀 최적화된 SupabaseManager 초기화 완료');
} else {
    console.log('✅ SupabaseManager 이미 존재 - 중복 생성 방지');
}
