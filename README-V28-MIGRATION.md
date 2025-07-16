# 📊 V2.8 34項目データ構造移行ガイド

## 🎯 概要
現在の11項目CSVデータをV2.8計画書の34項目データ構造に完全移行するための包括的ガイドです。

## 📋 V2.8 34項目データ構造

### 基本情報（6項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `shop_id` | VARCHAR(50) | ✅ | 店舗識別子（UNIQUE） |
| `shop_name` | VARCHAR(255) | ✅ | 店舗名 |
| `area` | VARCHAR(100) | ✅ | エリア |
| `phone_line` | VARCHAR(50) | ⭕ | 電話番号 |
| `website` | TEXT | ⭕ | ウェブサイト |
| `operating_hours` | VARCHAR(100) | ⭕ | 営業時間 |

### サービス情報（3項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `fun_dive_available` | BOOLEAN | ⭕ | ファンダイビング対応 |
| `trial_dive_options` | TEXT | ⭕ | 体験ダイビング詳細 |
| `license_course_available` | BOOLEAN | ⭕ | ライセンス講習対応 |

### グループ・ガイド（2項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `max_group_size` | INTEGER | ⭕ | 最大グループサイズ |
| `private_guide_available` | BOOLEAN | ⭕ | プライベートガイド対応 |

### 料金情報（5項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `fun_dive_price_2tanks` | INTEGER | ⭕ | ファンダイビング2本料金 |
| `trial_dive_price_beach` | INTEGER | ⭕ | ビーチ体験料金 |
| `trial_dive_price_boat` | INTEGER | ⭕ | ボート体験料金 |
| `equipment_rental_included` | BOOLEAN | ⭕ | 器材レンタル込み |
| `additional_fees` | TEXT | ⭕ | 追加料金詳細 |

### 安全・保険（2項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `safety_equipment` | BOOLEAN | ⭕ | 安全装備完備 |
| `insurance_coverage` | BOOLEAN | ⭕ | 保険カバー |

### サポート体制（3項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `female_instructor` | BOOLEAN | ⭕ | 女性インストラクター |
| `english_support` | BOOLEAN | ⭕ | 英語サポート |
| `pickup_service` | BOOLEAN | ⭕ | 送迎サービス |

### 対応レベル（3項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `beginner_friendly` | BOOLEAN | ⭕ | 初心者対応 |
| `solo_welcome` | BOOLEAN | ⭕ | 一人参加歓迎 |
| `family_friendly` | BOOLEAN | ⭕ | ファミリー対応 |

### 撮影サービス（2項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `photo_service` | BOOLEAN | ⭕ | 撮影サービス |
| `video_service` | BOOLEAN | ⭕ | 動画サービス |

### 専門情報（3項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `speciality_areas` | TEXT | ⭕ | 専門分野・特徴 |
| `certification_level` | VARCHAR(100) | ⭕ | 認定レベル |
| `experience_years` | INTEGER | ⭕ | 経験年数 |

### 評価・レビュー（3項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `customer_rating` | DECIMAL(3,2) | ⭕ | 顧客評価 |
| `review_count` | INTEGER | ⭕ | レビュー件数 |
| `incident_record` | TEXT | ⭕ | 事故記録 |

### Jiji評価・メタデータ（2項目）
| 項目 | 型 | 必須 | 説明 |
|-----|---|------|-----|
| `jiji_grade` | VARCHAR(50) | ⭕ | Jiji評価（premium/standard/basic） |
| `last_updated` | DATE | ⭕ | 最終更新日 |

## 🔄 移行手順

### 1. 環境準備
```bash
# 必要な依存関係をインストール
npm install csv-parser

# 環境変数設定
cp .env.example .env
# .envファイルを編集
```

### 2. 移行スクリプト実行
```bash
# CSV → V2.8形式変換
node scripts/migrate-csv-to-v28.js

# 結果確認
cat data/v28-migrated-shops.json
cat reports/migration-report.md
```

### 3. Google Sheets設定
```bash
# V2.8対応シートの作成
npm run sheets:setup

# 移行データのアップロード
npm run sheets:upload-v28
```

## 📊 データ対応表

### 直接対応（8項目）
| CSV項目 | V2.8項目 | 変換処理 |
|---------|----------|----------|
| エリア | `area` | 直接コピー |
| ショップ名 | `shop_name` | 直接コピー |
| URL | `website` | 直接コピー |
| 電話番号 | `phone_line` | 直接コピー |
| 評価 | `customer_rating` | 数値変換 |
| レビュー数 | `review_count` | 数値変換 |
| 専門・特徴 | `speciality_areas` | 直接コピー |
| 料金（2ダイブ目安） | `fun_dive_price_2tanks` | 価格変換（¥除去） |

### 推測対応（26項目）
| V2.8項目 | 推測方法 | 信頼度 |
|----------|----------|--------|
| `shop_id` | ショップ名から生成 | 100% |
| `jiji_grade` | 評価・レビュー数から算出 | 90% |
| `beginner_friendly` | 「初心者」キーワード検索 | 80% |
| `certification_level` | 「PADI」等キーワード検索 | 70% |
| `photo_service` | 「撮影」キーワード検索 | 70% |
| `max_group_size` | 「少人数」等から推測 | 60% |
| `trial_dive_price_beach` | ファン料金×0.7で推算 | 60% |
| `trial_dive_price_boat` | ファン料金×0.8で推算 | 60% |
| `private_guide_available` | 「貸切」キーワード検索 | 60% |
| `female_instructor` | 「女性」キーワード検索 | 60% |
| `english_support` | 「英語」キーワード検索 | 60% |
| `pickup_service` | 「送迎」キーワード検索 | 60% |
| `experience_years` | レビュー数から推算 | 50% |
| その他Boolean項目 | デフォルト値またはキーワード検索 | 40-50% |

## 🔧 Google Sheets構造

### シート1: ショップマスタ34項目
```
A: shop_id
B: shop_name
C: area
D: phone_line
E: website
F: operating_hours
G: fun_dive_available
H: trial_dive_options
I: license_course_available
J: max_group_size
K: private_guide_available
L: fun_dive_price_2tanks
M: trial_dive_price_beach
N: trial_dive_price_boat
O: equipment_rental_included
P: additional_fees
Q: safety_equipment
R: insurance_coverage
S: female_instructor
T: english_support
U: pickup_service
V: beginner_friendly
W: solo_welcome
X: family_friendly
Y: photo_service
Z: video_service
AA: speciality_areas
AB: certification_level
AC: experience_years
AD: customer_rating
AE: review_count
AF: incident_record
AG: jiji_grade
AH: last_updated
```

### シート2: 口コミデータ
```
A: review_id
B: shop_id
C: user_name
D: rating
E: comment
F: date
G: diving_type
H: experience_level
I: photos
J: verified
K: helpful_count
```

### シート3: 海況データ
```
A: weather_id
B: area
C: date
D: weather
E: temperature
F: wind_speed
G: wind_direction
H: wave_height
I: visibility
J: water_temperature
K: diving_conditions
```

## 🚀 API使用方法

### V2.8対応API
```javascript
const JijiShopDataManagerV28 = require('./api/google-sheets-integration-v28');

const manager = new JijiShopDataManagerV28();
await manager.initialize();

// V2.8形式での同期
const result = await manager.syncShopDataV28();

// V2.8マッチングアルゴリズム検索
const shops = await manager.searchShopsV28({
    area: '石垣島',
    beginnerFriendly: true,
    useV28Matching: true,
    sortBy: 'matching_score'
});
```

### マッチングアルゴリズム（50/30/20）
```javascript
// 口コミAI分析（50%）
const reviewScore = calculateReviewScore(shop);

// 基本情報適合度（30%）
const basicScore = calculateBasicScore(shop, filters);

// プラン優遇（20%）
const planScore = calculatePlanScore(shop);

// 総合スコア
const totalScore = reviewScore * 0.5 + basicScore * 0.3 + planScore * 0.2;
```

## 📈 データ品質向上計画

### 高優先度（手動確認必須）
1. **体験ダイビング料金** - 79件すべて要確認
2. **営業時間** - 公式サイトから確認
3. **女性インストラクター** - 電話確認が必要

### 中優先度（段階的確認）
1. **英語サポート** - 観光客対応状況
2. **送迎サービス** - 利便性向上
3. **プライベートガイド** - 高単価サービス

### 低優先度（将来的に必要）
1. **事故記録** - 安全性評価
2. **追加料金** - 透明性向上
3. **保険カバー** - 安心感向上

## 🔍 品質チェック項目

### 自動チェック
- [ ] 必須項目の完全性
- [ ] データ型の妥当性
- [ ] 範囲値の検証
- [ ] 重複データの確認

### 手動チェック
- [ ] 電話番号の有効性
- [ ] ウェブサイトの稼働状況
- [ ] 営業時間の正確性
- [ ] 料金情報の最新性

## 🎯 V2.8活用方法

### LINE Bot連携
```javascript
// ユーザー要求に基づく検索
const userRequest = "石垣島で初心者向けのショップを探している";
const matchedShops = await manager.searchShopsV28({
    area: '石垣島',
    beginnerFriendly: true,
    useV28Matching: true
});
```

### B2B収益化
```javascript
// プラン別表示制御
const displayShops = shops.map(shop => ({
    ...shop,
    displayLevel: shop.jiji_grade === 'premium' ? 'full' : 
                  shop.jiji_grade === 'standard' ? 'basic' : 'minimal'
}));
```

### 口コミ重視マッチング
```javascript
// 口コミスコアによるランキング
const rankedShops = shops.sort((a, b) => {
    const scoreA = a.customer_rating * 0.7 + (a.review_count / 100) * 0.3;
    const scoreB = b.customer_rating * 0.7 + (b.review_count / 100) * 0.3;
    return scoreB - scoreA;
});
```

## 🔄 継続的データ更新

### 日次更新
- Google Sheets自動同期
- データ品質チェック
- 新規ショップ追加

### 週次更新
- 料金情報の確認
- 評価・レビュー数更新
- 不正データの修正

### 月次更新
- 全項目の網羅的チェック
- 新機能項目の追加
- データ分析レポート生成

## 🎉 移行完了確認

### チェックリスト
- [ ] CSV → V2.8変換完了
- [ ] Google Sheets設定完了
- [ ] API連携動作確認
- [ ] マッチングアルゴリズム動作確認
- [ ] データ品質レポート確認
- [ ] 本番環境デプロイ

### 成功指標
- **変換成功率**: 95%以上
- **データ品質**: 90%以上
- **API応答時間**: 500ms以下
- **マッチング精度**: 85%以上

この移行により、V2.8の「LINE Bot完結型・口コミ重視マッチング・B2B収益化」を完全に実現できます。