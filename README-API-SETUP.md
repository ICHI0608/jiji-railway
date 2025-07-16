# 🔗 Google Sheets API連携セットアップガイド

## 📋 概要
JijiダイビングボットのGoogle Sheets API連携機能により、以下が可能になります：
- **リアルタイム同期**: 5分間隔での自動データ同期
- **データ検証**: 入力データの自動検証・エラー通知
- **管理者フレンドリー**: スプレッドシートでの簡単なデータ管理
- **スケーラブル**: 79店舗から1000店舗以上まで対応

## 🚀 クイックスタート

### 1. 依存関係のインストール
```bash
npm install
```

### 2. Google Cloud Console設定
1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクト作成
2. Google Sheets APIを有効化
3. サービスアカウントを作成
4. JSONキーファイルをダウンロード
5. 環境変数を設定

### 3. 環境変数設定
```bash
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 4. セットアップ実行
```bash
npm run sheets:setup
```

### 5. 動作確認
```bash
npm run sheets:demo
```

## 📊 Google Sheets準備

### スプレッドシート構造
#### シート1: ショップリスト
| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S | T |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shop_name | area | phone | status | rating | specialties | price_range | description | website | email | address | coordinates | business_hours | languages | certifications | equipment_rental | beginner_friendly | boat_diving | shore_diving | night_diving |

#### 必須項目
- **shop_name**: ショップ名
- **area**: エリア（石垣島、宮古島、沖縄本島、与那国島、久米島、座間味島）
- **phone**: 電話番号
- **status**: ステータス（active、inactive、pending）

#### 任意項目
- **rating**: 評価（0-5）
- **specialties**: 特色（カンマ区切り）
- **price_range**: 価格帯
- **description**: 説明文
- **website**: ウェブサイト
- **email**: メールアドレス
- **address**: 住所
- **coordinates**: 座標（緯度,経度）
- **business_hours**: 営業時間
- **languages**: 対応言語（カンマ区切り）
- **certifications**: 認定資格（カンマ区切り）
- **equipment_rental**: 機材レンタル（true/false）
- **beginner_friendly**: 初心者向け（true/false）
- **boat_diving**: ボートダイビング（true/false）
- **shore_diving**: ビーチダイビング（true/false）
- **night_diving**: ナイトダイビング（true/false）

### サンプルデータ
```
S2クラブ石垣, 石垣島, 0980-88-1234, active, 4.8, マンタ,地形ダイビング,初心者歓迎, ¥8,000-15,000, 石垣島でのマンタ遭遇率No.1！, https://s2club-ishigaki.com, info@s2club-ishigaki.com, 沖縄県石垣市美崎町1-5, 24.3369,124.1614, 8:00-18:00, 日本語,英語, PADI,NAUI, true, true, true, false, true
```

## 🛠️ API使用方法

### 基本的な同期
```javascript
const JijiShopDataManager = require('./api/google-sheets-integration');

const manager = new JijiShopDataManager();
await manager.initialize();

// 手動同期
const result = await manager.syncShopData();
console.log('同期完了:', result);
```

### 自動同期の開始
```javascript
const { SyncService } = require('./api/sync-sheets-data');

const syncService = new SyncService();
await syncService.initialize();
syncService.startAutoSync(); // 5分間隔で自動同期
```

### ショップ検索
```javascript
// エリアで検索
const shops = await manager.searchShops({
    area: '石垣島',
    minRating: 4.5,
    beginnerFriendly: true
});

// 特色で検索
const manaShops = await manager.searchShops({
    specialty: 'マンタ',
    sortBy: 'rating'
});
```

## 📡 API エンドポイント

### Express.jsでのAPI統合
```javascript
const express = require('express');
const { createSyncAPI } = require('./api/sync-sheets-data');

const app = express();
const syncService = await createSyncAPI(app);

// 利用可能なエンドポイント:
// POST /api/sync/manual - 手動同期
// GET /api/sync/status - 同期状態確認
// GET /api/sync/health - 健全性チェック
```

## 🔧 コマンドラインツール

```bash
# セットアップ
npm run sheets:setup

# デモモード（インタラクティブ）
npm run sheets:demo

# パフォーマンステスト
npm run sheets:performance

# 手動同期
npm run sheets:sync

# 自動同期開始
npm run sheets:sync auto

# 同期状態確認
npm run sheets:sync status

# 健全性チェック
npm run sheets:sync health
```

## 📈 監視・ログ

### ログファイル
- `logs/sync-combined.log`: 全ログ
- `logs/sync-error.log`: エラーログ
- `data/sync-results.json`: 同期結果履歴

### 監視項目
- **同期成功率**: 過去24時間の同期成功率
- **データ品質**: 検証エラー数
- **パフォーマンス**: 同期処理時間
- **API制限**: Google Sheets API使用量

## 🚨 エラーハンドリング

### よくあるエラー
1. **認証エラー**: サービスアカウントの設定確認
2. **API制限**: レート制限に達した場合の対応
3. **データ検証エラー**: 無効なデータの修正方法
4. **ネットワークエラー**: 接続失敗時の再試行

### 対処方法
```javascript
// エラー通知の設定
manager.on('error', (error) => {
    console.error('同期エラー:', error);
    // Slack通知、メール通知など
});

// 自動復旧機能
manager.on('retry', (attempt) => {
    console.log(`再試行: ${attempt}/3`);
});
```

## 🔐 セキュリティ

### 認証情報の管理
- 環境変数での秘密鍵管理
- サービスアカウントの最小権限設定
- 定期的なキーローテーション

### アクセス制御
- スプレッドシートの共有設定
- IP制限（必要に応じて）
- ログ監視

## 📊 パフォーマンス最適化

### 同期頻度の調整
```javascript
// 本番環境推奨設定
const config = {
    incrementalSync: '*/5 * * * *',  // 5分間隔
    fullSync: '0 */1 * * *',         // 1時間間隔
    maintenance: '0 2 * * *'         // 毎日午前2時
};
```

### キャッシュ戦略
- Redis による結果キャッシュ
- 差分同期によるデータ転送量削減
- 圧縮による通信最適化

## 🧪 テスト

### 単体テスト
```bash
npm test
```

### 統合テスト
```bash
npm run test:integration
```

### 負荷テスト
```bash
npm run sheets:performance
```

## 🚀 本番環境デプロイ

### Railway.app
```javascript
// railway.json
{
  "build": {
    "command": "npm install"
  },
  "start": {
    "command": "npm start"
  },
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 環境変数設定
```bash
# Railway CLIで設定
railway variables set GOOGLE_SPREADSHEET_ID=your_id
railway variables set GOOGLE_SERVICE_ACCOUNT_EMAIL=your_email
railway variables set GOOGLE_PRIVATE_KEY="your_private_key"
```

## 📞 サポート

### トラブルシューティング
1. **接続テスト**: `npm run sheets:setup`
2. **権限確認**: スプレッドシートの共有設定
3. **ログ確認**: `logs/sync-error.log`
4. **健全性チェック**: `npm run sheets:sync health`

### 問い合わせ
- GitHub Issues: バグ報告・機能要求
- メール: tech@jiji-diving.com
- Slack: #jiji-dev-support

## 🔄 更新履歴

### v2.8.0 (2025-01-15)
- Google Sheets API連携機能追加
- 自動同期システム実装
- データ検証機能強化
- 監視・ログ機能追加

### 今後の予定
- [ ] BigQuery連携（大規模データ分析）
- [ ] Webhook通知機能
- [ ] 多言語対応（英語、中国語）
- [ ] モバイルアプリ対応