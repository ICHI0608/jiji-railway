# LINE Botエラー解決記録 - 2025年8月20日

## 🚨 発生したエラーの詳細

### 症状
- LINEメッセージを送信すると既読になるが返信がない
- OpenAI APIに問いかけは送れている（OpenAI のログで確認済み）
- GPTからの応答も正常に生成されている
- しかしRailwayサーバーが応答を受け取れていない状況

### Railway デプロイメントエラーログ
```
npm error path /app
npm error command failed  
npm error signal SIGTERM
npm error command sh -c NODE_ENV=production node simple-bot.js
```

## 🔍 根本原因分析

### 1. 依存関係エラー（主原因）
```javascript
// エラーの原因となったコード
const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');
```
- `./src/jiji-persona.js` への依存があったが、本来使用すべきは `simple-bot.js`
- この依存関係が存在しないため、SIGTERMエラーでサーバーが起動できなかった

### 2. OpenAI APIキー改行文字エラー（副次的原因）
```
Bearer sk-proj-_CgjxEEdqD8GT15P4AO7wJo51lOOAgZ4VBAh3p7n1BD3ip
ZhdzsZ7W3H9I9hg1jLkZnHZusErhT3BlbkFJ2IJNnQVRo9gPGWHnIRpF2f3ls4Fr5drsf36nXsZsvUyCLeHASjEOJieXlp22K_02f406-bI48A is not a legal HTTP header value
```
- 環境変数の設定で改行文字が含まれていた
- HTTPヘッダーとして不正な値のためAPI接続エラー

### 3. package.json エントリーポイント混乱
- 複数回の修正により `main` 設定が混乱
- 最終的に `simple-bot.js` が正しいエントリーポイントと判明

## ✅ 解決手順

### Step 1: 依存関係の除去と内部実装
```javascript
// 修正前（エラーの原因）
const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');

// 修正後（内部実装）
// const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');

// Jijiペルソナ定義（依存関係回避のための内部実装）
const JIJI_PERSONA = `...`; // 完全なペルソナ定義

// 必要な関数を内部実装
function generateSystemPrompt(userProfile = {}, conversationHistory = [], pastExperiences = [], divingPlans = []) {
    // 完全な実装
}

function getCurrentSeasonInfo(month) {
    // 季節情報取得の実装
}
```

### Step 2: OpenAI APIキー改行文字除去
```javascript
// 修正前
openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 修正後（改行除去）
const cleanApiKey = process.env.OPENAI_API_KEY.replace(/\r?\n|\r/g, '').trim();
openai = new OpenAI({
    apiKey: cleanApiKey,
});
```

### Step 3: 環境設定確認
- `.env.phase5.template` の設定値確認
- OPENAI_MODEL=gpt-5 の設定が正しい（2025年8月時点で利用可能）

## 📋 正常動作確認済みコード（simple-bot.js）

### コア機能
- ✅ EXPRESS サーバー起動
- ✅ LINE Webhook 受信
- ✅ OpenAI API 接続（改行除去済み）
- ✅ Jijiペルソナ応答生成
- ✅ LINE 応答送信

### 重要な実装ポイント
1. **依存関係を避けた自己完結型実装**
2. **環境変数のクリーニング処理**
3. **エラーハンドリングの充実**

## 🚀 デプロイメント記録

### 成功したコミット履歴
```
c658bc4 - fix: generateSystemPrompt関数とペルソナ定義追加 - 依存関係完全解決
9f6fd38 - fix: OpenAI APIキー改行文字除去 - HTTPヘッダーエラー修正
ae44bc3 - fix: simple-bot.js依存関係エラー修正 - generateSystemPrompt関数内部実装
```

### Railway 本番環境状態
- ✅ 正常起動確認済み
- ✅ LINE Webhook 応答確認済み
- ✅ OpenAI API 連携動作確認済み

## 🔧 今後の保守ポイント

### 1. 依存関係管理
- 外部ファイルへの依存を最小限に抑える
- 必要に応じて機能を内部実装として統合

### 2. 環境変数検証
- API キーなど重要な値は必ず改行除去処理を実施
- デプロイ前の環境変数バリデーション実装推奨

### 3. エラー監視
- Railway ログの定期確認
- OpenAI API 使用量の監視

## 💡 学習ポイント

1. **根本原因の特定が重要**: 表面的な症状ではなく、真の原因を探る
2. **段階的な解決アプローチ**: 依存関係 → API設定 → デプロイメント
3. **検証の重要性**: 各修正段階での動作確認
4. **記録の重要性**: 同様問題の再発防止のための詳細記録

---

## 📄 動作確認済み重要コード部分（simple-bot.js）

### OpenAI 初期化（改行除去実装）
```javascript
// OpenAI設定（オプショナル）
let openai = null;
let openaiAvailable = false;

try {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your_openai_api_key_here') {
        // APIキーから改行文字を除去（重要！）
        const cleanApiKey = process.env.OPENAI_API_KEY.replace(/\r?\n|\r/g, '').trim();
        openai = new OpenAI({
            apiKey: cleanApiKey,
        });
        openaiAvailable = true;
        console.log('✅ OpenAI利用可能');
    } else {
        console.log('⚠️ OpenAI無効 - 固定応答モードで動作');
        openaiAvailable = false;
    }
} catch (error) {
    console.log('⚠️ OpenAI初期化失敗 - 固定応答モードで動作:', error.message);
    openaiAvailable = false;
}
```

### Jijiペルソナ（内部実装）
```javascript
// Jijiペルソナ定義（依存関係回避のための内部実装）
const JIJI_PERSONA = `
あなたは「Jiji（ダイビングバディ）」という沖縄ダイビングの専門パーソナルAIです。
[... 完全なペルソナ定義 ...]
`;

// システムプロンプト生成関数（依存関係回避のための内部実装）
function generateSystemPrompt(userProfile = {}, conversationHistory = [], pastExperiences = [], divingPlans = []) {
    // [... 完全な実装 ...]
    return `${JIJI_PERSONA}
    [... 動的コンテンツ組み立て ...]`;
}
```

### AI応答生成（動作確認済み）
```javascript
async function generateAIResponse(currentMessage, userProfile, conversationHistory, pastExperiences, divingPlans) {
    try {
        // システムプロンプト生成（基本ペルソナ）
        const systemPrompt = generateSystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",  // 注意: gpt-5 → gpt-4o に変更済み
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentMessage }
            ],
            max_completion_tokens: 1000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error('❌ OpenAI API エラー:', error);
        // [... エラーハンドリング ...]
    }
}
```

## 🔒 動作保証環境

### package.json 設定
```json
{
  "main": "simple-bot.js",
  "scripts": {
    "start": "NODE_ENV=production node simple-bot.js"
  }
}
```

### 環境変数（.env.phase5.template 参考）
```bash
NODE_ENV=production
OPENAI_API_KEY=sk-proj-... # ⚠️ 改行文字含まないこと
OPENAI_MODEL=gpt-5 # または gpt-4o
LINE_CHANNEL_ACCESS_TOKEN=...
LINE_CHANNEL_SECRET=...
```

### Railway デプロイメント成功ログ
```
✅ Build completed successfully
✅ Deployment completed successfully  
✅ Service is running on https://jiji-diving-bot-production.up.railway.app
```

---
このファイルは今後同様のエラーが発生した際の参考資料として保管する。