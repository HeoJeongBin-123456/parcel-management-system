-- ============================================================================
-- 네이버 지도 필지 관리 프로그램 - 모드 추적 스키마 업데이트
-- 3개 독립 지도 인스턴스 지원: source 필드 추가
-- ============================================================================

-- parcels 테이블에 모드 추적 컬럼 추가
-- ============================================================================

-- 1. 모드 소스 컬럼 추가 (어떤 모드에서 생성되었는지)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS mode_source TEXT DEFAULT 'click';
-- 값: 'click' (클릭 모드), 'search' (검색 모드)

-- 2. 모드 소스 히스토리 컬럼 추가 (JSONB 배열)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS mode_history JSONB DEFAULT '[]'::jsonb;
-- 구조: [
--   {"mode": "click", "timestamp": "2025-01-15T10:30:00Z", "action": "created"},
--   {"mode": "search", "timestamp": "2025-01-15T10:35:00Z", "action": "updated"}
-- ]

-- 3. 현재 활성 모드 컬럼 추가 (마지막으로 수정한 모드)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS current_mode TEXT DEFAULT 'click';
-- 값: 'click', 'search', 'hand' (hand는 수정만 가능)

-- 인덱스 추가
-- ============================================================================

-- 모드 소스별 인덱스 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_parcels_mode_source ON parcels(mode_source);

-- 현재 모드별 인덱스 (통계 및 필터링용)
CREATE INDEX IF NOT EXISTS idx_parcels_current_mode ON parcels(current_mode);

-- 복합 인덱스: 사용자 세션 + 모드 소스
CREATE INDEX IF NOT EXISTS idx_parcels_user_mode ON parcels(user_session, mode_source);

-- 기존 데이터 마이그레이션
-- ============================================================================

-- 기존 필지 데이터에 기본값 설정
UPDATE parcels
SET
    mode_source = CASE
        WHEN metadata->>'source' = 'search' THEN 'search'
        ELSE 'click'
    END,
    current_mode = CASE
        WHEN metadata->>'source' = 'search' THEN 'search'
        ELSE 'click'
    END,
    mode_history = jsonb_build_array(
        jsonb_build_object(
            'mode', CASE WHEN metadata->>'source' = 'search' THEN 'search' ELSE 'click' END,
            'timestamp', COALESCE(created_at::text, NOW()::text),
            'action', 'migrated'
        )
    )
WHERE mode_source IS NULL OR mode_history = '[]'::jsonb;

-- 제약조건 추가
-- ============================================================================

-- mode_source 제약조건 (허용된 값만)
ALTER TABLE parcels ADD CONSTRAINT check_mode_source
CHECK (mode_source IN ('click', 'search'));

-- current_mode 제약조건 (허용된 값만)
ALTER TABLE parcels ADD CONSTRAINT check_current_mode
CHECK (current_mode IN ('click', 'search', 'hand'));

-- 모드 히스토리 업데이트 함수
-- ============================================================================

CREATE OR REPLACE FUNCTION update_mode_history()
RETURNS TRIGGER AS $$
BEGIN
    -- mode_source나 current_mode가 변경된 경우에만 히스토리 추가
    IF (OLD.mode_source IS DISTINCT FROM NEW.mode_source) OR
       (OLD.current_mode IS DISTINCT FROM NEW.current_mode) THEN

        -- 새로운 히스토리 엔트리 추가
        NEW.mode_history = COALESCE(OLD.mode_history, '[]'::jsonb) ||
            jsonb_build_array(
                jsonb_build_object(
                    'mode', NEW.current_mode,
                    'source_mode', NEW.mode_source,
                    'timestamp', NOW()::text,
                    'action', 'updated',
                    'previous_mode', OLD.current_mode
                )
            );

        -- 히스토리가 너무 길어지는 것을 방지 (최근 10개 항목만 유지)
        IF jsonb_array_length(NEW.mode_history) > 10 THEN
            NEW.mode_history = (
                SELECT jsonb_agg(elem)
                FROM (
                    SELECT elem
                    FROM jsonb_array_elements(NEW.mode_history) AS elem
                    ORDER BY (elem->>'timestamp') DESC
                    LIMIT 10
                ) subquery
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- 모드 히스토리 트리거 생성
DROP TRIGGER IF EXISTS update_parcel_mode_history ON parcels;
CREATE TRIGGER update_parcel_mode_history
    BEFORE UPDATE ON parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_mode_history();

-- 검증 쿼리
-- ============================================================================

-- 1. 새로운 컬럼들이 정상적으로 추가되었는지 확인
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'parcels'
AND column_name IN ('mode_source', 'mode_history', 'current_mode')
ORDER BY column_name;

-- 2. 인덱스가 정상적으로 생성되었는지 확인
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'parcels'
AND indexname LIKE '%mode%'
ORDER BY indexname;

-- 3. 제약조건이 정상적으로 추가되었는지 확인
SELECT
    constraint_name,
    constraint_type,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
AND constraint_name LIKE '%mode%'
ORDER BY constraint_name;

-- 4. 샘플 데이터 확인 (기존 데이터가 있는 경우)
SELECT
    id,
    parcel_name,
    mode_source,
    current_mode,
    mode_history,
    created_at
FROM parcels
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================================
-- 완료! 이제 모든 필지 데이터는 어떤 모드에서 왔는지 추적 가능
-- ============================================================================

RAISE NOTICE '모드 추적 스키마 업데이트가 완료되었습니다!';
RAISE NOTICE '- mode_source: 필지가 생성된 모드 (click/search)';
RAISE NOTICE '- current_mode: 마지막으로 수정된 모드 (click/search/hand)';
RAISE NOTICE '- mode_history: 모드 변경 히스토리 추적';