// 특정 필지 데이터 초기화 스크립트
async function clearSpecificParcels() {
    const parcelsToDelete = ['소하동 1348', '소하동 1349'];
    console.log('🗑️ 다음 필지들을 초기화합니다:', parcelsToDelete);

    // 1. LocalStorage 데이터 삭제
    const keys = ['parcelData', 'parcels', 'parcelColors', 'markerStates'];

    keys.forEach(key => {
        const data = JSON.parse(localStorage.getItem(key) || '[]');
        let updated = false;

        if (Array.isArray(data)) {
            const filtered = data.filter(item => {
                const shouldDelete = parcelsToDelete.some(parcel =>
                    item.parcelNumber?.includes(parcel) ||
                    item.parcel_name?.includes(parcel) ||
                    item.jibun?.includes(parcel)
                );
                if (shouldDelete) {
                    console.log(`🗑️ ${key}에서 삭제:`, item.parcelNumber || item.parcel_name || item.jibun);
                    updated = true;
                }
                return !shouldDelete;
            });

            if (updated) {
                localStorage.setItem(key, JSON.stringify(filtered));
            }
        } else if (typeof data === 'object') {
            // parcelColors 같은 객체 형태
            for (const [pnu, info] of Object.entries(data)) {
                if (parcelsToDelete.some(parcel => info.parcel_name?.includes(parcel) || pnu.includes(parcel))) {
                    delete data[pnu];
                    console.log(`🗑️ ${key}에서 삭제:`, pnu, info);
                    updated = true;
                }
            }

            if (updated) {
                localStorage.setItem(key, JSON.stringify(data));
            }
        }
    });

    // 2. 지도에서 폴리곤 제거
    if (window.clickParcels) {
        window.clickParcels.forEach((parcelData, pnu) => {
            if (parcelsToDelete.some(parcel =>
                parcelData.parcelNumber?.includes(parcel) ||
                parcelData.jibun?.includes(parcel)
            )) {
                console.log('🗑️ 지도에서 폴리곤 제거:', pnu);
                if (parcelData.polygon) {
                    parcelData.polygon.setMap(null);
                }
                window.clickParcels.delete(pnu);
            }
        });
    }

    // 3. 검색 필지에서도 제거
    if (window.searchParcels) {
        window.searchParcels.forEach((parcelData, pnu) => {
            if (parcelsToDelete.some(parcel =>
                parcelData.displayText?.includes(parcel) ||
                parcelData.data?.properties?.JIBUN?.includes(parcel)
            )) {
                console.log('🗑️ 검색 필지에서 제거:', pnu);
                if (parcelData.polygon) {
                    parcelData.polygon.setMap(null);
                }
                if (parcelData.label) {
                    parcelData.label.setMap(null);
                }
                window.searchParcels.delete(pnu);
            }
        });
    }

    // 4. 마커 제거
    if (window.MemoMarkerManager) {
        parcelsToDelete.forEach(parcel => {
            // MemoMarkerManager의 markers Map에서 제거
            if (window.MemoMarkerManager.markers) {
                window.MemoMarkerManager.markers.forEach((markerInfo, pnu) => {
                    if (markerInfo.data?.parcelNumber?.includes(parcel) ||
                        markerInfo.data?.jibun?.includes(parcel)) {
                        console.log('🗑️ 마커 제거:', pnu);
                        if (markerInfo.marker) {
                            markerInfo.marker.setMap(null);
                        }
                        window.MemoMarkerManager.markers.delete(pnu);
                    }
                });
            }
        });
    }

    console.log('✅ 필지 초기화 완료');
}

// 실행
clearSpecificParcels();