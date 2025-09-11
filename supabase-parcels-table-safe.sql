-- 안전한 parcels 테이블 생성 (기존 데이터 보존)
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행

-- 1. parcels 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS parcels (
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

-- 2. 누락된 컬럼이 있다면 추가 (기존 테이블 보완)
DO $$ 
BEGIN
    -- lat 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='lat') THEN
        ALTER TABLE parcels ADD COLUMN lat DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
    
    -- lng 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='lng') THEN
        ALTER TABLE parcels ADD COLUMN lng DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
    
    -- parcel_name 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='parcel_name') THEN
        ALTER TABLE parcels ADD COLUMN parcel_name TEXT NOT NULL DEFAULT '';
    END IF;
    
    -- memo 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='memo') THEN
        ALTER TABLE parcels ADD COLUMN memo TEXT DEFAULT '';
    END IF;
    
    -- is_colored 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='is_colored') THEN
        ALTER TABLE parcels ADD COLUMN is_colored BOOLEAN DEFAULT true;
    END IF;
    
    -- color_type 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='color_type') THEN
        ALTER TABLE parcels ADD COLUMN color_type TEXT DEFAULT 'click';
    END IF;
    
    -- has_memo 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='has_memo') THEN
        ALTER TABLE parcels ADD COLUMN has_memo BOOLEAN DEFAULT false;
    END IF;
    
    -- user_session 컬럼 추가 (없으면)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='user_session') THEN
        ALTER TABLE parcels ADD COLUMN user_session TEXT DEFAULT '';
    END IF;
END $$;

-- 3. 인덱스 생성 (없으면)
CREATE INDEX IF NOT EXISTS idx_parcels_user_session ON parcels(user_session);
CREATE INDEX IF NOT EXISTS idx_parcels_created_at ON parcels(created_at);
CREATE INDEX IF NOT EXISTS idx_parcels_has_memo ON parcels(has_memo);
CREATE INDEX IF NOT EXISTS idx_parcels_color_type ON parcels(color_type);

-- 4. RLS (Row Level Security) 정책 설정
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제하고 새로 생성
DROP POLICY IF EXISTS "Allow all operations on parcels" ON parcels;
CREATE POLICY "Allow all operations on parcels" ON parcels
    FOR ALL USING (true) WITH CHECK (true);

-- 5. 실시간 구독 활성화 (에러 무시)
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE parcels;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- 이미 추가된 경우 무시
END $$;

-- 6. 테이블 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'parcels' 
ORDER BY ordinal_position;

-- 7. 기존 데이터 확인
SELECT COUNT(*) as existing_records FROM parcels;

-- 완료 메시지
SELECT '✅ parcels 테이블 안전하게 생성/업데이트 완료! 기존 데이터는 보존됩니다.' as status;