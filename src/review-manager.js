/**
 * Jiji沖縄ダイビングバディ - V2.8 口コミ・レビューシステム
 * V2.8の50%口コミ重視マッチングの核心機能
 * ユーザーレビュー管理、評価計算、ポイント付与
 */

const { 
    createUserReview, 
    getShopReviews, 
    updateReviewHelpfulness, 
    calculateShopAverageRatings,
    addUserPoints,
    getUserPointBalance,
    getShopById
} = require('./database');

/**
 * V2.8 レビューマネージャークラス
 * 口コミ投稿、評価計算、ポイント管理の統合システム
 */
class ReviewManager {
    constructor() {
        // V2.8: レビュー重要度設定
        this.reviewWeightConfig = {
            totalWeight: 0.5, // マッチングアルゴリズムでの口コミ重み（50%）
            reviewScoreWeight: 0.7, // レビュー評価の重み
            reviewCountWeight: 0.3, // レビュー数の重み
            minReviewsForReliability: 5, // 信頼性に必要な最低レビュー数
            maxReviewScore: 5.0, // 最高評価スコア
            newShopBonus: 0.2 // 新規店舗への加点
        };

        // ポイント報酬設定
        this.pointRewards = {
            basicReview: 100,        // 基本レビュー投稿
            detailedReview: 50,      // 詳細レビュー追加ボーナス
            photoReview: 50,         // 写真付きレビュー追加ボーナス
            helpfulReview: 20,       // 他ユーザーから「参考になった」評価
            monthlyReviewer: 200,    // 月間レビュー投稿者ボーナス
            qualityReviewer: 300     // 高品質レビュー投稿者ボーナス
        };

        // レビュー品質判定設定
        this.qualityThresholds = {
            minLength: 100,          // 詳細レビューの最低文字数
            keywordBonus: [          // 品質向上キーワード
                '初心者', '安全', 'インストラクター', '丁寧',
                'マンタ', 'ウミガメ', '透明度', '器材',
                '予約', '送迎', '料金', 'おすすめ'
            ],
            maxScore: 5,             // 最高評価
            minScore: 1              // 最低評価
        };
    }

    /**
     * V2.8: ユーザーレビューを投稿・処理
     * @param {string} lineUserId - LINEユーザーID
     * @param {number} shopId - ショップID
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} 処理結果とポイント情報
     */
    async submitReview(lineUserId, shopId, reviewData) {
        try {
            console.log(`📝 レビュー投稿開始: ${lineUserId} -> shop${shopId}`);

            // 1. レビューデータの検証
            const validationResult = this.validateReviewData(reviewData);
            if (!validationResult.isValid) {
                return {
                    success: false,
                    error: 'レビューデータが無効です',
                    details: validationResult.errors
                };
            }

            // 2. レビュー品質分析
            const qualityAnalysis = this.analyzeReviewQuality(reviewData);

            // 3. データベースにレビュー保存
            const review = {
                line_user_id: lineUserId,
                shop_id: shopId,
                overall_rating: reviewData.overallRating,
                safety_rating: reviewData.safetyRating || null,
                service_rating: reviewData.serviceRating || null,
                value_rating: reviewData.valueRating || null,
                review_text: reviewData.reviewText,
                dive_date: reviewData.diveDate || new Date(),
                experience_type: reviewData.experienceType || 'fun_dive',
                has_photos: reviewData.hasPhotos || false,
                photo_urls: reviewData.photoUrls || [],
                quality_score: qualityAnalysis.qualityScore,
                is_detailed: qualityAnalysis.isDetailed,
                helpful_count: 0,
                verified_diver: true // LINE連携なので検証済み
            };

            const createResult = await createUserReview(review);
            if (!createResult.success) {
                throw new Error('レビュー保存に失敗しました');
            }

            // 4. ポイント計算・付与
            const pointsEarned = await this.calculateAndAwardPoints(
                lineUserId, 
                qualityAnalysis, 
                reviewData
            );

            // 5. ショップの平均評価を更新
            await this.updateShopAverageRating(shopId);

            // 6. レビュー統計更新
            const stats = await this.updateReviewStatistics(lineUserId, shopId);

            console.log(`✅ レビュー投稿完了: ${pointsEarned.totalPoints}ポイント獲得`);

            return {
                success: true,
                reviewId: createResult.data.id,
                pointsEarned: pointsEarned,
                qualityAnalysis: qualityAnalysis,
                message: this.generateThankYouMessage(pointsEarned, qualityAnalysis)
            };

        } catch (error) {
            console.error('❌ レビュー投稿エラー:', error);
            return {
                success: false,
                error: 'レビュー投稿に失敗しました',
                details: error.message
            };
        }
    }

    /**
     * レビューデータの検証
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} 検証結果
     */
    validateReviewData(reviewData) {
        const errors = [];

        // 必須フィールドチェック
        if (!reviewData.overallRating || reviewData.overallRating < 1 || reviewData.overallRating > 5) {
            errors.push('総合評価は1-5の範囲で入力してください');
        }

        if (!reviewData.reviewText || reviewData.reviewText.trim().length < 10) {
            errors.push('レビューテキストは10文字以上入力してください');
        }

        // 不適切な内容のチェック（簡易）
        const inappropriateKeywords = ['最悪', '詐欺', 'ぼったくり', '危険すぎる'];
        const hasInappropriate = inappropriateKeywords.some(keyword => 
            reviewData.reviewText.includes(keyword)
        );

        if (hasInappropriate) {
            errors.push('レビュー内容を見直してください');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * レビュー品質分析
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} 品質分析結果
     */
    analyzeReviewQuality(reviewData) {
        let qualityScore = 3.0; // 基本スコア
        const reviewText = reviewData.reviewText || '';
        const features = [];

        // 文字数による品質評価
        if (reviewText.length >= this.qualityThresholds.minLength) {
            qualityScore += 0.5;
            features.push('詳細レビュー');
        }

        // キーワードによる品質評価
        const keywordCount = this.qualityThresholds.keywordBonus.filter(keyword =>
            reviewText.includes(keyword)
        ).length;

        if (keywordCount >= 3) {
            qualityScore += 0.3;
            features.push('具体的内容');
        }

        // 写真付きレビュー
        if (reviewData.hasPhotos) {
            qualityScore += 0.2;
            features.push('写真付き');
        }

        // 詳細評価項目の有無
        const detailRatings = [
            reviewData.safetyRating,
            reviewData.serviceRating,
            reviewData.valueRating
        ].filter(rating => rating !== null && rating !== undefined);

        if (detailRatings.length >= 2) {
            qualityScore += 0.3;
            features.push('詳細評価');
        }

        // 体験タイプの明記
        if (reviewData.experienceType && reviewData.experienceType !== 'unknown') {
            qualityScore += 0.1;
            features.push('体験タイプ明記');
        }

        // 最大スコア制限
        qualityScore = Math.min(qualityScore, 5.0);

        return {
            qualityScore: Math.round(qualityScore * 10) / 10,
            isDetailed: reviewText.length >= this.qualityThresholds.minLength,
            features: features,
            keywordCount: keywordCount
        };
    }

    /**
     * ポイント計算・付与
     * @param {string} lineUserId - ユーザーID
     * @param {Object} qualityAnalysis - 品質分析結果
     * @param {Object} reviewData - レビューデータ
     * @returns {Object} ポイント詳細
     */
    async calculateAndAwardPoints(lineUserId, qualityAnalysis, reviewData) {
        let totalPoints = 0;
        const breakdown = [];

        // 基本レビューポイント
        totalPoints += this.pointRewards.basicReview;
        breakdown.push({
            type: 'basic_review',
            points: this.pointRewards.basicReview,
            description: '基本レビュー投稿'
        });

        // 詳細レビューボーナス
        if (qualityAnalysis.isDetailed) {
            totalPoints += this.pointRewards.detailedReview;
            breakdown.push({
                type: 'detailed_review',
                points: this.pointRewards.detailedReview,
                description: '詳細レビューボーナス'
            });
        }

        // 写真付きレビューボーナス
        if (reviewData.hasPhotos) {
            totalPoints += this.pointRewards.photoReview;
            breakdown.push({
                type: 'photo_review',
                points: this.pointRewards.photoReview,
                description: '写真付きレビューボーナス'
            });
        }

        // 高品質レビューボーナス
        if (qualityAnalysis.qualityScore >= 4.5) {
            totalPoints += this.pointRewards.qualityReviewer;
            breakdown.push({
                type: 'quality_bonus',
                points: this.pointRewards.qualityReviewer,
                description: '高品質レビューボーナス'
            });
        }

        // ポイントをデータベースに追加
        const pointResult = await addUserPoints(lineUserId, totalPoints, 'review_submission', {
            reviewQuality: qualityAnalysis.qualityScore,
            features: qualityAnalysis.features
        });

        if (!pointResult.success) {
            console.error('❌ ポイント付与エラー:', pointResult.error);
        }

        return {
            totalPoints: totalPoints,
            breakdown: breakdown,
            success: pointResult.success
        };
    }

    /**
     * ショップの平均評価更新
     * @param {number} shopId - ショップID
     */
    async updateShopAverageRating(shopId) {
        try {
            const result = await calculateShopAverageRatings(shopId);
            if (result.success) {
                console.log(`📊 ショップ${shopId} 平均評価更新完了`);
            }
        } catch (error) {
            console.error('❌ 平均評価更新エラー:', error);
        }
    }

    /**
     * V2.8: ショップレビュースコア計算（マッチングアルゴリズム用）
     * @param {number} shopId - ショップID
     * @returns {Object} レビュースコア詳細
     */
    async calculateShopReviewScore(shopId) {
        try {
            // ショップのレビュー取得
            const reviewsResult = await getShopReviews(shopId);
            if (!reviewsResult.success || reviewsResult.data.length === 0) {
                return {
                    score: 0,
                    reviewCount: 0,
                    averageRating: 0,
                    reliability: 'low',
                    details: 'レビューなし'
                };
            }

            const reviews = reviewsResult.data;
            const reviewCount = reviews.length;

            // 平均評価計算
            const totalRating = reviews.reduce((sum, review) => sum + review.overall_rating, 0);
            const averageRating = totalRating / reviewCount;

            // 品質重み付け評価計算
            const qualityWeightedSum = reviews.reduce((sum, review) => {
                const qualityWeight = (review.quality_score || 3.0) / 5.0; // 品質による重み
                return sum + (review.overall_rating * qualityWeight);
            }, 0);

            const qualityWeightedAverage = qualityWeightedSum / reviewCount;

            // レビュー数による信頼性評価
            let reliabilityMultiplier = 1.0;
            let reliability = 'low';

            if (reviewCount >= this.reviewWeightConfig.minReviewsForReliability) {
                reliabilityMultiplier = Math.min(1.0, reviewCount / 20); // 最大20レビューで満点
                reliability = reviewCount >= 15 ? 'high' : 'medium';
            } else {
                reliabilityMultiplier = reviewCount / this.reviewWeightConfig.minReviewsForReliability;
                reliability = 'low';
            }

            // 最終レビュースコア計算（0-100点）
            const baseScore = (qualityWeightedAverage / 5.0) * 100;
            const finalScore = Math.round(baseScore * reliabilityMultiplier);

            // 新規店舗ボーナス（レビュー数が少ない場合の補正）
            let adjustedScore = finalScore;
            if (reviewCount < this.reviewWeightConfig.minReviewsForReliability && averageRating >= 4.0) {
                const newShopBonus = this.reviewWeightConfig.newShopBonus * 100;
                adjustedScore = Math.min(100, finalScore + newShopBonus);
            }

            return {
                score: adjustedScore,
                reviewCount: reviewCount,
                averageRating: Math.round(averageRating * 10) / 10,
                qualityWeightedAverage: Math.round(qualityWeightedAverage * 10) / 10,
                reliability: reliability,
                reliabilityMultiplier: Math.round(reliabilityMultiplier * 100) / 100,
                details: `${reviewCount}件のレビュー、平均${averageRating}★`
            };

        } catch (error) {
            console.error('❌ レビュースコア計算エラー:', error);
            return {
                score: 0,
                reviewCount: 0,
                averageRating: 0,
                reliability: 'error',
                details: 'スコア計算エラー'
            };
        }
    }

    /**
     * 複数ショップのレビュースコア一括計算
     * @param {Array} shopIds - ショップIDの配列
     * @returns {Object} ショップ別レビュースコア
     */
    async calculateBulkReviewScores(shopIds) {
        const scores = {};
        
        for (const shopId of shopIds) {
            try {
                scores[shopId] = await this.calculateShopReviewScore(shopId);
            } catch (error) {
                console.error(`❌ ショップ${shopId}のスコア計算エラー:`, error);
                scores[shopId] = {
                    score: 0,
                    reviewCount: 0,
                    averageRating: 0,
                    reliability: 'error',
                    details: 'エラー'
                };
            }
        }

        return scores;
    }

    /**
     * レビュー統計更新
     * @param {string} lineUserId - ユーザーID
     * @param {number} shopId - ショップID
     */
    async updateReviewStatistics(lineUserId, shopId) {
        // 実装: ユーザーとショップのレビュー統計を更新
        // 将来的にダッシュボードや分析で使用
        return {
            userReviewCount: 1, // 簡易実装
            shopReviewCount: 1
        };
    }

    /**
     * 感謝メッセージ生成
     * @param {Object} pointsEarned - 獲得ポイント情報
     * @param {Object} qualityAnalysis - 品質分析結果
     * @returns {string} 感謝メッセージ
     */
    generateThankYouMessage(pointsEarned, qualityAnalysis) {
        let message = `🎉 レビュー投稿ありがとうございます！\n\n`;
        message += `💰 獲得ポイント: ${pointsEarned.totalPoints}ポイント\n`;
        
        if (qualityAnalysis.features.length > 0) {
            message += `✨ 評価ポイント: ${qualityAnalysis.features.join('、')}\n`;
        }

        message += `\n📝 あなたのレビューは他の初心者ダイバーの方にとても参考になります。`;
        
        if (qualityAnalysis.qualityScore >= 4.5) {
            message += `\n🌟 特に詳細で参考になるレビューをありがとうございます！`;
        }

        message += `\n\n💡 ポイントは体験ダイビング無料チケット（3,000P）や水中写真撮影（1,200P）と交換できます。`;

        return message;
    }

    /**
     * レビューを「参考になった」として評価
     * @param {number} reviewId - レビューID  
     * @param {string} evaluatorUserId - 評価者ユーザーID
     * @returns {Object} 処理結果
     */
    async markReviewAsHelpful(reviewId, evaluatorUserId) {
        try {
            const result = await updateReviewHelpfulness(reviewId, evaluatorUserId);
            
            if (result.success) {
                // レビュー投稿者にボーナスポイント付与
                const reviewAuthorId = result.data.reviewAuthorId;
                await addUserPoints(
                    reviewAuthorId, 
                    this.pointRewards.helpfulReview, 
                    'helpful_review',
                    { reviewId: reviewId, evaluatedBy: evaluatorUserId }
                );

                return {
                    success: true,
                    message: 'レビューを「参考になった」として評価しました',
                    bonusPoints: this.pointRewards.helpfulReview
                };
            }

            return result;

        } catch (error) {
            console.error('❌ レビュー評価エラー:', error);
            return {
                success: false,
                error: 'レビュー評価に失敗しました'
            };
        }
    }
}

// エクスポート
module.exports = ReviewManager;