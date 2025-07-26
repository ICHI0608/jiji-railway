# 🗄️ Supabase テーブル作成SQL（手動実行）

## 📋 実行手順
1. Supabaseダッシュボード → **SQL Editor**
2. 以下のSQLを順番に実行

## 🔧 SQL文（PostgreSQL対応版）

### 1. user_surveys テーブル
```sql
-- ユーザーアンケート基本情報テーブル
CREATE TABLE user_surveys (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Q1: ダイビング経験レベル
    experience_level VARCHAR(50) CHECK (experience_level IN (
        'okinawa_experienced',
        'okinawa_few_times', 
        'other_location_experienced',
        'complete_beginner',
        'skipped'
    )) DEFAULT NULL,
    
    -- Q1.5: ライセンス種類
    license_type VARCHAR(50) CHECK (license_type IN (
        'owd',
        'aow_plus',
        'experience_only', 
        'none',
        'skipped'
    )) DEFAULT NULL,
    
    -- Q2: 分岐質問の回答（JSONで柔軟に保存）
    q2_response JSONB DEFAULT NULL,
    
    -- アンケート状態管理
    current_question VARCHAR(20) DEFAULT 'q1',
    survey_completed BOOLEAN DEFAULT FALSE,
    
    -- タイムスタンプ
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_user_surveys_user_id ON user_surveys(user_id);
CREATE INDEX idx_user_surveys_completed ON user_surveys(survey_completed);
CREATE INDEX idx_user_surveys_experience ON user_surveys(experience_level);
```

### 2. survey_responses テーブル
```sql
-- 詳細回答ログテーブル
CREATE TABLE survey_responses (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    selected_option VARCHAR(100) NOT NULL,
    option_emoji VARCHAR(10),
    option_text TEXT,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX idx_survey_responses_question ON survey_responses(question_id);
```

### 3. survey_insights テーブル
```sql
-- アンケート分析・洞察テーブル
CREATE TABLE survey_insights (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- 分析結果
    user_segment VARCHAR(50), -- 'experienced_diver', 'intermediate_diver', 'beginner_diver'
    primary_motivation VARCHAR(50), -- 'safety', 'adventure', 'relaxation', 'learning'
    recommended_approach VARCHAR(100),
    
    -- 分析メタ情報
    analysis_confidence DECIMAL(3,2) DEFAULT 0.00,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX idx_survey_insights_user_id ON survey_insights(user_id);
CREATE INDEX idx_survey_insights_segment ON survey_insights(user_segment);
```

### 4. rich_menu_analytics テーブル
```sql
-- リッチメニュー分析テーブル
CREATE TABLE rich_menu_analytics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    menu_action VARCHAR(50) NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_id VARCHAR(100),
    
    -- 追加分析用
    user_segment VARCHAR(50),
    context_data JSONB DEFAULT NULL
);

-- インデックス作成
CREATE INDEX idx_rich_menu_analytics_user_id ON rich_menu_analytics(user_id);
CREATE INDEX idx_rich_menu_analytics_action ON rich_menu_analytics(menu_action);
CREATE INDEX idx_rich_menu_analytics_date ON rich_menu_analytics(clicked_at);
```

## 🚀 実行後の確認

### テーブル作成確認
```sql
-- テーブル一覧確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'user_surveys', 
    'survey_responses', 
    'survey_insights', 
    'rich_menu_analytics'
);
```

### Row Level Security (RLS) 有効化（推奨）
```sql
-- RLS有効化
ALTER TABLE user_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE rich_menu_analytics ENABLE ROW LEVEL SECURITY;

-- 基本ポリシー（匿名アクセス許可）
CREATE POLICY "Enable all access for anon users" ON user_surveys FOR ALL USING (true);
CREATE POLICY "Enable all access for anon users" ON survey_responses FOR ALL USING (true);
CREATE POLICY "Enable all access for anon users" ON survey_insights FOR ALL USING (true);
CREATE POLICY "Enable all access for anon users" ON rich_menu_analytics FOR ALL USING (true);
```

## ⚡ 実行手順まとめ

1. **Supabaseダッシュボード** → **SQL Editor**
2. 上記SQL文を**順番に**実行
3. エラーがないことを確認
4. **Tables**セクションで4つのテーブル作成確認
5. `node src/setup-survey-system.js test` でテスト実行

これでアンケートシステムが完全稼働します！