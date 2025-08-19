# Dive Buddy's ファイル構造

**記録日時**: 2025年8月1日
**プロジェクトルート**: /Users/ymacbookpro/jiji-diving-bot/

## 実際に確認済みのファイル構造

### 公開ディレクトリ (/public/)
```
public/
├── index.html (実装済み)
├── index_ui_check.html (修正中)
├── beginner.html (新規作成)
├── about.html (実装済み)
├── contact.html (実装済み)
├── legal.html (実装済み)
├── pricing.html (実装済み)
├── blog-post.html (実装済み)
├── blog.html (実装済み)
├── partners.html (実装済み)
├── transition.html (実装済み)
├── google-analytics.html (実装済み)
├── robots.txt (実装済み)
├── sitemap.xml (実装済み)
├── css/
│   └── common.css (共通スタイル)
├── js/
│   └── common.js (共通JavaScript)
├── images/
│   └── hero-background.png
├── admin/
│   ├── dashboard.html
│   ├── blog-editor.html
│   ├── blog-list.html
│   ├── analytics.html
│   └── monitoring.html
├── api/
│   └── weather-integration.html
├── app/
│   ├── v28-index.html
│   ├── v28-script.js
│   └── v28-styles.css
├── blog/
│   ├── index.html
│   ├── article.html
│   └── search.html
├── member/
│   ├── index.html
│   ├── register.html
│   ├── login.html
│   ├── dashboard.html
│   ├── profile.html
│   ├── points.html
│   ├── review-post.html
│   └── profile/
│       ├── diving.html
│       └── settings.html
├── partners/
│   ├── advertising.html
│   └── dashboard.html
├── reviews/
│   └── submit.html
├── shop/
│   ├── dashboard.html
│   ├── edit-profile.html
│   ├── login.html
│   └── subscription.html
├── shops-database/
│   ├── index.html
│   ├── details.html
│   ├── shops.html
│   └── shops.js
├── test/
│   └── integration-test.html
├── travel-guide/
│   ├── index.html
│   ├── ishigaki.html
│   ├── miyako.html
│   ├── accommodation.html
│   ├── flights.html
│   ├── transport.html
│   └── cost-simulator.html
└── weather-ocean/
    └── index.html
```

### ドキュメントディレクトリ (/docs/)
```
docs/
├── project-summary.md (新規作成)
├── url-complete-list.md (新規作成)
├── work-history-20250801.md (新規作成)
├── file-structure.md (新規作成)
├── sitemap-wireframe.html (新規作成)
└── [その他の既存ドキュメント]
```

### データディレクトリ (/data/)
```
data/
├── area-content.json
├── blog-articles.json
├── dive-history.json
├── integrations.json
├── points.json
├── reviews.json
├── subscription-plans.json
├── transitions.json
└── users.json
```

### APIディレクトリ (/api/)
```
api/
├── google-sheets-integration-v28.js
├── google-sheets-integration.js
├── setup-google-sheets.js
└── sync-sheets-data.js
```

### ソースディレクトリ (/src/)
```
src/
├── server.js.old-backup
├── database.js
├── jiji-persona.js
├── message-handler.js
├── emotional-matching.js
├── point-manager.js
├── review-manager.js
├── rich-menu-manager.js
├── shop-database.js
├── subscription-manager.js
├── supabase-connector.js
├── survey-manager.js
├── weather-api.js
├── flight-api.js
├── transport-api.js
└── [その他のJavaScriptファイル]
```

## 今回作成・修正したファイル

### 修正ファイル
- `/Users/ymacbookpro/jiji-diving-bot/public/index_ui_check.html`

### 新規作成ファイル
- `/Users/ymacbookpro/jiji-diving-bot/public/beginner.html`
- `/Users/ymacbookpro/jiji-diving-bot/docs/sitemap-wireframe.html`
- `/Users/ymacbookpro/jiji-diving-bot/docs/project-summary.md`
- `/Users/ymacbookpro/jiji-diving-bot/docs/url-complete-list.md`
- `/Users/ymacbookpro/jiji-diving-bot/docs/work-history-20250801.md`
- `/Users/ymacbookpro/jiji-diving-bot/docs/file-structure.md`

## 注記
- 上記構造は実際にlsコマンドで確認したディレクトリとファイルのみ記載
- 推測や仮定は一切含まない
- 存在確認できないファイルは記載していない