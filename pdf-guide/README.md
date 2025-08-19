# Dive Buddy's PDF生成ガイド

## 📋 作業手順

### 1. ページインデックス確認
`/Users/ymacbookpro/jiji-diving-bot/pdf-guide/page-index.html` をブラウザで開く

### 2. 各ページのPDF生成
1. 「ページを開く」リンクをクリック
2. ブラウザメニュー → 印刷
3. 「PDFとして保存」を選択
4. ファイル名: `01_トップページ.pdf` の形式で保存

### 3. PDF設定推奨値
- **用紙サイズ**: A4
- **マージン**: 最小 (0.5cm程度)
- **背景**: ON (背景グラフィック印刷)
- **倍率**: 100% または 収まるように調整

## 📝 対象ページ一覧 (23ページ)


### メイン (5ページ)
- 01_トップページ → `public/index.html`
- 01b_メインページUI → `public/index_ui_check.html`
- 02_サービス概要 → `public/about.html`
- 03_初心者向け → `public/beginner.html`
- 04_お問い合わせ → `public/contact.html`

### 会員 (4ページ)
- 05_会員マイページ → `public/member/index.html`
- 06_会員登録 → `public/member/register.html`
- 07_ログイン → `public/member/login.html`
- 08_ダッシュボード → `public/member/dashboard.html`

### ショップ (2ページ)
- 09_ショップ検索 → `public/shops-database/index.html`
- 10_ショップ詳細 → `public/shops-database/details.html`

### 機能 (2ページ)
- 11_クリエイター紹介 → `public/diving-creators/index.html`
- 15_海況天気 → `public/weather-ocean/index.html`

### 旅行 (3ページ)
- 12_旅行ガイド → `public/travel-guide/index.html`
- 13_航空券検索 → `public/travel-guide/flights.html`
- 14_宿泊ガイド → `public/travel-guide/accommodation.html`

### ブログ (2ページ)
- 16_ブログTOP → `public/blog.html`
- 17_記事詳細 → `public/blog/article.html`

### 管理 (2ページ)
- 18_管理ダッシュボード → `public/admin/dashboard.html`
- 19_YouTube監視 → `public/admin/youtube-monitoring.html`

### ビジネス (1ページ)
- 20_パートナー → `public/partners.html`

### その他 (2ページ)
- 21_利用規約 → `public/legal.html`
- 22_料金プラン → `public/pricing.html`


## 🎯 修正指示の作成方法

### 推奨ツール
- **PDF注釈**: Adobe Reader、Preview.app等
- **画像編集**: スクリーンショット + 画像編集アプリ
- **手書き**: タブレット + スタイラスペン

### 修正指示のベストプラクティス
1. **赤枠・矢印で明確に指示**
2. **具体的な文字で説明**
3. **優先度を明記** (高・中・低)
4. **全体共通 or 個別ページか明記**

### 修正例
```
🔴 この部分の背景色を薄い青に変更
→ 優先度: 高
→ 全ページ共通

⚡ フォントサイズを18px→24pxに
→ 優先度: 中  
→ このページのみ
```

## 📁 ファイル構成

```
pdf-guide/
├── page-index.html     # ページ一覧（ブラウザで開く）
├── README.md          # このガイド
└── (ここにPDFを保存)
   ├── 01_トップページ.pdf
   ├── 02_サービス概要.pdf
   └── ...
```

---
Generated: 2025/8/14 11:39:25
Dive Buddy's Design System Applied ✅
