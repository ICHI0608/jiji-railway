# 🌊 Dive Buddy's アンケートシステム セットアップ要件 v2.8

## 📋 必要な手動設定一覧

### **🔧 1. 環境変数設定（.envファイル）**

以下の環境変数を`.env`ファイルに追加する必要があります：

```bash
# =================================
# V2.8 追加必須項目
# =================================

# LINE Bot設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here

# データベース設定（Supabase使用）
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI設定
OPENAI_API_KEY=your_openai_api_key_here

# =================================
# 既存設定（そのまま）
# =================================
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/google-service-account.json
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
GOOGLE_SHEETS_CLIENT_EMAIL="jiji-diving-bot-service@..."
GOOGLE_PROJECT_ID="jiji-diving-bot-dev"
JIJI_SHOPS_SPREADSHEET_ID=""
NODE_ENV=development
PORT=3000
```

---

## **🤖 2. LINE Bot設定（LINE Developers Console）**

### **手動設定が必要な項目:**

#### **A. Basic Settings**
- **Channel Name**: `Dive Buddy's`
- **Channel Description**: `沖縄ダイビング専門AIバディ - あなた専属のダイビングコンシェルジュ`
- **Channel Icon**: Jijiキャラクター画像（制作必要）
- **Privacy Policy**: Webサイトのプライバシーポリシーページ
- **Terms of Use**: 利用規約ページ

#### **B. Messaging API Settings**
- **Webhook URL**: `https://your-domain.com/webhook`
- **Use webhooks**: `Enabled`
- **Auto-reply messages**: `Disabled`（Jijiが応答するため）
- **Greeting messages**: `Disabled`（アンケートシステムが代替）

#### **C. LINE Login Settings（オプション）**
- **Web app URL**: `https://dive-buddys.com`
- **Callback URL**: `https://your-domain.com/auth/line/callback`

---

## **🎨 3. リッチメニュー画像制作**

### **制作必要な画像:**

#### **メイン画像仕様:**
- **サイズ**: 2500×1686px
- **フォーマット**: JPEG推奨
- **ファイルサイズ**: 1MB以下

#### **デザイン案:**
```
┌─────────────────────────────────────────────────────┐
│              🌺 Dive Buddy's Menu                    │
├─────────────────┬─────────────────┬─────────────────┤
│      🤿         │       🏪        │       📋       │
│   体験相談       │   ショップDB     │   アンケート     │
│                 │                 │                 │
│ 気軽に相談       │ ショップ検索     │ プロファイル     │
├─────────────────┼─────────────────┼─────────────────┤
│      🗓️         │       ☀️        │       ❓       │
│   旅行計画       │   海況情報       │   ヘルプ       │
│                 │                 │                 │
│ 日程・予算       │ 天気・海況       │ 使い方ガイド     │
└─────────────────┴─────────────────┴─────────────────┘
```

#### **色彩・デザイン方針:**
- **ベース色**: 沖縄の海をイメージした青系グラデーション
- **アクセント色**: サンゴピンク、トロピカルイエロー
- **フォント**: 読みやすいゴシック体
- **アイコン**: 統一感のある丸角デザイン

---

## **🗄️ 4. データベース設定（Supabase）**

### **手動設定項目:**

#### **A. Supabaseプロジェクト作成**
1. https://supabase.com でプロジェト作成
2. Organization: `Dive Buddy's`
3. Project Name: `jiji-diving-bot-v28`
4. Password: 安全なパスワード設定
5. Region: `Northeast Asia (Tokyo)`

#### **B. 接続情報取得**
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon Key**: プロジェクト設定からコピー
- **Service Role Key**: 管理用（使用しない）

#### **C. SQL実行**
セットアップスクリプトが自動実行しますが、手動確認も可能：
```sql
-- テーブル作成確認
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%survey%';
```

---

## **🚀 5. 自動セットアップ可能項目**

以下は`setup-survey-system.js`で自動化済み：

### **✅ 自動実行される項目:**
- データベーステーブル作成
- リッチメニューLINE登録
- アンケートマスターデータ投入
- システムテスト実行
- 統計ダッシュボード初期化

### **🔧 セットアップコマンド:**
```bash
# 完全セットアップ
node src/setup-survey-system.js setup

# データベースのみ
node src/setup-survey-system.js database

# リッチメニューのみ（画像作成後）
node src/setup-survey-system.js rich-menu

# システムテスト
node src/setup-survey-system.js test
```

---

## **📊 6. 動作確認手順**

### **A. 基本動作テスト**
1. LINE Bot友だち追加
2. 自動アンケート開始確認
3. 3問回答完了
4. リッチメニュー表示確認
5. 「ショップをマッチング」テスト

### **B. 管理者確認**
```bash
# アンケート統計確認
node src/setup-survey-system.js stats

# データベース確認
SELECT COUNT(*) FROM user_surveys WHERE survey_completed = 1;
```

---

## **⚠️ 7. 制作・設定が必要な項目まとめ**

### **🎨 制作必要:**
1. **リッチメニュー画像** (2500×1686px)
2. **LINE Bot アイコン** (512×512px推奨)
3. **Jijiキャラクター画像** (プロフィール用)

### **🔧 手動設定必要:**
1. **LINE Developers Console** 各種設定
2. **Supabaseプロジェクト** 作成・設定
3. **環境変数** (.env追加)
4. **Webhook URL** サーバー公開後設定

### **⏰ 設定所要時間:**
- **制作時間**: 2-3時間（画像制作）
- **設定時間**: 30分（各種サービス設定）
- **テスト時間**: 15分（動作確認）

---

## **📞 8. サポート情報**

### **参考URL:**
- LINE Developers: https://developers.line.biz/
- Supabase Docs: https://supabase.com/docs
- リッチメニュー仕様: https://developers.line.biz/ja/docs/messaging-api/using-rich-menus/

### **トラブルシューティング:**
よくある問題と解決方法は`docs/troubleshooting.md`を参照