# 🔧 環境変数設定チェックリスト

## ⚠️ 現在の状況
アンケートシステムのセットアップを実行する前に、以下の環境変数設定が必要です。

## 📋 必須環境変数（設定必要）

### 1. LINE Bot設定
```bash
LINE_CHANNEL_ACCESS_TOKEN=Channel Access Token
LINE_CHANNEL_SECRET=Channel Secret
```

**取得方法:**
1. https://developers.line.biz/ にアクセス
2. Providers → Channel設定
3. Messaging API → Channel Access Token
4. Basic settings → Channel Secret

### 2. Supabase設定
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=anon public key
```

**取得方法:**
1. https://supabase.com でプロジェクト作成
2. Settings → API → Project URL
3. Settings → API → anon public key

### 3. OpenAI設定
```bash
OPENAI_API_KEY=sk-...
```

**取得方法:**
1. https://platform.openai.com/
2. API Keys → Create new secret key

## 🚀 設定完了後の実行手順

### Step 1: 環境変数設定確認
```bash
# .envファイルを編集
nano .env

# 設定確認
cat .env | grep -E "(LINE_|SUPABASE_|OPENAI_)"
```

### Step 2: システムセットアップ実行
```bash
# 完全セットアップ
node src/setup-survey-system.js setup

# または段階的実行
node src/setup-survey-system.js database  # データベースのみ
node src/setup-survey-system.js rich-menu # リッチメニューのみ
```

### Step 3: 動作確認
```bash
# システムテスト
node src/setup-survey-system.js test

# 統計確認
node src/setup-survey-system.js stats
```

## ⚡ 今すぐ実行可能な作業

セットアップスクリプトは以下の機能を持っています：

✅ **ファイル準備完了**
- survey-manager.js ✅
- rich-menu-manager.js ✅
- survey-schema.sql ✅
- database.js ✅
- setup-survey-system.js ✅

⚠️ **環境変数設定待ち**
- LINE Bot設定
- Supabase設定
- OpenAI設定

## 📱 設定値入手の優先順位

1. **Supabase** (最優先) - データベース機能のため必須
2. **OpenAI** - アンケート分析・会話理解のため重要
3. **LINE Bot** - リッチメニュー設定のため（手動設定でも可）

## 🔍 トラブルシューティング

### データベース接続エラー
```bash
Error: supabaseUrl is required.
```
→ Supabase設定を追加

### LINE API エラー
```bash
LINE API Error: Invalid access token
```
→ LINE設定確認（スキップ可能）

### 部分セットアップ対応
LINE設定が未完了でも、データベース・アンケート機能は利用可能です。