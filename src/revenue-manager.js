/**
 * Jiji Revenue Manager
 * Phase 5: 収益化システム・ショップ紹介手数料・プレミアム会員管理
 * 
 * v2.7計画書準拠収益モデル実装
 */

class JijiRevenueManager {
    constructor() {
        this.shopReferrals = new Map(); // shopId -> referralData
        this.premiumMembers = new Map(); // userId -> membershipData
        this.affiliatePartners = new Map(); // partnerId -> partnerData
        this.transactions = new Map(); // transactionId -> transactionData
        this.commissionRates = new Map(); // type -> rates
        
        this.initializeRevenueSystem();
        console.log('💰 Revenue Manager initialized - Phase 5');
    }

    // ===== システム初期化 =====

    initializeRevenueSystem() {
        this.setupCommissionRates();
        this.setupPremiumPlans();
        this.setupAffiliatePrograms();
        
        console.log('✅ Revenue system initialized');
    }

    setupCommissionRates() {
        // ショップ紹介手数料率設定
        this.commissionRates.set('shop_referral', {
            S_grade: 0.08, // 8% (S級ショップ)
            A_grade: 0.06, // 6% (A級ショップ)
            B_grade: 0.05, // 5% (B級ショップ)
            C_grade: 0.03, // 3% (C級ショップ)
            base_fee: 500   // ベース手数料500円
        });

        // アフィリエイト手数料率
        this.commissionRates.set('affiliate', {
            travel_booking: 0.04,  // 4% (旅行予約)
            equipment_rental: 0.10, // 10% (器材レンタル)
            accommodation: 0.06,    // 6% (宿泊施設)
            transportation: 0.03    // 3% (交通手段)
        });

        console.log('📊 Commission rates configured');
    }

    setupPremiumPlans() {
        const premiumPlans = [
            {
                id: 'premium_basic',
                name: 'Jiji Premium Basic',
                price_monthly: 980,
                price_yearly: 9800,
                features: [
                    '優先感情分析（待ち時間なし）',
                    '詳細店舗比較レポート',
                    '限定ショップ情報アクセス',
                    '専用Jijiサポート',
                    '紹介コード無制限生成'
                ],
                limits: {
                    emotion_analysis_per_month: 50,
                    detailed_reports_per_month: 10,
                    priority_support: true
                }
            },
            {
                id: 'premium_pro',
                name: 'Jiji Premium Pro',
                price_monthly: 1980,
                price_yearly: 19800,
                features: [
                    'Premium Basic全機能',
                    '個人ダイビングプランナー',
                    'AIダイビングコーチ',
                    '独占ショップ割引',
                    'VIPイベント招待',
                    '24時間専用サポート'
                ],
                limits: {
                    emotion_analysis_per_month: -1, // 無制限
                    detailed_reports_per_month: -1, // 無制限
                    priority_support: true,
                    vip_access: true
                }
            }
        ];

        this.premiumPlans = premiumPlans;
        console.log('💎 Premium plans configured');
    }

    setupAffiliatePrograms() {
        const affiliatePrograms = [
            {
                id: 'rakuten_travel',
                name: '楽天トラベル',
                type: 'accommodation',
                api_endpoint: 'https://app.rakuten.co.jp/services/api/Travel/',
                commission_rate: 0.06,
                tracking_params: ['affiliate_id', 'campaign_id']
            },
            {
                id: 'jalan_travel',
                name: 'じゃらん',
                type: 'accommodation',
                commission_rate: 0.05,
                tracking_params: ['aff_id', 'tracking_id']
            },
            {
                id: 'diving_gear_store',
                name: 'ダイビング器材ストア',
                type: 'equipment_rental',
                commission_rate: 0.10,
                tracking_params: ['referrer_id']
            }
        ];

        affiliatePrograms.forEach(program => {
            this.affiliatePartners.set(program.id, {
                ...program,
                status: 'active',
                total_referrals: 0,
                total_commission: 0,
                created_at: new Date().toISOString()
            });
        });

        console.log('🤝 Affiliate programs configured');
    }

    // ===== ショップ紹介手数料システム =====

    trackShopReferral(userId, shopId, referralSource = 'app') {
        const referralId = `ref_${userId}_${shopId}_${Date.now()}`;
        
        const referralData = {
            referral_id: referralId,
            user_id: userId,
            shop_id: shopId,
            source: referralSource,
            timestamp: new Date().toISOString(),
            status: 'pending', // pending, confirmed, paid
            estimated_value: 0,
            commission_amount: 0,
            shop_grade: null,
            conversion_confirmed: false,
            conversion_date: null,
            payment_date: null
        };

        this.shopReferrals.set(referralId, referralData);
        
        console.log(`🏪 Shop referral tracked: ${shopId} for user ${userId}`);
        return referralData;
    }

    confirmShopConversion(referralId, conversionData) {
        const referral = this.shopReferrals.get(referralId);
        if (!referral) return { success: false, reason: 'referral_not_found' };

        // 予約・購入確認データ
        const { 
            booking_amount, 
            booking_date, 
            shop_grade,
            customer_count = 1,
            service_type = 'fun_dive' 
        } = conversionData;

        // 手数料計算
        const commissionData = this.calculateShopCommission(booking_amount, shop_grade, service_type);
        
        // 紹介データ更新
        referral.status = 'confirmed';
        referral.conversion_confirmed = true;
        referral.conversion_date = booking_date;
        referral.estimated_value = booking_amount;
        referral.commission_amount = commissionData.commission;
        referral.shop_grade = shop_grade;
        referral.service_details = {
            service_type,
            customer_count,
            booking_amount
        };

        // 取引記録
        const transaction = this.createTransaction({
            type: 'shop_referral_commission',
            referral_id: referralId,
            amount: commissionData.commission,
            description: `Shop referral commission: ${referral.shop_id}`,
            metadata: {
                shop_id: referral.shop_id,
                user_id: referral.user_id,
                booking_amount,
                commission_rate: commissionData.rate
            }
        });

        console.log(`✅ Shop conversion confirmed: ${referralId} - ¥${commissionData.commission}`);
        return {
            success: true,
            referral_data: referral,
            commission: commissionData,
            transaction_id: transaction.id
        };
    }

    calculateShopCommission(bookingAmount, shopGrade, serviceType) {
        const rates = this.commissionRates.get('shop_referral');
        
        // グレード別レート
        const gradeRateKey = `${shopGrade}_grade`;
        const gradeRate = rates[gradeRateKey] || rates.B_grade;
        
        // サービス別レート調整
        const serviceMultiplier = {
            'trial_dive': 1.2,     // 体験ダイビング: +20%
            'license_course': 1.1,  // ライセンス講習: +10%
            'fun_dive': 1.0,       // ファンダイビング: 基準
            'specialty_course': 1.15 // スペシャリティ講習: +15%
        };

        const finalRate = gradeRate * (serviceMultiplier[serviceType] || 1.0);
        const commission = Math.max(
            bookingAmount * finalRate,
            rates.base_fee // 最低手数料保証
        );

        return {
            rate: finalRate,
            commission: Math.round(commission),
            base_amount: bookingAmount,
            grade: shopGrade,
            service_type: serviceType
        };
    }

    // ===== プレミアム会員システム =====

    subscribePremium(userId, planId, paymentMethod = 'monthly') {
        const plan = this.premiumPlans.find(p => p.id === planId);
        if (!plan) return { success: false, reason: 'plan_not_found' };

        const subscriptionId = `sub_${userId}_${Date.now()}`;
        const startDate = new Date();
        const endDate = new Date();
        
        // 契約期間設定
        if (paymentMethod === 'yearly') {
            endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
            endDate.setMonth(endDate.getMonth() + 1);
        }

        const membership = {
            subscription_id: subscriptionId,
            user_id: userId,
            plan_id: planId,
            plan_name: plan.name,
            payment_method: paymentMethod,
            status: 'active',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            monthly_price: plan.price_monthly,
            yearly_price: plan.price_yearly,
            current_period_amount: paymentMethod === 'yearly' ? plan.price_yearly : plan.price_monthly,
            features: plan.features,
            usage_limits: { ...plan.limits },
            usage_current: {
                emotion_analysis_used: 0,
                detailed_reports_used: 0
            },
            auto_renewal: true,
            created_at: new Date().toISOString()
        };

        this.premiumMembers.set(userId, membership);

        // 取引記録
        const transaction = this.createTransaction({
            type: 'premium_subscription',
            subscription_id: subscriptionId,
            amount: membership.current_period_amount,
            description: `Premium subscription: ${plan.name}`,
            metadata: {
                plan_id: planId,
                payment_method: paymentMethod,
                period_start: membership.start_date,
                period_end: membership.end_date
            }
        });

        console.log(`💎 Premium subscription created: ${planId} for user ${userId}`);
        return {
            success: true,
            membership: membership,
            transaction_id: transaction.id
        };
    }

    checkPremiumAccess(userId, feature) {
        const membership = this.premiumMembers.get(userId);
        if (!membership || membership.status !== 'active') {
            return { access: false, reason: 'no_active_subscription' };
        }

        // 期限チェック
        if (new Date() > new Date(membership.end_date)) {
            membership.status = 'expired';
            return { access: false, reason: 'subscription_expired' };
        }

        // 使用制限チェック
        const limits = membership.usage_limits;
        const current = membership.usage_current;

        switch (feature) {
            case 'emotion_analysis':
                if (limits.emotion_analysis_per_month !== -1 && 
                    current.emotion_analysis_used >= limits.emotion_analysis_per_month) {
                    return { access: false, reason: 'monthly_limit_exceeded' };
                }
                break;
            case 'detailed_reports':
                if (limits.detailed_reports_per_month !== -1 && 
                    current.detailed_reports_used >= limits.detailed_reports_per_month) {
                    return { access: false, reason: 'monthly_limit_exceeded' };
                }
                break;
            case 'priority_support':
                if (!limits.priority_support) {
                    return { access: false, reason: 'feature_not_included' };
                }
                break;
        }

        return { 
            access: true, 
            membership: membership,
            remaining_usage: this.calculateRemainingUsage(membership)
        };
    }

    calculateRemainingUsage(membership) {
        const limits = membership.usage_limits;
        const current = membership.usage_current;

        return {
            emotion_analysis: limits.emotion_analysis_per_month === -1 ? 
                'unlimited' : limits.emotion_analysis_per_month - current.emotion_analysis_used,
            detailed_reports: limits.detailed_reports_per_month === -1 ? 
                'unlimited' : limits.detailed_reports_per_month - current.detailed_reports_used
        };
    }

    recordPremiumUsage(userId, feature) {
        const membership = this.premiumMembers.get(userId);
        if (!membership) return false;

        switch (feature) {
            case 'emotion_analysis':
                membership.usage_current.emotion_analysis_used++;
                break;
            case 'detailed_reports':
                membership.usage_current.detailed_reports_used++;
                break;
        }

        membership.last_activity = new Date().toISOString();
        return true;
    }

    // ===== アフィリエイト統合システム =====

    generateAffiliateLink(partnerId, productId, userId, metadata = {}) {
        const partner = this.affiliatePartners.get(partnerId);
        if (!partner) return { success: false, reason: 'partner_not_found' };

        const trackingId = `aff_${userId}_${partnerId}_${Date.now()}`;
        
        const affiliateLink = {
            tracking_id: trackingId,
            partner_id: partnerId,
            user_id: userId,
            product_id: productId,
            created_at: new Date().toISOString(),
            clicked: false,
            converted: false,
            commission_earned: 0,
            metadata: {
                ...metadata,
                source: 'jiji_app',
                user_segment: metadata.user_segment || 'organic'
            }
        };

        // パートナー別リンク生成
        let generatedUrl = '';
        switch (partnerId) {
            case 'rakuten_travel':
                generatedUrl = `https://hotel.travel.rakuten.co.jp/hinfo/${productId}/?f_hai=jiji&f_hac=${trackingId}`;
                break;
            case 'jalan_travel':
                generatedUrl = `https://www.jalan.net/yad${productId}/?screenId=UWW1402&affiliate_id=jiji&tracking_id=${trackingId}`;
                break;
            case 'diving_gear_store':
                generatedUrl = `https://diving-gear.example.com/products/${productId}?ref=jiji&tracking=${trackingId}`;
                break;
            default:
                generatedUrl = `${partner.base_url}/${productId}?ref=jiji&tracking=${trackingId}`;
        }

        affiliateLink.generated_url = generatedUrl;
        
        console.log(`🔗 Affiliate link generated: ${partnerId} for user ${userId}`);
        return {
            success: true,
            affiliate_link: affiliateLink,
            url: generatedUrl
        };
    }

    trackAffiliateConversion(trackingId, conversionData) {
        // アフィリエイト成果確認・手数料計算
        const { amount, product_type, partner_id } = conversionData;
        
        const partner = this.affiliatePartners.get(partner_id);
        if (!partner) return { success: false, reason: 'partner_not_found' };

        const commissionRate = this.commissionRates.get('affiliate')[product_type] || 0.03;
        const commission = amount * commissionRate;

        // パートナー統計更新
        partner.total_referrals++;
        partner.total_commission += commission;

        // 取引記録
        const transaction = this.createTransaction({
            type: 'affiliate_commission',
            tracking_id: trackingId,
            amount: commission,
            description: `Affiliate commission: ${partner.name}`,
            metadata: {
                partner_id,
                product_type,
                conversion_amount: amount,
                commission_rate: commissionRate
            }
        });

        console.log(`✅ Affiliate conversion tracked: ${trackingId} - ¥${commission}`);
        return {
            success: true,
            commission: commission,
            transaction_id: transaction.id
        };
    }

    // ===== 取引・収益管理 =====

    createTransaction(transactionData) {
        const transaction = {
            id: `txn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            ...transactionData,
            created_at: new Date().toISOString(),
            status: 'completed'
        };

        this.transactions.set(transaction.id, transaction);
        return transaction;
    }

    calculateMonthlyRevenue(year, month) {
        const transactions = Array.from(this.transactions.values());
        const targetDate = new Date(year, month - 1); // month is 0-based
        const nextMonth = new Date(year, month);

        const monthlyTransactions = transactions.filter(txn => {
            const txnDate = new Date(txn.created_at);
            return txnDate >= targetDate && txnDate < nextMonth;
        });

        const revenue = {
            total: 0,
            by_type: {
                shop_referral_commission: 0,
                premium_subscription: 0,
                affiliate_commission: 0
            },
            transaction_count: monthlyTransactions.length,
            top_revenue_sources: []
        };

        monthlyTransactions.forEach(txn => {
            revenue.total += txn.amount;
            if (revenue.by_type.hasOwnProperty(txn.type)) {
                revenue.by_type[txn.type] += txn.amount;
            }
        });

        // トップ収益源ランキング
        revenue.top_revenue_sources = Object.entries(revenue.by_type)
            .sort(([,a], [,b]) => b - a)
            .map(([type, amount]) => ({ type, amount, percentage: (amount / revenue.total) * 100 }));

        return revenue;
    }

    generateRevenueReport() {
        const currentDate = new Date();
        const currentMonth = this.calculateMonthlyRevenue(currentDate.getFullYear(), currentDate.getMonth() + 1);
        const lastMonth = this.calculateMonthlyRevenue(currentDate.getFullYear(), currentDate.getMonth());

        const report = {
            report_id: `revenue_report_${Date.now()}`,
            generated_at: new Date().toISOString(),
            period: {
                current_month: currentMonth,
                last_month: lastMonth,
                growth_rate: lastMonth.total > 0 ? 
                    ((currentMonth.total - lastMonth.total) / lastMonth.total) * 100 : 0
            },
            summary: {
                total_active_premium_users: Array.from(this.premiumMembers.values())
                    .filter(m => m.status === 'active').length,
                total_shop_referrals: this.shopReferrals.size,
                total_affiliate_partners: this.affiliatePartners.size,
                monthly_recurring_revenue: this.calculateMRR(),
                average_revenue_per_user: this.calculateARPU()
            },
            projections: {
                next_month_projection: this.projectNextMonthRevenue(),
                yearly_projection: currentMonth.total * 12,
                growth_trend: this.analyzeGrowthTrend()
            }
        };

        return report;
    }

    calculateMRR() {
        // Monthly Recurring Revenue計算
        const activeMembers = Array.from(this.premiumMembers.values())
            .filter(m => m.status === 'active');
        
        return activeMembers.reduce((mrr, member) => {
            return mrr + (member.payment_method === 'yearly' ? 
                member.yearly_price / 12 : member.monthly_price);
        }, 0);
    }

    calculateARPU() {
        // Average Revenue Per User計算
        const currentMonth = this.calculateMonthlyRevenue(
            new Date().getFullYear(), 
            new Date().getMonth() + 1
        );
        
        const activeUsers = new Set();
        this.premiumMembers.forEach(member => {
            if (member.status === 'active') activeUsers.add(member.user_id);
        });
        this.shopReferrals.forEach(referral => {
            activeUsers.add(referral.user_id);
        });

        return activeUsers.size > 0 ? currentMonth.total / activeUsers.size : 0;
    }

    projectNextMonthRevenue() {
        const currentMRR = this.calculateMRR();
        const currentGrowthRate = 0.15; // 15%成長を仮定
        
        return {
            conservative: currentMRR * 1.05, // 5%成長
            realistic: currentMRR * (1 + currentGrowthRate), // 15%成長
            optimistic: currentMRR * 1.25 // 25%成長
        };
    }

    analyzeGrowthTrend() {
        // 成長トレンド分析（簡易版）
        const recentMonths = [];
        for (let i = 3; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            recentMonths.push(this.calculateMonthlyRevenue(date.getFullYear(), date.getMonth() + 1));
        }

        const growthRates = [];
        for (let i = 1; i < recentMonths.length; i++) {
            if (recentMonths[i-1].total > 0) {
                growthRates.push(
                    ((recentMonths[i].total - recentMonths[i-1].total) / recentMonths[i-1].total) * 100
                );
            }
        }

        const averageGrowthRate = growthRates.length > 0 ?
            growthRates.reduce((a, b) => a + b, 0) / growthRates.length : 0;

        return {
            trend: averageGrowthRate > 10 ? 'strong_growth' : 
                   averageGrowthRate > 0 ? 'moderate_growth' : 'declining',
            average_monthly_growth: averageGrowthRate,
            consistency: this.calculateGrowthConsistency(growthRates)
        };
    }

    calculateGrowthConsistency(growthRates) {
        if (growthRates.length < 2) return 'insufficient_data';
        
        const variance = growthRates.reduce((sum, rate, index, array) => {
            const mean = array.reduce((a, b) => a + b, 0) / array.length;
            return sum + Math.pow(rate - mean, 2);
        }, 0) / growthRates.length;

        return variance < 25 ? 'consistent' : variance < 100 ? 'moderate' : 'volatile';
    }

    // ===== 外部インターフェース =====

    getRevenueStatus() {
        return {
            active_premium_users: Array.from(this.premiumMembers.values())
                .filter(m => m.status === 'active').length,
            pending_shop_referrals: Array.from(this.shopReferrals.values())
                .filter(r => r.status === 'pending').length,
            confirmed_shop_referrals: Array.from(this.shopReferrals.values())
                .filter(r => r.status === 'confirmed').length,
            active_affiliate_partners: Array.from(this.affiliatePartners.values())
                .filter(p => p.status === 'active').length,
            monthly_recurring_revenue: this.calculateMRR(),
            last_updated: new Date().toISOString()
        };
    }

    getCommissionRates() {
        return Object.fromEntries(this.commissionRates);
    }

    getPremiumPlans() {
        return this.premiumPlans;
    }
}

module.exports = JijiRevenueManager;