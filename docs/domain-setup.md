# 🌐 dive-buddys.com ドメイン統合設定ガイド

## 📋 **設定概要**

**目標**: Railway プロジェクトを `dive-buddys.com` で公開し、SSL証明書を適用してセキュアなアクセスを実現する

**作成日**: 2025年7月29日  
**更新日**: 2025年7月29日  
**バージョン**: v1.0  

---

## 🚀 **Phase 1: Railway カスタムドメイン設定**

### **Step 1: Railway プロジェクト設定**

1. Railway ダッシュボードにログイン
2. `jiji-diving-bot` プロジェクトを選択
3. `Settings` → `Domains` に移動
4. `Add Custom Domain` をクリック
5. ドメイン名 `dive-buddys.com` を入力
6. 同様に `www.dive-buddys.com` も追加

### **Step 2: DNS設定確認**

Railway から提供されるDNS設定情報:
```
Type: CNAME
Name: @
Value: [railway-generated-domain].railway.app

Type: CNAME  
Name: www
Value: [railway-generated-domain].railway.app
```

### **Step 3: SSL証明書の自動発行**

- Railway は Let's Encrypt を使用して自動的にSSL証明書を発行
- DNS設定完了後、数分〜数時間で証明書が有効化
- `https://dive-buddys.com` でアクセス可能になる

---

## 🛠 **Phase 2: アプリケーション設定更新**

### **環境変数の更新**

```javascript
// admin-app.js 内の設定更新
const DOMAIN = process.env.CUSTOM_DOMAIN || 'dive-buddys.com';
const BASE_URL = process.env.NODE_ENV === 'production' ? `https://${DOMAIN}` : 'http://localhost:3000';
```

### **CORS設定の更新**

```javascript
// CORS設定にカスタムドメインを追加
app.use(cors({
    origin: [
        'https://dive-buddys.com',
        'https://www.dive-buddys.com',
        'http://localhost:3000' // 開発環境用
    ],
    credentials: true
}));
```

### **セキュリティヘッダーの追加**

```javascript
// セキュリティヘッダー設定
app.use((req, res, next) => {
    // HSTS (HTTP Strict Transport Security)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self' https://dive-buddys.com");
    
    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY');
    
    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    next();
});
```

---

## 🔄 **Phase 3: リダイレクト設定**

### **HTTP → HTTPS リダイレクト**

```javascript
// HTTPS強制リダイレクト
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
        next();
    }
});
```

### **WWW リダイレクト設定**

```javascript
// www.dive-buddys.com → dive-buddys.com リダイレクト
app.use((req, res, next) => {
    if (req.header('host') === 'www.dive-buddys.com') {
        res.redirect(301, `https://dive-buddys.com${req.url}`);
    } else {
        next();
    }
});
```

### **古いURLからの301リダイレクト**

```javascript
// Railway デフォルトドメインからのリダイレクト
app.use((req, res, next) => {
    const host = req.header('host');
    if (host && host.includes('railway.app')) {
        res.redirect(301, `https://dive-buddys.com${req.url}`);
    } else {
        next();
    }
});
```

---

## 📱 **Phase 4: モバイル・SEO最適化**

### **メタタグの更新**

```html
<!-- 全ページ共通メタタグ -->
<meta property="og:url" content="https://dive-buddys.com/">
<meta property="og:site_name" content="Dive Buddy's">
<link rel="canonical" href="https://dive-buddys.com/">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png">
```

### **Sitemapの更新**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://dive-buddys.com/</loc>
        <lastmod>2025-07-29</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://dive-buddys.com/shops-database</loc>
        <lastmod>2025-07-29</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.9</priority>
    </url>
    <!-- 他のページも同様に追加 -->
</urlset>
```

---

## ✅ **Phase 5: 設定確認・テスト**

### **DNS伝播確認**

```bash
# DNS設定の確認
nslookup dive-buddys.com
nslookup www.dive-buddys.com

# SSL証明書の確認
openssl s_client -connect dive-buddys.com:443 -servername dive-buddys.com
```

### **動作テスト項目**

- [ ] `https://dive-buddys.com` にアクセス可能
- [ ] `https://www.dive-buddys.com` から `dive-buddys.com` にリダイレクト
- [ ] HTTP から HTTPS に自動リダイレクト
- [ ] SSL証明書が有効（グリーンロック表示）
- [ ] 全ページが正常に動作
- [ ] API エンドポイントが正常に動作
- [ ] ショップ詳細ページの画像表示
- [ ] 会員登録・ログイン機能
- [ ] LINE Bot連携機能

### **パフォーマンステスト**

- [ ] Google PageSpeed Insights でスコア確認
- [ ] モバイル表示の確認
- [ ] 各種ブラウザでの動作確認（Chrome, Firefox, Safari, Edge）

---

## 🚨 **トラブルシューティング**

### **よくある問題と解決方法**

1. **DNS設定が反映されない**
   - TTL設定を確認（通常24-48時間で完全伝播）
   - DNS キャッシュをクリア: `ipconfig /flushdns` (Windows) / `sudo dscacheutil -flushcache` (Mac)

2. **SSL証明書が発行されない**
   - DNS設定が正しいか確認
   - Railway ダッシュボードでドメイン検証状態を確認
   - CAA レコードが Let's Encrypt を許可しているか確認

3. **リダイレクトループが発生**
   - `x-forwarded-proto` ヘッダーの確認
   - Railway のプロキシ設定確認

4. **CORS エラーが発生**
   - 許可オリジンに新しいドメインが含まれているか確認
   - プリフライトリクエストの処理確認

---

## 📊 **設定完了チェックリスト**

### **Railway設定**
- [ ] カスタムドメイン `dive-buddys.com` 追加
- [ ] カスタムドメイン `www.dive-buddys.com` 追加  
- [ ] SSL証明書自動発行完了
- [ ] ドメイン検証完了

### **DNS設定**
- [ ] A/CNAME レコード設定完了
- [ ] DNS伝播完了確認
- [ ] TTL設定適切

### **アプリケーション設定**
- [ ] CORS設定更新
- [ ] セキュリティヘッダー追加
- [ ] リダイレクト設定実装
- [ ] 環境変数更新

### **SEO・メタデータ**
- [ ] 全ページのcanonical URL更新
- [ ] OGPメタタグ更新
- [ ] Sitemap.xml作成・更新
- [ ] robots.txt確認

### **テスト・確認**
- [ ] 全機能動作テスト完了
- [ ] パフォーマンステスト完了
- [ ] セキュリティテスト完了
- [ ] モバイル対応確認完了

---

## 🎯 **完成目標**

- **メインURL**: `https://dive-buddys.com`
- **SSL証明書**: Let's Encrypt (自動更新)
- **パフォーマンス**: PageSpeed Insights 90+
- **セキュリティ**: A+ SSL Labs Rating
- **SEO**: 完全な構造化データ対応

---

**🌊 この設定により、Dive Buddy's が本格的なWebサービスとして dive-buddys.com で運用開始されます！**