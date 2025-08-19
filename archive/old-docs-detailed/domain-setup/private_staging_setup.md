# 🔒 非公開ステージング環境設定ガイド

**実装日**: 2025年7月27日  
**ステータス**: 非公開テスト環境  
**目的**: 本番公開前のテスト・検証  

---

## 📋 **非公開環境の特徴**

### **✅ 実装済み機能**
- Railway提供の非公開URLでアクセス
- 検索エンジンからの除外（noindex設定）
- HTTPS・セキュリティヘッダー完備
- 管理画面・API機能完全動作
- 本番環境と同等のテスト可能

### **🔒 アクセス制御**
```javascript
// 環境変数による制御
NODE_ENV=staging
SITE_STATUS=private

// 検索エンジン除外
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
```

---

## 🚀 **Railway でのセットアップ手順**

### **Step 1: ステージング環境作成**
1. Railway ダッシュボード → プロジェクト選択
2. **Environments** タブ → **New Environment**
3. 環境名: `staging`

### **Step 2: 環境変数設定**
ステージング環境で以下を設定:
```
NODE_ENV=staging
SITE_STATUS=private
```

### **Step 3: デプロイ確認**
- 自動デプロイ完了を確認
- Railway提供URLでアクセステスト

---

## 🌐 **アクセス可能URL（非公開）**

### **推定ステージングURL**
```
https://jiji-diving-bot-staging.railway.app/
```
※実際のURLはRailway環境により自動生成

### **主要ページ**
```
# フロントエンド
https://[staging-url]/                    # ホーム
https://[staging-url]/about              # サービス概要
https://[staging-url]/shops-database     # ショップDB
https://[staging-url]/travel-guide       # 旅行ガイド
https://[staging-url]/weather-ocean      # 海況情報

# 管理画面（テスト用）
https://[staging-url]/admin/dashboard    # ダッシュボード
https://[staging-url]/admin/blog-editor  # 記事作成
https://[staging-url]/admin/blog-list    # 記事管理

# API
https://[staging-url]/api/health         # ヘルスチェック
https://[staging-url]/api/blog/articles  # ブログAPI
https://[staging-url]/api/shops          # ショップAPI
```

---

## 🧪 **テスト項目チェックリスト**

### **🔧 システム動作**
- [ ] ヘルスチェック（/api/health）
- [ ] HTTPS リダイレクト動作
- [ ] セキュリティヘッダー設定確認
- [ ] 静的ファイル配信確認

### **📝 ブログ管理システム**
- [ ] 記事作成ページ動作
- [ ] 記事保存・API連携
- [ ] 記事管理リスト表示
- [ ] プレビュー機能
- [ ] カテゴリ・タグ管理

### **🏪 ショップデータベース**
- [ ] ショップ検索機能
- [ ] 詳細ページ表示
- [ ] フィルター・ソート機能
- [ ] レスポンシブ対応

### **✈️ 旅行ガイド**
- [ ] 航空券検索・比較
- [ ] 交通ルート検索
- [ ] エリア別ガイド表示
- [ ] 予算計算ツール

### **🌊 海況・天気**
- [ ] 気象データ取得
- [ ] エリア別海況情報
- [ ] ダイビング適性判定

---

## 📊 **テスト用コマンド**

### **基本動作確認**
```bash
# ヘルスチェック
curl https://[staging-url]/api/health

# セキュリティヘッダー確認
curl -I https://[staging-url]

# API テスト
curl https://[staging-url]/api/blog/articles?limit=5
curl https://[staging-url]/api/shops?limit=3
```

### **管理画面テスト**
```bash
# 記事作成API
curl -X POST https://[staging-url]/api/blog/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "テスト記事",
    "excerpt": "テスト用の記事です",
    "content": "これはテスト記事の内容です。",
    "category": "diving_spots",
    "tags": ["石垣島", "テスト"]
  }'
```

---

## 🔍 **検証ポイント**

### **1. パフォーマンス**
- ページ読み込み速度 < 3秒
- API レスポンス時間 < 1秒
- 画像最適化確認

### **2. セキュリティ**
- HTTPS 強制リダイレクト
- セキュリティヘッダー設定
- XSS・CSRF対策

### **3. 機能性**
- 全ページの表示確認
- 管理画面操作確認
- API エンドポイント動作確認
- エラーハンドリング確認

### **4. ユーザビリティ**
- レスポンシブデザイン
- ナビゲーション動作
- フォーム入力・バリデーション

---

## 📱 **モバイル対応確認**

### **画面サイズテスト**
- スマートフォン（375px〜）
- タブレット（768px〜）
- デスクトップ（1024px〜）

### **操作確認**
- タッチ操作
- スクロール
- フォーム入力
- ボタン操作

---

## 🚨 **トラブルシューティング**

### **よくある問題**

**1. 500エラーが発生**
```bash
# ログ確認
railway logs --environment=staging
```

**2. 環境変数が反映されない**
```bash
# 環境変数確認
railway variables --environment=staging
```

**3. 静的ファイルが読み込めない**
- パス設定確認
- ファイル存在確認
- MIMEタイプ確認

---

## 📈 **次のステップ**

### **テスト完了後**
1. **バグ修正・改善実装**
2. **パフォーマンス最適化**
3. **本番環境設定準備**
4. **dive-buddys.com 公開準備**

### **本番公開時の作業**
1. **Railway環境変数変更**:
   ```
   NODE_ENV=production
   SITE_STATUS=public
   ```
2. **カスタムドメイン有効化**
3. **DNS設定実行**
4. **最終動作確認**

---

## 🎯 **現在の状況**

**✅ 完了**:
- ステージング環境コード実装
- セキュリティ設定
- 非公開アクセス制御

**⚠️ Railway で要実行**:
- ステージング環境作成
- 環境変数設定（NODE_ENV=staging, SITE_STATUS=private）
- デプロイ確認

**🔜 次回**:
- 全機能テスト実行
- 問題点の洗い出し
- 本番公開準備

---

**🔒 非公開環境でのテスト開始準備完了！**  
**Railway ダッシュボードでステージング環境を作成してください。**