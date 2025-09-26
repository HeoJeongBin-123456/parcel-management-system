/**
 * 실시간 협업 매니저
 * - 여러 사용자가 동시에 필지 색칠 공유
 * - Supabase Realtime으로 즉시 동기화
 * - 충돌 방지 및 낙관적 업데이트
 */

class RealtimeCollaborationManager {
    constructor() {
        this.subscription = null;
        this.isSubscribed = false;
        this.userSession = this.getUserSession();
        this.activeUsers = new Map();
        this.changeBuffer = [];
        this.lastSyncTime = Date.now();

        console.log('👥 RealtimeCollaborationManager 초기화');
        this.initialize();
    }

    async initialize() {
        await this.waitForSupabase();
        await this.setupRealtimeSubscription();
        this.setupPresence();
    }

    async waitForSupabase() {
        let attempts = 0;
        while (attempts < 50) {
            if (window.SupabaseManager && window.SupabaseManager.isConnected) {
                console.log('✅ Supabase 연결 확인');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        console.warn('⚠️ Supabase 연결 실패 - 실시간 협업 비활성화');
        return false;
    }

    /**
     * ========================================
     * 1. Realtime 구독 설정
     * ========================================
     */

    async setupRealtimeSubscription() {
        if (!window.SupabaseManager || !window.SupabaseManager.supabase) {
            console.warn('⚠️ Supabase 미연결 - Realtime 구독 건너뜀');
            return;
        }

        try {
            const supabase = window.SupabaseManager.supabase;

            this.subscription = supabase
                .channel('parcels-realtime')
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'parcels'
                    },
                    (payload) => this.handleDatabaseChange(payload)
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        this.isSubscribed = true;
                        console.log('✅ Realtime 구독 활성화');
                        this.showCollaborationStatus('🟢 협업 모드 활성화');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Realtime 구독 오류');
                        this.showCollaborationStatus('🔴 협업 모드 오류');
                    }
                });

        } catch (error) {
            console.error('❌ Realtime 구독 설정 실패:', error);
        }
    }

    /**
     * ========================================
     * 2. 데이터베이스 변경 처리
     * ========================================
     */

    handleDatabaseChange(payload) {
        const { eventType, old: oldData, new: newData } = payload;

        if (this.isMyChange(newData)) {
            return;
        }

        console.log(`👥 다른 사용자의 변경: ${eventType}`, newData);

        switch (eventType) {
            case 'INSERT':
                this.handleInsert(newData);
                break;
            case 'UPDATE':
                this.handleUpdate(newData, oldData);
                break;
            case 'DELETE':
                this.handleDelete(oldData);
                break;
        }

        this.lastSyncTime = Date.now();
    }

    handleInsert(data) {
        console.log('➕ 새 필지 추가:', data.pnu || data.id);

        if (window.clickParcels && window.clickParcels.has) {
            if (!window.clickParcels.has(data.pnu || data.id)) {
                if (window.loadSavedParcels) {
                    window.loadSavedParcels();
                }
            }
        }

        this.showCollaborationNotification(`팀원이 필지를 추가했습니다`, 'info');
    }

    handleUpdate(newData, oldData) {
        const pnu = newData.pnu || newData.id;
        console.log('✏️ 필지 업데이트:', pnu);

        if (window.clickParcels && window.clickParcels.get) {
            const existingPolygon = window.clickParcels.get(pnu);

            if (existingPolygon && newData.color !== oldData?.color) {
                if (existingPolygon.setOptions) {
                    existingPolygon.setOptions({
                        fillColor: newData.color || 'transparent',
                        fillOpacity: newData.color ? 0.4 : 0
                    });
                }

                this.showCollaborationNotification(`필지 ${pnu}의 색상이 변경되었습니다`, 'info');
            }
        }

        if (window.parcelsData && Array.isArray(window.parcelsData)) {
            const index = window.parcelsData.findIndex(p =>
                (p.pnu === pnu) || (p.id === pnu)
            );

            if (index !== -1) {
                window.parcelsData[index] = {
                    ...window.parcelsData[index],
                    ...newData
                };
            }
        }

        if (window.MemoMarkerManager && window.MemoMarkerManager.updateMarker) {
            window.MemoMarkerManager.updateMarker(pnu, newData);
        }
    }

    handleDelete(data) {
        const pnu = data.pnu || data.id;
        console.log('➖ 필지 삭제:', pnu);

        if (window.clickParcels && window.clickParcels.get) {
            const polygon = window.clickParcels.get(pnu);
            if (polygon) {
                if (polygon.setMap) {
                    polygon.setMap(null);
                }
                window.clickParcels.delete(pnu);
            }
        }

        if (window.parcelsData && Array.isArray(window.parcelsData)) {
            window.parcelsData = window.parcelsData.filter(p =>
                p.pnu !== pnu && p.id !== pnu
            );
        }

        if (window.MemoMarkerManager && window.MemoMarkerManager.markers) {
            const markerInfo = window.MemoMarkerManager.markers.get(pnu);
            if (markerInfo && markerInfo.marker) {
                markerInfo.marker.setMap(null);
                window.MemoMarkerManager.markers.delete(pnu);
            }
        }

        this.showCollaborationNotification(`필지가 삭제되었습니다`, 'warning');
    }

    isMyChange(data) {
        if (!data || !data.updated_by) return false;
        return data.updated_by === this.userSession;
    }

    /**
     * ========================================
     * 3. Presence (접속 중인 사용자)
     * ========================================
     */

    setupPresence() {
        if (!this.subscription) return;

        this.subscription
            .on('presence', { event: 'sync' }, () => {
                const state = this.subscription.presenceState();
                this.activeUsers.clear();

                Object.keys(state).forEach(key => {
                    const presences = state[key];
                    presences.forEach(presence => {
                        this.activeUsers.set(presence.user_id, presence);
                    });
                });

                console.log(`👥 접속 중인 사용자: ${this.activeUsers.size}명`);
                this.updatePresenceUI();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('👋 사용자 접속:', newPresences);
                this.showCollaborationNotification(`팀원이 접속했습니다 (${this.activeUsers.size + 1}명 온라인)`, 'info');
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                console.log('👋 사용자 퇴장:', leftPresences);
            });

        this.subscription.track({
            user_id: this.userSession,
            online_at: new Date().toISOString()
        });
    }

    updatePresenceUI() {
        const presenceEl = document.getElementById('activeUsersCount');
        if (presenceEl) {
            presenceEl.textContent = `👥 ${this.activeUsers.size}`;
            presenceEl.title = `${this.activeUsers.size}명 접속 중`;
        }
    }

    /**
     * ========================================
     * 4. 충돌 방지 (낙관적 잠금)
     * ========================================
     */

    async saveWithConflictResolution(pnu, updates) {
        try {
            const current = await this.getLatestVersion(pnu);

            if (!current) {
                console.log('신규 데이터 - 충돌 없음');
                return await this.directSave(pnu, updates);
            }

            const localVersion = updates.version || 0;
            const remoteVersion = current.version || 0;

            if (localVersion < remoteVersion) {
                console.warn('⚠️ 충돌 감지: 다른 사용자가 먼저 수정함');

                const shouldOverwrite = await this.resolveConflict(current, updates);

                if (!shouldOverwrite) {
                    console.log('사용자가 취소 - 최신 데이터 반영');
                    return current;
                }
            }

            updates.version = remoteVersion + 1;
            updates.updated_by = this.userSession;
            updates.updated_at = new Date().toISOString();

            return await this.directSave(pnu, updates);

        } catch (error) {
            console.error('❌ 저장 실패:', error);
            throw error;
        }
    }

    async getLatestVersion(pnu) {
        if (!window.SupabaseManager || !window.SupabaseManager.supabase) {
            return null;
        }

        try {
            const { data, error } = await window.SupabaseManager.supabase
                .from('parcels')
                .select('*')
                .or(`pnu.eq.${pnu},id.eq.${pnu}`)
                .single();

            if (error) {
                console.warn('최신 버전 조회 실패:', error);
                return null;
            }

            return data;

        } catch (error) {
            console.error('최신 버전 조회 오류:', error);
            return null;
        }
    }

    async directSave(pnu, updates) {
        if (window.UnifiedBackupManager) {
            await window.UnifiedBackupManager.saveToCloud([updates]);
        }
        return updates;
    }

    async resolveConflict(remoteData, localData) {
        const message = `⚠️ 충돌 감지\n\n다른 사용자가 이 필지를 먼저 수정했습니다.\n\n현재 데이터:\n- 색상: ${remoteData.color || '없음'}\n- 메모: ${remoteData.memo || '없음'}\n\n덮어쓰시겠습니까?`;

        return confirm(message);
    }

    /**
     * ========================================
     * 5. 유틸리티
     * ========================================
     */

    getUserSession() {
        let session = localStorage.getItem('user_session');

        if (!session) {
            session = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('user_session', session);
        }

        return session;
    }

    showCollaborationStatus(message) {
        console.log(`👥 ${message}`);

        const statusEl = document.getElementById('collaborationStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';

            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    }

    showCollaborationNotification(message, type = 'info') {
        if (window.UnifiedBackupManager && window.UnifiedBackupManager.showNotification) {
            window.UnifiedBackupManager.showNotification(message, type);
        } else {
            console.log(`👥 ${message}`);
        }
    }

    getStatus() {
        return {
            isSubscribed: this.isSubscribed,
            activeUsers: this.activeUsers.size,
            userSession: this.userSession,
            lastSyncTime: this.lastSyncTime
        };
    }

    unsubscribe() {
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.isSubscribed = false;
            console.log('👥 Realtime 구독 해제');
        }
    }
}

window.RealtimeCollaborationManager = new RealtimeCollaborationManager();

window.getCollaborationStatus = () => window.RealtimeCollaborationManager.getStatus();

console.log('👥 RealtimeCollaborationManager 로드 완료');