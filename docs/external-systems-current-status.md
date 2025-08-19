# 🌐 Dive Buddy's 外部システム連携状況

**最終更新**: 2025年8月6日  
**プロジェクト**: Dive Buddy's - 沖縄ダイビングプラットフォーム

## 📊 **現在関与している外部システム一覧**

### 🔴 **必須レベル（システム運用に不可欠）**

#### 1. 🐙 **GitHub**
- **サービス**: ソースコード管理・バージョン管理
- **リポジトリ**: `git@github.com:ICHI0608/jiji-railway.git`
- **状況**: ✅ **アクティブ使用中**
- **影響度**: 🔴 **Critical** - コード管理の中核
- **設定ファイル**: `.git/`, `package.json`

#### 2. 🚂 **Railway** 
- **サービス**: 本番環境ホスティング・デプロイメント
- **URL**: https://dive-buddys.com
- **状況**: ✅ **アクティブ運用中**
- **影響度**: 🔴 **Critical** - 本番サイト運用
- **設定ファイル**: `railway.toml`
- **環境**: Production/Staging 両方稼働

#### 3. 🗄️ **Supabase**
- **サービス**: PostgreSQLデータベース・認証・リアルタイム機能
- **状況**: ✅ **アクティブ使用中**
- **影響度**: 🔴 **Critical** - 全データ管理
- **主要テーブル**: 
  - `diving_shops` (79店舗データ)
  - `user_profiles` (ユーザー情報)
  - `user_feedback` (フィードバック)
  - `conversations` (チャット履歴)
- **設定**: `src/supabase-connector.js`

#### 4. 🤖 **OpenAI GPT-5**
- **サービス**: AI感情分析・Jijiキャラクター応答生成
- **モデル**: GPT-5
- **状況**: ✅ **アクティブ使用中**
- **影響度**: 🔴 **Critical** - AIチャット機能の中核
- **機能**: 6カテゴリ感情分析システム
- **設定**: `src/openai-emotion-analyzer.js`

#### 5. 💬 **LINE Bot Platform**
- **サービス**: LINE Bot機能・メッセージング
- **Bot ID**: @2007331165
- **公式URL**: https://line.me/ti/p/@2007331165
- **状況**: ✅ **アクティブ運用中**
- **影響度**: 🔴 **Critical** - ユーザー接点の主要チャネル
- **機能**: リッチメニュー、アンケートシステム
- **設定**: `simple-bot.js`

### 🟡 **重要レベル（機能拡張・運用効率化）**

#### 6. 📊 **Google Sheets API**
- **サービス**: ショップデータ管理・同期
- **状況**: ✅ **アクティブ使用中**
- **影響度**: 🟡 **Important** - データ管理効率化
- **機能**: 79店舗データの一括管理・同期
- **認証**: Google Service Account
- **設定**: `api/google-sheets-integration.js`

#### 7. 🌤️ **気象庁API**
- **サービス**: 沖縄地域天気・海況情報
- **API**: https://www.jma.go.jp/bosai
- **状況**: ✅ **アクティブ使用中**
- **影響度**: 🟡 **Important** - ダイビング適性判定
- **対象地域**: 沖縄本島、宮古島、石垣島、与那国島
- **設定**: `src/weather-api.js`

### 🟢 **補助レベル（準備済み・オプション機能）**

#### 8. 💳 **Stripe**
- **サービス**: 決済処理システム
- **状況**: ⚠️ **デモ実装のみ**
- **影響度**: 🟢 **Optional** - 将来の課金機能
- **実装レベル**: テスト環境のみ
- **設定**: `admin-app.js`

#### 9. 🗺️ **Google Maps API**
- **サービス**: 地図・位置情報機能
- **状況**: ⚠️ **設定準備済み**
- **影響度**: 🟢 **Optional** - 将来の位置連携
- **実装レベル**: API Key設定のみ

#### 10. 🔔 **Slack**
- **サービス**: システム通知・エラー通知
- **状況**: ⚠️ **設定準備済み**
- **影響度**: 🟢 **Optional** - 運用監視
- **実装レベル**: Webhook URL設定のみ

#### 11. ⚡ **Redis**
- **サービス**: キャッシュ・セッション管理
- **状況**: ⚠️ **パッケージ準備済み**
- **影響度**: 🟢 **Optional** - パフォーマンス向上
- **実装レベル**: 依存関係インストール済み

## 📈 **サービス稼働状況サマリー**

| サービス | 稼働状況 | 影響度 | 実装レベル |
|---------|---------|-------|-----------|
| GitHub | ✅ Active | 🔴 Critical | 完全運用 |
| Railway | ✅ Active | 🔴 Critical | 完全運用 |
| Supabase | ✅ Active | 🔴 Critical | 完全運用 |
| OpenAI | ✅ Active | 🔴 Critical | 完全運用 |
| LINE Bot | ✅ Active | 🔴 Critical | 完全運用 |
| Google Sheets | ✅ Active | 🟡 Important | 完全運用 |
| 気象庁API | ✅ Active | 🟡 Important | 完全運用 |
| Stripe | ⚠️ Demo | 🟢 Optional | テスト段階 |
| Google Maps | ⚠️ Ready | 🟢 Optional | 準備済み |
| Slack | ⚠️ Ready | 🟢 Optional | 準備済み |
| Redis | ⚠️ Ready | 🟢 Optional | 準備済み |

## 🔐 **認証・設定状況**

### ✅ **完全設定済み（7サービス）**
- GitHub SSH Key認証
- Railway アカウント連携
- Supabase PostgreSQL接続
- OpenAI API Key
- LINE Channel Token
- Google Service Account
- 気象庁API（認証不要）

### ⚠️ **部分設定済み（4サービス）**
- Stripe テストキーのみ
- Google Maps API Key準備
- Slack Webhook URL準備
- Redis URL準備

## 💰 **コスト・課金状況**

### 🔴 **有料サービス（月額課金）**
- **Railway**: 本番環境ホスティング
- **Supabase**: データベース・認証
- **OpenAI**: GPT-5 API使用量課金
- **LINE Bot**: メッセージ配信課金

### 🟢 **無料・準備済み**
- **GitHub**: プライベートリポジトリ
- **Google Sheets API**: 使用量制限内
- **気象庁API**: 完全無料
- **Stripe**: テスト環境無料

## ⚠️ **システム依存関係**

### 🚨 **停止すると即座に影響**
- **Railway** → サイト全体停止
- **Supabase** → データアクセス不可
- **LINE Bot** → チャット機能停止
- **OpenAI** → AI機能停止

### ⚠️ **停止すると機能制限**
- **Google Sheets** → データ同期停止
- **気象庁API** → 天気情報取得不可

### ✅ **停止しても基本機能維持**
- **Stripe/Google Maps/Slack/Redis** → 影響軽微

---

**総合評価**: **7つの外部システムが完全稼働中** 🟢  
**リスクレベル**: **中程度** - 主要5サービスへの依存度高