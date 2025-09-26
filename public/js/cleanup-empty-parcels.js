/**
 * 빈 필지 정리 유틸리티
 *
 * 기존에 저장된 색칠도 없고 필지 정보도 없는 빈 필지들을 DB에서 삭제합니다.
 */

async function cleanupEmptyParcels(options = {}) {
    const {
        dryRun = false, // true면 실제 삭제 안 하고 시뮬레이션만
        autoConfirm = false // true면 확인 없이 바로 삭제
    } = options;

    console.log('🧹 빈 필지 정리 시작...');

    if (!window.ParcelValidationUtils) {
        console.error('❌ ParcelValidationUtils가 로드되지 않았습니다');
        return { success: false, error: 'ParcelValidationUtils 없음' };
    }

    if (!window.SupabaseManager || !window.SupabaseManager.isConnected) {
        console.error('❌ Supabase 연결이 필요합니다');
        return { success: false, error: 'Supabase 연결 없음' };
    }

    try {
        console.log('📥 모든 필지 로드 중...');
        const allParcels = await window.SupabaseManager.loadParcels();
        console.log(`📊 총 ${allParcels.length}개의 필지 발견`);

        const emptyParcels = [];
        const validParcels = [];

        allParcels.forEach(parcel => {
            if (window.ParcelValidationUtils.isParcelWorthSaving(parcel)) {
                validParcels.push(parcel);
            } else {
                emptyParcels.push(parcel);
            }
        });

        console.log(`✅ 유효한 필지: ${validParcels.length}개`);
        console.log(`🗑️  삭제 대상 빈 필지: ${emptyParcels.length}개`);

        if (emptyParcels.length === 0) {
            console.log('✨ 정리할 빈 필지가 없습니다!');
            return {
                success: true,
                totalParcels: allParcels.length,
                validParcels: validParcels.length,
                emptyParcels: 0,
                deleted: 0
            };
        }

        console.table(emptyParcels.slice(0, 10).map(p => ({
            PNU: p.pnu,
            지번: p.parcelNumber || p.parcel_name || '',
            소유자: p.ownerName || '',
            메모: p.memo || '',
            색상: p.color || p.is_colored ? 'O' : 'X'
        })));

        if (dryRun) {
            console.log('🔍 [시뮬레이션 모드] 실제 삭제는 하지 않습니다');
            return {
                success: true,
                dryRun: true,
                totalParcels: allParcels.length,
                validParcels: validParcels.length,
                emptyParcels: emptyParcels.length,
                deleted: 0
            };
        }

        if (!autoConfirm) {
            const userConfirm = confirm(
                `⚠️ ${emptyParcels.length}개의 빈 필지를 삭제하시겠습니까?\n\n` +
                `유효한 필지: ${validParcels.length}개\n` +
                `삭제 대상: ${emptyParcels.length}개\n\n` +
                `이 작업은 되돌릴 수 없습니다.`
            );

            if (!userConfirm) {
                console.log('❌ 사용자가 취소했습니다');
                return { success: false, cancelled: true };
            }
        }

        console.log('🗑️  빈 필지 삭제 중...');
        let deletedCount = 0;
        const errors = [];

        for (const parcel of emptyParcels) {
            try {
                if (parcel.pnu) {
                    await window.SupabaseManager.deleteParcel(parcel.pnu);
                    deletedCount++;

                    if (deletedCount % 10 === 0) {
                        console.log(`진행률: ${deletedCount}/${emptyParcels.length}`);
                    }
                }
            } catch (error) {
                console.error(`삭제 실패: ${parcel.pnu}`, error);
                errors.push({ pnu: parcel.pnu, error: error.message });
            }
        }

        console.log('✅ 빈 필지 정리 완료!');
        console.log(`📊 결과:
- 총 필지: ${allParcels.length}개
- 유효한 필지: ${validParcels.length}개
- 삭제된 빈 필지: ${deletedCount}개
- 삭제 실패: ${errors.length}개`);

        if (errors.length > 0) {
            console.warn('⚠️ 삭제 실패 목록:', errors);
        }

        alert(`✅ 정리 완료!\n\n삭제: ${deletedCount}개\n유지: ${validParcels.length}개`);

        return {
            success: true,
            totalParcels: allParcels.length,
            validParcels: validParcels.length,
            emptyParcels: emptyParcels.length,
            deleted: deletedCount,
            errors: errors.length
        };

    } catch (error) {
        console.error('❌ 빈 필지 정리 실패:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function cleanupEmptyParcelsReport() {
    return await cleanupEmptyParcels({ dryRun: true });
}

window.cleanupEmptyParcels = cleanupEmptyParcels;
window.cleanupEmptyParcelsReport = cleanupEmptyParcelsReport;

console.log('🧹 빈 필지 정리 도구 로드 완료');
console.log('사용법:');
console.log('  - cleanupEmptyParcelsReport()  // 시뮬레이션 (삭제 안 함)');
console.log('  - cleanupEmptyParcels()        // 실제 정리 (확인 후 삭제)');