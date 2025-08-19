# Dive Buddy's 外部サービス一覧

**調査日時**: 2025年8月1日
**プロジェクト**: /Users/ymacbookpro/jiji-diving-bot/

## 1. クラウドプラットフォーム・ホスティング

### Railway
- **利用目的**: 本番環境デプロイメントプラットフォーム
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/railway.toml`
- **環境**: Production/Staging環境設定済み
- **実装状況**: 完全実装済み

## 2. データベースサービス

### Supabase
- **利用目的**: PostgreSQLデータベース、認証、リアルタイム機能
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/src/supabase-connector.js`
- **環境変数**: 
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- **テーブル**: diving_shops, user_feedback, user_profiles, conversations
- **実装状況**: 完全実装済み（CRUD操作実装済み）

## 3. AIサービス

### OpenAI GPT-5
- **利用目的**: 感情分析、Jijiキャラクター応答生成
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/src/openai-emotion-analyzer.js`
- **環境変数**: `OPENAI_API_KEY`
- **モデル**: gpt-5
- **機能**: 6カテゴリ感情分析システム
- **実装状況**: 完全実装済み

## 4. Google Cloud Services

### Google Sheets API
- **利用目的**: ショップデータ管理、口コミ・海況データ同期
- **設定ファイル**: 
  - `/Users/ymacbookpro/jiji-diving-bot/api/google-sheets-integration.js`
  - `/Users/ymacbookpro/jiji-diving-bot/api/setup-google-sheets.js`
- **認証ファイル**: `/Users/ymacbookpro/jiji-diving-bot/credentials/google-service-account.json`
- **環境変数**:
  - `GOOGLE_SPREADSHEET_ID`
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`
- **実装状況**: 完全実装済み（データ同期システム実装済み）

### Google Maps API
- **環境変数**: `GOOGLE_MAPS_API_KEY`
- **実装状況**: 設定準備済み（詳細実装未確認）

## 5. メッセージングサービス

### LINE Bot SDK
- **利用目的**: LINE Bot機能、リッチメニュー、メッセージ配信
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/simple-bot.js`
- **パッケージ**: `@line/bot-sdk`
- **環境変数**:
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_CHANNEL_SECRET`
- **LINE Bot ID**: @2007331165
- **実装状況**: 完全実装済み（アンケートシステム、リッチメニュー実装済み）

## 6. 気象データサービス

### 気象庁API
- **利用目的**: 沖縄各地域の天気予報、海況情報取得
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/src/weather-api.js`
- **API URL**: https://www.jma.go.jp/bosai
- **対象地域**: 沖縄本島、宮古島、石垣島、与那国島
- **実装状況**: 完全実装済み（ダイビング適性判定システム実装済み）

## 7. 決済サービス

### Stripe
- **利用目的**: 決済処理（デモ版）
- **設定ファイル**: `/Users/ymacbookpro/jiji-diving-bot/admin-app.js`
- **環境変数**:
  - `STRIPE_PUBLIC_KEY`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- **実装状況**: デモ実装のみ（本格運用はされていない）

## 8. 通知・監視サービス

### Slack
- **利用目的**: システム通知、エラー通知
- **環境変数**: `SLACK_WEBHOOK_URL`
- **実装状況**: 設定準備済み（詳細実装未確認）

## 9. その他のサービス

### Redis
- **利用目的**: キャッシュ、セッション管理
- **パッケージ**: redis
- **環境変数**: `REDIS_URL`
- **実装状況**: パッケージインストール済み（詳細実装未確認）

### GitHub
- **利用目的**: ソースコード管理
- **設定箇所**: package.jsonのrepository設定
- **実装状況**: 確認済み（Gitリポジトリとして使用中）

## APIキー優先度別分類

### 必須レベル（高優先度）
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` - データベース接続
- `OPENAI_API_KEY` - AI機能
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` - LINE Bot機能

### 推奨レベル（中優先度）
- `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` - データ管理
- `WEATHER_API_KEY` - 気象情報（気象庁APIは無料）

### オプションレベル（低優先度）
- `STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY` - 決済機能
- `SLACK_WEBHOOK_URL` - 通知機能
- `GOOGLE_MAPS_API_KEY` - 地図機能
- `REDIS_URL` - キャッシュ機能

## セキュリティ設計

### 認証情報管理
- 全APIキーは環境変数で管理
- 認証ファイルは/credentials/ディレクトリで管理
- コード内に直接記述された認証情報なし

### フォールバック機能
- APIキー未設定でも基本機能は動作
- モックデータによる代替機能実装
- 開発環境用の設定分離

## 実装状況サマリー
- **完全実装済み**: Railway, Supabase, OpenAI, Google Sheets, LINE Bot, 気象庁API
- **部分実装済み**: Stripe (デモのみ)
- **設定準備済み**: Google Maps, Slack, Redis
- **総外部サービス数**: 10サービス