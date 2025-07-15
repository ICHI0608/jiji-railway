# UptimeRobot 無料版設定手順

## 📋 概要
UptimeRobotの無料版を使用してJijiダイビングボットの外形監視を実施します。

## 🆓 無料版の機能
- **監視数**: 50サイト
- **監視間隔**: 5分
- **監視地点**: 世界各地
- **通知方法**: Email, SMS, Webhook
- **データ保持**: 2ヶ月

## 🚀 設定手順

### 1. UptimeRobotアカウント作成
1. https://uptimerobot.com/ にアクセス
2. 「Start monitoring for free」をクリック
3. メールアドレスとパスワードを入力
4. アカウント認証を完了

### 2. 監視対象の設定

#### 基本監視項目
```
1. メインサイト
   - URL: https://jiji-diving-bot.railway.app
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
   - キーワード監視: "Jiji" (応答内容確認)

2. APIヘルスチェック
   - URL: https://jiji-diving-bot.railway.app/health
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
   - 期待レスポンス: 200 OK

3. LINE Bot Webhook
   - URL: https://jiji-diving-bot.railway.app/api/line-webhook
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
   - POSTメソッド対応

4. 管理画面
   - URL: https://jiji-diving-bot.railway.app/admin
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
```

#### 高度な監視設定
```
5. API レスポンス時間監視
   - URL: https://jiji-diving-bot.railway.app/api/shops/search
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
   - タイムアウト: 30秒

6. データベース接続確認
   - URL: https://jiji-diving-bot.railway.app/api/health/db
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
   - 期待レスポンス: {"status": "ok"}

7. 外部API依存関係
   - URL: https://jiji-diving-bot.railway.app/api/health/external
   - 監視タイプ: HTTP(s)
   - 監視間隔: 5分
```

### 3. 通知設定

#### Email通知
```
1. 設定 → Alert Contacts
2. 「Add Alert Contact」をクリック
3. Type: Email
4. Email: your-email@example.com
5. 通知条件:
   - Down: 即座に通知
   - Up: 復旧時に通知
   - 閾値: 1回失敗で通知
```

#### Webhook通知（Slack連携）
```
1. Slack Webhook URL取得
2. 設定 → Alert Contacts
3. Type: Webhook
4. URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
5. POST Data:
   {
     "text": "🚨 *alertTypeFriendlyName*: *monitorFriendlyName* (*monitorURL*)",
     "username": "UptimeRobot",
     "channel": "#alerts"
   }
```

### 4. 監視ダッシュボード設定

#### パブリックダッシュボード
```
1. 設定 → Public Status Pages
2. 「Add Status Page」をクリック
3. 設定:
   - Name: Jiji Diving Bot Status
   - URL: https://stats.uptimerobot.com/your-custom-url
   - 監視対象を選択
   - デザインをカスタマイズ
```

## 🔧 ヘルスチェックエンドポイント実装

### Express.jsでのヘルスチェック実装
```javascript
// /health エンドポイント
app.get('/health', async (req, res) => {
    try {
        const healthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version,
            environment: process.env.NODE_ENV,
            memory: process.memoryUsage(),
            pid: process.pid
        };
        
        res.status(200).json(healthStatus);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// /api/health/db - データベース接続確認
app.get('/api/health/db', async (req, res) => {
    try {
        // Supabaseへの接続確認
        const { data, error } = await supabase
            .from('shops')
            .select('count(*)')
            .single();
            
        if (error) throw error;
        
        res.json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            message: error.message
        });
    }
});

// /api/health/external - 外部API確認
app.get('/api/health/external', async (req, res) => {
    try {
        const checks = await Promise.allSettled([
            // OpenAI API確認
            fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
            }),
            // Google Sheets API確認
            fetch('https://sheets.googleapis.com/v4/spreadsheets/test')
        ]);
        
        const results = {
            openai: checks[0].status === 'fulfilled' && checks[0].value.ok,
            google_sheets: checks[1].status === 'fulfilled' && checks[1].value.ok
        };
        
        const allOk = Object.values(results).every(Boolean);
        
        res.status(allOk ? 200 : 500).json({
            status: allOk ? 'ok' : 'partial',
            services: results,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});
```

## 📊 監視メトリクス活用

### 1. 可用性監視
- **目標**: 99.9%（月間43分以下のダウンタイム）
- **測定**: 各エンドポイントの応答状況
- **アラート**: 1回失敗で即座に通知

### 2. パフォーマンス監視
- **目標**: 応答時間 < 2秒
- **測定**: HTTPレスポンス時間
- **アラート**: 5秒超過で警告

### 3. 機能監視
- **目標**: 主要機能の正常動作
- **測定**: APIエンドポイント応答
- **アラート**: 機能不全で即座に通知

## 🔄 定期メンテナンス

### 週次作業
- [ ] 監視データの確認
- [ ] 異常発生時の分析
- [ ] 通知設定の確認

### 月次作業
- [ ] 可用性レポートの作成
- [ ] パフォーマンストレンドの分析
- [ ] 監視対象の見直し

## 🎯 Pro版への移行判断基準

### 移行を検討する条件
- 監視間隔を1分に短縮したい
- 50サイト以上の監視が必要
- SMS通知が必要
- 詳細な分析レポートが必要

### Pro版の料金
- **月額**: $7/月
- **追加機能**: 
  - 1分間隔監視
  - 50+ 監視対象
  - SMS通知
  - 詳細統計

## 🚀 実装完了チェックリスト

- [ ] UptimeRobotアカウント作成
- [ ] 7つの監視対象設定
- [ ] Email通知設定
- [ ] Webhook通知設定（Slack）
- [ ] パブリックダッシュボード作成
- [ ] ヘルスチェックエンドポイント実装
- [ ] 監視メトリクス確認
- [ ] 定期メンテナンス手順確立