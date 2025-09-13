-- ============================================================================
-- 네이버 지도 필지 관리 프로그램 - Supabase 올인원 스키마
-- ============================================================================

-- 1. user_settings 테이블 생성 (사용자 설정 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id TEXT PRIMARY KEY,
    user_session TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 유니크 제약조건: 한 세션당 하나의 설정 키
    CONSTRAINT unique_user_setting UNIQUE(user_session, setting_key)
);

-- user_settings 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_session ON user_settings(user_session);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_user_settings_category ON user_settings(category);

-- user_settings 실시간 구독 활성화 (조건부)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'user_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;
        RAISE NOTICE 'user_settings 테이블을 실시간 구독에 추가했습니다.';
    ELSE
        RAISE NOTICE 'user_settings 테이블이 이미 실시간 구독에 포함되어 있습니다.';
    END IF;
END $$;

-- ============================================================================
-- 2. user_states 테이블 생성 (지도 상태 및 UI 상태 관리)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_states (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_session TEXT NOT NULL UNIQUE,

    -- 지도 상태
    map_center JSONB, -- {lat: number, lng: number, zoom: number}
    map_bounds JSONB, -- {ne: {lat, lng}, sw: {lat, lng}}

    -- 선택된 필지 정보
    selected_parcel_id TEXT,
    selected_parcel_pnu TEXT,

    -- 활성 레이어
    active_layers JSONB DEFAULT '["normal"]'::jsonb, -- ['cadastral', 'satellite', 'street']

    -- UI 상태
    ui_state JSONB DEFAULT '{}'::jsonb, -- 사이드바, 모달, 패널 상태

    -- 검색/클릭 모드
    current_mode TEXT DEFAULT 'click', -- 'search' 또는 'click'

    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- user_states 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_states_session ON user_states(user_session);
CREATE INDEX IF NOT EXISTS idx_user_states_parcel ON user_states(selected_parcel_id);

-- user_states 실시간 구독 활성화 (조건부)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'user_states'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE user_states;
        RAISE NOTICE 'user_states 테이블을 실시간 구독에 추가했습니다.';
    ELSE
        RAISE NOTICE 'user_states 테이블이 이미 실시간 구독에 포함되어 있습니다.';
    END IF;
END $$;

-- ============================================================================
-- 3. parcels 테이블 확장 (기존 테이블에 컬럼 추가)
-- ============================================================================

-- 폴리곤 데이터 컬럼 추가
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS polygon_data JSONB;
-- 구조: {
--   "coordinates": [[[lng, lat], [lng, lat], ...]],
--   "style": {"fillColor": "#FF0000", "strokeColor": "#000000", "opacity": 0.7},
--   "bounds": {"ne": {"lat": 37.567, "lng": 126.979}, "sw": {"lat": 37.566, "lng": 126.978}}
-- }

-- 마커 데이터 컬럼 추가
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS marker_data JSONB;
-- 구조: {
--   "type": "memo|normal|special",
--   "position": {"lat": 37.5666, "lng": 126.9784},
--   "icon": "M|default|custom",
--   "label": "123-4",
--   "memo_preview": "메모 내용...",
--   "style": {"color": "#FF0000", "size": "medium"}
-- }

-- 마커 타입 컬럼 추가
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS marker_type TEXT DEFAULT 'normal';
-- 값: 'normal', 'memo', 'special', 'search'

-- 색상 정보 컬럼 추가 (기존 is_colored 확장)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS color_info JSONB;
-- 구조: {
--   "color": "#FF0000",
--   "opacity": 0.7,
--   "applied_at": "2025-01-15T10:30:00Z"
-- }

-- 지번 정보 확장
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS pnu_code TEXT; -- 지번 고유 코드
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS address_full TEXT; -- 전체 주소
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS address_short TEXT; -- 간략 주소

-- 소유자 정보 확장 (기존 memo에서 분리)
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS owner_info JSONB;
-- 구조: {
--   "name": "홍길동",
--   "address": "서울시 강남구...",
--   "contact": "010-1234-5678",
--   "updated_at": "2025-01-15T10:30:00Z"
-- }

-- 메타데이터
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
-- 구조: {
--   "source": "vworld|manual|import",
--   "accuracy": "high|medium|low",
--   "verification_status": "verified|pending|failed",
--   "last_sync": "2025-01-15T10:30:00Z"
-- }

-- parcels 테이블 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_parcels_pnu ON parcels(pnu_code);
CREATE INDEX IF NOT EXISTS idx_parcels_marker_type ON parcels(marker_type);
CREATE INDEX IF NOT EXISTS idx_parcels_color_type ON parcels(color_type);
CREATE INDEX IF NOT EXISTS idx_parcels_has_memo ON parcels(has_memo);
CREATE INDEX IF NOT EXISTS idx_parcels_user_session ON parcels(user_session);

-- parcels 실시간 구독 (이미 활성화되어 있을 수 있으므로 조건부 추가)
DO $$
BEGIN
    -- parcels 테이블이 이미 구독에 포함되어 있지 않은 경우에만 추가
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND tablename = 'parcels'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE parcels;
        RAISE NOTICE 'parcels 테이블을 실시간 구독에 추가했습니다.';
    ELSE
        RAISE NOTICE 'parcels 테이블이 이미 실시간 구독에 포함되어 있습니다.';
    END IF;
END $$;

-- ============================================================================
-- 4. 공통 함수 및 트리거 생성
-- ============================================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- user_settings 트리거
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- user_states 트리거
DROP TRIGGER IF EXISTS update_user_states_updated_at ON user_states;
CREATE TRIGGER update_user_states_updated_at
    BEFORE UPDATE ON user_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- parcels 트리거 (기존에 있을 수 있음)
DROP TRIGGER IF EXISTS update_parcels_updated_at ON parcels;
CREATE TRIGGER update_parcels_updated_at
    BEFORE UPDATE ON parcels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. RLS (Row Level Security) 정책 설정
-- ============================================================================

-- user_settings RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- user_settings 정책: 자신의 세션 데이터만 접근 가능
CREATE POLICY "Users can only access their own settings" ON user_settings
    FOR ALL USING (TRUE); -- 개발 환경에서는 모든 접근 허용

-- user_states RLS 활성화
ALTER TABLE user_states ENABLE ROW LEVEL SECURITY;

-- user_states 정책: 자신의 세션 데이터만 접근 가능
CREATE POLICY "Users can only access their own states" ON user_states
    FOR ALL USING (TRUE); -- 개발 환경에서는 모든 접근 허용

-- parcels RLS는 기존 설정 유지 (이미 설정되어 있을 수 있음)

-- ============================================================================
-- 6. 초기 데이터 및 기본값 설정
-- ============================================================================

-- 기본 사용자 설정 템플릿 (선택사항)
-- INSERT INTO user_settings (id, user_session, setting_key, setting_value, category) VALUES
-- ('default_current_color', 'default', 'current_color', '"#FF0000"'::jsonb, 'appearance'),
-- ('default_map_type', 'default', 'map_type', '"normal"'::jsonb, 'map'),
-- ('default_auto_save', 'default', 'auto_save', 'true'::jsonb, 'general');

-- ============================================================================
-- 완료!
-- ============================================================================

-- 확인 쿼리
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_settings', 'user_states', 'parcels')
ORDER BY tablename;

-- 컬럼 확인 쿼리
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('user_settings', 'user_states', 'parcels')
ORDER BY table_name, ordinal_position;