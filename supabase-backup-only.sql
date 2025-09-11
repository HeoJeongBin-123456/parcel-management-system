-- 백업 시스템 전용 테이블 생성 (기존 parcels 테이블은 그대로 유지)
-- 실행 방법: Supabase Dashboard > SQL Editor에서 실행

-- 1. 일일 백업 테이블 (BackupManager 전용)
CREATE TABLE IF NOT EXISTS daily_backups (
    id SERIAL PRIMARY KEY,
    backup_date TIMESTAMPTZ NOT NULL UNIQUE,
    data_count INTEGER NOT NULL,
    backup_data JSONB NOT NULL,
    backup_size INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 월간 백업 로그 테이블 (BackupManager 전용)
CREATE TABLE IF NOT EXISTS monthly_backup_logs (
    id SERIAL PRIMARY KEY,
    backup_date TIMESTAMPTZ NOT NULL,
    data_count INTEGER NOT NULL,
    backup_method VARCHAR(50) DEFAULT 'google_sheets',
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'failed'
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 백업 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_backups_date ON daily_backups(backup_date);
CREATE INDEX IF NOT EXISTS idx_monthly_logs_date ON monthly_backup_logs(backup_date);
CREATE INDEX IF NOT EXISTS idx_monthly_logs_status ON monthly_backup_logs(status);

-- 4. 기존 parcels 테이블 구조 확인 (정보만 표시)
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'parcels' 
ORDER BY ordinal_position;

-- 완료 메시지
SELECT '✅ 백업 시스템 테이블 생성 완료!' as status;