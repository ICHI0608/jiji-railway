# 🚨 Railway Supabase API Key エラー修正手順

## 問題概要
- **エラー**: "Invalid API key" 
- **発生環境**: Railway本番環境のみ
- **影響**: 記事作成・取得でSupabase接続失敗

## 修正手順

### 1. Railway Dashboard での環境変数確認
```bash
# Railway CLI確認 (推奨)
railway status
railway variables

# 現在のSupabase設定
SUPABASE_URL=https://mveoxxivgnwnutjacnpv.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Railway 環境変数設定コマンド
```bash
# Railway環境変数を設定
railway variables set SUPABASE_URL=https://mveoxxivgnwnutjacnpv.supabase.co

railway variables set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12ZW94eGl2Z253bnV0amFjbnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwODI2NDEsImV4cCI6MjA2NTY1ODY0MX0.U0KSnnYLauRu6PD8g055D_GtugJAEO7GaA3OcNfON84
```

### 3. 新しいSupabase API Keyの再生成（必要に応じて）
1. https://app.supabase.com にアクセス
2. プロジェクト `mveoxxivgnwnutjacnpv` を選択
3. Settings → API → Project API keys
4. `anon public` key を再生成
5. Railway環境変数を新しいkeyで更新

### 4. デプロイ確認
```bash
# Railway再デプロイ
railway deploy

# ログ確認
railway logs
```

## フォールバック機能
コードにフォールバック機能を実装済み：
- Supabase接続失敗時 → メモリ保存
- API key無効時 → サンプルデータ表示
- エラー時 → 管理画面は継続動作

## 確認方法
```bash
# ヘルスチェック
curl https://dive-buddys.com/api/health

# 現在の応答（2025-07-27）
{
  "database": "auth_ok",       # ← 古いバージョンの応答
  "supabase_configured": true
}

# 期待される応答（修正版デプロイ後）
{
  "database": "connected",
  "supabase_status": "connected", 
  "mode": "supabase"
}
```

## 📊 現状分析
- Railway環境変数再設定済み
- しかしデプロイが古いバージョンのまま
- 修正版コードがRailwayに反映されていない
```

## 最終確認
- [ ] Railway環境変数設定完了
- [ ] デプロイ・再起動完了  
- [ ] ログからエラー消失確認
- [ ] 記事作成・一覧取得のSupabase接続確認

---
**作成日**: 2025-07-27
**状態**: API key検証機能実装済み - Railway設定待ち