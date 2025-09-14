-- ================================================
-- Supabase 스키마 업데이트: parcel_type 필드 추가
-- Phase 1 완료를 위한 필수 스키마 업데이트
-- ================================================

-- 1. parcels 테이블에 parcel_type 필드 추가
ALTER TABLE parcels
ADD COLUMN IF NOT EXISTS parcel_type TEXT DEFAULT 'click';

-- 2. 기존 데이터 업데이트 (보라색은 검색, 나머지는 클릭)
UPDATE parcels
SET parcel_type = 'search'
WHERE color = '#9370DB';

UPDATE parcels
SET parcel_type = 'click'
WHERE color != '#9370DB' OR color IS NULL;

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parcels_type ON parcels(parcel_type);
CREATE INDEX IF NOT EXISTS idx_parcels_color ON parcels(color);

-- 4. 확인 쿼리
SELECT parcel_type, COUNT(*) as count
FROM parcels
GROUP BY parcel_type;

-- ================================================
-- 실행 방법:
-- 1. Supabase 대시보드 → SQL Editor 접속
-- 2. 위 SQL 코드 전체 복사 후 실행
-- 3. "Run" 버튼 클릭하여 실행
-- ================================================