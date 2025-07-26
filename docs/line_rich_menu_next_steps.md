# 🚀 リッチメニュー設定 - 次のステップ実行ガイド

## 📸 Step 1: リッチメニュー画像作成（即座に実行可能）

### **方法A: HTMLテンプレートから作成（推奨・簡単）**

1. **HTMLファイルを開く**
   ```bash
   open /Users/ymacbookpro/jiji-diving-bot/assets/rich-menu-template.html
   ```

2. **ブラウザでスクリーンショット撮影**
   - Safari/Chromeで開く
   - 表示倍率を100%に設定
   - 開発者ツールで画面サイズを確認（2500×1686px）
   - スクリーンショットを撮影
   - JPEGで保存: `rich-menu-v28.jpg`

3. **ファイル配置**
   ```bash
   # 撮影した画像を正しい場所に移動
   mv ~/Downloads/rich-menu-v28.jpg /Users/ymacbookpro/jiji-diving-bot/assets/
   ```

### **方法B: macOSスクリーンショット詳細手順**

1. **Safariで正確なサイズで表示**
   ```bash
   # HTMLファイルを開く
   open -a Safari /Users/ymacbookpro/jiji-diving-bot/assets/rich-menu-template.html
   ```

2. **開発者ツールでサイズ調整**
   - Safari → 開発 → Webインスペクタ
   - レスポンシブデザインモードをON
   - 2500×1686pxに設定

3. **スクリーンショット撮影**
   - `⌘ + Shift + 4`
   - 表示領域を正確に選択
   - または `⌘ + Shift + 3` で全画面撮影後トリミング

---

## 🔧 Step 2: 環境変数の最終確認

現在の`.env`ファイルを確認し、不足項目を補完：

```bash
# 現在の環境変数確認
cat .env

# 必要に応じて追加
echo "LINE_CHANNEL_ACCESS_TOKEN=your_token_here" >> .env
echo "LINE_CHANNEL_SECRET=your_secret_here" >> .env
```

---

## 🤖 Step 3: LINE公式アカウント設定の具体的操作

### **LINE Official Account Manager での操作**

1. **リッチメニュー設定画面にアクセス**
   - https://manager.line.biz/ にログイン
   - 該当アカウントを選択
   - 「ホーム」→「リッチメニュー」

2. **新規リッチメニュー作成**
   - 「作成」ボタンをクリック
   - タイトル: `Dive Buddy's Menu v2.8`
   - 表示期間: 2025/07/24 00:00 〜 無期限

3. **テンプレート選択**
   - 「設定」ボタンクリック
   - テンプレートA（3×2グリッド）を選択
   - 画像アップロード: `rich-menu-v28.jpg`

4. **各エリアのアクション設定**
   ```
   エリア1（左上）: メッセージ「体験相談」
   エリア2（中上）: メッセージ「ショップDB」  
   エリア3（右上）: メッセージ「アンケート開始」
   エリア4（左下）: メッセージ「旅行計画」
   エリア5（中下）: メッセージ「海況情報」
   エリア6（右下）: メッセージ「ヘルプ」
   ```

5. **メニューバー設定**
   - テキスト: `メニュー`
   - デフォルト表示: `表示する`

6. **保存・公開**
   - 「保存」→「公開」

---

## 🔄 Step 4: システムセットアップ実行

画像作成完了後、以下を実行：

```bash
# 1. データベース＆リッチメニューセットアップ
cd /Users/ymacbookpro/jiji-diving-bot
node src/setup-survey-system.js setup

# 2. 動作確認
node src/setup-survey-system.js test

# 3. 統計確認
node src/setup-survey-system.js stats
```

---

## ✅ Step 5: 動作テスト

### **スマートフォンでの確認**
1. LINE公式アカウントを友だち追加
2. リッチメニューの表示確認
3. 各ボタンをタップしてBot応答確認
4. アンケート機能の動作確認

### **期待される動作**
```
👆 体験相談      → 🤿 体験相談案内メッセージ
👆 ショップDB    → 🏪 ショップ検索メニュー  
👆 アンケート    → 📋 アンケート開始（3問）
👆 旅行計画      → ✈️ 旅行計画サポート案内
👆 海況情報      → 🌊 海況・天気情報
👆 ヘルプ        → ❓ 使い方ガイド
```

---

## 🛠️ トラブルシューティング

### **よくある問題と解決方法**

#### **画像サイズエラー**
```bash
# 画像サイズ確認
file assets/rich-menu-v28.jpg
# → 2500x1686 JPEG でない場合は再作成
```

#### **アップロードエラー**
- ファイルサイズ1MB以下確認
- JPEG形式確認（PNG不可）
- ファイル名の正確性確認

#### **Bot応答なし**
```bash
# ログ確認
tail -f logs/jiji-bot.log

# 環境変数確認
echo $LINE_CHANNEL_ACCESS_TOKEN
```

---

## ⏱️ 作業時間目安

- **画像作成**: 10-15分
- **LINE設定**: 10-15分  
- **システムセットアップ**: 5-10分
- **動作確認**: 10-15分

**合計**: 約45分で完了

---

## 🎯 完了後の確認項目

- [ ] リッチメニュー画像表示OK
- [ ] 6つの全ボタン動作OK  
- [ ] アンケート機能動作OK
- [ ] マッチング機能動作OK
- [ ] ログにエラーなし

これで Dive Buddy's の v2.8 アンケートシステムが完全稼働します！