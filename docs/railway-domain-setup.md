# 🌊 Railway カスタムドメイン設定 - Claude Code作業指示書

## 📋 **作業概要**
**目標**: dive-buddys.com を Railway本番環境に統合
**所要時間**: 30-60分
**環境**: Railway本番環境（jiji-bot-production）

---

## 🔑 **事前確認情報**

### ✅ **現在の環境情報**
```
Railway本番環境:
- URL: https://jiji-bot-production.up.railway.app
- GitHub: ICHI0608/jiji-railway
- ステータス: 稼働中（2025年7月21日確認済み）
- LINE Bot: 完全稼働中

取得済みドメイン:
- ドメイン名: dive-buddys.com
- 取得先: お名前.com
- 状態: DNS設定待ち
```

---

## 🚀 **Phase 1: Railway管理画面でカスタムドメイン設定**

### **Step 1-1: Railway管理画面にログイン**
```bash
# ブラウザでRailway管理画面を開く
https://railway.app/dashboard

# プロジェクト選択
プロジェクト名: "jiji-bot-production"
または GitHub連携: "ICHI0608/jiji-railway"
```

### **Step 1-2: ドメイン設定画面へ移動**
```
1. プロジェクトダッシュボードで該当サービスをクリック
2. 「Settings」タブをクリック  
3. 「Domains」セクションを確認
4. 「Custom Domain」または「Add Domain」ボタンをクリック
```

### **Step 1-3: カスタムドメイン追加**
```
入力するドメイン名:
dive-buddys.com

設定項目:
☑️ HTTPS強制リダイレクト: 有効
☑️ SSL証明書自動取得: 有効（Let's Encrypt）
☑️ ワイルドカード: 無効（サブドメイン不要）
```

### **Step 1-4: DNS設定値の確認**
**重要**: Railway側で表示されるDNS設定値をメモする
```
期待される表示:
- Aレコード: xxx.xxx.xxx.xxx (IPアドレス)
- または CNAMEレコード: xxxxx.railway.app

この値を次のDNS設定で使用します
```

---

## 🌐 **Phase 2: お名前.com DNS設定**

### **Step 2-1: お名前.com Naviにログイン**
```
URL: https://www.onamae.com/navi/
- ログイン情報でアクセス
- 「ドメイン設定」→「DNS設定」を選択
```

### **Step 2-2: DNS設定変更**
```
対象ドメイン: dive-buddys.com

設定内容（Railway画面の指示に従って）:
パターンA（Aレコードの場合）:
- ホスト名: 空白（またはwww）
- TYPE: A
- VALUE: [Railway表示のIPアドレス]

パターンB（CNAMEの場合）:
- ホスト名: 空白（またはwww） 
- TYPE: CNAME
- VALUE: [Railway表示のドメイン名]

TTL: 3600（デフォルト）
```

### **Step 2-3: 設定保存・反映確認**
```
1. 「確認画面へ進む」をクリック
2. 設定内容を確認して「設定する」をクリック
3. 反映時間: 最大24時間（通常1-2時間）
```

---

## 🔍 **Phase 3: 接続確認・動作テスト**

### **Step 3-1: DNS反映確認**
```bash
# 基本DNS確認
nslookup dive-buddys.com

# 詳細DNS確認
dig dive-buddys.com

# パブリックDNSサーバーで確認（より正確）
nslookup dive-buddys.com 8.8.8.8
nslookup dive-buddys.com 1.1.1.1

# 期待結果例:
# dive-buddys.com has address 35.185.44.232
# または dive-buddys.com CNAME xxxxx.railway.app
```

### **Step 3-2: HTTPS接続確認**
```bash
# HTTPSヘッダー確認
curl -I https://dive-buddys.com

# 詳細SSL証明書確認  
curl -vI https://dive-buddys.com 2>&1 | grep -E "(SSL|TLS|certificate)"

# HTTP→HTTPS リダイレクト確認
curl -I http://dive-buddys.com

# 期待結果:
# HTTP/2 200 OK または HTTP/1.1 200 OK
# SSL certificate verify ok
# Location: https://dive-buddys.com (リダイレクト時)
```

### **Step 3-3: 機能別確認コマンド**
```bash
# Web App確認
curl -s https://dive-buddys.com | grep -i "title\|jiji\|dive"

# API エンドポイント確認
curl -s https://dive-buddys.com/api/health
curl -s https://dive-buddys.com/api/stats

# 応答時間測定
time curl -s https://dive-buddys.com > /dev/null

# 期待結果:
# {"status":"ok","timestamp":"..."}  (health check)
# 3秒以内の応答時間
```

### **Step 3-3: 機能確認**
```
確認項目:
☑️ https://dive-buddys.com でアクセス可能
☑️ SSL証明書正常取得（緑色のロックマーク）
☑️既存機能正常動作（Web App）
☑️ API エンドポイント正常応答
☑️ Static ファイル正常配信
```

---

## 🤖 **Phase 4: LINE Bot Webhook URL更新**

### **Step 4-1: LINE Developers Console**
```
URL: https://developers.line.biz/console/
Channel ID: 2007331165

更新内容:
旧Webhook URL: https://jiji-bot-production.up.railway.app/webhook
新Webhook URL: https://dive-buddys.com/webhook
```

### **Step 4-2: Webhook設定更新**
```
1. 該当チャンネル選択
2. 「Messaging API設定」タブ
3. 「Webhook URL」を新URLに変更
4. 「検証」ボタンで接続確認
5. 「更新」をクリック
```

### **Step 4-3: LINE Bot動作確認**
```
確認方法:
1. LINEアプリで該当Botにメッセージ送信
2. 正常応答確認
3. Railway ログでWebhook受信確認
```

---

## 🚨 **トラブルシューティング**

### **よくある問題と対処法**

#### **DNS反映が遅い場合**
```bash
# DNSキャッシュクリア（OS別）
# macOS
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Windows  
ipconfig /flushdns

# Linux
sudo systemctl restart systemd-resolved
# または
sudo service nscd restart

# パブリックDNSで直接確認
nslookup dive-buddys.com 8.8.8.8
nslookup dive-buddys.com 1.1.1.1
nslookup dive-buddys.com 208.67.222.222

# DNS伝播状況確認
dig @8.8.8.8 dive-buddys.com
dig @1.1.1.1 dive-buddys.com
```

#### **SSL証明書エラーの場合**
```bash
# SSL詳細確認
openssl s_client -connect dive-buddys.com:443 -servername dive-buddys.com

# SSL証明書情報取得
echo | openssl s_client -connect dive-buddys.com:443 2>/dev/null | openssl x509 -text -noout

# SSL証明書の有効期限確認
echo | openssl s_client -connect dive-buddys.com:443 2>/dev/null | openssl x509 -enddate -noout
```

#### **接続テスト・デバッグ**
```bash
# 接続可能性確認
telnet dive-buddys.com 80
telnet dive-buddys.com 443

# トレースルート確認
traceroute dive-buddys.com

# ポートスキャン
nmap -p 80,443 dive-buddys.com

# HTTP/HTTPSレスポンス比較
diff <(curl -s http://dive-buddys.com) <(curl -s https://dive-buddys.com)
```

#### **SSL証明書エラーの場合**
```
1. Railway側で「Force SSL」を一時無効化
2. HTTP接続確認後、再度有効化
3. 証明書取得まで15-30分待機
```

#### **404エラーの場合**
```
確認項目:
- Railway環境の稼働状況
- 環境変数の設定確認
- ログ出力の確認
```

---

## ✅ **完了チェックリスト**

### **Phase 3完了基準**
```
☑️ https://dive-buddys.com でアクセス可能
☑️ SSL証明書正常取得・表示
☑️ Web App正常動作（既存機能）
☑️ API エンドポイント正常応答
☑️ LINE Bot正常動作（新Webhook）
☑️ 旧URLからの自動リダイレクト確認
```

### **次工程への引き継ぎ**
```
完了時に報告内容:
1. 設定完了日時
2. 動作確認結果
3. 発生した問題・解決策
4. パフォーマンス確認結果
5. 次工程（Phase 4以降）準備状況
```

---

## 📞 **完了報告フォーマット**

```
🎉 Phase 3完了報告

✅ 完了項目:
- Railway カスタムドメイン設定: 完了
- DNS設定変更: 完了  
- HTTPS接続確認: 完了
- LINE Bot Webhook更新: 完了

📊 確認結果:
- アクセス: https://dive-buddys.com ✅
- SSL証明書: 正常取得 ✅  
- 応答時間: X秒 ✅
- LINE Bot: 正常動作 ✅

🚀 次工程準備完了
- 既存機能: 全て正常稼働
- 統合基盤: 完全準備完了
- Phase 4以降: 開始可能
```