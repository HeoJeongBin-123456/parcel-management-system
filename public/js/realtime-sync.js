// 실시간 동기화 관리자 (사용자 제한 없음)
class RealtimeSync {
    constructor() {
        this.isConnected = false;
        this.currentUsers = new Set();
        this.maxUsers = 999999; // 제한 없음으로 변경
        this.userId = this.generateUserId();
        this.lastUpdateTime = Date.now();
        this.subscription = null;

        console.log('🔄 RealtimeSync 초기화:', this.userId);
    }

    generateUserId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `user_${timestamp}_${random}`;
    }

    // 실시간 동기화 시작
    async startRealtimeSync() {
        try {
            const supabaseManager = window.SupabaseManager;
            if (!supabaseManager || !supabaseManager.isConnected) {
                console.log('⚠️ Supabase 미연결로 실시간 동기화 생략');
                return false;
            }

            // 사용자 수 체크 (제한 해제)
            const userCount = await this.checkActiveUsers();
            // 제한 없음 - 경고 메시지 제거

            // 현재 사용자 등록
            await this.registerUser();

            // Realtime 구독 설정
            this.setupRealtimeSubscription();
            
            // 탭 간 동기화 설정
            this.setupBroadcastChannel();
            
            // 주기적 동기화 설정
            this.setupPeriodicSync();
            
            // 연결 해제 이벤트 처리
            this.setupDisconnectHandlers();

            this.isConnected = true;
            console.log('✅ 실시간 동기화 활성화 - 사용자:', this.userId);
            
            // UI에 연결 상태 표시
            this.updateConnectionUI('connected', userCount + 1);
            
            return true;
        } catch (error) {
            console.error('❌ 실시간 동기화 시작 실패:', error);
            return false;
        }
    }

    // 활성 사용자 수 체크
    async checkActiveUsers() {
        // 실제 구현에서는 사용자 세션 테이블을 만들어야 함
        // 지금은 간단히 localStorage로 구현
        const activeUsers = JSON.parse(localStorage.getItem('active_users') || '[]');
        const now = Date.now();
        
        // 5분 이내 활성 사용자만 카운트
        const recentUsers = activeUsers.filter(user => now - user.lastSeen < 5 * 60 * 1000);
        
        // 정리된 목록 저장
        localStorage.setItem('active_users', JSON.stringify(recentUsers));
        
        return recentUsers.length;
    }

    // 현재 사용자 등록
    async registerUser() {
        const activeUsers = JSON.parse(localStorage.getItem('active_users') || '[]');
        const now = Date.now();
        
        // 기존 사용자 업데이트 또는 새 사용자 추가
        const userIndex = activeUsers.findIndex(user => user.id === this.userId);
        const userData = {
            id: this.userId,
            lastSeen: now,
            joinedAt: userIndex === -1 ? now : activeUsers[userIndex].joinedAt
        };

        if (userIndex === -1) {
            activeUsers.push(userData);
        } else {
            activeUsers[userIndex] = userData;
        }

        localStorage.setItem('active_users', JSON.stringify(activeUsers));
    }

    // Realtime 구독 설정
    setupRealtimeSubscription() {
        const supabase = window.SupabaseManager.supabase;

        this.subscription = supabase
            .channel('parcels_realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'parcels' },
                (payload) => this.handleRealtimeUpdate(payload)
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'parcel_polygons' },
                (payload) => this.handlePolygonRealtimeUpdate(payload)
            )
            .subscribe((status) => {
                console.log('📡 Realtime 구독 상태:', status);
            });
    }

    // Realtime 업데이트 처리
    handleRealtimeUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        // 자신이 보낸 업데이트는 무시 (중복 처리 방지)
        if (this.isOwnUpdate(payload)) {
            return;
        }

        console.log('📡 실시간 업데이트 수신:', eventType, newRecord || oldRecord);
        
        switch (eventType) {
            case 'INSERT':
                this.handleParcelAdded(newRecord);
                break;
            case 'UPDATE':
                this.handleParcelUpdated(newRecord);
                break;
            case 'DELETE':
                this.handleParcelDeleted(oldRecord);
                break;
        }
        
        // 마지막 업데이트 시간 갱신
        this.lastUpdateTime = Date.now();
    }

    // 자신이 보낸 업데이트인지 확인
    isOwnUpdate(payload) {
        // 시간 기반 체크를 500ms로 늘림 (무한루프 방지)
        return Date.now() - this.lastUpdateTime < 500;
    }

    // 🗺️ 폴리곤 실시간 업데이트 처리
    handlePolygonRealtimeUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        // 자신이 보낸 업데이트는 무시
        if (this.isOwnUpdate(payload)) {
            return;
        }

        console.log('🗺️ 폴리곤 실시간 업데이트 수신:', eventType, newRecord || oldRecord);

        switch (eventType) {
            case 'INSERT':
                this.handlePolygonAdded(newRecord);
                break;
            case 'UPDATE':
                this.handlePolygonUpdated(newRecord);
                break;
            case 'DELETE':
                this.handlePolygonDeleted(oldRecord);
                break;
        }

        // 마지막 업데이트 시간 갱신
        this.lastUpdateTime = Date.now();
    }

    // 🗺️ 새 폴리곤 추가 처리
    async handlePolygonAdded(polygon) {
        console.log('🗺️ 새 폴리곤 추가:', polygon.pnu);

        // 삭제된 필지 체크 - 삭제된 필지의 폴리곤은 복원하지 않음
        if (window.getDeletedParcels) {
            const deletedParcels = window.getDeletedParcels();
            if (deletedParcels.includes(polygon.pnu)) {
                console.log(`⏩ 실시간 동기화: 삭제된 필지의 폴리곤 복원 방지: ${polygon.pnu}`);
                return; // 삭제된 필지의 폴리곤은 처리하지 않음
            }
        }

        // 지도에 폴리곤 그리기
        if (window.drawParcelPolygon) {
            const feature = {
                geometry: polygon.geometry,
                properties: polygon.properties || {
                    PNU: polygon.pnu,
                    pnu: polygon.pnu
                }
            };

            await window.drawParcelPolygon(feature, false);

            // IndexedDB에 캐싱
            if (window.dataPersistenceManager && window.dataPersistenceManager.db) {
                const tx = window.dataPersistenceManager.db.transaction('polygons', 'readwrite');
                const store = tx.objectStore('polygons');
                await store.put(polygon);
            }

            // UI 알림
            this.showNotification(`🗺️ 새 필지가 추가되었습니다: ${polygon.pnu}`);
        }
    }

    // 🗺️ 폴리곤 업데이트 처리
    async handlePolygonUpdated(polygon) {
        console.log('🗺️ 폴리곤 업데이트:', polygon.pnu);

        // 기존 폴리곤 제거
        const existingParcel = window.clickParcels?.get(polygon.pnu);
        if (existingParcel && existingParcel.polygon) {
            existingParcel.polygon.setMap(null);
        }

        // 새 폴리곤 그리기
        if (window.drawParcelPolygon) {
            const feature = {
                geometry: polygon.geometry,
                properties: polygon.properties || {
                    PNU: polygon.pnu,
                    pnu: polygon.pnu
                }
            };

            await window.drawParcelPolygon(feature, false);

            // IndexedDB 업데이트
            if (window.dataPersistenceManager && window.dataPersistenceManager.db) {
                const tx = window.dataPersistenceManager.db.transaction('polygons', 'readwrite');
                const store = tx.objectStore('polygons');
                await store.put(polygon);
            }
        }
    }

    // 🗺️ 폴리곤 삭제 처리
    handlePolygonDeleted(polygon) {
        console.log('🗺️ 폴리곤 삭제:', polygon.pnu);

        // 지도에서 폴리곤 제거
        const existingParcel = window.clickParcels?.get(polygon.pnu);
        if (existingParcel && existingParcel.polygon) {
            existingParcel.polygon.setMap(null);
            window.clickParcels.delete(polygon.pnu);
        }

        // IndexedDB에서 제거
        if (window.dataPersistenceManager && window.dataPersistenceManager.db) {
            const tx = window.dataPersistenceManager.db.transaction('polygons', 'readwrite');
            const store = tx.objectStore('polygons');
            store.delete(polygon.pnu);
        }
    }

    // 필지 추가 처리
    handleParcelAdded(parcel) {
        // 삭제된 필지 체크 - 삭제된 필지는 복원하지 않음
        const pnu = parcel.pnu || parcel.id;
        if (window.getDeletedParcels) {
            const deletedParcels = window.getDeletedParcels();
            if (deletedParcels.includes(pnu)) {
                console.log(`⏩ 실시간 동기화: 삭제된 필지 복원 방지: ${pnu}`);
                return; // 삭제된 필지는 처리하지 않음
            }
        }

        // 지도에 새 필지 표시
        this.addParcelToMap(parcel);

        // 알림 표시
        this.showNotification(`새 필지 추가: ${parcel.parcel_name}`, 'success');
    }

    // 필지 업데이트 처리
    handleParcelUpdated(parcel) {
        // 지도의 필지 업데이트
        this.updateParcelOnMap(parcel);
        
        // 알림 표시
        this.showNotification(`필지 수정: ${parcel.parcel_name}`, 'info');
    }

    // 필지 삭제 처리
    handleParcelDeleted(parcel) {
        // 지도에서 필지 제거
        this.removeParcelFromMap(parcel);
        
        // 알림 표시
        this.showNotification(`필지 삭제: ${parcel.parcel_name}`, 'warning');
    }

    // 지도에 필지 추가
    addParcelToMap(parcel) {
        // 무한루프 방지: loadSavedParcels 호출 제거
        console.log('📡 실시간 동기화: 새 필지 추가', parcel.parcel_name);
        // 개별 필지만 업데이트하는 로직 필요 (향후 개선)
    }

    // 지도의 필지 업데이트
    updateParcelOnMap(parcel) {
        // 무한루프 방지: loadSavedParcels 호출 제거
        console.log('📡 실시간 동기화: 필지 업데이트', parcel.parcel_name);
        // 개별 필지만 업데이트하는 로직 필요 (향후 개선)
    }

    // 지도에서 필지 제거
    removeParcelFromMap(parcel) {
        // 기존 polygon 제거 로직 활용
        if (window.clickParcels && window.searchParcels) {
            window.clickParcels.delete(parcel.id);
            window.searchParcels.delete(parcel.id);
            
            // 지도 새로고침
            if (window.loadSavedParcels) {
                window.loadSavedParcels();
            }
        }
    }

    // BroadcastChannel 설정 (탭 간 동기화)
    setupBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') return;

        this.broadcastChannel = new BroadcastChannel('parcels_sync');
        this.broadcastChannel.addEventListener('message', (event) => {
            this.handleBroadcastMessage(event.data);
        });
    }

    // BroadcastChannel 메시지 처리
    handleBroadcastMessage(data) {
        const { type, payload, senderId, timestamp } = data;
        
        // 자신이 보낸 메시지는 무시
        if (senderId === this.userId) return;
        
        // 너무 오래된 메시지는 무시 (5초 이내만)
        if (Date.now() - timestamp > 5000) return;

        switch (type) {
            case 'parcel_update':
                this.handleParcelUpdated(payload);
                break;
            case 'parcel_delete':
                this.handleParcelDeleted(payload);
                break;
            case 'user_joined':
                this.handleUserJoined(payload);
                break;
            case 'user_left':
                this.handleUserLeft(payload);
                break;
        }
    }

    // 메시지 브로드캐스트
    broadcastMessage(type, payload) {
        if (this.broadcastChannel) {
            try {
                this.broadcastChannel.postMessage({
                    type,
                    payload,
                    senderId: this.userId,
                    timestamp: Date.now()
                });
            } catch (error) {
                // 채널이 닫혀있을 수 있음 - 조용히 처리
                if (error.name === 'InvalidStateError') {
                    // 채널이 닫혀있음 - 무시
                    this.broadcastChannel = null;
                } else {
                    console.warn('브로드캐스트 메시지 전송 실패:', error);
                }
            }
        }
    }

    // 주기적 동기화 설정 (30초마다)
    setupPeriodicSync() {
        setInterval(async () => {
            if (this.isConnected) {
                // 사용자 상태 업데이트
                await this.registerUser();
                
                // 연결 상태 확인
                const userCount = await this.checkActiveUsers();
                this.updateConnectionUI('connected', userCount);
                
                console.log('🔄 주기적 동기화 - 활성 사용자:', userCount);
            }
        }, 30000);
    }

    // 연결 해제 핸들러 설정
    setupDisconnectHandlers() {
        // 페이지 언로드 시
        window.addEventListener('beforeunload', () => {
            this.disconnect();
        });

        // 탭 숨김 시
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.registerUser(); // 마지막 활성 시간 업데이트
            }
        });
    }

    // 연결 해제
    async disconnect() {
        try {
            // Realtime 구독 해제
            if (this.subscription) {
                this.subscription.unsubscribe();
            }

            // 사용자 목록에서 제거
            const activeUsers = JSON.parse(localStorage.getItem('active_users') || '[]');
            const filteredUsers = activeUsers.filter(user => user.id !== this.userId);
            localStorage.setItem('active_users', JSON.stringify(filteredUsers));

            // 다른 사용자들에게 알림 (채널 닫기 전에)
            this.broadcastMessage('user_left', { userId: this.userId });

            // BroadcastChannel 닫기 (메시지 전송 후)
            if (this.broadcastChannel) {
                this.broadcastChannel.close();
                this.broadcastChannel = null;
            }

            this.isConnected = false;
            this.updateConnectionUI('disconnected', 0);
            
            console.log('🔴 실시간 동기화 해제');
        } catch (error) {
            console.error('❌ 연결 해제 오류:', error);
        }
    }

    // 연결 상태 UI 업데이트
    updateConnectionUI(status, userCount) {
        // 상태 표시 영역이 있다면 업데이트
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const statusText = status === 'connected'
                ? `🟢 실시간 동기화`
                : '🔴 오프라인';
            statusElement.textContent = statusText;
            statusElement.className = `connection-status ${status}`;
        }
    }

    // 알림 표시
    showNotification(message, type = 'info') {
        // 기존 toast 시스템 활용하거나 간단한 알림
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // 간단한 콘솔 알림
            console.log(`🔔 [${type.toUpperCase()}] ${message}`);
            
            // 선택적: 브라우저 알림
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('필지 관리 프로그램', {
                    body: message,
                    icon: '/favicon.ico'
                });
            }
        }
    }

    // 사용자 참여 처리
    handleUserJoined(payload) {
        console.log('👋 새 사용자 참여:', payload.userId);
        this.showNotification('새로운 사용자가 참여했습니다', 'info');
    }

    // 사용자 나가기 처리
    handleUserLeft(payload) {
        console.log('👋 사용자 나감:', payload.userId);
        this.showNotification('사용자가 나갔습니다', 'info');
    }

    // 강제 동기화
    async forceSyncAll() {
        if (window.loadSavedParcels) {
            await window.loadSavedParcels();
            this.showNotification('데이터 동기화 완료', 'success');
        }
    }

    // 연결 상태 반환
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            userCount: this.currentUsers.size,
            maxUsers: this.maxUsers
        };
    }
}

// 전역 인스턴스 생성
window.RealtimeSync = new RealtimeSync();

// 자동 시작 (페이지 로드 후 3초 뒤)
setTimeout(() => {
    window.RealtimeSync.startRealtimeSync();
}, 3000);

console.log('🔄 RealtimeSync 로드 완료');
