/**
 * 🌊 Dive Buddy's リッチメニュー管理システム v2.8
 * アンケート機能統合対応
 */

const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

// LINE Bot設定
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);

/**
 * リッチメニュー管理クラス
 */
class RichMenuManager {
    
    constructor() {
        this.menuConfig = this.createMenuConfig();
    }
    
    /**
     * Dive Buddy's リッチメニュー設定
     */
    createMenuConfig() {
        return {
            size: {
                width: 2500,
                height: 1686
            },
            selected: false,
            name: "Dive Buddy's Menu v2.8",
            chatBarText: "メニュー",
            areas: [
                // 上段左: 体験相談
                {
                    bounds: { x: 0, y: 0, width: 833, height: 843 },
                    action: {
                        type: "message",
                        text: "体験相談"
                    }
                },
                // 上段中央: ショップDB
                {
                    bounds: { x: 833, y: 0, width: 834, height: 843 },
                    action: {
                        type: "message", 
                        text: "ショップDB"
                    }
                },
                // 上段右: アンケート
                {
                    bounds: { x: 1667, y: 0, width: 833, height: 843 },
                    action: {
                        type: "message",
                        text: "アンケート開始"
                    }
                },
                // 下段左: 旅行計画
                {
                    bounds: { x: 0, y: 843, width: 833, height: 843 },
                    action: {
                        type: "message",
                        text: "旅行計画"
                    }
                },
                // 下段中央: 海況情報
                {
                    bounds: { x: 833, y: 843, width: 834, height: 843 },
                    action: {
                        type: "message",
                        text: "海況情報"
                    }
                },
                // 下段右: ヘルプ
                {
                    bounds: { x: 1667, y: 843, width: 833, height: 843 },
                    action: {
                        type: "message", 
                        text: "ヘルプ"
                    }
                }
            ]
        };
    }
    
    /**
     * リッチメニュー画像作成
     */
    async createMenuImage() {
        // 実際の実装では画像作成ライブラリ（Canvas等）を使用
        // ここではサンプルとして既存画像パスを返す
        const imagePath = path.join(__dirname, '../assets/rich-menu-v28.jpg');
        
        // 画像が存在しない場合はプレースホルダー画像を作成
        if (!fs.existsSync(imagePath)) {
            console.log('⚠️ リッチメニュー画像が見つかりません。プレースホルダーを使用します。');
            return this.createPlaceholderImage();
        }
        
        return imagePath;
    }
    
    /**
     * プレースホルダー画像作成（開発用）
     */
    createPlaceholderImage() {
        // 実際の実装では Canvas で画像生成
        return null; // 今回は省略
    }
    
    /**
     * リッチメニューをLINEに登録
     */
    async createRichMenu() {
        try {
            console.log('🎨 リッチメニュー作成開始...');
            
            // 1. リッチメニューオブジェクト作成
            const richMenu = await client.createRichMenu(this.menuConfig);
            console.log('✅ リッチメニューオブジェクト作成完了:', richMenu.richMenuId);
            
            // 2. 画像アップロード
            const imagePath = await this.createMenuImage();
            if (imagePath && fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                await client.setRichMenuImage(richMenu.richMenuId, imageBuffer);
                console.log('🖼️ リッチメニュー画像アップロード完了');
            } else {
                console.log('⚠️ 画像なしでリッチメニューを作成しました');
            }
            
            return richMenu.richMenuId;
            
        } catch (error) {
            console.error('❌ リッチメニュー作成エラー:', error);
            throw error;
        }
    }
    
    /**
     * デフォルトリッチメニューとして設定
     */
    async setAsDefault(richMenuId) {
        try {
            await client.setDefaultRichMenu(richMenuId);
            console.log('✅ デフォルトリッチメニュー設定完了:', richMenuId);
        } catch (error) {
            console.error('❌ デフォルトリッチメニュー設定エラー:', error);
            throw error;
        }
    }
    
    /**
     * 特定ユーザーにリッチメニューを設定
     */
    async setUserRichMenu(userId, richMenuId) {
        try {
            await client.linkRichMenuToUser(userId, richMenuId);
            console.log(`✅ ユーザー固有リッチメニュー設定完了: ${userId}`);
        } catch (error) {
            console.error('❌ ユーザーリッチメニュー設定エラー:', error);
            throw error;
        }
    }
    
    /**
     * 既存リッチメニューの削除
     */
    async deleteExistingMenus() {
        try {
            const richMenus = await client.getRichMenuList();
            
            for (const menu of richMenus) {
                try {
                    await client.deleteRichMenu(menu.richMenuId);
                    console.log(`🗑️ 既存リッチメニュー削除: ${menu.richMenuId}`);
                } catch (deleteError) {
                    console.log(`⚠️ リッチメニュー削除スキップ: ${menu.richMenuId}`);
                }
            }
            
        } catch (error) {
            console.error('❌ 既存メニュー削除エラー:', error);
        }
    }
    
    /**
     * リッチメニューの完全セットアップ
     */
    async setupCompleteRichMenu() {
        try {
            console.log('🚀 Dive Buddy\'s リッチメニューセットアップ開始');
            
            // 1. 既存メニューをクリーンアップ
            await this.deleteExistingMenus();
            
            // 2. 新しいリッチメニュー作成
            const richMenuId = await this.createRichMenu();
            
            // 3. デフォルトとして設定
            await this.setAsDefault(richMenuId);
            
            console.log('🎉 リッチメニューセットアップ完了!');
            return richMenuId;
            
        } catch (error) {
            console.error('❌ リッチメニューセットアップ失敗:', error);
            throw error;
        }
    }
    
    /**
     * リッチメニュークリック分析記録
     */
    async recordMenuAnalytics(userId, menuAction) {
        try {
            const db = require('./database');
            
            await db.query(`
                INSERT INTO rich_menu_analytics (user_id, menu_action, access_count, first_access, last_access)
                VALUES (?, ?, 1, NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                    access_count = access_count + 1,
                    last_access = NOW()
            `, [userId, menuAction]);
            
            console.log(`📊 リッチメニュー分析記録: ${userId} - ${menuAction}`);
            
        } catch (error) {
            console.error('❌ メニュー分析記録エラー:', error);
        }
    }
    
    /**
     * メニューアクション処理
     */
    async handleMenuAction(userId, action) {
        // 分析記録
        await this.recordMenuAnalytics(userId, action);
        
        // アクション別処理
        switch (action) {
            case '体験相談':
                return this.handleExperienceConsultation();
            case 'ショップDB':
                return this.handleShopDatabase();
            case 'アンケート開始':
                return this.handleSurveyStart();
            case '旅行計画':
                return this.handleTravelPlanning();
            case '海況情報':
                return this.handleOceanConditions();
            case 'ヘルプ':
                return this.handleHelp();
            default:
                return this.handleUnknownAction();
        }
    }
    
    /**
     * 各メニューアクション処理メソッド
     */
    
    handleExperienceConsultation() {
        return {
            type: 'consultation',
            message: `🤿 体験相談へようこそ！\n\n` +
                    `ダイビングについて何でも相談してくださいね。\n` +
                    `初心者の方も経験者の方も、\n` +
                    `沖縄の海を最大限楽しめるよう\n` +
                    `Jijiがサポートします！✨\n\n` +
                    `例えば：\n` +
                    `「初心者におすすめのエリアは？」\n` +
                    `「マンタを見たいです」\n` +
                    `「予算○万円で楽しみたい」\n\n` +
                    `何でも気軽に聞いてくださいね🌊`
        };
    }
    
    handleShopDatabase() {
        return {
            type: 'shop_database',
            message: `🏪 ショップデータベースへようこそ！\n\n` +
                    `沖縄全域の厳選ダイビングショップを\n` +
                    `検索・比較できます。\n\n` +
                    `💡 使い方：\n` +
                    `「石垣島のショップを見たい」\n` +
                    `「初心者向けのショップ教えて」\n` +
                    `「ショップをマッチング」\n\n` +
                    `あなたにピッタリのショップを\n` +
                    `見つけましょう！🔍`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🏝️ 石垣島のショップ',
                            text: '石垣島のショップを見たい'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message', 
                            label: '🌺 宮古島のショップ',
                            text: '宮古島のショップを見たい'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🤿 初心者向け',
                            text: '初心者向けのショップ教えて'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🎯 マッチング',
                            text: 'ショップをマッチング'
                        }
                    }
                ]
            }
        };
    }
    
    handleSurveyStart() {
        return {
            type: 'survey_trigger',
            message: 'survey_start' // survey-manager.js で処理
        };
    }
    
    handleTravelPlanning() {
        return {
            type: 'travel_planning',
            message: `✈️ 沖縄ダイビング旅行計画\n\n` +
                    `完璧な沖縄ダイビング旅行を\n` +
                    `一緒に計画しましょう！\n\n` +
                    `🗓️ 提案できること：\n` +
                    `• 最適な時期・日程\n` +
                    `• 予算計算・見積もり\n` +
                    `• 航空券・宿泊手配\n` +
                    `• ダイビング本数プラン\n` +
                    `• 観光・グルメ情報\n\n` +
                    `「○月に○日間行きたい」\n` +
                    `「予算○万円で計画したい」\n` +
                    `など、お聞かせください🏝️`
        };
    }
    
    handleOceanConditions() {
        return {
            type: 'ocean_conditions',
            message: `🌊 沖縄海況・天気情報\n\n` +
                    `最新の海況情報をお伝えします！\n\n` +
                    `📊 提供情報：\n` +
                    `• 各エリアの海況\n` +
                    `• 透明度・水温情報\n` +
                    `• 風向き・波高\n` +
                    `• 週間天気予報\n` +
                    `• ダイビング適合度\n\n` +
                    `知りたいエリアを教えてくださいね：\n` +
                    `「石垣島の海況は？」\n` +
                    `「今週の天気予報教えて」☀️`
        };
    }
    
    handleHelp() {
        return {
            type: 'help',
            message: `❓ Dive Buddy's ヘルプ\n\n` +
                    `🌺 Jijiの使い方をご案内します！\n\n` +
                    `💬 基本的な相談：\n` +
                    `普通に話しかけるだけでOK！\n` +
                    `「マンタ見たい」「初心者です」など\n\n` +
                    `🎯 特別機能：\n` +
                    `• 「ショップをマッチング」\n` +
                    `• 「アンケート開始」\n` +
                    `• 「旅行計画」\n\n` +
                    `📋 リッチメニュー：\n` +
                    `下のメニューから機能にアクセス\n\n` +
                    `🆘 困った時：\n` +
                    `「ヘルプ」と送ってもらえれば\n` +
                    `いつでもサポートします！✨`
        };
    }
    
    handleUnknownAction() {
        return {
            type: 'unknown',
            message: `すみません、そのメニューは\n` +
                    `まだ対応していません。\n\n` +
                    `何か他にお手伝いできることが\n` +
                    `あれば気軽に話しかけてくださいね🌊`
        };
    }
}

// シングルトンエクスポート
const richMenuManager = new RichMenuManager();

module.exports = {
    RichMenuManager,
    richMenuManager
};