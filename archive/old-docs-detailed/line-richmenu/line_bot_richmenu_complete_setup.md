# 🤖 LINE Bot リッチメニュー完全設定ガイド

## 🔧 Part 1: LINE Bot環境変数設定（必須）

### **LINE Developers Console での作業**

#### **Step 1: LINE Developers Consoleにアクセス**
1. https://developers.line.biz/ にアクセス
2. LINE アカウントでログイン
3. プロバイダーを選択（または新規作成）

#### **Step 2: Messaging API チャンネル確認/作成**
1. **既存チャンネルがある場合**: チャンネルを選択
2. **新規作成の場合**: 
   - 「新規チャンネル作成」
   - 「Messaging API」を選択
   - チャンネル名: `Dive Buddy's`
   - チャンネル説明: `沖縄ダイビング専門AIバディ`

#### **Step 3: 必要な認証情報を取得**

**🔑 Channel Access Token (長期)**
1. チャンネル設定 → **「Messaging API」** タブ
2. **「Channel access token (long-lived)」** セクション
3. **「Issue」** ボタンをクリック
4. 生成されたトークンをコピー
   - 形式: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx...`

**🔑 Channel Secret**
1. チャンネル設定 → **「Basic settings」** タブ  
2. **「Channel secret」** セクション
3. **「Show」** → **「Copy」**
   - 形式: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

#### **Step 4: 環境変数設定**
```bash
# .envファイルを編集
nano .env

# 以下の行を実際の値に置換
LINE_CHANNEL_ACCESS_TOKEN=取得したChannel Access Token
LINE_CHANNEL_SECRET=取得したChannel Secret
```

---

## 🎨 Part 2: リッチメニュー画像作成

### **方法A: HTMLテンプレート使用（推奨・15分）**

#### **Step 1: HTMLテンプレートから画像作成**
```bash
# HTMLファイルをブラウザで開く
open /Users/ymacbookpro/jiji-diving-bot/assets/rich-menu-template.html
```

#### **Step 2: 正確なサイズでスクリーンショット**
1. **Safari/Chrome開発者ツール**: ⌘+⌥+I
2. **レスポンシブモード**: ⌘+⌥+M
3. **画面サイズ設定**: `2500 × 1686`
4. **倍率確認**: 100%
5. **スクリーンショット**: ⌘+Shift+4 で範囲選択
6. **保存**: `assets/rich-menu-v28.jpg`

### **方法B: 自動画像生成（高品質）**
```bash
# Puppeteerインストール（未インストールの場合）
npm install puppeteer

# 自動画像生成実行
node scripts/create-rich-menu-image.js
```

---

## 🔗 Part 3: アンケート機能のアクション設定

### **重要: メッセージアクションの仕組み**

#### **リッチメニューボタン → Bot応答の流れ**
```
1. ユーザーがアンケートボタンをタップ
   ↓
2. LINEが「アンケート開始」メッセージを送信  
   ↓
3. message-handler.jsが「アンケート開始」を検知
   ↓
4. surveyManager.startSurvey() を実行
   ↓
5. アンケート質問＋QuickReplyボタンを表示
```

#### **設定すべきアクション内容**

**📋 アンケートボタンの設定**
- **アクションタイプ**: `メッセージ`
- **メッセージテキスト**: `アンケート開始`
- **重要**: この文字列は完全一致で処理されます

#### **6つのボタンの完全設定**

```javascript
// リッチメニューエリア設定（LINE Official Account Manager用）
const richMenuAreas = [
    // エリア1（左上）
    { 
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "体験相談" }
    },
    // エリア2（中上）
    { 
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: "message", text: "ショップDB" }
    },
    // エリア3（右上）- アンケート
    { 
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: "message", text: "アンケート開始" }  // ← 重要：この文字列
    },
    // エリア4（左下）
    { 
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "旅行計画" }
    },
    // エリア5（中下）
    { 
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: "message", text: "海況情報" }
    },
    // エリア6（右下）
    { 
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: "message", text: "ヘルプ" }
    }
];
```

---

## 🤖 Part 4: Bot側の応答設定確認

### **message-handler.js での処理確認**

アンケート機能は既に実装済みです：

```javascript
// 特別なメッセージの処理
if (messageText === 'アンケート開始') {
    const isNewUser = !(await getUserProfile(userId));
    const surveyResponse = await surveyManager.startSurvey(userId, isNewUser);
    return formatResponseMessage(surveyResponse);
}

// その他のリッチメニューアクション
switch(messageText) {
    case '体験相談':
        return { type: 'text', text: '🤿 体験ダイビングのご相談ですね！...' };
    case 'ショップDB':
        return { type: 'text', text: '🏪 沖縄のダイビングショップ検索...' };
    case '旅行計画':
        return { type: 'text', text: '🗓️ 沖縄ダイビング旅行の計画サポート...' };
    case '海況情報':
        return { type: 'text', text: '🌊 現在の海況・天気情報...' };
    case 'ヘルプ':
        return { type: 'text', text: '❓ Dive Buddy\'s の使い方...' };
}
```

---

## 🚀 Part 5: 自動リッチメニュー設定実行

### **環境変数設定完了後の自動設定**

```bash
# リッチメニュー自動設定
node src/setup-survey-system.js rich-menu

# または完全セットアップ
node src/setup-survey-system.js setup
```

### **期待される結果**
```bash
🎨 リッチメニューセットアップ開始...
🚀 Dive Buddy's リッチメニューセットアップ開始
🎨 リッチメニュー作成開始...
📤 画像アップロード完了: assets/rich-menu-v28.jpg
🔗 リッチメニュー作成完了: richmenu-xxx
🎯 デフォルトメニュー設定完了
✅ リッチメニューセットアップ完了: richmenu-xxx
```

---

## 📱 Part 6: LINE Official Account Manager での手動設定（代替方法）

### **自動設定が失敗した場合の手動設定**

#### **Step 1: LINE Official Account Managerにアクセス**
1. https://manager.line.biz/ にログイン
2. 該当アカウントを選択
3. **「ホーム」** → **「リッチメニュー」**

#### **Step 2: リッチメニュー作成**
1. **「作成」** ボタンをクリック
2. **基本設定**:
   - タイトル: `Dive Buddy's Menu v2.8`
   - 表示期間: 無期限
3. **コンテンツ設定**:
   - **「設定」** ボタンをクリック
   - **テンプレート**: A（3×2グリッド）
   - **画像アップロード**: `rich-menu-v28.jpg`

#### **Step 3: アクション設定**
各エリアに以下を設定：

| エリア | 位置 | アクション | テキスト |
|--------|------|------------|----------|
| A | 左上 | メッセージ | `体験相談` |
| B | 中上 | メッセージ | `ショップDB` |
| C | 右上 | メッセージ | `アンケート開始` |
| D | 左下 | メッセージ | `旅行計画` |
| E | 中下 | メッセージ | `海況情報` |
| F | 右下 | メッセージ | `ヘルプ` |

#### **Step 4: 公開設定**
1. **「保存」** をクリック
2. **「公開」** をクリック

---

## 🧪 Part 7: アンケート機能テスト方法

### **スマートフォンでのテスト**

1. **LINE友だち追加**
   - QRコードまたはLINE ID検索
   
2. **リッチメニュー表示確認**
   - メニューバーが表示されること
   - 6つのボタンが正しく配置されていること

3. **アンケート機能テスト**
   ```
   1. 📋「アンケート開始」をタップ
   2. 「🌺 はいさい！Jijiだよ！...」メッセージ表示
   3. Q1のQuickReplyボタン表示
   4. ボタンをタップして回答
   5. Q1.5 → Q2と進む
   6. 「アンケート完了！」メッセージ
   ```

4. **期待される応答フロー**
   ```
   👆 アンケート開始
   ↓
   🌺 はいさい！まずは簡単なアンケート...
   ↓  
   🏝️ ダイビング経験はどのくらい？
   [🌊 沖縄で何度も] [🤿 沖縄で1-2回] ...
   ↓
   🎫 ダイビングライセンスは？
   [🎫 オープンウォーター] [🏆 アドバンス以上] ...
   ↓
   📍 分岐質問（経験レベルに応じて）
   ↓
   🎉 アンケート完了！あなたのプロファイル...
   ```

---

## ⚠️ トラブルシューティング

### **よくある問題と解決方法**

#### **問題1: リッチメニューが表示されない**
```
原因: Channel Access Token が無効
解決: トークンを再発行して.envファイルを更新
```

#### **問題2: アンケートボタンが反応しない**
```
原因: メッセージテキストの不一致
確認: 「アンケート開始」（完全一致）
解決: LINE Official Account Managerでアクション設定を確認
```

#### **問題3: 画像がアップロードできない**
```
原因: 画像サイズ・形式の問題
確認: 2500×1686px、JPEG、1MB以下
解決: HTMLテンプレートから再作成
```

#### **問題4: 自動設定が失敗する**
```
原因: 環境変数未設定
解決: LINE_CHANNEL_ACCESS_TOKEN と LINE_CHANNEL_SECRET を確認
代替: LINE Official Account Manager で手動設定
```

---

## 🎯 設定完了後の確認項目

### **✅ チェックリスト**

- [ ] LINE Developers Console で Channel Access Token 取得
- [ ] LINE_CHANNEL_ACCESS_TOKEN を .env に設定
- [ ] LINE_CHANNEL_SECRET を .env に設定
- [ ] リッチメニュー画像作成完了（2500×1686px）
- [ ] 自動リッチメニュー設定実行 または 手動設定完了
- [ ] スマートフォンでリッチメニュー表示確認
- [ ] 「アンケート開始」ボタンの動作確認
- [ ] アンケート完了まで全フロー確認
- [ ] 他の5つのボタンの基本応答確認

### **🚀 次のステップ**

リッチメニュー設定完了後：
1. **全機能テスト実行**
2. **ショップリスト充実**
3. **コンテンツシステム構築**

これでLINE Botアンケートシステムが完全稼働します！