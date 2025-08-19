# 🎨 **Dive Buddy's UIコンポーネント辞書**

**作成日**: 2025年8月6日  
**目的**: Claude Codeによる効率的で正確なUI修正のための標準コンポーネント定義  
**使用方法**: 修正指示時に「○○コンポーネントを適用」と指定

---

## 📋 **ボタンコンポーネント**

### **🔵 Primary Button (button-primary)**
```css
/* 適用クラス: .btn-primary */
background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
color: var(--color-white);
padding: var(--spacing-3) var(--spacing-6);  /* 12px 24px */
border-radius: var(--border-radius-lg);       /* 8px */
font-size: var(--font-size-base);
font-weight: var(--font-weight-medium);
transition: var(--transition-base);
min-height: 44px;  /* アクセシビリティ対応 */
```
**使用例**: メインアクション、CTA、重要な操作
**適用ファイル**: `/public/css/common.css` line 140-155

---

### **🟢 LINE Button (button-line)**
```css
/* 適用クラス: .btn-line-connect */
background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
color: var(--color-white);
padding: var(--spacing-3) var(--spacing-6);
border-radius: var(--border-radius-lg);
```
**使用例**: LINE公式アカウント登録、LINE連携機能
**特殊機能**: 💬アイコン自動表示

---

### **⚪ Secondary Button (button-secondary)**
```css
/* 適用クラス: .btn-secondary */
background: transparent;
border: 2px solid var(--color-primary);
color: var(--color-primary);
padding: var(--spacing-3) var(--spacing-6);
border-radius: var(--border-radius-lg);
```
**使用例**: サブアクション、キャンセル、戻る

---

### **🔶 Outline Button (button-outline)**
```css
/* 適用クラス: .btn-outline */
background: transparent;
border: 1px solid var(--color-gray-300);
color: var(--color-gray-700);
padding: var(--spacing-3) var(--spacing-6);
border-radius: var(--border-radius-lg);
```
**使用例**: 軽微なアクション、フィルターボタン

---

### **📐 Size Variants**
- **Large**: `.btn-large` - padding: 18px 36px
- **Small**: `.btn-small` - padding: 8px 16px
- **Full Width**: `.btn-full` - width: 100%

---

## 📊 **レイアウトコンポーネント**

### **📱 Responsive Grid (layout-grid)**
```css
/* 適用クラス: .responsive-grid */
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: var(--spacing-6);
padding: var(--spacing-4);
```
**使用例**: カード一覧、ショップ一覧表示

---

### **🎯 Center Content (layout-center)**
```css
/* 適用クラス: .center-content */
max-width: 1200px;
margin: 0 auto;
padding: 0 var(--spacing-4);
```
**使用例**: メインコンテンツ領域、セクションの中央寄せ

---

### **📚 Mobile Stack (layout-mobile-stack)**
```css
/* 適用クラス: .mobile-stack */
@media (max-width: 768px) {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
}
```
**使用例**: PC横並び → スマホ縦積みレイアウト

---

## 🎭 **カードコンポーネント**

### **🏪 Shop Card (card-shop)**
```css
/* 適用クラス: .shop-card */
background: var(--color-white);
border-radius: var(--border-radius-xl);
box-shadow: var(--shadow-md);
overflow: hidden;
transition: var(--transition-base);
```
**構成要素**:
- `.shop-card-header` - 店舗画像エリア
- `.shop-card-body` - 店舗情報エリア
- `.shop-card-footer` - ボタンエリア

---

### **📰 Blog Card (card-blog)**
```css
/* 適用クラス: .blog-card */
background: var(--color-white);
border-radius: var(--border-radius-lg);
box-shadow: var(--shadow-base);
overflow: hidden;
```
**構成要素**:
- `.blog-card-image` - アイキャッチ画像
- `.blog-card-content` - 記事タイトル・概要
- `.blog-card-meta` - 日付・カテゴリ

---

## 🎨 **フォームコンポーネント**

### **📝 Input Field (form-input)**
```css
/* 適用クラス: .form-input */
width: 100%;
padding: var(--spacing-3);
border: 1px solid var(--color-gray-300);
border-radius: var(--border-radius-md);
font-size: var(--font-size-base);
transition: var(--transition-fast);
```
**States**:
- `:focus` - border-color: var(--color-primary)
- `.error` - border-color: var(--color-error)
- `.success` - border-color: var(--color-success)

---

### **⭐ Star Rating (form-star-rating)**
```css
/* 適用クラス: .star-button */
background: none;
border: none;
color: var(--color-gray-300);
font-size: 1.5rem;
cursor: pointer;
transition: var(--transition-fast);
```
**States**:
- `.active` - color: #fbbf24 (金色)
- `:hover` - color: #fbbf24

---

## 🧭 **ナビゲーションコンポーネント**

### **📱 Main Header (nav-header)**
```css
/* 適用クラス: .main-header */
background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
position: sticky;
top: 0;
z-index: var(--z-index-sticky);
box-shadow: var(--shadow-md);
```
**構成要素**:
- `.main-nav` - ナビゲーションコンテナ
- `.main-logo` - ロゴエリア
- `.main-nav-buttons` - ボタンエリア

---

### **🔗 Breadcrumb (nav-breadcrumb)**
```css
/* 適用クラス: .breadcrumb */
display: flex;
align-items: center;
gap: var(--spacing-2);
font-size: var(--font-size-sm);
color: var(--color-gray-600);
```

---

## 🎪 **モーダル・オーバーレイコンポーネント**

### **💬 Modal Dialog (modal-dialog)**
```css
/* 適用クラス: .modal-overlay */
position: fixed;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(0,0,0,0.5);
z-index: var(--z-index-modal);
```

---

## 📐 **ユーティリティクラス**

### **🎨 Text Utilities**
- `.text-center` - 中央揃え
- `.text-left` - 左揃え
- `.text-right` - 右揃え
- `.text-primary` - プライマリーカラー
- `.text-gray` - グレーテキスト
- `.text-error` - エラーカラー

### **📏 Spacing Utilities**
- `.mb-4` - margin-bottom: var(--spacing-4)
- `.mt-6` - margin-top: var(--spacing-6)
- `.p-4` - padding: var(--spacing-4)
- `.px-6` - padding-left/right: var(--spacing-6)
- `.py-8` - padding-top/bottom: var(--spacing-8)

### **📱 Display Utilities**
- `.hidden-mobile` - スマホで非表示
- `.hidden-desktop` - PCで非表示
- `.flex-center` - display: flex; justify-content: center; align-items: center;

---

## 🎯 **使用方法・指示例**

### **✅ 正しい指示例**
```
「/public/index.html の line 145-160 にある3つのボタンに button-primary コンポーネントを適用」

「/public/shops-database/index.html の .search-results エリアに layout-grid コンポーネントを適用」

「/public/blog.html の記事カード部分に card-blog コンポーネントを適用」
```

### **❌ 避けるべき指示例**
```
「ボタンを青くして」
「カードをきれいにして」  
「レスポンシブにして」
```

---

## 🔄 **更新履歴**

**v1.0 (2025年8月6日)**
- 初回作成
- 基本コンポーネント15種類定義
- デザイントークン連携完了

**更新ルール**: 新規コンポーネント追加時は v1.1, v1.2... でバージョンアップ

---

## 📁 **関連ファイル**
- **デザイントークン**: `/css/design-tokens.css`
- **共通スタイル**: `/public/css/common.css`
- **修正指示テンプレート**: `/docs/ui-modification-template.md`

---

**🎨 このコンポーネント辞書により、Claude Codeとの効率的で正確なUI修正が可能になります！**