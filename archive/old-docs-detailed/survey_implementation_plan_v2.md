# 🌊 Jiji アンケート実装計画 v2.0
**【リッチメニュー対応・初回必須・会話重視設計】**

## 🎯 アンケートの役割定義

### **📋 基本方針**
- **目的**: 初回ユーザープロファイル構築のみ
- **位置づけ**: マッチングの「出発点」であり「最終判断材料」ではない
- **重要度**: 会話分析 > アンケートデータ

### **🔄 マッチング戦略**
```
アンケート（基礎理解） 
    ↓
日常会話での深い理解（メイン）
    ↓ 
「ショップをマッチング」発言時
    ↓
総合判定でショップ3選提示
```

---

## 🖱️ リッチメニュー設計

### **📱 リッチメニュー構成**
```
┌─────────────────────────────┐
│  🌺 Dive Buddy's Menu      │
├─────────┬─────────┬─────────┤
│   🤿    │   🏪    │   📋    │
│体験相談  │ショップDB │アンケート │
├─────────┼─────────┼─────────┤
│   🗓️    │   ☀️    │   ❓    │
│旅行計画  │ 海況情報 │ ヘルプ   │
└─────────┴─────────┴─────────┘
```

### **📋 アンケートボタン仕様**
- **ラベル**: 「📋 アンケート」
- **アクション**: 「プロファイル設定」「簡単アンケート」
- **表示条件**: 常時表示（何度でも更新可能）

---

## 🚀 実装フロー設計

### **✨ 初回登録時（必須）**

#### **1. 友だち追加直後**
```
🌺 はいさい！Dive Buddy'sのJijiだよ！
沖縄ダイビングの専属バディとして
サポートさせてもらうね✨

まずは簡単なアンケート（3問30秒）で
あなたのことを教えてもらえる？

【アンケートを開始する】 ボタン
```

#### **2. アンケート完了後**
```
ありがとう！🙏
これで基本的なプロファイルができました。

これからの会話の中で、
あなたの好みや状況をもっと
深く理解していくからね。

何でも気軽に相談してください！
沖縄の海のことなら任せて🌊
```

### **🔄 リッチメニューからの呼び出し**

#### **1. アンケート済みユーザー**
```
📋 プロファイル更新

現在の設定:
🤿 ダイビング経験: アドバンス
🏝️ 沖縄経験: 石垣島
💭 関心事: 大物狙い

設定を更新しますか？

【はい、更新する】
【いいえ、戻る】
```

#### **2. アンケート未実施ユーザー**
```
📋 プロファイル設定

より良い提案のために、
簡単なアンケートにお答えください

【アンケートを開始する】
【後で回答する】
```

---

## 🧠 会話重視マッチングロジック

### **📊 判定ウェイト配分**
```
マッチング判定要素:
├── 会話履歴分析: 70%
│   ├── 最近の質問内容（興味・関心）
│   ├── 過去の反応（ポジティブ/ネガティブ）
│   ├── 専門用語理解度
│   ├── 予算・時期に関する言及
│   └── 旅行スタイル（一人/グループ/家族）
│
├── ユーザープロファイル: 20%
│   ├── 会話回数・関係性
│   ├── 過去の推薦への反応
│   └── リピート相談パターン
│
└── アンケートデータ: 10%
    ├── 基礎経験レベル
    ├── ライセンス種類
    └── 基本的な関心分野
```

### **💡 会話分析重視例**

#### **ケース1: アンケートvs会話の乖離**
```
アンケート: 「初心者・安全重視」
最近の会話: 「アドバンス取得した」「マンタ以外も見たい」「宮古島の地形に興味」

→ 判定: 会話内容を優先してアドバンス向けショップを推薦
```

#### **ケース2: 段階的成長の検知**
```
アンケート: 「体験ダイビングのみ」
3ヶ月後の会話: 「ライセンス取った」「もっと深いところも潜りたい」

→ 判定: 成長を考慮したステップアップショップを推薦
```

---

## 🔧 技術実装仕様

### **📱 LINE Bot実装**

#### **1. リッチメニュー設定**
```javascript
// リッチメニュー設定
const richMenuConfig = {
    size: { width: 2500, height: 1686 },
    selected: false,
    name: "Dive Buddy's Menu",
    chatBarText: "メニュー",
    areas: [
        {
            bounds: { x: 0, y: 0, width: 833, height: 843 },
            action: { type: "message", text: "体験相談" }
        },
        {
            bounds: { x: 833, y: 0, width: 834, height: 843 },
            action: { type: "message", text: "ショップDB" }
        },
        {
            bounds: { x: 1667, y: 0, width: 833, height: 843 },
            action: { type: "message", text: "アンケート開始" }
        }
        // ... 他のメニュー項目
    ]
};
```

#### **2. アンケート状態管理**
```javascript
// ユーザー状態管理
const userStates = {
    NORMAL: 'normal',
    SURVEY_Q1: 'survey_q1',
    SURVEY_Q1_5: 'survey_q1_5', 
    SURVEY_Q2: 'survey_q2',
    SURVEY_COMPLETE: 'survey_complete'
};

// アンケート進行管理
async function handleSurveyFlow(userId, userInput, currentState) {
    switch(currentState) {
        case userStates.SURVEY_Q1:
            return await processSurveyQ1(userId, userInput);
        case userStates.SURVEY_Q1_5:
            return await processSurveyQ1_5(userId, userInput);
        // ...
    }
}
```

#### **3. プロファイル管理**
```javascript
// プロファイル構造
const userProfile = {
    userId: "LINE_USER_ID",
    surveyData: {
        experience_level: "beginner/intermediate/advanced",
        license_type: "none/owd/aow/rescue",
        okinawa_areas: ["ishigaki", "miyako", "mainland"],
        main_interests: ["safety", "big_fish", "coral", "caves"],
        survey_completed: true,
        last_updated: "2025-07-24"
    },
    conversationProfile: {
        total_messages: 25,
        recent_interests: ["manta", "ishigaki", "budget"],
        skill_progression: "improving",
        travel_style: "solo",
        last_interaction: "2025-07-24"
    }
};
```

### **🤖 マッチング判定システム**
```javascript
// 総合マッチング判定
async function generateShopMatching(userId) {
    const profile = await getUserProfile(userId);
    const conversationHistory = await getConversationHistory(userId, 20);
    
    // 会話分析（70%ウェイト）
    const conversationAnalysis = analyzeConversations(conversationHistory);
    
    // プロファイル分析（20%ウェイト）
    const profileAnalysis = analyzeUserProfile(profile);
    
    // アンケート分析（10%ウェイト）
    const surveyAnalysis = analyzeSurveyData(profile.surveyData);
    
    // 総合判定
    const matchingCriteria = {
        experience_level: conversationAnalysis.skill_level,
        interests: conversationAnalysis.main_interests,
        budget_range: conversationAnalysis.budget_hints,
        travel_style: conversationAnalysis.travel_style,
        safety_priority: surveyAnalysis.safety_focus
    };
    
    return await findBestShops(matchingCriteria, 3);
}
```

---

## 📊 データベース設計

### **🗄️ テーブル構造**

#### **user_surveys（アンケート基礎データ）**
```sql
CREATE TABLE user_surveys (
    user_id VARCHAR(255) PRIMARY KEY,
    experience_level ENUM('beginner', 'intermediate', 'advanced'),
    license_type ENUM('none', 'owd', 'aow', 'rescue'),
    okinawa_experience JSON,
    main_concerns JSON,
    survey_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### **conversation_insights（会話分析データ）**
```sql
CREATE TABLE conversation_insights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255),
    insight_type ENUM('interest', 'skill_level', 'budget', 'travel_style'),
    insight_value TEXT,
    confidence_score DECIMAL(3,2),
    source_message_id INT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_insights (user_id, insight_type)
);
```

---

## 🎯 成功指標・KPI

### **📈 アンケート効果測定**
- アンケート完了率: 目標85%以上
- 初回マッチング精度: ユーザー満足度4.0以上
- 会話継続率: アンケート済みユーザーで+30%向上

### **🔍 マッチング精度向上**
- 会話ベースマッチング: 従来比+40%精度向上
- 段階的理解: 3回以上会話後の推薦精度90%以上
- ユーザー成長追従: レベルアップ検知率80%以上

---

## 📅 実装スケジュール

### **Phase 1: 基本機能（1週間）**
- リッチメニュー設定
- アンケートフロー実装
- 基本プロファイル管理

### **Phase 2: 会話分析強化（1週間）**
- 会話履歴分析エンジン
- 動的プロファイル更新
- マッチング重み付け調整

### **Phase 3: 最適化・改善（継続）**
- ユーザーフィードバック分析
- マッチング精度改善
- 新機能追加検討

---

これでアンケートは「初期理解のツール」として位置づけ、実際のマッチングは「会話からの深い理解」をメインとする設計が完成しました。実装に進みますか？