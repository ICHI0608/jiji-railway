# 🔧 残りのSupabaseテーブル作成手順

## 📊 現在の状況
✅ `user_surveys` テーブル既存 - スキップ
⚠️ 残り3つのテーブル作成が必要

## 🗄️ 実行手順

### **Step 1: エディタをクリア**
1. SQL Editorで **Ctrl+A** (全選択)
2. **Delete** キーでクリア

### **Step 2: survey_responses テーブル作成**
以下のSQLをコピー&ペーストして **▶️ Run** をクリック：

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

### **Step 3: survey_insights テーブル作成**
エディタをクリアして以下を実行：

```sql
-- アンケート分析・洞察テーブル
CREATE TABLE survey_insights (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- 分析結果
    user_segment VARCHAR(50),
    primary_motivation VARCHAR(50),
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

### **Step 4: rich_menu_analytics テーブル作成**
エディタをクリアして以下を実行：

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

### **Step 5: テーブル作成確認**
エディタをクリアして以下を実行：

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

**期待される結果:**
```
table_name
-----------------
user_surveys
survey_responses  
survey_insights
rich_menu_analytics
```

## ✅ 確認方法

### **Tables セクションで確認**
1. 左サイドバーの **📊 Tables** をクリック
2. 以下の4つのテーブルが表示されることを確認:
   - ✅ user_surveys (既存)
   - 🆕 survey_responses 
   - 🆕 survey_insights
   - 🆕 rich_menu_analytics

## 🚀 作業完了後の次のステップ

全テーブル作成確認後、ターミナルで実行：

```bash
# システムテスト実行
node src/setup-survey-system.js test

# 期待される結果:
# ✅ アンケート開始: survey_start
# ✅ Q1回答処理: survey_progress  
# ✅ システムテスト完了
```

残り3つのテーブル作成で完了です！