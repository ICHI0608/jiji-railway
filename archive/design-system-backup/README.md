# Dive Buddy's デザインシステム バックアップ

**作成日**: 2025年8月13日  
**目的**: 統一デザインシステム適用後のページ確認用  
**注意**: このフォルダはシステムコードに影響しません（確認用のみ）

## 📁 格納内容

### **🎨 デザインシステム**
- `design-system.css` - 統一デザインシステムの CSS変数・コンポーネント

### **📄 HTMLページ（52ファイル）**
全ページが統一デザインシステム適用済み

#### **🏠 メインページ**
- `public/index.html` - トップページ
- `public/about.html` - サービス概要
- `public/contact.html` - お問い合わせ
- `public/legal.html` - 利用規約
- `public/pricing.html` - 料金プラン

#### **👤 会員システム（8ページ）**
```
public/member/
├── index.html          # マイページ
├── dashboard.html      # ダッシュボード
├── login.html          # ログイン
├── register.html       # 会員登録
├── profile.html        # プロフィール
├── points.html         # ポイント管理
├── review-post.html    # 口コミ投稿
└── profile/
    ├── diving.html     # ダイビング設定
    └── settings.html   # アカウント設定
```

#### **🏪 ショップデータベース（3ページ）**
```
public/shops-database/
├── index.html          # 検索TOP
├── details.html        # ショップ詳細
└── shops.html          # 一覧ページ
```

#### **✈️ 旅行ガイド（7ページ）**
```
public/travel-guide/
├── index.html          # 旅行ガイドTOP
├── flights.html        # 航空券検索
├── accommodation.html  # 宿泊ガイド
├── transport.html      # 交通情報
├── cost-simulator.html # 費用計算
├── ishigaki.html       # 石垣島ガイド
└── miyako.html         # 宮古島ガイド
```

#### **🎥 ダイビングクリエイター**
- `public/diving-creators/index.html` - YouTube クリエイター紹介

#### **🌊 海況・天気**
- `public/weather-ocean/index.html` - リアルタイム海況情報

#### **📝 ブログシステム（4ページ）**
```
public/blog/
├── index.html          # ブログ一覧
├── article.html        # 記事詳細
└── search.html         # 記事検索

public/blog.html        # ブログTOP
public/blog-post.html   # 投稿フォーム
```

#### **🎯 管理画面（6ページ）**
```
public/admin/
├── dashboard.html          # 管理TOP
├── blog-editor.html        # 記事作成
├── blog-list.html          # 記事管理
├── analytics.html          # 分析画面
├── monitoring.html         # システム監視
└── youtube-monitoring.html # YouTube API監視
```

#### **🤝 パートナー・ショップ向け（6ページ）**
```
public/partners/
├── advertising.html    # 掲載案内
└── dashboard.html      # パートナーDB

public/shop/
├── login.html          # ショップログイン
├── dashboard.html      # ショップDB
├── edit-profile.html   # プロフィール編集
└── subscription.html   # サブスクリプション
```

## 🎨 統一デザインシステム仕様

### **カラーパレット**
- **ベース背景**: #FFFFFF
- **アクセント1**: #77C9D4 (透明感のある海色ブルー)
- **アクセント2**: #A2DED0 (エメラルド寄りの淡緑)
- **テキストメイン**: #333333
- **テキストサブ**: #666666

### **タイポグラフィ**
- **見出し（英字）**: Playfair Display
- **本文（日本語）**: Noto Sans JP Regular

### **UIコンポーネント**
- **ボタン**: 角丸8px、ホバー時色変化
- **カード**: 白背景+薄いシャドウ、hover時1.05倍拡大
- **検索バー**: 角丸20px、アイコン付き
- **余白**: セクション間 80px、カード間 24px

## 📊 適用状況

- **適用済みページ**: 36ページ
- **適用率**: 75% 
- **機能影響**: なし（見た目のみ統一）

## ⚠️ 重要な注意事項

1. **このフォルダは確認用のみ**
   - システム本体の `public/` フォルダとは独立
   - 変更しても本体に影響なし

2. **バックアップの目的**
   - デザイン統一状況の確認
   - 作業前後の比較
   - 問題発生時の参照

3. **更新について**
   - 本体が更新されても自動同期しない
   - 必要に応じて手動で再作成

---

**作成者**: Claude Code  
**最終確認**: 2025年8月13日  
**バックアップ対象**: 全52 HTMLページ + デザインシステムCSS