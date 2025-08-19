# 🌐 dive-buddys.com ドメイン設定ガイド

**実装日**: 2025年7月27日  
**ステータス**: 設定準備完了  
**対象**: INTEGRATION-002 カスタムドメイン統合  

---

## 📋 **実装済み内容**

### **✅ 1. Railway設定ファイル**
- `railway.toml` - カスタムドメイン設定
- HTTPS強制リダイレクト
- セキュリティヘッダー設定

### **✅ 2. アプリケーション設定**
```javascript
// 本番環境自動判定
const isProduction = process.env.NODE_ENV === 'production';
const DOMAIN = isProduction ? 'dive-buddys.com' : 'localhost:3000';
const BASE_URL = `${PROTOCOL}://${DOMAIN}`;
```

### **✅ 3. セキュリティ強化**
- HTTPSリダイレクト
- HSTS（Strict-Transport-Security）
- XSS保護
- クリックジャッキング対策

---

## 🚀 **Railway ダッシュボードでの設定手順**

### **Step 1: プロジェクトアクセス**
1. [Railway ダッシュボード](https://railway.app/dashboard) にログイン
2. `jiji-diving-bot` プロジェクトを選択

### **Step 2: カスタムドメイン追加**
1. **Settings** → **Domains** セクション
2. **Add Domain** をクリック
3. ドメインを追加：
   ```
   dive-buddys.com
   www.dive-buddys.com
   ```

### **Step 3: DNS設定**
Railway が提供するCNAMEレコードを設定：

**ドメイン管理画面で以下を設定:**
```dns
Type: CNAME
Name: @
Value: [Railway提供のCNAME]

Type: CNAME  
Name: www
Value: [Railway提供のCNAME]
```

### **Step 4: SSL証明書**
- Railway が Let's Encrypt で自動発行
- 設定後5-10分で有効化

---

## 🔄 **変更点まとめ**

### **開発環境 → 本番環境**

| 項目 | 開発環境 | 本番環境 |
|------|----------|----------|
| **ベースURL** | `http://localhost:3000` | `https://dive-buddys.com` |
| **管理画面** | `/admin/dashboard.html` | `/admin/dashboard` |
| **記事作成** | `/admin/blog-editor.html` | `/admin/blog-editor` |
| **記事管理** | `/admin/blog-list.html` | `/admin/blog-list` |
| **プロトコル** | HTTP | HTTPS（強制） |
| **セキュリティ** | 基本 | 強化（HSTS等） |

### **API エンドポイント**
すべて相対パスのため変更不要：
```
/api/blog/articles
/api/shops
/api/weather
etc...
```

---

## 🔧 **必要な作業**

### **✅ 完了済み**
- [x] Railway設定ファイル作成
- [x] HTTPS リダイレクト実装
- [x] セキュリティヘッダー設定
- [x] 環境別URL設定

### **⚠️ Railway ダッシュボードで要実行**
- [ ] カスタムドメイン追加
- [ ] DNS CNAME設定
- [ ] SSL証明書確認

### **⚠️ ドメイン管理者側で要実行**
- [ ] dive-buddys.com のDNS設定
- [ ] CNAME レコード追加

---

## 🧪 **デプロイ後の確認**

### **1. 基本動作確認**
```bash
# ヘルスチェック
curl https://dive-buddys.com/api/health

# HTTPSリダイレクト確認
curl -I http://dive-buddys.com
# → Location: https://dive-buddys.com
```

### **2. セキュリティヘッダー確認**
```bash
curl -I https://dive-buddys.com
# → Strict-Transport-Security: max-age=31536000; includeSubDomains
# → X-Content-Type-Options: nosniff
# → X-Frame-Options: DENY
```

### **3. 管理画面アクセス確認**
```
https://dive-buddys.com/admin/dashboard
https://dive-buddys.com/admin/blog-editor
https://dive-buddys.com/admin/blog-list
```

---

## 📊 **主要ページ URL 一覧**

### **フロントエンド**
```
https://dive-buddys.com/                    # ホーム
https://dive-buddys.com/about              # サービス概要
https://dive-buddys.com/shops-database     # ショップDB
https://dive-buddys.com/travel-guide       # 旅行ガイド
https://dive-buddys.com/weather-ocean      # 海況情報
https://dive-buddys.com/member             # 会員システム
```

### **管理画面**
```
https://dive-buddys.com/admin/dashboard     # ダッシュボード
https://dive-buddys.com/admin/blog-editor   # 記事作成
https://dive-buddys.com/admin/blog-list     # 記事管理
```

### **API**
```
https://dive-buddys.com/api/health          # ヘルスチェック
https://dive-buddys.com/api/blog/articles   # ブログAPI
https://dive-buddys.com/api/shops           # ショップAPI
https://dive-buddys.com/api/weather         # 気象API
```

---

## 🔐 **セキュリティ設定詳細**

### **HTTPS 強制**
```javascript
// すべてのHTTPリクエストをHTTPSにリダイレクト
if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
}
```

### **セキュリティヘッダー**
```javascript
// HSTS - HTTPS強制記憶（1年間）
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'

// MIME タイプ推測防止
'X-Content-Type-Options': 'nosniff'

// フレーム埋め込み防止
'X-Frame-Options': 'DENY'

// XSS攻撃防止
'X-XSS-Protection': '1; mode=block'

// リファラー制御
'Referrer-Policy': 'strict-origin-when-cross-origin'
```

---

## 🎯 **次のステップ**

1. **Railway ダッシュボードでドメイン設定**
2. **DNS CNAME レコード設定**
3. **SSL証明書有効化確認**
4. **本番環境動作テスト**
5. **ユーザーへの切り替え案内**

---

**🌊 dive-buddys.com での本格運用開始準備完了！**