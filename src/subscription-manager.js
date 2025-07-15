/**
 * Jiji沖縄ダイビングバディ - V2.8 ショップ課金システム
 * B2B収益化の核心機能
 * ショップサブスクリプション管理・課金・認定バッジシステム
 */

const { 
    createShopSubscription, 
    updateShopSubscription, 
    getShopSubscription,
    getShopById,
    updateShopInfo
} = require('./database');

/**
 * V2.8 サブスクリプションマネージャークラス
 * ショップ課金・プラン管理・認定バッジシステムの統合管理
 */
class SubscriptionManager {
    constructor() {
        // V2.8: サブスクリプションプラン設定（計画書準拠）
        this.subscriptionPlans = {
            basic: {
                name: 'ベーシックプラン',
                monthlyPrice: 0,
                yearlyPrice: 0,
                features: {
                    listing: true,              // 基本店舗情報掲載
                    reviews: true,              // ユーザー口コミ表示
                    photos: 3,                  // 基本写真3枚まで
                    priority: 1,                // 標準表示順位
                    analytics: false,           // 分析機能なし
                    badge: null,                // バッジなし
                    planBonus: 0,               // プランボーナス0%
                    supportLevel: 'basic'       // 基本サポート
                },
                maxRecommendations: 999,    // 制限なし（口コミベース）
                commission: 0               // 手数料率0%
            },
            
            standard: {
                name: 'スタンダードプラン',
                monthlyPrice: 3000,
                yearlyPrice: 30000,         // 年間2ヶ月分無料
                features: {
                    listing: true,
                    reviews: true,
                    photos: 10,                 // 写真ギャラリー10枚まで
                    priority: 3,                // 検索結果優遇表示
                    analytics: true,            // 月間レポート
                    badge: 'verified',          // Jiji推薦店シルバーバッジ
                    planBonus: 12,              // 12%プランボーナス（20%重みの60%）
                    supportLevel: 'standard'    // 標準サポート
                },
                maxRecommendations: 999,
                commission: 0               // 手数料率0%
            },
            
            premium: {
                name: 'プレミアムプラン',
                monthlyPrice: 5000,
                yearlyPrice: 50000,         // 年間2ヶ月分無料
                features: {
                    listing: true,
                    reviews: true,
                    photos: 999,                // 写真・動画ギャラリー無制限
                    priority: 10,               // 最上位表示・推薦優遇
                    analytics: true,            // 詳細分析レポート
                    badge: 'premium',           // Jijiプレミアム認定ゴールドバッジ
                    planBonus: 20,              // 20%プランボーナス（満額）
                    supportLevel: 'premium',    // プレミアムサポート
                    customization: true,        // カスタムブランディング
                    marketing: true             // マーケティング支援
                },
                maxRecommendations: 999,
                commission: 0               // 手数料率0%
            }
        };

        // V2.8: 認定バッジシステム（計画書準拠）
        this.certificationBadges = {
            verified: {
                name: 'Jiji推薦店',
                icon: '⭐',
                color: '#3b82f6',  // シルバーブルー
                description: '安心おすすめショップ',
                requirements: ['standard プラン', '平均評価4.0以上', 'レビュー10件以上'],
                benefits: ['上位表示', '推薦店マーク表示', '詳細説明']
            },
            
            premium: {
                name: 'Jijiプレミアム認定',
                icon: '🌟',
                color: '#f59e0b',  // ゴールドグラデーション
                description: '最高品質サービス保証',
                requirements: ['premium プラン', '平均評価4.5以上', 'レビュー25件以上'],
                benefits: ['最上位表示', 'プレミアムマーク', '優先推薦', '詳細説明強調']
            }
        };

        // プラン変更制限設定
        this.planChangeRules = {
            downgradeNotice: 30,        // ダウングレード予告期間（日）
            upgradeImmediate: true,     // アップグレード即時適用
            refundPeriod: 7,            // 返金可能期間（日）
            minimumTerm: 30             // 最低契約期間（日）
        };

        // 支払い方法設定
        this.paymentMethods = {
            credit_card: {
                name: 'クレジットカード',
                enabled: true,
                processingFee: 0,       // 手数料なし（計画書準拠）
                autoRenewal: true
            },
            bank_transfer: {
                name: '銀行振込',
                enabled: true,
                processingFee: 0,
                autoRenewal: false
            }
        };
    }

    /**
     * V2.8: ショップサブスクリプション作成・更新
     * @param {number} shopId - ショップID
     * @param {string} planId - プランID
     * @param {string} billingCycle - 課金サイクル ('monthly' | 'yearly')
     * @param {string} paymentMethod - 支払い方法
     * @returns {Object} 処理結果
     */
    async createOrUpdateSubscription(shopId, planId, billingCycle = 'monthly', paymentMethod = 'credit_card') {
        try {
            console.log(`💳 サブスクリプション処理: shop${shopId} - ${planId}(${billingCycle})`);

            // 1. プラン存在確認
            const plan = this.subscriptionPlans[planId];
            if (!plan) {
                return {
                    success: false,
                    error: '存在しないプランです'
                };
            }

            // 2. ショップ情報取得
            const shopResult = await getShopById(shopId);
            if (!shopResult.success) {
                return {
                    success: false,
                    error: 'ショップが見つかりません'
                };
            }

            const shop = shopResult.data;

            // 3. 現在のサブスクリプション確認
            const currentSubResult = await getShopSubscription(shopId);
            const hasCurrentSub = currentSubResult.success;

            // 4. 料金計算
            const pricing = this.calculatePricing(plan, billingCycle, paymentMethod);

            // 5. 認定バッジの判定
            const eligibleBadges = await this.determineEligibleBadges(shop, planId);

            // 6. サブスクリプションデータ作成
            const subscriptionData = {
                shop_id: shopId,
                plan_id: planId,
                plan_name: plan.name,
                billing_cycle: billingCycle,
                monthly_price: pricing.monthlyAmount,
                total_amount: pricing.totalAmount,
                payment_method: paymentMethod,
                status: 'active',
                features: plan.features,
                start_date: new Date(),
                end_date: this.calculateEndDate(billingCycle),
                auto_renewal: this.paymentMethods[paymentMethod].autoRenewal,
                badges: eligibleBadges.map(b => b.id)
            };

            // 7. データベース更新
            let dbResult;
            if (hasCurrentSub) {
                dbResult = await updateShopSubscription(shopId, subscriptionData);
            } else {
                dbResult = await createShopSubscription(subscriptionData);
            }

            if (!dbResult.success) {
                throw new Error('サブスクリプション保存に失敗しました');
            }

            // 8. ショップ情報の更新（プラン情報、バッジ情報）
            await this.updateShopPlanInfo(shopId, planId, eligibleBadges);

            // 9. 課金処理（実装は簡易版）
            const billingResult = await this.processBilling(shopId, pricing, paymentMethod);

            console.log(`✅ サブスクリプション完了: ${plan.name} - ¥${pricing.totalAmount}`);

            return {
                success: true,
                subscription: subscriptionData,
                pricing: pricing,
                badges: eligibleBadges,
                billing: billingResult,
                message: this.generateSubscriptionMessage(plan, pricing, eligibleBadges)
            };

        } catch (error) {
            console.error('❌ サブスクリプション処理エラー:', error);
            return {
                success: false,
                error: 'サブスクリプション処理に失敗しました',
                details: error.message
            };
        }
    }

    /**
     * 料金計算
     * @param {Object} plan - プラン情報
     * @param {string} billingCycle - 課金サイクル
     * @param {string} paymentMethod - 支払い方法
     * @returns {Object} 料金詳細
     */
    calculatePricing(plan, billingCycle, paymentMethod) {
        const baseAmount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
        const processingFee = this.paymentMethods[paymentMethod].processingFee || 0;
        const feeAmount = Math.round(baseAmount * processingFee);
        const totalAmount = baseAmount + feeAmount;

        // 年間割引計算
        const yearlyDiscount = billingCycle === 'yearly' ? 
            (plan.monthlyPrice * 12) - plan.yearlyPrice : 0;

        return {
            baseAmount: baseAmount,
            processingFee: feeAmount,
            totalAmount: totalAmount,
            monthlyAmount: billingCycle === 'yearly' ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice,
            yearlyDiscount: yearlyDiscount,
            billingCycle: billingCycle,
            currency: 'JPY'
        };
    }

    /**
     * 終了日計算
     * @param {string} billingCycle - 課金サイクル
     * @returns {Date} 終了日
     */
    calculateEndDate(billingCycle) {
        const endDate = new Date();
        if (billingCycle === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            endDate.setMonth(endDate.getMonth() + 1);
        }
        return endDate;
    }

    /**
     * 認定バッジの判定（計画書準拠）
     * @param {Object} shop - ショップ情報
     * @param {string} planId - プランID
     * @returns {Array} 取得可能バッジリスト
     */
    async determineEligibleBadges(shop, planId) {
        const eligibleBadges = [];

        // スタンダードプラン: Jiji推薦店バッジ
        if (planId === 'standard') {
            if (shop.customer_rating >= 4.0 && shop.review_count >= 10) {
                eligibleBadges.push({
                    id: 'verified',
                    ...this.certificationBadges.verified
                });
            }
        }

        // プレミアムプラン: Jijiプレミアム認定バッジ
        if (planId === 'premium') {
            if (shop.customer_rating >= 4.5 && shop.review_count >= 25) {
                eligibleBadges.push({
                    id: 'premium',
                    ...this.certificationBadges.premium
                });
            }
        }

        return eligibleBadges;
    }

    /**
     * ショップのプラン情報更新
     * @param {number} shopId - ショップID
     * @param {string} planId - プランID
     * @param {Array} badges - バッジリスト
     */
    async updateShopPlanInfo(shopId, planId, badges) {
        const plan = this.subscriptionPlans[planId];
        
        await updateShopInfo(shopId, {
            subscription_plan: planId,
            plan_priority: plan.features.priority,
            certification_badges: badges.map(b => b.id),
            plan_bonus_percentage: plan.features.planBonus,
            last_plan_update: new Date().toISOString()
        });
    }

    /**
     * 課金処理（簡易実装）
     * @param {number} shopId - ショップID
     * @param {Object} pricing - 料金情報
     * @param {string} paymentMethod - 支払い方法
     * @returns {Object} 課金結果
     */
    async processBilling(shopId, pricing, paymentMethod) {
        // 実際の実装では決済APIと連携
        // ここでは簡易実装

        const transactionId = `TXN-${Date.now()}-${shopId}`;
        
        return {
            success: true,
            transactionId: transactionId,
            amount: pricing.totalAmount,
            method: paymentMethod,
            status: 'completed',
            processedAt: new Date().toISOString()
        };
    }

    /**
     * プラン比較情報取得
     * @returns {Object} プラン比較データ
     */
    getPlanComparison() {
        return Object.entries(this.subscriptionPlans).map(([planId, plan]) => ({
            id: planId,
            name: plan.name,
            monthlyPrice: plan.monthlyPrice,
            yearlyPrice: plan.yearlyPrice,
            yearlyDiscount: (plan.monthlyPrice * 12) - plan.yearlyPrice,
            features: plan.features,
            maxRecommendations: plan.maxRecommendations,
            commission: Math.round(plan.commission * 100),
            badges: this.getAvailableBadges(planId)
        }));
    }

    /**
     * プランで利用可能なバッジ取得（計画書準拠）
     * @param {string} planId - プランID
     * @returns {Array} 利用可能バッジ
     */
    getAvailableBadges(planId) {
        const badges = [];
        
        if (planId === 'standard') {
            badges.push('verified');
        }
        if (planId === 'premium') {
            badges.push('premium');
        }

        return badges.map(badgeId => ({
            id: badgeId,
            ...this.certificationBadges[badgeId]
        }));
    }

    /**
     * サブスクリプション作成メッセージ生成
     * @param {Object} plan - プラン情報
     * @param {Object} pricing - 料金情報
     * @param {Array} badges - バッジリスト
     * @returns {string} メッセージ
     */
    generateSubscriptionMessage(plan, pricing, badges) {
        let message = `🎉 ${plan.name}へのご加入ありがとうございます！\n\n`;
        
        message += `💰 料金: ¥${pricing.totalAmount.toLocaleString()}`;
        if (pricing.billingCycle === 'yearly' && pricing.yearlyDiscount > 0) {
            message += ` (年間¥${pricing.yearlyDiscount.toLocaleString()}お得！)`;
        }
        message += `\n`;

        if (badges.length > 0) {
            message += `\n🏆 取得バッジ:\n`;
            badges.forEach(badge => {
                message += `${badge.icon} ${badge.name}\n`;
            });
        }

        message += `\n✨ プラン特典:\n`;
        if (plan.features.photos > 0) {
            message += `📸 写真掲載: ${plan.features.photos}枚まで\n`;
        }
        if (plan.features.priority > 1) {
            message += `⬆️ 優先表示: レベル${plan.features.priority}\n`;
        }
        if (plan.features.planBonus > 0) {
            message += `🎁 マッチング優遇: +${plan.features.planBonus}%\n`;
        }

        message += `\n📊 Jijiでのより多くの集客をお楽しみください！`;

        return message;
    }

    /**
     * サブスクリプション状況確認
     * @param {number} shopId - ショップID
     * @returns {Object} サブスクリプション状況
     */
    async getSubscriptionStatus(shopId) {
        try {
            const subResult = await getShopSubscription(shopId);
            
            if (!subResult.success) {
                return {
                    hasSubscription: false,
                    plan: 'basic',
                    status: 'inactive'
                };
            }

            const subscription = subResult.data;
            const plan = this.subscriptionPlans[subscription.plan_id];
            
            return {
                hasSubscription: true,
                subscription: subscription,
                plan: plan,
                daysUntilExpiry: this.calculateDaysUntilExpiry(subscription.end_date),
                autoRenewal: subscription.auto_renewal
            };

        } catch (error) {
            console.error('❌ サブスクリプション状況確認エラー:', error);
            return {
                hasSubscription: false,
                plan: 'basic',
                status: 'error'
            };
        }
    }

    /**
     * 有効期限までの日数計算
     * @param {Date} endDate - 終了日
     * @returns {number} 残り日数
     */
    calculateDaysUntilExpiry(endDate) {
        const now = new Date();
        const expiry = new Date(endDate);
        const diffTime = expiry - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}

// エクスポート
module.exports = SubscriptionManager;