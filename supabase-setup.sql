-- 네이버 지도 필지 관리 프로그램 Supabase 데이터베이스 설정
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행

-- 1. 필지 메인 테이블
CREATE TABLE IF NOT EXISTS parcels (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_random_uuid()::text,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    parcel_name VARCHAR(100) NOT NULL,
    memo TEXT DEFAULT '',
    is_colored BOOLEAN DEFAULT true,
    color_type VARCHAR(10) DEFAULT 'click', -- 'click' (빨강) 또는 'search' (보라)
    has_memo BOOLEAN GENERATED ALWAYS AS (LENGTH(TRIM(memo)) > 0) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_session VARCHAR(50) NOT NULL
);

-- 2. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parcels_location ON parcels(lat, lng);
CREATE INDEX IF NOT EXISTS idx_parcels_user_session ON parcels(user_session);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at);
CREATE INDEX IF NOT EXISTS idx_parcels_has_memo ON parcels(has_memo);
CREATE INDEX IF NOT EXISTS idx_parcels_color_type ON parcels(color_type);

-- 3. 일일 백업 테이블
CREATE TABLE IF NOT EXISTS daily_backups (
    id SERIAL PRIMARY KEY,
    backup_date DATE NOT NULL UNIQUE,
    data JSONB NOT NULL,
    count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 월간 백업 로그 테이블  
CREATE TABLE IF NOT EXISTS monthly_backup_logs (
    id SERIAL PRIMARY KEY,
    backup_month VARCHAR(7) NOT NULL, -- YYYY-MM 형식
    google_drive_url TEXT,
    google_sheets_url TEXT,
    export_count INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. updated_at 트리거 적용
CREATE TRIGGER update_parcels_updated_at 
    BEFORE UPDATE ON parcels 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Row Level Security (RLS) 활성화 (선택사항)
-- ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

-- 8. 공개 접근 정책 (개발용 - 실제 운영에서는 사용자별 제한 필요)
-- CREATE POLICY "Allow public access" ON parcels
--     FOR ALL USING (true);

-- 9. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE parcels;

-- 10. 샘플 데이터 (테스트용)
INSERT INTO parcels (lat, lng, parcel_name, memo, color_type, user_session) VALUES 
(37.5666103, 126.9783882, '중구 정동 1-8', '샘플 필지입니다.', 'click', 'sample_user'),
(37.5657, 126.9769, '중구 정동 2-1', '검색으로 찾은 샘플 필지', 'search', 'sample_user')
ON CONFLICT (id) DO NOTHING;

-- 완료 메시지
SELECT '✅ Supabase 데이터베이스 설정 완료!' as status;