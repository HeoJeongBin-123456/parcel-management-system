/**
 * 필지 검증 유틸리티
 *
 * 저장할 가치가 있는 필지인지 검증하는 중앙화된 로직
 * - 색칠 또는 필지 정보 중 하나라도 있으면 저장 가능
 * - memo-markers.js의 shouldShowMarker와 동일한 조건 사용
 */
class ParcelValidationUtils {

    /**
     * 필지가 저장할 가치가 있는지 검증
     * @param {Object} parcelData - 필지 데이터
     * @returns {boolean} - 저장 가능 여부
     */
    static isParcelWorthSaving(parcelData) {
        if (!parcelData) {
            console.warn('⚠️ [검증] 필지 데이터가 없습니다');
            return false;
        }

        const hasColor = this.hasValidColor(parcelData);
        const hasInfo = this.hasValidParcelInfo(parcelData);

        const isWorthSaving = hasColor || hasInfo;

        if (!isWorthSaving) {
            console.warn('⚠️ [검증 실패] 색칠도 없고 필지 정보도 없는 빈 필지입니다', {
                pnu: parcelData.pnu || parcelData.id,
                hasColor,
                hasInfo
            });
        }

        return isWorthSaving;
    }

    /**
     * 유효한 색칠이 있는지 확인
     * @param {Object} parcelData - 필지 데이터
     * @returns {boolean}
     */
    static hasValidColor(parcelData) {
        const is_colored = parcelData.is_colored === true || parcelData.is_colored === 'true';

        const hasColorHex = !!(
            parcelData.color &&
            typeof parcelData.color === 'string' &&
            parcelData.color.trim() !== ''
        );

        const hasColorIndex =
            parcelData.colorIndex !== null &&
            parcelData.colorIndex !== undefined &&
            parcelData.colorIndex !== '';

        return is_colored || hasColorHex || hasColorIndex;
    }

    /**
     * 유효한 필지 정보가 있는지 확인 (마커 표시 조건과 동일)
     * @param {Object} parcelData - 필지 데이터
     * @returns {boolean}
     */
    static hasValidParcelInfo(parcelData) {
        const memo = parcelData.memo || parcelData.parcelMemo || '';
        const parcelNumber = parcelData.parcelNumber || parcelData.parcel_number || parcelData.parcel_name || '';
        const ownerName = parcelData.ownerName || parcelData.owner_name || parcelData.owner || '';
        const ownerAddress = parcelData.ownerAddress || parcelData.owner_address || '';
        const ownerContact = parcelData.ownerContact || parcelData.owner_contact || parcelData.contact || '';

        const hasUserSuppliedInfo = !!(
            this._isValidField(memo, ['(메모 없음)', '추가 메모...']) ||
            this._isValidField(ownerName, ['홍길동']) ||
            this._isValidField(ownerAddress, ['서울시 강남구...']) ||
            this._isValidField(ownerContact, ['010-1234-5678']) ||
            this._isValidField(parcelNumber, ['자동입력'])
        );

        return hasUserSuppliedInfo;
    }

    /**
     * 필드가 유효한지 확인 (공백 아님 && 기본값 아님)
     * @param {string} value - 검증할 값
     * @param {Array<string>} defaultValues - 제외할 기본값 목록
     * @returns {boolean}
     * @private
     */
    static _isValidField(value, defaultValues = []) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        const trimmed = value.trim();

        if (trimmed === '') {
            return false;
        }

        for (const defaultValue of defaultValues) {
            if (trimmed === defaultValue) {
                return false;
            }
        }

        return true;
    }

    /**
     * 배치 필터링: 유효한 필지만 반환
     * @param {Array<Object>} parcels - 필지 배열
     * @returns {Array<Object>} - 유효한 필지 배열
     */
    static filterValidParcels(parcels) {
        if (!Array.isArray(parcels)) {
            console.warn('⚠️ [검증] 배치 필터링 실패: 배열이 아님');
            return [];
        }

        const validParcels = parcels.filter(parcel => this.isParcelWorthSaving(parcel));

        const filtered = parcels.length - validParcels.length;
        if (filtered > 0) {
            console.log(`🔍 [검증] ${filtered}개의 빈 필지 필터링됨 (${validParcels.length}/${parcels.length} 저장)`);
        }

        return validParcels;
    }

    /**
     * 검증 리포트 생성 (디버깅용)
     * @param {Object} parcelData - 필지 데이터
     * @returns {Object} - 상세 검증 결과
     */
    static getValidationReport(parcelData) {
        if (!parcelData) {
            return {
                isValid: false,
                reason: '필지 데이터 없음'
            };
        }

        const hasColor = this.hasValidColor(parcelData);
        const hasInfo = this.hasValidParcelInfo(parcelData);
        const isValid = hasColor || hasInfo;

        return {
            isValid,
            pnu: parcelData.pnu || parcelData.id || 'unknown',
            hasColor,
            hasInfo,
            colorDetails: {
                is_colored: parcelData.is_colored,
                color: parcelData.color,
                colorIndex: parcelData.colorIndex
            },
            infoDetails: {
                parcelNumber: parcelData.parcelNumber || '',
                ownerName: parcelData.ownerName || '',
                ownerAddress: parcelData.ownerAddress || '',
                ownerContact: parcelData.ownerContact || '',
                memo: parcelData.memo || ''
            },
            reason: !isValid ? '색칠도 없고 필지 정보도 없음' : '유효한 필지'
        };
    }

    /**
     * 검증 통계 (전역 카운터)
     */
    static getStats() {
        if (!window._parcelValidationStats) {
            window._parcelValidationStats = {
                totalChecks: 0,
                validParcels: 0,
                rejectedParcels: 0,
                rejectedReasons: {
                    noColorNoInfo: 0
                }
            };
        }
        return window._parcelValidationStats;
    }

    /**
     * 검증 통계 업데이트
     * @param {boolean} isValid - 검증 통과 여부
     */
    static updateStats(isValid) {
        const stats = this.getStats();
        stats.totalChecks++;

        if (isValid) {
            stats.validParcels++;
        } else {
            stats.rejectedParcels++;
            stats.rejectedReasons.noColorNoInfo++;
        }
    }

    /**
     * 검증 통계 출력
     */
    static resetStats() {
        this.stats = {
            totalChecks: 0,
            validParcels: 0,
            rejectedParcels: 0,
            rejectedReasons: {}
        };
        console.log('🔄 [검증 통계] 초기화 완료');
    }

    static printStats() {
        const stats = this.getStats();
        console.log('📊 [필지 검증 통계]', {
            총_검증_횟수: stats.totalChecks,
            통과: stats.validParcels,
            거부: stats.rejectedParcels,
            거부율: `${((stats.rejectedParcels / stats.totalChecks) * 100).toFixed(1)}%`
        });
    }
}

window.ParcelValidationUtils = ParcelValidationUtils;

console.log('✅ ParcelValidationUtils 로드 완료');