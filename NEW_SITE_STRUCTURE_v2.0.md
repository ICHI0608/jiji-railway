# 🌊 Dive Buddy's 新サイト構造 v2.0

**作成日**: 2025年8月19日  
**プロジェクト**: Jiji Diving Bot  
**ベースページ**: index_ui_check.html  
**ステータス**: 設計完了・実装準備完了

---

## 📋 新導線v2.0 - ページURL一覧

### **🏠 メインページ（高優先 - 即時実装）**

| # | URL | ステータス | 説明 |
|---|-----|-----------|------|
| 1 | `https://dive-buddys.com/` | ✅ 調整完了 | Topページ（ベース: index_ui_check.html） |
| 2 | `https://dive-buddys.com/about` | 🔄 機能拡充予定 | サービス概要詳細説明 |
| 3 | `https://dive-buddys.com/member/register` | ✅ 実装済み | 会員登録ページ |
| 4 | `https://dive-buddys.com/shops-database` | ✅ 実装済み | ショップ検索ページ |

### **🌊 新規作成ページ（中優先 - 段階実装）**

| # | URL | ステータス | 説明 |
|---|-----|-----------|------|
| 5 | `https://dive-buddys.com/diving-guide` | 🆕 新規作成予定 | 沖縄ガイドメイン - ダイブポイント紹介 |
| 6 | `https://dive-buddys.com/diving-guide/ishigaki` | 🆕 新規作成予定 | 石垣島特化ガイド |
| 7 | `https://dive-buddys.com/diving-guide/miyako` | 🆕 新規作成予定 | 宮古島特化ガイド |
| 8 | `https://dive-buddys.com/diving-guide/okinawa` | 🆕 新規作成予定 | 沖縄本島特化ガイド |

### **🌤️ 機能強化ページ（中優先 - 段階実装）**

| # | URL | ステータス | 説明 |
|---|-----|-----------|------|
| 9 | `https://dive-buddys.com/weather-ocean` | 🔄 機能強化予定 | 海況天気（3日間リアルタイム表示） |
| 10 | `https://dive-buddys.com/weather-ocean/details` | 🆕 新規作成予定 | 海況詳細ページ |
| 11 | `https://dive-buddys.com/travel-guide` | 🔄 機能強化予定 | 旅行ガイド（チケット検索機能） |

### **📚 既存ページ（後回し可能）**

| # | URL | ステータス | 説明 |
|---|-----|-----------|------|
| 12 | `https://dive-buddys.com/blog` | ✅ 実装済み | ブログ記事一覧 |
| 13 | `https://dive-buddys.com/member/dashboard` | ✅ 実装済み | 会員マイページ |
| 14 | `https://dive-buddys.com/shop/dashboard` | ✅ 実装済み | パートナーショップ管理 |

---

## 🎨 各ページUI現状確認

### **1. 📱 Topページ (index_ui_check.html)**
**✅ 完成度: 98% - 新導線v2.0対応完了**

```html
<!-- 主要UI構成 -->
- ヒーロー画像: TOP.png「沖縄の海で新しい自分に出会う」
- メインテキスト: 画面左1/4位置、文字間隔調整済み
- CTAボタン: 
  - 「ダイビングショップを探す」（水色枠）
  - 「Jijiに相談する」（緑色塗りつぶし）
- アイコンナビゲーション: 7ボタン配置（3×3グリッド）
  1. ショップ検索 2. 海況情報 3. 沖縄ガイド（🆕新追加）
  4. 旅行プランニング 5. ダイビング情報 6. 会員サービス 7. ショップ向け
- サブテキスト: 「沖縄ダイビングショップ 紹介サイト」（右下配置）
- レスポンシブ対応: デスクトップ・タブレット・モバイル完全対応
```

### **2. 🔍 ショップ検索ページ**
**✅ 実装済み - design-system.css適用**

```html
<!-- 機能構成 -->
- 検索フィルタ: 地域・評価・価格帯・安全認証レベル
- 表示形式: カード形式のショップ一覧
- ソート機能: 評価順・距離順・価格順
- 詳細ページ: shops-database/details.html
- データベース: 79店舗×38項目の詳細情報
```

### **3. 🌊 海況天気ページ**
**🔄 基本実装済み - リアルタイム機能強化予定**

```html
<!-- 現在の機能 -->
- 3地域対応: 宮古島・石垣島・沖縄本島
- 気象庁API連携準備済み
- 基本UI: weather-ocean/index.html

<!-- 強化予定機能 -->
- 3日間リアルタイム表示
- ダイビング適性自動判定
- 詳細ページ: weather-ocean/details.html
```

### **4. 👥 会員・管理系ページ**
**✅ 実装済み - 統一デザインシステム適用**

```html
<!-- 会員システム -->
- 登録: member/register.html
- ログイン: member/login.html
- ダッシュボード: member/dashboard.html
- プロフィール: member/profile.html

<!-- 管理システム -->
- ショップ管理: shop/dashboard.html
- 分析画面: admin/analytics.html
```

---

## 🆕 新規作成が必要なページ詳細

### **diving-guideシリーズ（4ページ）**

#### **1. /diving-guide/index.html - メインページ**
```html
<!-- ページ構成案 -->
<section class="hero-section">
  <!-- 沖縄全体のダイビング概要 -->
</section>

<section class="region-selection">
  <!-- 地域別リンク -->
  <div class="region-card">石垣島</div>
  <div class="region-card">宮古島</div>
  <div class="region-card">沖縄本島</div>
</section>

<section class="popular-spots">
  <!-- おすすめポイントランキング -->
</section>
```

#### **2. /diving-guide/ishigaki.html - 石垣島特化**
```html
<!-- コンテンツ構成 -->
- マンタポイント詳細（川平石崎マンタスクランブル等）
- 季節別ベストダイビング情報
- 石垣島ショップリンク（shops-database連携）
- 地形ダイビング・ドリフト情報
- アクセス・宿泊情報
```

#### **3. /diving-guide/miyako.html - 宮古島特化**
```html
<!-- コンテンツ構成 -->
- 地形ダイビング特化（通り池・魔王の宮殿等）
- 八重干瀬情報
- 宮古島ショップリンク
- 透明度・海洋生物情報
```

#### **4. /diving-guide/okinawa.html - 沖縄本島特化**
```html
<!-- コンテンツ構成 -->
- 青の洞窟・慶良間諸島
- 初心者向けポイント
- 本島ショップリンク
- アクセス情報（那覇から各ポイント）
```

### **weather-ocean/details.html - 海況詳細ページ**
```html
<!-- 機能構成 -->
<section class="weekly-forecast">
  <!-- 7日間詳細予報 -->
</section>

<section class="marine-conditions">
  <!-- 海況詳細（波高・潮位・透明度予測） -->
</section>

<section class="diving-assessment">
  <!-- ダイビング適性自動判定 -->
</section>

<section class="regional-comparison">
  <!-- 3地域比較表 -->
</section>
```

---

## 🔄 ユーザー導線フロー

### **情報収集フェーズ**
```
Topページ（7ボタン） → サービス概要 → 沖縄ガイド/海況天気/ブログ
     ↓
「沖縄ガイド」ボタン → diving-guide → 地域別詳細
```

### **検討・比較フェーズ**
```
ショップ検索 → 詳細比較 → 旅行ガイド（宿泊・交通手配）
     ↓
海況天気チェック → 詳細ページで最終確認
```

### **行動フェーズ**
```
会員登録 → ショップ予約 → 会員ページでの管理
```

### **継続利用フェーズ**
```
会員ページ → ダイビング履歴 → レビュー投稿 → ポイント活用
```

---

## 📊 実装統計

### **現在の状況**
- **総ページ数**: 52ページ（+5ページ増加）
- **実装済み**: 45ページ（86.5%）
- **調整完了**: 1ページ（index_ui_check.html）
- **機能拡充予定**: 3ページ（about, weather-ocean, travel-guide）
- **新規作成予定**: 5ページ（diving-guide×4 + weather-ocean/details）

### **開発工数見積もり**
- **新規ページ作成**: 5ページ × 8時間 = 40時間
- **機能拡充**: 3ページ × 4時間 = 12時間
- **テスト・調整**: 10時間
- **合計**: 約62時間（約8営業日）

---

## 🚀 実装ロードマップ

### **Phase 1: 基盤整備（2週間）**
1. ✅ Topページ完成（index_ui_check.html - 7ボタン配置完了）
2. 🔄 サービス概要ページ拡充（about.html）
3. 🆕 diving-guide/index.html作成

### **Phase 2: コンテンツ拡充（3週間）**
1. 🆕 diving-guide地域別ページ作成（ishigaki, miyako, okinawa）
2. 🔄 海況天気のリアルタイム化
3. 🆕 weather-ocean/details.html作成

### **Phase 3: 機能強化・最適化（2週間）**
1. 🔄 travel-guideのチケット検索機能
2. 📱 レスポンシブ対応完全化
3. ⚡ ページ表示速度改善・SEO対策

---

## 🎯 成功指標（KPI）

### **ユーザー行動指標**
- **Topページ滞在時間**: 30秒以上
- **7ボタンクリック率**: 各20%以上
- **diving-guide閲覧率**: 40%以上（新ボタン効果）
- **ショップ検索利用率**: 60%以上
- **会員登録率**: 15%以上

### **コンバージョン指標**
- **ショップ予約完了率**: 25%以上
- **旅行ガイド利用率**: 35%以上
- **リピート利用率**: 40%以上

---

## 📁 関連ファイル

### **設計ドキュメント**
- `docs/site-navigation-design-v2.md` - 詳細導線設計
- `docs/url-complete-list.md` - URL一覧（v2.0更新済み）
- `NEW_SITE_STRUCTURE_v2.0.md` - 本ファイル

### **アーカイブ済み**
- `archive/old-docs-detailed/url-complete-list_v1.md` - 旧URL一覧
- `archive/old-docs-detailed/website-structure-chart_v1.html` - 旧サイト構造

### **実装基準**
- `public/index_ui_check.html` - Topページベース
- `css/design-system.css` - 統一デザインシステム
- `src/server.js` - バックエンド機能

---

**📝 備考**:
- 新導線v2.0は実用性と開発効率を重視した設計
- 既存リソースを最大活用しつつ、5ページのみ新規作成
- 統一されたUI/UXでユーザビリティ向上
- 段階的実装により、早期リリース・継続改善が可能

---

**最終更新**: 2025年8月19日  
**次回レビュー**: Phase 1完了時