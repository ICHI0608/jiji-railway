# 🔧 Supabase手動操作ガイド（詳細版）

## 📋 Project URL確認方法

### **Step 1: Supabaseダッシュボードにアクセス**
1. ブラウザで https://supabase.com にアクセス
2. **「Sign In」** をクリックしてログイン
3. プロジェクト一覧から **「ICHI0608's Project」** をクリック

### **Step 2: Project URL確認**
1. 左サイドバーの **⚙️ 「Settings」** をクリック
2. **「API」** タブを選択
3. **「Project URL」** セクションを確認
   - 形式: `https://mveoxxivgnwnutjacnpv.supabase.co`
   - 右側の📋 **「Copy」** ボタンでコピー可能

### **Step 3: API Key確認**
1. 同じAPI設定画面で下方向にスクロール
2. **「Project API keys」** セクションを確認
3. **「anon public」** キーをコピー
   - 形式: `eyJhbGciOiJIUzI1NiIsInR...` (長い文字列)
   - 右側の👁️ **「Show」** → 📋 **「Copy」** でコピー

---

## 🗄️ 手動SQL実行方法（詳細）

### **Step 1: SQL Editorにアクセス**
1. Supabaseプロジェクトダッシュボードで
2. 左サイドバーの **🔍 「SQL Editor」** をクリック
3. または上部メニューの **「SQL」** タブをクリック

### **Step 2: 新しいクエリ作成**
1. **「+ New Query」** ボタンをクリック
2. または既存のクエリエディタを使用

### **Step 3: SQL実行（4つのテーブルを順番に作成）**

#### **🔸 1番目: user_surveys テーブル**
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

**実行方法:**
1. 上記SQLをコピーしてSQL Editorに貼り付け
2. **▶️ 「Run」** ボタンをクリック
3. 緑色の成功メッセージを確認: `Success. No rows returned`

#### **🔸 2番目: survey_responses テーブル**
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

**実行方法:**
1. SQL Editorの内容をクリア（Ctrl+A → Delete）
2. 上記SQLを貼り付け
3. **▶️ 「Run」** ボタンをクリック
4. 成功メッセージを確認

#### **🔸 3番目: survey_insights テーブル**
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

#### **🔸 4番目: rich_menu_analytics テーブル**
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

### **Step 4: テーブル作成確認**
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

### **Step 5: Row Level Security設定（セキュリティ向上）**
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

---

## 🔍 テーブル作成後の確認方法

### **方法1: Tablesセクションで確認**
1. 左サイドバーの **📊 「Tables」** をクリック
2. 以下の4つのテーブルが表示されることを確認:
   - `user_surveys`
   - `survey_responses`
   - `survey_insights`
   - `rich_menu_analytics`

### **方法2: Table Editorで確認**
1. **「Tables」** → **「user_surveys」** をクリック
2. テーブル構造を確認:
   - `id` (int8, Primary Key)
   - `user_id` (varchar)
   - `experience_level` (varchar)
   - `license_type` (varchar)
   - など

---

## 🚨 エラー発生時の対処法

### **よくあるエラーと解決方法**

#### **エラー1: 「relation already exists」**
```
ERROR: relation "user_surveys" already exists
```
**解決方法:**
- テーブルが既に存在する場合は正常です
- 次のSQLに進んでください

#### **エラー2: 「syntax error」**
```
ERROR: syntax error at or near "..."
```
**解決方法:**
1. SQLをもう一度コピー&ペーストしてください
2. 余分な文字や改行がないか確認
3. 一つずつCREATE TABLEとCREATE INDEXを分けて実行

#### **エラー3: 「permission denied」**
```
ERROR: permission denied for schema public
```
**解決方法:**
1. プロジェクトオーナーでログインしているか確認
2. 別のブラウザ/タブでSupabaseに再ログイン

---

## ✅ 作業完了チェックリスト

- [ ] Project URL確認完了: `https://mveoxxivgnwnutjacnpv.supabase.co`
- [ ] API Key確認完了: `eyJhbG...`
- [ ] SQL Editor にアクセス完了
- [ ] `user_surveys` テーブル作成完了
- [ ] `survey_responses` テーブル作成完了
- [ ] `survey_insights` テーブル作成完了
- [ ] `rich_menu_analytics` テーブル作成完了
- [ ] テーブル一覧で4つのテーブル確認完了
- [ ] RLS設定完了

---

## 🎯 作業完了後の次のステップ

テーブル作成完了後、ターミナルで以下を実行：

```bash
# システムテスト実行
node src/setup-survey-system.js test

# 期待される結果: 
# ✅ アンケート開始: survey_start
# ✅ Q1回答処理: survey_progress  
# ✅ Q1.5回答処理: survey_progress
# ✅ Q2回答処理: survey_completed
# ✅ システムテスト完了
```

この手順で確実にSupabaseテーブルが作成され、アンケートシステムが稼働します！