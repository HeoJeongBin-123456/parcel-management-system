-- ============================================================================
-- 누락된 컬럼 추가 스크립트 (에러 수정)
-- ============================================================================

-- parcels 테이블에 누락된 컬럼 추가
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS color_type TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS geometry JSONB;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS is_colored BOOLEAN DEFAULT false;

-- daily_backups 테이블에 누락된 컬럼 추가
ALTER TABLE daily_backups ADD COLUMN IF NOT EXISTS backup_version TEXT DEFAULT 'v1';

-- parcel_polygons 테이블에 parcel_id 컬럼 추가 (존재하지 않는 경우)
ALTER TABLE parcel_polygons ADD COLUMN IF NOT EXISTS parcel_id TEXT;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parcels_color_type ON parcels(color_type);
CREATE INDEX IF NOT EXISTS idx_parcels_is_colored ON parcels(is_colored);
CREATE INDEX IF NOT EXISTS idx_parcel_polygons_parcel_id ON parcel_polygons(parcel_id);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 누락된 컬럼 추가 완료';
END $$;