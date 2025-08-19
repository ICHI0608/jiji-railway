# 📚 Dive Buddy's ドキュメント管理

**最終更新**: 2025年8月10日  
**管理方式**: シンプル上書き更新方式  
**プロジェクト**: Dive Buddy's - Okinawa Diving Platform

## 🎯 **ファイル構成・管理方針**

### **📄 メインファイル（常に参照）**
- **`system-current-status.md`** - システム現状レポート（上書き更新）
  - Web版Claude・Claude Code共通参照用
  - 常に最新の正確な情報を記載
  - 更新時は上書きで管理

### **📊 技術詳細ファイル**
- **`api_integration_status_v2.0.md`** - API統合状況詳細
- **`diving_creators_system_spec_v1.0.md`** - クリエイター機能技術仕様
- **`task_completion_record_v2.0.md`** - 作業完了記録

## 📋 **現在有効なドキュメント**

### 🎯 **プロジェクト概要**
- **`project-summary.md`** - プロジェクト全体概要とシステム仕様
- **`external-services.md`** - 外部サービス一覧と設定情報
- **`security-analysis-report.md`** - セキュリティ監査結果レポート

### 🌐 **サイト構造**
- **`url-complete-list.md`** - 全ページURL一覧
- **`sitemap-wireframe.html`** - A3印刷用ワイヤーフレーム
- **`website-structure-chart.html`** - サイト構造図

### 📝 **作業履歴**
- **`work-history-20250801.md`** - 開発作業履歴
- **`task_completion_record_v1.0.md`** - タスク完了記録
- **`tasks_v1.3.md`** - 現在のタスク状況

### ⚙️ **現在使用中の設定**
- **`domain-setup.md`** - ドメイン設定手順（最新版）
- **`file-structure.md`** - ファイル構造説明

## 📦 **アーカイブ済みドキュメント**

古い・重複・使用されなくなったドキュメントは `/archive/old-docs-detailed/` に移動済み：

### `/archive/old-docs-detailed/`
```
├── line-richmenu/           # LINE リッチメニュー設定（旧版）
│   ├── line_bot_richmenu_complete_setup.md
│   ├── line_rich_menu_next_steps.md
│   └── rich-menu-design-spec.md
├── supabase-setup/          # Supabase セットアップ（旧版）
│   ├── supabase_manual_operations_guide.md
│   ├── supabase_setup_instructions.md
│   └── v28_database_setup.sql
├── domain-setup/            # ドメイン設定（旧版）
│   ├── domain_setup_guide.md
│   ├── railway-domain-setup.md
│   └── private_staging_setup.md
└── 個別ファイル/            # その他旧ファイル
    ├── database_restoration_v29.md
    ├── survey_implementation_plan_v2.md
    ├── linebot_*.csv (トレーニングデータ)
    └── その他旧設定ファイル
```

## 🔄 **記録管理方式**

### **上書き更新方式採用**
1. **メインファイル**: `system-current-status.md` を常に最新状態で維持
2. **バックアップ**: 更新前にGitコミット履歴で自動保管
3. **アーカイブ**: 重要節目時のみ日付付きファイル作成

### **Git履歴による安全管理**
- 全変更がコミット履歴で追跡可能
- 必要時は `git log` で変更履歴確認
- 緊急時は `git revert` で復旧可能

## 🔍 **ドキュメント使用ガイド**

### 📖 **Web版Claude利用時**
1. **`system-current-status.md`** を最初に参照
2. 詳細が必要な場合は技術詳細ファイルを確認
3. 古いファイル・バージョン番号付きファイルは無視

### 🔧 **Claude Code継続開発時**  
1. **`system-current-status.md`** で現在状況確認
2. 実装詳細は技術仕様ファイル参照
3. 更新後は上書き保存

### 🔐 **セキュリティ確認**
- `security-analysis-report.md` - 最新セキュリティ監査結果

### 🌍 **サイト構造理解**
- `sitemap-wireframe.html` - 全ページ構造（A3印刷対応）
- `url-complete-list.md` - 実際のURL一覧

## ⚠️ **注意事項**

### ✅ **現在使用中（編集注意）**
- 上記「現在有効なドキュメント」は全て現役で使用中
- システム運用に直接関連するため、編集時は慎重に

### 📦 **アーカイブファイル**
- 必要に応じて `archive/` から復元可能
- システム運用への影響はありません

---

**整理実施**: Claude Code  
**次回レビュー推奨**: 2025年11月（3ヶ月後）