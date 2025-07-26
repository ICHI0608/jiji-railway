# 🔌 LINE Bot Webhook設定 手動ガイド

## 🔍 現在の問題
- ✅ Botサーバー起動済み: `http://localhost:3000`
- ❌ LINEからアクセス不可: Webhookが`localhost`のため外部から接続できない

## 🚀 解決方法: ngrokでWebhook公開

### **Step 1: 新しいターミナルを開く**
1. **⌘+T** で新しいターミナルタブを開く
2. プロジェクトディレクトリに移動:
   ```bash
   cd /Users/ymacbookpro/jiji-diving-bot
   ```

### **Step 2: ngrokでトンネル作成**
```bash
# ngrokでローカルサーバーを公開
ngrok http 3000
```

### **Step 3: 公開URLを確認**
ngrok起動後、以下のような出力が表示されます：
```
Session Status                online
Account                       Your Account
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://xxxx-xxx-xxx-xxx.ngrok.io -> http://localhost:3000
```

**重要**: `https://xxxx-xxx-xxx-xxx.ngrok.io` をコピー

### **Step 4: LINE Developers ConsoleでWebhook設定**

#### **LINE設定手順**
1. https://developers.line.biz/ にアクセス
2. チャンネル選択 → **「Messaging API」** タブ
3. **「Webhook settings」** セクション

#### **Webhook URL設定**
- **Webhook URL**: `https://xxxx-xxx-xxx-xxx.ngrok.io/webhook`
- **重要**: 末尾に `/webhook` を追加
- **「Use webhook」**: ON に設定

#### **Auto-reply messages設定**
- **「Auto-reply messages」**: OFF に設定
- **「Greeting messages」**: OFF に設定

### **Step 5: 動作確認**

#### **Webhook検証**
1. LINE Developers Consoleで **「Verify」** ボタンをクリック
2. 「Success」が表示されれば設定完了

#### **スマートフォンでテスト**
1. LINE公式アカウントで **「アンケート開始」** ボタンをタップ
2. 期待される応答:
   ```
   🌺 はいさい！Jijiだよ！
   沖縄ダイビングの専属バディとして
   サポートさせてもらうね✨

   まずは簡単なアンケート（3問30秒）で
   あなたのことを教えてもらえる？
   
   🏝️ ダイビング経験はどのくらい？
   [🌊 沖縄で何度も] [🤿 沖縄で1-2回] ...
   ```

## ⚠️ 重要な注意事項

### **ngrok使用上の注意**
- **セッション継続**: ngrokを停止すると URL が変わります
- **開発用途**: 本格運用時はRailway等のクラウドデプロイが必要
- **無料版制限**: 月間帯域幅制限があります

### **トラブルシューティング**

#### **問題1: ngrokがインストールされていない**
```bash
# Homebrewでインストール
brew install ngrok
```

#### **問題2: Webhook Verify失敗**
- Botサーバーが起動していることを確認
- ngrokトンネルが有効であることを確認
- `/webhook` パスが正しいことを確認

#### **問題3: アンケートが開始されない**
- サーバーログを確認:
  ```bash
  # 別ターミナルで
  tail -f server.log
  ```
-環境変数設定を確認:
  ```bash
  echo $LINE_CHANNEL_ACCESS_TOKEN
  ```

## 🔄 実行手順まとめ

### **並行実行が必要な3つのプロセス**

#### **ターミナル1: Botサーバー**
```bash
cd /Users/ymacbookpro/jiji-diving-bot
node app.js
# 起動したまま維持
```

#### **ターミナル2: ngrokトンネル**
```bash
ngrok http 3000
# 公開URL確認: https://xxxx.ngrok.io
# 起動したまま維持
```

#### **ブラウザ: LINE設定**
- Webhook URL: `https://xxxx.ngrok.io/webhook`
- Auto-reply: OFF
- Verify: 成功確認

## 🎯 成功の確認方法

### **ログ出力例（正常時）**
```
🤖 Webhook received: アンケート開始
📋 Starting survey for user: U1234567890
✅ Survey response sent: survey_start
```

### **スマートフォン表示例**
```
🌺 はいさい！Jijiだよ！
...
🏝️ ダイビング経験はどのくらい？
[QuickReplyボタン表示]
```

この手順でアンケートシステムが完全稼働します！