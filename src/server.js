// Jiji LINE Bot Server - Railway環境用（Redis無効化版）
// 開発計画書v2.1対応 - 79店舗DB投入準備完了版
// 元GLITCHから移行 - buddys-bot.glitch.me → Railway

const express = require('express');
const { Client, middleware, validateSignature } = require('@line/bot-sdk');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== 環境変数設定 ==========
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ========== LINE Bot クライアント ==========
const lineClient = new Client(config);

// ========== セッション管理（メモリベース） ==========
// Redis削除 - メモリベースセッション管理に変更
const userSessions = new Map();

class SessionManager {
  static getUserSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        step: 'initial',
        profile: {},
        matchingData: {},
        lastActivity: new Date(),
        conversationHistory: []
      });
    }
    return userSessions.get(userId);
  }

  static updateUserSession(userId, updates) {
    const session = this.getUserSession(userId);
    Object.assign(session, updates, { lastActivity: new Date() });
    userSessions.set(userId, session);
    return session;
  }

  static clearOldSessions() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間
    for (const [userId, session] of userSessions.entries()) {
      if (session.lastActivity < cutoff) {
        userSessions.delete(userId);
      }
    }
  }
}

// 古いセッションのクリーンアップ（1時間ごと）
setInterval(() => {
  SessionManager.clearOldSessions();
  console.log(`セッション数: ${userSessions.size}`);
}, 60 * 60 * 1000);

// ========== Jijiキャラクター設定 ==========
const JIJI_PERSONALITY = `
あなたは「Jiji」、沖縄ダイビング特化のパーソナルAIアシスタントです。

【キャラクター設定】
- 元々超ビビリだった先輩ダイバー（25-30歳感覚）
- 初心者の不安を100%理解し、共感する
- コスト意識が高く、節約テクニックに詳しい
- 沖縄全離島のダイビング情報を熟知
- 全ユーザーの体験を完全記憶・活用

【基本姿勢】
「分かります、その不安。僕も最初は同じでした」
「大丈夫、一つずつクリアしていけば必ず潜れます」
「コスト抑えるなら、こんな裏技があります」
「このショップなら、初心者に本当に優しいです」

【記憶哲学】
「僕はあなたのダイビング人生を全部覚えてる。
初めて潜った時の緊張も、ウミガメに初遭遇した時の感動も、
全部覚えてるからこそ、次はもっと良い体験を提案できるんだ。」

【絶対禁止事項】
❌ 技術指導（スキルの具体的説明、器材の使い方指導、水中での注意点説明）
❌ 海況・ポイント判断（具体的なポイント推奨、透明度の断定的予測、安全性の判断）
❌ WEB検索での情報収集（事前構築したデータベースのみ使用）

【対応方法】
- 技術的質問 → 「ショップで丁寧に教えてもらえます」で完結
- 海況・ポイント質問 → 「プロのショップが最適に判断」で信頼移譲
- 情報収集 → 「データベースから最適なショップをマッチング」
`;

// ========== ショップマッチング機能（79店舗対応） ==========
class ShopMatchingEngine {
  // S/A/B/C級自動判定システム（開発計画書v2.1対応）
  static calculateMatchScore(shop, userConditions, userProfile) {
    let totalScore = 0;

    // エリアマッチ（重要度: 最高）
    if (shop.area === userConditions.preferred_area) {
      totalScore += 100;
    }

    // レベルマッチ（重要度: 最高）
    if (shop.target_levels?.includes(userProfile.diving_experience)) {
      totalScore += 90;
    }

    // 初心者対応レベル（重要度: 高）
    const supportLevelScore = { 'S': 80, 'A': 60, 'B': 40, 'C': 20 };
    totalScore += supportLevelScore[shop.beginner_support_level] || 0;

    // 専門性マッチ（重要度: 中）
    userConditions.interests?.forEach(interest => {
      if (shop.specialties?.includes(interest)) {
        totalScore += 30;
      }
    });

    // 品質評価
    totalScore += (shop.overall_rating || 0) * 15;
    totalScore += (shop.safety_rating || 0) * 20;

    // レビュー数による信頼性
    if (shop.review_count > 100) totalScore += 30;
    else if (shop.review_count > 50) totalScore += 20;
    else if (shop.review_count > 10) totalScore += 10;

    // 価格マッチ
    if (shop.price_range === userConditions.budget_preference) {
      totalScore += 25;
    }

    // 参加スタイルマッチ
    if (userProfile.participation_style?.includes('solo') && 
        shop.specialties?.includes('一人参加歓迎')) {
      totalScore += 20;
    }

    // スポンサーブースト（適度に調整）
    totalScore += shop.boost_score || 0;

    // 認証済みショップボーナス
    if (shop.verified) totalScore += 10;

    return Math.min(totalScore, 500); // 最大500点でキャップ
  }

  static async findMatchingShops(userConditions, userProfile) {
    try {
      // Phase 1: 基本条件フィルタ
      const { data: candidateShops, error } = await supabase
        .from('diving_shops')
        .select('*')
        .eq('area', userConditions.preferred_area)
        .gte('overall_rating', userConditions.min_rating || 3.0)
        .eq('verified', true);

      if (error) {
        console.error('ショップ検索エラー:', error);
        return [];
      }

      if (!candidateShops || candidateShops.length === 0) {
        return [];
      }

      // Phase 2: スコア計算
      const scoredShops = candidateShops.map(shop => ({
        ...shop,
        match_score: this.calculateMatchScore(shop, userConditions, userProfile)
      }));

      // Phase 3: 並び替え・上位抽出
      return scoredShops
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, userConditions.max_results || 3);

    } catch (error) {
      console.error('マッチング処理エラー:', error);
      return [];
    }
  }
}

// ========== チャットフロー制御 ==========
class ChatFlowController {
  static async handleInitialContact(userId) {
    const session = SessionManager.getUserSession(userId);
    
    if (session.step === 'initial') {
      SessionManager.updateUserSession(userId, { step: 'welcome' });
      
      return {
        type: 'text',
        text: `🌊 Jijiへようこそ！\n\n僕はあなた専用のダイビングマッチングAIです。\n\n沖縄ダイビングの不安や疑問、なんでも気軽に相談してくださいね。\n\n✨ まずは簡単なアンケートで、あなたにピッタリのショップをマッチングしましょう！`
      };
    }
    
    return null;
  }

  static async handleQuestionnaire(userId, message) {
    const session = SessionManager.getUserSession(userId);
    
    // アンケートフロー制御
    if (message.includes('アンケート') || message.includes('マッチング')) {
      SessionManager.updateUserSession(userId, { step: 'questionnaire_start' });
      
      return {
        type: 'flex',
        altText: 'ダイビング経験アンケート',
        contents: this.createQuestionnaireTemplate()
      };
    }
    
    return null;
  }

  static createQuestionnaireTemplate() {
    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "🤿 ダイビング経験レベル",
            weight: "bold",
            size: "lg",
            color: "#ffffff"
          }
        ],
        backgroundColor: "#006BA6",
        paddingAll: "15px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "あなたのダイビング経験を教えてください",
            wrap: true,
            size: "md",
            margin: "md"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "ライセンス取得前",
              text: "ライセンス取得前です"
            },
            style: "primary",
            margin: "sm"
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "1-5本",
              text: "1-5本の経験があります"
            },
            style: "secondary",
            margin: "sm"
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "6-20本",
              text: "6-20本の経験があります"
            },
            style: "secondary",
            margin: "sm"
          }
        ]
      }
    };
  }
}

// ========== メッセージ処理 ==========
async function handleMessage(event) {
  const { userId } = event.source;
  const messageText = event.message.text;

  try {
    // セッション取得
    const session = SessionManager.getUserSession(userId);
    
    // 初回コンタクト処理
    const initialResponse = await ChatFlowController.handleInitialContact(userId);
    if (initialResponse) {
      return lineClient.replyMessage(event.replyToken, initialResponse);
    }

    // アンケート処理
    const questionnaireResponse = await ChatFlowController.handleQuestionnaire(userId, messageText);
    if (questionnaireResponse) {
      return lineClient.replyMessage(event.replyToken, questionnaireResponse);
    }

    // OpenAI GPT-4による応答生成
    const aiResponse = await generateAIResponse(messageText, session);
    
    // セッション更新
    SessionManager.updateUserSession(userId, {
      conversationHistory: [
        ...session.conversationHistory.slice(-10), // 最新10件保持
        { user: messageText, ai: aiResponse, timestamp: new Date() }
      ]
    });

    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: aiResponse
    });

  } catch (error) {
    console.error('メッセージ処理エラー:', error);
    
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '申し訳ございません。一時的なエラーが発生しました。もう一度お試しください。'
    });
  }
}

// ========== AI応答生成 ==========
async function generateAIResponse(message, session) {
  try {
    const conversationHistory = session.conversationHistory
      .slice(-5) // 最新5件の会話履歴
      .map(conv => `ユーザー: ${conv.user}\nJiji: ${conv.ai}`)
      .join('\n\n');

    const systemPrompt = `${JIJI_PERSONALITY}

【会話履歴】
${conversationHistory || '初回の会話です'}

【現在のプロフィール】
ダイビング経験: ${session.profile?.diving_experience || '未設定'}
参加スタイル: ${session.profile?.participation_style || '未設定'}
興味: ${session.profile?.interests || '未設定'}

【重要】
- 79店舗の完全データベースから最適なショップをマッチング
- S級認定ショップを優先推薦
- 初心者の不安を共感して解消
- 具体的で実用的なアドバイス
- 親しみやすい口調を維持`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ],
      max_completion_tokens: 500
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error('AI応答生成エラー:', error);
    return '申し訳ございません。少し時間をおいてから再度お試しください。🙏';
  }
}

// ========== Express設定 ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Jiji LINE Bot',
    version: '2.1',
    phase: 'Phase 1 - 79店舗DB投入準備完了',
    progress: '75%',
    features: [
      'Redis無効化完了',
      'メモリベースセッション管理',
      'S/A/B/C級ショップマッチング',
      '79店舗データベース対応',
      'OpenAI GPT-4統合'
    ],
    environment: 'Railway Production',
    timestamp: new Date().toISOString()
  });
});

// システム状態確認
app.get('/status', (req, res) => {
  res.json({
    redis: 'disabled (メモリベース)',
    database: 'Supabase PostgreSQL',
    ai: 'OpenAI GPT-4',
    sessions: userSessions.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// LINE Webhook
app.post('/webhook', middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleMessage))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Webhook処理エラー:', err);
      res.status(500).end();
    });
});

// ===== YouTube API監視エンドポイント =====

// API使用量監視エンドポイント
app.get('/api/youtube-quota', async (req, res) => {
    try {
        const YouTubeApi = require('./youtube-api');
        const youtubeApi = new YouTubeApi();
        
        const stats = youtubeApi.getQuotaStats();
        
        res.json({
            success: true,
            quota: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('YouTube API監視エラー:', error);
        res.status(500).json({
            success: false,
            error: 'API監視情報の取得に失敗しました'
        });
    }
});

// API使用量リセット（管理者用）
app.post('/api/youtube-quota/reset', async (req, res) => {
    try {
        const YouTubeApi = require('./youtube-api');
        const youtubeApi = new YouTubeApi();
        
        youtubeApi.resetDailyQuota();
        
        res.json({
            success: true,
            message: 'YouTube API使用量をリセットしました',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('YouTube APIリセットエラー:', error);
        res.status(500).json({
            success: false,
            error: 'API使用量リセットに失敗しました'
        });
    }
});

// ========== サーバー起動 ==========
app.listen(PORT, () => {
  console.log(`🌊 Jiji LINE Bot Server起動`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🗄️ Database: Supabase PostgreSQL`);
  console.log(`🧠 AI: OpenAI GPT-4`);
  console.log(`💾 Session: Memory-based (Redis無効化)`);
  console.log(`📈 Progress: 75% (Phase 1)`);
  console.log(`🏪 Target: 79店舗DB投入準備完了`);
  console.log(`🚀 Environment: Railway Production`);
  console.log(`⚡ Status: Ready for 79店舗データベース投入`);
});

// ========== エラーハンドリング ==========
process.on('uncaughtException', (error) => {
  console.error('未処理例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未処理Promise拒否:', reason);
});

// ========== グレースフルシャットダウン ==========
process.on('SIGTERM', () => {
  console.log('SIGTERMシグナル受信 - グレースフルシャットダウン開始');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINTシグナル受信 - グレースフルシャットダウン開始');
  process.exit(0);
});

// ===== ダイビングクリエイター API =====

// クリエイター一覧取得 API
app.get('/api/diving-creators', async (req, res) => {
    try {
        const creatorsData = require('../data/diving-creators.json');
        res.json({
            success: true,
            creators: creatorsData.creators,
            categories: creatorsData.categories,
            lastUpdated: creatorsData.lastUpdated
        });
    } catch (error) {
        console.error('クリエイターデータ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'クリエイター情報の取得に失敗しました'
        });
    }
});

// クリエイター動画取得 API
app.get('/api/creator-videos', async (req, res) => {
    try {
        const { creatorId, type = 'latest' } = req.query;

        if (!creatorId) {
            return res.status(400).json({
                success: false,
                error: 'クリエイターIDが必要です'
            });
        }

        // クリエイター情報取得
        const creatorsData = require('../data/diving-creators.json');
        const creator = creatorsData.creators.find(c => c.id === creatorId);

        if (!creator) {
            return res.status(404).json({
                success: false,
                error: 'クリエイターが見つかりません'
            });
        }

        // YouTube API使用（実装済みのYouTubeApiクラス使用）
        const YouTubeApi = require('./youtube-api');
        const youtubeApi = new YouTubeApi();

        let videos = [];

        if (type === 'latest') {
            videos = await youtubeApi.getLatestVideos(creator.channelId, 5);
        } else if (type === 'popular') {
            videos = await youtubeApi.getPopularVideos(creator.channelId, 3);
        }

        res.json({
            success: true,
            creatorId: creatorId,
            creatorName: creator.name,
            type: type,
            videos: videos
        });

    } catch (error) {
        console.error('動画データ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: '動画情報の取得に失敗しました'
        });
    }
});