-- Jiji Diving Bot V2.8 データベーススキーマ拡張
-- 実行日: 2025年7月15日
-- 説明: 口コミ重視マッチング・B2B収益化対応

-- ========================================
-- 1. ショップサブスクリプションテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS shop_subscriptions (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(50) NOT NULL,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('premium', 'standard', 'basic')),
    monthly_fee INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status ON shop_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_plan_type ON shop_subscriptions(plan_type);

-- ========================================
-- 2. ユーザーレビューテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS user_reviews (
    id SERIAL PRIMARY KEY,
    review_id VARCHAR(100) UNIQUE NOT NULL,
    shop_id VARCHAR(50) NOT NULL,
    line_user_id VARCHAR(100) NOT NULL,
    overall_rating DECIMAL(2,1) CHECK (overall_rating >= 1 AND overall_rating <= 5),
    beginner_friendliness DECIMAL(2,1) CHECK (beginner_friendliness >= 1 AND beginner_friendliness <= 5),
    safety_rating DECIMAL(2,1) CHECK (safety_rating >= 1 AND safety_rating <= 5),
    staff_rating DECIMAL(2,1) CHECK (staff_rating >= 1 AND staff_rating <= 5),
    satisfaction_rating DECIMAL(2,1) CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    cost_performance DECIMAL(2,1) CHECK (cost_performance >= 1 AND cost_performance <= 5),
    detailed_review TEXT,
    photos JSONB DEFAULT '[]',
    experience_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_reviews_shop_id ON user_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_line_user_id ON user_reviews(line_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_created_at ON user_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_user_reviews_overall_rating ON user_reviews(overall_rating);

-- ========================================
-- 3. ユーザーポイントテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    points_earned INTEGER DEFAULT 0,
    points_spent INTEGER DEFAULT 0,
    balance INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_user_points_line_user_id ON user_points(line_user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_created_at ON user_points(created_at);
CREATE INDEX IF NOT EXISTS idx_user_points_action_type ON user_points(action_type);

-- ========================================
-- 4. 会員プロフィールテーブル
-- ========================================
CREATE TABLE IF NOT EXISTS member_profiles (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(100) UNIQUE NOT NULL,
    registration_date DATE NOT NULL,
    total_points INTEGER DEFAULT 0,
    membership_level VARCHAR(20) DEFAULT 'basic',
    profile_completion_rate INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_member_profiles_line_user_id ON member_profiles(line_user_id);
CREATE INDEX IF NOT EXISTS idx_member_profiles_membership_level ON member_profiles(membership_level);

-- ========================================
-- 5. 既存テーブルの拡張（必要に応じて）
-- ========================================

-- user_profilesテーブルにLINE連携情報を追加（既存カラムを確認してから実行）
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS line_connected BOOLEAN DEFAULT FALSE;
-- ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS member_since DATE;

-- conversationsテーブルに追加メタデータ（既存カラムを確認してから実行）
-- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id VARCHAR(100);
-- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ========================================
-- 6. 初期データ投入（オプション）
-- ========================================

-- サンプル課金プラン（テスト用）
INSERT INTO shop_subscriptions (shop_id, plan_type, monthly_fee, start_date, status) 
VALUES 
    ('SAMPLE001', 'premium', 5000, CURRENT_DATE, 'active'),
    ('SAMPLE002', 'standard', 3000, CURRENT_DATE, 'active'),
    ('SAMPLE003', 'basic', 0, CURRENT_DATE, 'active')
ON CONFLICT DO NOTHING;

-- ========================================
-- 7. ビュー作成（統計・分析用）
-- ========================================

-- ショップ別平均評価ビュー
CREATE OR REPLACE VIEW shop_average_ratings AS
SELECT 
    shop_id,
    COUNT(*) as review_count,
    ROUND(AVG(overall_rating), 1) as avg_overall_rating,
    ROUND(AVG(beginner_friendliness), 1) as avg_beginner_friendliness,
    ROUND(AVG(safety_rating), 1) as avg_safety_rating,
    ROUND(AVG(staff_rating), 1) as avg_staff_rating,
    ROUND(AVG(satisfaction_rating), 1) as avg_satisfaction_rating,
    ROUND(AVG(cost_performance), 1) as avg_cost_performance,
    MAX(created_at) as latest_review_date
FROM user_reviews 
GROUP BY shop_id;

-- ユーザー別ポイントサマリービュー
CREATE OR REPLACE VIEW user_point_summary AS
SELECT 
    line_user_id,
    SUM(points_earned) as total_earned,
    SUM(points_spent) as total_spent,
    MAX(balance) as current_balance,
    COUNT(*) as transaction_count,
    MAX(created_at) as last_activity
FROM user_points 
GROUP BY line_user_id;

-- ショップ課金ステータスビュー
CREATE OR REPLACE VIEW shop_subscription_status AS
SELECT 
    shop_id,
    plan_type,
    monthly_fee,
    start_date,
    CASE 
        WHEN end_date IS NULL THEN '継続中'
        WHEN end_date > CURRENT_DATE THEN '継続中'
        ELSE '終了'
    END as subscription_status,
    EXTRACT(DAYS FROM (COALESCE(end_date, CURRENT_DATE) - start_date)) as subscription_days
FROM shop_subscriptions 
WHERE status = 'active';

-- ========================================
-- 8. 権限設定（Row Level Security）
-- ========================================

-- RLSを有効化（本番環境で推奨）
-- ALTER TABLE shop_subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のデータのみアクセス可能
-- CREATE POLICY "Users can only see their own reviews" ON user_reviews FOR ALL USING (auth.uid()::text = line_user_id);
-- CREATE POLICY "Users can only see their own points" ON user_points FOR ALL USING (auth.uid()::text = line_user_id);
-- CREATE POLICY "Users can only see their own member profile" ON member_profiles FOR ALL USING (auth.uid()::text = line_user_id);

-- ========================================
-- 9. 完了確認
-- ========================================

-- テーブル一覧確認クエリ
SELECT 
    table_name,
    table_type,
    'V2.8で追加' as note
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('shop_subscriptions', 'user_reviews', 'user_points', 'member_profiles')
ORDER BY table_name;

-- 各テーブルのカラム数確認
SELECT 
    table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('shop_subscriptions', 'user_reviews', 'user_points', 'member_profiles')
GROUP BY table_name
ORDER BY table_name;

-- ========================================
-- セットアップ完了メッセージ
-- ========================================
SELECT 'V2.8 データベーススキーマ拡張が完了しました！' as status;