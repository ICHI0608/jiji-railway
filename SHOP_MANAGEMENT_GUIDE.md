# 🏪 **店舗管理ガイド - データ追加・更新手順**

**作成日**: 2025年7月27日  
**対象**: 79店舗×34項目データベース管理  
**目的**: 新店舗追加・既存店舗更新の標準手順確立

---

## 📊 **現在のデータ管理構造**

### **データソース一覧**
1. **Google Sheets API連携** (本格運用向け)
   - `src/sheets-connector.js` - API統合基盤
   - `api/setup-google-sheets.js` - 設定・テスト
   - 34項目ヘッダー定義済み

2. **CSVテンプレート** (推奨・実用的)
   - `templates/v28-shops-template.csv` - 完全テンプレート
   - Excel/Googleスプレッドシートで編集可能

3. **JSONデータ** (現在動作中)
   - `mock-shops-data.json` - 79店舗データ
   - フォールバック・開発用

---

## 🔧 **店舗追加の標準手順**

### **方法1: CSVファイル編集（推奨）**

#### **Step 1: テンプレート準備**
```bash
# プロジェクトディレクトリで実行
cd /Users/ymacbookpro/jiji-diving-bot
cp templates/v28-shops-template.csv new-shops-$(date +%Y%m%d).csv
```

#### **Step 2: データ入力**
```bash
# Excelまたはスプレッドシートで開く
open new-shops-$(date +%Y%m%d).csv
```

**必須入力項目（34項目）**:
```
shop_id, shop_name, area, phone_line, website, operating_hours,
fun_dive_available, trial_dive_options, license_course_available,
max_group_size, private_guide_available, fun_dive_price_2tanks,
trial_dive_price_beach, trial_dive_price_boat, equipment_rental_included,
additional_fees, safety_equipment, insurance_coverage, female_instructor,
english_support, pickup_service, beginner_friendly, solo_welcome,
family_friendly, photo_service, video_service, speciality_areas,
certification_level, experience_years, customer_rating, review_count,
incident_record, jiji_grade, last_updated
```

#### **Step 3: データインポート**
```bash
# CSVからシステムへインポート
npm run v28:migrate

# または手動スクリプト実行
node scripts/migrate-csv-to-v28.js
```

#### **Step 4: 動作確認**
```bash
# ローカル確認
curl http://localhost:3000/api/shops | jq '.count'

# Railway本番確認
curl https://dive-buddys.com/api/shops | jq '.count'
```

### **方法2: Google Sheets（本格運用）**

#### **事前準備**
1. Google Cloud Console でサービスアカウント作成
2. Google Sheets API有効化
3. 認証情報設定 (.env)

#### **実行手順**
```bash
# Google Sheets セットアップ
npm run sheets:setup

# データ同期実行
npm run sheets:sync

# 動作確認
npm run sheets:demo
```

### **方法3: JSON直接編集（開発・緊急時）**

#### **ファイル編集**
```bash
# JSONファイル直接編集
code mock-shops-data.json

# 新店舗オブジェクト追加
{
  "shop_id": "SHOP_080",
  "shop_name": "新店舗名",
  "area": "石垣島",
  ...34項目
}
```

#### **即座反映**
- サーバー再起動不要
- 管理画面で即座確認可能

---

## 📋 **データ入力規則**

### **必須フィールド**
- `shop_id`: 一意識別子 (SHOP_001形式)
- `shop_name`: 店舗名
- `area`: エリア (石垣島/宮古島/沖縄本島/その他)
- `phone_line`: 電話番号
- `jiji_grade`: 品質評価 (premium/standard/basic)

### **Boolean項目**
```
true/false で入力:
fun_dive_available, license_course_available, private_guide_available,
equipment_rental_included, safety_equipment, insurance_coverage,
female_instructor, english_support, pickup_service, beginner_friendly,
solo_welcome, family_friendly, photo_service, video_service
```

### **数値項目**
```
数値で入力:
max_group_size, fun_dive_price_2tanks, trial_dive_price_beach,
trial_dive_price_boat, experience_years, customer_rating, review_count
```

### **日付項目**
```
YYYY-MM-DD形式:
last_updated (例: 2025-07-27)
```

---

## 🔍 **データ品質チェック**

### **入力前チェックリスト**
- [ ] shop_id の重複確認
- [ ] 必須項目の入力完了
- [ ] Boolean値の正確性
- [ ] 価格・評価の妥当性
- [ ] 電話番号・URLの形式

### **インポート後確認**
```bash
# 店舗数確認
curl -s localhost:3000/api/shops | jq '.count'

# 新店舗確認
curl -s localhost:3000/api/shops | jq '.shops[] | select(.shop_id=="SHOP_080")'

# エラーログ確認
tail -f server.log
```

---

## 🚀 **運用フロー**

### **定期更新スケジュール**
1. **月次**: 店舗情報の全般更新
2. **週次**: 料金・営業時間の確認
3. **随時**: 新店舗追加・閉店対応

### **承認プロセス**
1. **データ準備**: CSV/Sheets編集
2. **品質チェック**: 入力項目検証
3. **テスト環境**: ローカルでの動作確認
4. **本番反映**: Railway環境への適用
5. **最終確認**: ユーザー画面での表示確認

---

## 📊 **現在の店舗構成**

### **エリア別分布**
- **石垣島**: 44店舗
- **宮古島**: 35店舗
- **沖縄本島**: 若干
- **合計**: 79店舗

### **品質グレード**
- **Premium**: S級認定店舗
- **Standard**: A/B級店舗
- **Basic**: C級店舗

---

## 🛠️ **トラブルシューティング**

### **よくある問題**

#### **CSVインポートエラー**
```bash
# 文字コード確認
file -I new-shops.csv

# UTF-8変換
iconv -f SHIFT_JIS -t UTF-8 new-shops.csv > new-shops-utf8.csv
```

#### **重複shop_id**
```bash
# 重複チェック
cut -d',' -f1 new-shops.csv | sort | uniq -d
```

#### **Boolean値エラー**
```
正: true, false
誤: TRUE, FALSE, 1, 0, Yes, No
```

---

## 📝 **次期開発予定（SHOP-001）**

### **管理画面機能**
- 店舗情報の直接編集
- CSVアップロード機能
- リアルタイムバリデーション

### **API機能強化**
- 店舗検索・フィルタリング
- 一括更新API
- 変更履歴管理

### **データ連携**
- Google Sheets自動同期
- 外部サービス連携
- バックアップシステム

---

**📅 最終更新**: 2025年7月27日  
**📋 対象バージョン**: v4.0.2  
**🎯 次回更新**: SHOP-001完了時