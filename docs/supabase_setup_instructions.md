# 🔧 Supabase環境変数設定手順

## 📋 現在の状況
✅ Supabaseプロジェクト作成済み（ICHI0608's Project）
⚠️ 環境変数設定が必要

## 🔍 Step 1: Supabase認証情報の取得

### **Project Settings へアクセス**
1. 左サイドバーの **⚙️ Settings** をクリック
2. **API** セクションを選択

### **必要な情報を取得**
以下の2つの値をコピー：

1. **Project URL** 
   - 形式: `https://xxxxxxxxx.supabase.co`
   
2. **anon public key**
   - 形式: `eyJhbGciOiJIUzI1NiIsInR5cCI6...` (長い文字列)

## 🖥️ Step 2: 環境変数設定（自動）

取得した情報を使って以下のコマンドを実行：

```bash
# Supabase URL設定
export SUPABASE_URL="取得したProject URL"

# Supabase Anon Key設定  
export SUPABASE_ANON_KEY="取得したanon public key"

# .envファイルに永続保存
echo "SUPABASE_URL=$SUPABASE_URL" >> .env
echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env
```

## 🚀 Step 3: アンケートテーブル作成（自動）

環境変数設定後、以下のコマンドで自動作成：

```bash
# データベーステーブル作成
node src/setup-survey-system.js database

# システム全体セットアップ
node src/setup-survey-system.js setup

# 動作テスト
node src/setup-survey-system.js test
```

## 📊 Step 4: テーブル作成確認

Supabaseダッシュボードの **Tables** セクションで以下のテーブルが作成されていることを確認：

- `user_surveys` (アンケート回答)
- `survey_responses` (詳細回答ログ)  
- `survey_insights` (分析結果)
- `shop_subscriptions` (ショップ情報)
- `user_reviews` (レビュー)

## ⚡ 即座に実行可能な作業

1. **Supabase Settings → API** で認証情報取得
2. 上記のexportコマンド実行
3. `node src/setup-survey-system.js setup` 実行

これで完全自動でアンケートシステムが稼働します！

## 🎯 期待される結果

```bash
✅ データベースセットアップ完了
✅ V2.8テーブル作成完了  
✅ アンケートテーブル作成完了
✅ システムテスト完了
🎉 アンケートシステム セットアップ完了！
```