# Archive フォルダ - 旧ファイル保管庫

**作成日**: 2025年8月6日  
**目的**: システム整理のため、現在使用されていない旧ファイルを安全に保管

## 📁 アーカイブ構造

### `/old-versions/` - 旧バージョンファイル
- `app.js` - 旧メインアプリ（現在は admin-app.js を使用）
- `script.js` - 旧スクリプト
- `styles.css` - 旧スタイル
- `test_database.js` - 旧テストファイル
- `制作ページ一覧.md` - 旧ページリスト

### `/old-docs/` - 旧ドキュメント
- `tasks_v1.md`, `tasks_v1.1.md`, `tasks_v1.2.md` - 旧タスクファイル
- `setup_summary_v28.md` - 旧セットアップ情報

### `/old-public/` - 旧公開ファイル
- `index_backup_v1.html`, `index_old_backup.html` - 旧バックアップ
- `dive-buddys-top.html`, `dive-buddys-yumeka.html` - 旧ページ版

### `/old-src/` - 旧ソースコード
- `server.js.old-backup` - 旧サーバーバックアップ
- `emotional-matching-test.js` - 旧テストファイル
- `emotional-matching-standalone.js` - 旧スタンドアロン版

## ⚠️ 重要事項

### ✅ **現在のシステムで使用中（移動していません）**
- `admin-app.js` - メインエントリーポイント
- `simple-bot.js` - LINE Bot
- `package.json` - 依存関係管理
- `railway.toml` - デプロイ設定
- `src/` フォルダ全体 - アクティブなソースコード
- `public/` フォルダ（バックアップ除く） - 公開Webサイト
- `credentials/` - 認証情報
- `.env` 関連ファイル - 環境設定

### 🔐 **セキュリティ・システム連携への影響**
- **影響なし**: 移動したファイルは全て現在のシステムから参照されていないファイル
- **GitHub**: `.gitignore` は維持、重要ファイルは保護済み
- **Railway**: `railway.toml` とメインエントリーポイントは変更なし
- **Database**: Supabase接続に関わるファイルは全て保持
- **External APIs**: 認証情報・設定ファイルは全て保持

## 🗂️ **復元方法**

必要に応じてファイルを元の場所に戻すことができます：

```bash
# 例: 旧app.jsを復元する場合
mv archive/old-versions/app.js ./

# 旧ドキュメントを復元する場合
mv archive/old-docs/tasks_v1.md docs/
```

---

**整理実施者**: Claude Code  
**整理日時**: 2025年8月6日