/**
 * Jiji沖縄ダイビングバディ - V2.8 ポイントシステム
 * ユーザーエンゲージメント向上とB2B収益化の核心機能
 * ポイント獲得・交換・管理システム
 */

const { 
    addUserPoints, 
    getUserPointBalance, 
    createPointTransaction, 
    getPointTransactionHistory,
    updateUserProfile,
    getUserProfile
} = require('./database');

/**
 * V2.8 ポイントマネージャークラス
 * ポイント獲得・交換・ランク管理の統合システム
 */
class PointManager {
    constructor() {
        // V2.8: ポイント獲得設定
        this.pointEarningRules = {
            // レビュー関連
            review_submission: 100,      // 基本レビュー投稿
            detailed_review: 50,         // 詳細レビューボーナス
            photo_review: 50,            // 写真付きレビューボーナス
            helpful_review: 20,          // 他ユーザーから「参考になった」評価
            quality_review: 300,         // 高品質レビューボーナス
            
            // ソーシャル活動
            friend_referral: 300,        // 友達紹介成功
            sns_share: 20,               // SNSシェア
            line_follow: 30,             // LINE Bot友達追加
            
            // エンゲージメント
            daily_login: 10,             // 日次ログイン
            weekly_activity: 50,         // 週間アクティブ
            monthly_member: 200,         // 月間メンバーボーナス
            
            // 特別活動
            first_dive: 500,             // 初回ダイビング
            birthday_bonus: 1000,        // 誕生日ボーナス
            anniversary: 500,            // 年間記念日
            
            // ショップパートナーシップ
            partner_shop_dive: 150,      // パートナーショップ利用
            premium_plan_use: 200,       // プレミアムプラン利用
            
            // イベント・キャンペーン
            campaign_participation: 100, // キャンペーン参加
            event_attendance: 200,       // イベント参加
            survey_completion: 50        // アンケート回答
        };

        // V2.8: ポイント交換商品
        this.exchangeItems = {
            // ダイビング体験
            experience_dive: {
                name: '体験ダイビング無料チケット',
                points: 3000,
                category: 'diving',
                description: '初心者向け体験ダイビングの無料チケット',
                availability: true,
                partnersOnly: false,
                validity_days: 180
            },
            
            // サービス
            underwater_photo: {
                name: '水中写真撮影サービス',
                points: 1200,
                category: 'service',
                description: 'プロによる水中写真撮影（10枚）',
                availability: true,
                partnersOnly: true,
                validity_days: 90
            },
            
            camera_rental: {
                name: '防水カメラレンタル',
                points: 800,
                category: 'equipment',
                description: '1日防水カメラレンタル',
                availability: true,
                partnersOnly: false,
                validity_days: 60
            },
            
            // 器材・用品
            mask_snorkel_set: {
                name: 'マスク・シュノーケルセット',
                points: 2500,
                category: 'equipment',
                description: '初心者用マスク・シュノーケルセット',
                availability: true,
                partnersOnly: false,
                validity_days: 365
            },
            
            dive_logbook: {
                name: 'オリジナルダイブログブック',
                points: 500,
                category: 'goods',
                description: 'Jijiオリジナルダイブログブック',
                availability: true,
                partnersOnly: false,
                validity_days: 365
            },
            
            // 割引券
            shop_discount_10: {
                name: 'ショップ利用10%OFF券',
                points: 600,
                category: 'discount',
                description: 'パートナーショップでの10%割引券',
                availability: true,
                partnersOnly: true,
                validity_days: 90
            },
            
            shop_discount_15: {
                name: 'ショップ利用15%OFF券',
                points: 1000,
                category: 'discount',
                description: 'パートナーショップでの15%割引券',
                availability: true,
                partnersOnly: true,
                validity_days: 60
            },
            
            // デジタル特典
            exclusive_content: {
                name: '限定ダイビングコンテンツ',
                points: 300,
                category: 'digital',
                description: '限定ダイビングガイド・動画コンテンツ',
                availability: true,
                partnersOnly: false,
                validity_days: 365
            },
            
            diving_map: {
                name: 'デジタルダイビングマップ',
                points: 200,
                category: 'digital',
                description: '沖縄ダイビングポイント詳細マップ',
                availability: true,
                partnersOnly: false,
                validity_days: 365
            }
        };

        // V2.8: ユーザーランクシステム
        this.rankSystem = {
            rookie: {
                name: 'ルーキー',
                minPoints: 0,
                maxPoints: 999,
                benefits: ['基本ポイント獲得'],
                multiplier: 1.0,
                color: '#94a3b8'
            },
            
            explorer: {
                name: 'エクスプローラー',
                minPoints: 1000,
                maxPoints: 2999,
                benefits: ['ポイント+10%', '月1回ボーナス'],
                multiplier: 1.1,
                color: '#3b82f6'
            },
            
            adventurer: {
                name: 'アドベンチャラー',
                minPoints: 3000,
                maxPoints: 7999,
                benefits: ['ポイント+20%', '限定商品アクセス'],
                multiplier: 1.2,
                color: '#10b981'
            },
            
            master: {
                name: 'マスター',
                minPoints: 8000,
                maxPoints: 19999,
                benefits: ['ポイント+30%', '優先サポート', 'VIP特典'],
                multiplier: 1.3,
                color: '#f59e0b'
            },
            
            legend: {
                name: 'レジェンド',
                minPoints: 20000,
                maxPoints: 999999,
                benefits: ['ポイント+50%', '全特典アクセス', '特別招待'],
                multiplier: 1.5,
                color: '#dc2626'
            }
        };

        // 期間限定キャンペーン設定
        this.campaigns = {
            welcome_campaign: {
                name: '新規登録キャンペーン',
                active: true,
                startDate: '2025-07-01',
                endDate: '2025-12-31',
                bonusMultiplier: 2.0,
                targetActions: ['review_submission', 'friend_referral']
            }
        };
    }

    /**
     * V2.8: ポイント獲得処理
     * @param {string} lineUserId - LINEユーザーID
     * @param {string} action - アクション種別
     * @param {Object} metadata - 追加情報
     * @returns {Object} 処理結果
     */
    async earnPoints(lineUserId, action, metadata = {}) {
        try {
            console.log(`💰 ポイント獲得処理: ${lineUserId} - ${action}`);

            // 1. ポイント基礎計算
            const basePoints = this.pointEarningRules[action] || 0;
            if (basePoints === 0) {
                return {
                    success: false,
                    error: '無効なアクション',
                    action: action
                };
            }

            // 2. ユーザーランク取得
            const userRank = await this.getUserRank(lineUserId);
            
            // 3. ランクボーナス適用
            const rankMultiplier = userRank.multiplier || 1.0;
            
            // 4. キャンペーンボーナス適用
            const campaignMultiplier = this.getCampaignMultiplier(action);
            
            // 5. 最終ポイント計算
            const finalPoints = Math.round(basePoints * rankMultiplier * campaignMultiplier);

            // 6. データベースにポイント追加
            const addResult = await addUserPoints(lineUserId, finalPoints, action, {
                basePoints: basePoints,
                rankMultiplier: rankMultiplier,
                campaignMultiplier: campaignMultiplier,
                userRank: userRank.name,
                ...metadata
            });

            if (!addResult.success) {
                throw new Error('ポイント追加に失敗しました');
            }

            // 7. 新しい残高とランクチェック
            const newBalance = addResult.data.newBalance;
            const newRank = this.calculateRankFromPoints(newBalance);
            const rankUp = newRank.name !== userRank.name;

            // 8. ランクアップ処理
            if (rankUp) {
                await this.processRankUp(lineUserId, userRank, newRank);
            }

            console.log(`✅ ポイント獲得完了: ${finalPoints}P (残高: ${newBalance}P)`);

            return {
                success: true,
                pointsEarned: finalPoints,
                newBalance: newBalance,
                breakdown: {
                    basePoints: basePoints,
                    rankBonus: Math.round((rankMultiplier - 1) * 100),
                    campaignBonus: Math.round((campaignMultiplier - 1) * 100)
                },
                rank: newRank,
                rankUp: rankUp,
                message: this.generateEarningMessage(finalPoints, newRank, rankUp)
            };

        } catch (error) {
            console.error('❌ ポイント獲得エラー:', error);
            return {
                success: false,
                error: 'ポイント獲得に失敗しました',
                details: error.message
            };
        }
    }

    /**
     * ポイント交換処理
     * @param {string} lineUserId - ユーザーID
     * @param {string} itemId - 交換商品ID
     * @param {number} quantity - 数量
     * @returns {Object} 処理結果
     */
    async exchangePoints(lineUserId, itemId, quantity = 1) {
        try {
            console.log(`🎁 ポイント交換処理: ${lineUserId} - ${itemId} x${quantity}`);

            // 1. 交換商品の存在確認
            const item = this.exchangeItems[itemId];
            if (!item) {
                return {
                    success: false,
                    error: '存在しない商品です'
                };
            }

            // 2. 商品の利用可能性確認
            if (!item.availability) {
                return {
                    success: false,
                    error: 'この商品は現在交換できません'
                };
            }

            // 3. 必要ポイント計算
            const requiredPoints = item.points * quantity;

            // 4. ユーザーのポイント残高確認
            const balanceResult = await getUserPointBalance(lineUserId);
            if (!balanceResult.success) {
                throw new Error('ポイント残高を取得できません');
            }

            const currentBalance = balanceResult.data;
            if (currentBalance < requiredPoints) {
                return {
                    success: false,
                    error: 'ポイントが不足しています',
                    required: requiredPoints,
                    current: currentBalance,
                    shortage: requiredPoints - currentBalance
                };
            }

            // 5. パートナーショップ限定商品の確認
            if (item.partnersOnly) {
                // 実装: パートナーショップの利用履歴確認
                // 簡易実装では省略
            }

            // 6. ポイント減算
            const deductResult = await addUserPoints(lineUserId, -requiredPoints, 'point_exchange', {
                itemId: itemId,
                itemName: item.name,
                quantity: quantity,
                exchangeDate: new Date().toISOString()
            });

            if (!deductResult.success) {
                throw new Error('ポイント減算に失敗しました');
            }

            // 7. 交換記録作成
            const exchangeRecord = {
                lineUserId: lineUserId,
                itemId: itemId,
                itemName: item.name,
                pointsUsed: requiredPoints,
                quantity: quantity,
                status: 'completed',
                validUntil: this.calculateExpiryDate(item.validity_days),
                exchangeDate: new Date()
            };

            // 8. 交換完了通知生成
            const completionCode = this.generateExchangeCode(lineUserId, itemId);

            console.log(`✅ ポイント交換完了: ${item.name} x${quantity}`);

            return {
                success: true,
                item: item,
                quantity: quantity,
                pointsUsed: requiredPoints,
                newBalance: deductResult.data.newBalance,
                exchangeRecord: exchangeRecord,
                completionCode: completionCode,
                message: this.generateExchangeMessage(item, quantity, completionCode)
            };

        } catch (error) {
            console.error('❌ ポイント交換エラー:', error);
            return {
                success: false,
                error: 'ポイント交換に失敗しました',
                details: error.message
            };
        }
    }

    /**
     * ユーザーランク取得
     * @param {string} lineUserId - ユーザーID
     * @returns {Object} ランク情報
     */
    async getUserRank(lineUserId) {
        try {
            const balanceResult = await getUserPointBalance(lineUserId);
            const totalPoints = balanceResult.success ? balanceResult.data : 0;
            
            return this.calculateRankFromPoints(totalPoints);
        } catch (error) {
            console.error('❌ ランク取得エラー:', error);
            return this.rankSystem.rookie; // デフォルトランク
        }
    }

    /**
     * ポイント数からランク計算
     * @param {number} totalPoints - 総ポイント数
     * @returns {Object} ランク情報
     */
    calculateRankFromPoints(totalPoints) {
        for (const [rankId, rank] of Object.entries(this.rankSystem)) {
            if (totalPoints >= rank.minPoints && totalPoints <= rank.maxPoints) {
                return {
                    id: rankId,
                    name: rank.name,
                    multiplier: rank.multiplier,
                    benefits: rank.benefits,
                    color: rank.color,
                    currentPoints: totalPoints,
                    minPoints: rank.minPoints,
                    maxPoints: rank.maxPoints,
                    progressPercentage: this.calculateRankProgress(totalPoints, rank)
                };
            }
        }
        return this.rankSystem.rookie;
    }

    /**
     * ランク内進捗計算
     * @param {number} currentPoints - 現在ポイント
     * @param {Object} rank - ランク情報
     * @returns {number} 進捗パーセンテージ
     */
    calculateRankProgress(currentPoints, rank) {
        if (rank.maxPoints === 999999) return 100; // 最高ランク
        
        const rangePoints = rank.maxPoints - rank.minPoints;
        const progressPoints = currentPoints - rank.minPoints;
        return Math.round((progressPoints / rangePoints) * 100);
    }

    /**
     * キャンペーンボーナス倍率取得
     * @param {string} action - アクション種別
     * @returns {number} ボーナス倍率
     */
    getCampaignMultiplier(action) {
        for (const campaign of Object.values(this.campaigns)) {
            if (!campaign.active) continue;
            
            const now = new Date();
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);
            
            if (now >= startDate && now <= endDate) {
                if (campaign.targetActions.includes(action)) {
                    return campaign.bonusMultiplier;
                }
            }
        }
        return 1.0;
    }

    /**
     * ランクアップ処理
     * @param {string} lineUserId - ユーザーID
     * @param {Object} oldRank - 旧ランク
     * @param {Object} newRank - 新ランク
     */
    async processRankUp(lineUserId, oldRank, newRank) {
        try {
            console.log(`🎉 ランクアップ: ${oldRank.name} → ${newRank.name}`);

            // ランクアップボーナスポイント
            const bonusPoints = newRank.minPoints * 0.1; // ランク基準ポイントの10%
            
            await addUserPoints(lineUserId, bonusPoints, 'rank_up_bonus', {
                oldRank: oldRank.name,
                newRank: newRank.name,
                bonusPoints: bonusPoints
            });

            // プロフィール更新
            await updateUserProfile(lineUserId, {
                current_rank: newRank.id,
                rank_up_date: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ ランクアップ処理エラー:', error);
        }
    }

    /**
     * 有効期限計算
     * @param {number} validityDays - 有効日数
     * @returns {Date} 有効期限
     */
    calculateExpiryDate(validityDays) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + validityDays);
        return expiryDate;
    }

    /**
     * 交換コード生成
     * @param {string} lineUserId - ユーザーID
     * @param {string} itemId - 商品ID
     * @returns {string} 交換コード
     */
    generateExchangeCode(lineUserId, itemId) {
        const timestamp = Date.now().toString(36);
        const userHash = lineUserId.slice(-4);
        const itemHash = itemId.slice(0, 4);
        return `JIJI-${timestamp}-${userHash}-${itemHash}`.toUpperCase();
    }

    /**
     * ポイント獲得メッセージ生成
     * @param {number} points - 獲得ポイント
     * @param {Object} rank - 現在ランク
     * @param {boolean} rankUp - ランクアップフラグ
     * @returns {string} メッセージ
     */
    generateEarningMessage(points, rank, rankUp) {
        let message = `🎉 ${points}ポイント獲得しました！\n\n`;
        
        if (rankUp) {
            message += `✨ ランクアップ！ ${rank.name}になりました！\n`;
            message += `🎁 ランクアップボーナス: ${Math.round(rank.minPoints * 0.1)}ポイント\n\n`;
        }
        
        message += `📊 現在のランク: ${rank.name}\n`;
        message += `💰 次のランクまで: あと${rank.maxPoints - rank.currentPoints}ポイント\n\n`;
        message += `💡 ポイントは体験ダイビング(3,000P)や水中写真撮影(1,200P)と交換できます！`;
        
        return message;
    }

    /**
     * ポイント交換メッセージ生成
     * @param {Object} item - 交換商品
     * @param {number} quantity - 数量
     * @param {string} code - 交換コード
     * @returns {string} メッセージ
     */
    generateExchangeMessage(item, quantity, code) {
        let message = `🎁 ポイント交換完了！\n\n`;
        message += `商品: ${item.name}\n`;
        message += `数量: ${quantity}個\n`;
        message += `交換コード: ${code}\n\n`;
        message += `📝 ${item.description}\n\n`;
        
        if (item.partnersOnly) {
            message += `⚠️ パートナーショップでのご利用時に交換コードをお伝えください。\n`;
        }
        
        message += `📅 有効期限: ${item.validity_days}日間\n\n`;
        message += `🤿 素敵なダイビング体験をお楽しみください！`;
        
        return message;
    }

    /**
     * 利用可能な交換商品一覧取得
     * @param {string} lineUserId - ユーザーID（パートナー商品フィルタ用）
     * @returns {Array} 交換商品リスト
     */
    async getAvailableExchangeItems(lineUserId) {
        const userBalance = await getUserPointBalance(lineUserId);
        const currentPoints = userBalance.success ? userBalance.data : 0;
        
        return Object.entries(this.exchangeItems)
            .filter(([_, item]) => item.availability)
            .map(([itemId, item]) => ({
                id: itemId,
                name: item.name,
                points: item.points,
                category: item.category,
                description: item.description,
                affordable: currentPoints >= item.points,
                partnersOnly: item.partnersOnly
            }))
            .sort((a, b) => a.points - b.points);
    }
}

// エクスポート
module.exports = PointManager;