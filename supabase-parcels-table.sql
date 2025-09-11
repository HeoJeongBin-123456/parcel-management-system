-- 핵심 parcels 테이블 생성
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행

-- 1. 기존 테이블들의 의존성을 고려해서 안전하게 삭제
DROP TABLE IF EXISTS memos CASCADE;
DROP TABLE IF EXISTS parcels CASCADE;

-- 2. parcels 테이블 생성 (애플리케이션에서 사용하는 구조)
CREATE TABLE parcels (
    id TEXT PRIMARY KEY,                    -- 고유 ID (generateId()로 생성)
    lat DOUBLE PRECISION NOT NULL,          -- 위도
    lng DOUBLE PRECISION NOT NULL,          -- 경도
    parcel_name TEXT NOT NULL,              -- 필지명 (예: "정동 1-8")
    memo TEXT DEFAULT '',                   -- 메모 내용
    is_colored BOOLEAN DEFAULT true,        -- 색칠 여부
    color_type TEXT DEFAULT 'click',        -- 색상 타입: 'click' (빨강) 또는 'search' (보라)
    has_memo BOOLEAN DEFAULT false,         -- 메모 존재 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),   -- 생성 시간
    updated_at TIMESTAMPTZ DEFAULT NOW(),   -- 수정 시간
    user_session TEXT DEFAULT ''            -- 사용자 세션 ID
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_parcels_user_session ON parcels(user_session);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at);
CREATE INDEX IF NOT EXISTS idx_parcels_has_memo ON parcels(has_memo);
CREATE INDEX IF NOT EXISTS idx_parcels_color_type ON parcels(color_type);

-- 4. RLS (Row Level Security) 정책 설정
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기/쓰기 가능 (간단한 데모용)
CREATE POLICY "Allow all operations on parcels" ON parcels
    FOR ALL USING (true) WITH CHECK (true);

-- 5. 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE parcels;

-- 6. 테이블 생성 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'parcels' 
ORDER BY ordinal_position;

-- 완료 메시지
SELECT '✅ parcels 테이블 생성 완료! 이제 필지 데이터가 새로고침 후에도 유지됩니다.' as status;