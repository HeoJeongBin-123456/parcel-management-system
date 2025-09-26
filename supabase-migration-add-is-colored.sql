-- ============================================================================
-- Supabase 마이그레이션: is_colored 컬럼 추가
-- ============================================================================
--
-- 목적: 필지 검증 시스템과의 호환성을 위해 is_colored 컬럼 추가
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행
--
-- ============================================================================

-- 1. is_colored 컬럼 추가 (Boolean, 기본값 false)
ALTER TABLE parcels
ADD COLUMN IF NOT EXISTS is_colored BOOLEAN DEFAULT false;

-- 2. 기존 데이터 마이그레이션: color_info가 있으면 is_colored = true
UPDATE parcels
SET is_colored = true
WHERE color_info IS NOT NULL
  AND color_info::text != '{}'
  AND color_info::text != 'null';

-- 3. color가 있는 경우도 is_colored = true로 설정
UPDATE parcels
SET is_colored = true
WHERE color IS NOT NULL
  AND color != ''
  AND color != 'transparent';

-- 4. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parcels_is_colored ON parcels(is_colored);

-- 5. 잘못된 인덱스 제거 (color_type 컬럼이 존재하지 않음)
DROP INDEX IF EXISTS idx_parcels_color_type;

-- 6. 검증 쿼리 (선택사항 - 확인용)
-- SELECT
--   is_colored,
--   COUNT(*) as count,
--   COUNT(CASE WHEN color IS NOT NULL THEN 1 END) as with_color,
--   COUNT(CASE WHEN color_info IS NOT NULL THEN 1 END) as with_color_info
-- FROM parcels
-- GROUP BY is_colored;

-- ============================================================================
-- 완료!
-- ============================================================================
SELECT '✅ is_colored 컬럼 추가 완료!' as status;