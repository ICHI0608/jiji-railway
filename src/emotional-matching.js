/**
 * Jiji沖縄ダイビングバディ - 感情的マッチングシステム
 * スプレッドシート特化版 - 初心者の不安解消に特化したマッチングアルゴリズム
 */

const { JijiSheetsConnector } = require('./sheets-connector');
const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./jiji-persona');

class JijiEmotionalMatcher {
    constructor() {
        this.sheetsConnector = new JijiSheetsConnector();
        
        // 感情的不安の分類定義
        this.emotionalConcerns = {
            safety: {
                keywords: ['安全', '不安', '怖い', '危険', '心配', '大丈夫', '事故', '溺れる', '器材', '故障'],
                weight: 25,
                jijiEmpathy: '僕も最初は安全面がすごく心配でした'
            },
            skill: {
                keywords: ['下手', 'できない', '初心者', '自信ない', '泳げない', '経験少ない', 'スキル', '上達'],
                weight: 20,
                jijiEmpathy: '僕も最初は『絶対無理』って思ってました'
            },
            solo: {
                keywords: ['一人', 'ぼっち', '友達いない', '参加不安', '浮く', '馴染める', '知らない人'],
                weight: 18,
                jijiEmpathy: '一人参加って勇気いりますよね。僕も同じでした'
            },
            cost: {
                keywords: ['高い', '料金', '予算', '安い', 'お金', 'コスト', '節約', '学生', '追加料金'],
                weight: 15,
                jijiEmpathy: 'お金の心配、僕も学生時代は同じでした'
            },
            physical: {
                keywords: ['体力', '疲れる', 'きつい', '年齢', '運動不足', '持病', '健康'],
                weight: 12,
                jijiEmpathy: '体力的な不安、よく分かります'
            },
            communication: {
                keywords: ['英語', '言葉', 'コミュニケーション', '質問できない', '恥ずかしい'],
                weight: 10,
                jijiEmpathy: '質問するのって恥ずかしいですよね'
            }
        };

        // 34項目ショップデータ構造
        this.shopDataFields = {
            // 基本情報
            shop_id: 'string',
            shop_name: 'string',
            area: 'string', // 石垣島、宮古島、沖縄本島、慶良間、久米島、西表島
            phone_line: 'string',
            website: 'string',
            operating_hours: 'string',
            
            // サービス対応
            fun_dive_available: 'boolean',
            trial_dive_options: 'string',
            license_course_available: 'boolean',
            max_group_size: 'number',
            private_guide_available: 'boolean',
            
            // 料金体系
            fun_dive_price_2tanks: 'number',
            trial_dive_price_beach: 'number',
            trial_dive_price_boat: 'number',
            equipment_rental_included: 'boolean',
            additional_fees: 'string',
            
            // 安全・サービス
            safety_equipment: 'boolean', // AED、酸素等
            insurance_coverage: 'boolean',
            female_instructor: 'boolean',
            english_support: 'boolean',
            pickup_service: 'boolean',
            
            // 特徴・強み
            beginner_friendly: 'boolean',
            solo_welcome: 'boolean',
            family_friendly: 'boolean',
            photo_service: 'boolean',
            video_service: 'boolean',
            
            // 専門性
            speciality_areas: 'string', // 地形、生物観察、写真等
            certification_level: 'string', // S級、A級、B級、C級
            experience_years: 'number',
            
            // 実績・評価
            customer_rating: 'number',
            review_count: 'number',
            incident_record: 'string',
            jiji_grade: 'string', // S級認定、A級認定等
            
            // その他
            last_updated: 'string',
            notes: 'string'
        };
    }

    /**
     * メイン感情的マッチング実行
     * @param {Object} userProfile - ユーザープロファイル
     * @param {Array} userConcerns - ユーザーの不安・懸念（メッセージから抽出）
     * @param {string} preferredArea - 希望エリア
     * @returns {Object} マッチング結果
     */
    async findOptimalShops(userProfile, userConcerns = [], preferredArea = null) {
        try {
            console.log('🎯 感情的マッチング開始:', { userProfile: userProfile?.name, concerns: userConcerns.length });

            // 1. スプレッドシートからショップデータ取得
            const allShops = await this.sheetsConnector.getShopsForMatching(preferredArea);
            console.log(`📊 取得ショップ数: ${allShops.length}`);

            // 2. 基本条件フィルタリング
            const candidates = this.filterBasicRequirements(allShops, userProfile);
            console.log(`🔍 基本条件後: ${candidates.length}店舗`);

            // 3. 感情的不安分析
            const emotionalNeeds = this.analyzeUserConcerns(userProfile, userConcerns);
            console.log('💝 感情分析結果:', emotionalNeeds);

            // 4. 34項目感情スコア計算
            const rankedShops = this.calculateEmotionalScores(candidates, emotionalNeeds);
            console.log(`🏆 スコア計算完了: トップ3の平均スコア ${this.getAverageScore(rankedShops.slice(0, 3))}`);

            // 5. Jijiキャラクターコメント生成
            const recommendations = this.generateJijiRecommendations(rankedShops.slice(0, 3), emotionalNeeds, userProfile);

            // 6. 総合結果生成
            const result = {
                success: true,
                recommendations,
                jijiMainMessage: this.generateMainMessage(userProfile, emotionalNeeds),
                matchingStats: {
                    totalShops: allShops.length,
                    filteredShops: candidates.length,
                    topScore: rankedShops[0]?.total_score || 0,
                    emotionalFactors: Object.keys(emotionalNeeds).length
                },
                dataSource: 'googlesheets',
                timestamp: new Date().toISOString()
            };

            console.log('✅ 感情的マッチング完了');
            return result;

        } catch (error) {
            console.error('❌ 感情的マッチングエラー:', error);
            return {
                success: false,
                error: error.message,
                fallbackMessage: this.generateFallbackMessage(),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 基本条件でのフィルタリング
     * @param {Array} shops - 全ショップデータ
     * @param {Object} userProfile - ユーザープロファイル
     * @returns {Array} フィルタリング後のショップ
     */
    filterBasicRequirements(shops, userProfile) {
        return shops.filter(shop => {
            // 経験レベルチェック
            if (userProfile.diving_experience === 'beginner' || userProfile.diving_experience === 'none') {
                if (!shop.beginner_friendly) return false;
            }

            // ライセンスレベルチェック
            if (userProfile.license_type === 'none' && !shop.trial_dive_options) {
                return false;
            }

            // 営業状況チェック（基本的な除外条件）
            if (shop.jiji_grade === 'C級' && userProfile.diving_experience === 'none') {
                return false; // 初心者にC級は推薦しない
            }

            return true;
        });
    }

    /**
     * ユーザーの感情的不安を分析
     * @param {Object} userProfile - ユーザープロファイル
     * @param {Array} userConcerns - ユーザーの不安メッセージ
     * @returns {Object} 感情的ニーズ分析結果
     */
    analyzeUserConcerns(userProfile, userConcerns) {
        const detectedConcerns = {};
        const concernText = userConcerns.join(' ').toLowerCase();

        // キーワードベース感情分析
        Object.entries(this.emotionalConcerns).forEach(([concernType, config]) => {
            const hasKeyword = config.keywords.some(keyword => 
                concernText.includes(keyword.toLowerCase())
            );

            if (hasKeyword) {
                detectedConcerns[concernType] = {
                    detected: true,
                    weight: config.weight,
                    empathy: config.jijiEmpathy,
                    keywords: config.keywords.filter(k => concernText.includes(k.toLowerCase()))
                };
            }
        });

        // プロファイルベース推論
        if (userProfile.diving_experience === 'none' || userProfile.diving_experience === 'beginner') {
            detectedConcerns.safety = detectedConcerns.safety || {
                detected: true,
                weight: 20,
                empathy: '初心者の方は安全面が心配になりますよね',
                source: 'profile_inference'
            };
        }

        if (userProfile.participation_style === 'solo') {
            detectedConcerns.solo = detectedConcerns.solo || {
                detected: true,
                weight: 18,
                empathy: '一人参加、僕も最初は緊張しました',
                source: 'profile_inference'
            };
        }

        return detectedConcerns;
    }

    /**
     * 34項目を活用した感情スコア計算
     * @param {Array} shops - 候補ショップ
     * @param {Object} emotionalNeeds - 感情的ニーズ
     * @returns {Array} スコア付きショップリスト
     */
    calculateEmotionalScores(shops, emotionalNeeds) {
        return shops.map(shop => {
            let emotionalScore = 0;
            const emotionalReasons = [];
            const scoreBreakdown = {};

            // 安全性不安解消
            if (emotionalNeeds.safety) {
                let safetyScore = 0;
                const safetyReasons = [];

                if (shop.safety_equipment) {
                    safetyScore += 15;
                    safetyReasons.push('AED・酸素完備');
                }
                if (shop.insurance_coverage) {
                    safetyScore += 8;
                    safetyReasons.push('保険完備');
                }
                if (shop.experience_years >= 10) {
                    safetyScore += 7;
                    safetyReasons.push(`${shop.experience_years}年の実績`);
                }
                if (shop.incident_record === 'clean' || shop.incident_record === '') {
                    safetyScore += 5;
                    safetyReasons.push('事故記録なし');
                }

                if (safetyScore > 0) {
                    emotionalScore += safetyScore;
                    scoreBreakdown.safety = safetyScore;
                    emotionalReasons.push({
                        concern: '安全性不安',
                        solution: safetyReasons.join('、'),
                        jijiEmpathy: emotionalNeeds.safety.empathy,
                        score: safetyScore
                    });
                }
            }

            // 少人数制・個別対応による安心感
            if (emotionalNeeds.skill || emotionalNeeds.solo) {
                let personalScore = 0;
                const personalReasons = [];

                if (shop.max_group_size <= 4) {
                    personalScore += 12;
                    personalReasons.push(`少人数制（最大${shop.max_group_size}名）`);
                }
                if (shop.private_guide_available) {
                    personalScore += 10;
                    personalReasons.push('プライベートガイド可能');
                }
                if (shop.beginner_friendly) {
                    personalScore += 8;
                    personalReasons.push('初心者に特化したサポート');
                }

                if (personalScore > 0) {
                    emotionalScore += personalScore;
                    scoreBreakdown.personal = personalScore;
                    emotionalReasons.push({
                        concern: emotionalNeeds.skill ? 'スキル不安' : '一人参加不安',
                        solution: personalReasons.join('、'),
                        jijiEmpathy: emotionalNeeds.skill?.empathy || emotionalNeeds.solo?.empathy,
                        score: personalScore
                    });
                }
            }

            // 予算配慮
            if (emotionalNeeds.cost) {
                let costScore = 0;
                const costReasons = [];

                // 価格帯評価
                if (shop.fun_dive_price_2tanks <= 12000) {
                    costScore += 15;
                    costReasons.push(`良心的価格（¥${shop.fun_dive_price_2tanks}）`);
                } else if (shop.fun_dive_price_2tanks <= 15000) {
                    costScore += 8;
                    costReasons.push(`適正価格（¥${shop.fun_dive_price_2tanks}）`);
                }

                if (shop.equipment_rental_included) {
                    costScore += 6;
                    costReasons.push('器材レンタル込み');
                }
                if (shop.photo_service) {
                    costScore += 4;
                    costReasons.push('写真撮影サービス');
                }
                if (!shop.additional_fees || shop.additional_fees === '') {
                    costScore += 3;
                    costReasons.push('追加料金なし');
                }

                if (costScore > 0) {
                    emotionalScore += costScore;
                    scoreBreakdown.cost = costScore;
                    emotionalReasons.push({
                        concern: '予算心配',
                        solution: costReasons.join('、'),
                        jijiEmpathy: emotionalNeeds.cost.empathy,
                        score: costScore
                    });
                }
            }

            // 一人参加歓迎度
            if (emotionalNeeds.solo) {
                let soloScore = 0;
                const soloReasons = [];

                if (shop.solo_welcome) {
                    soloScore += 15;
                    soloReasons.push('一人参加大歓迎');
                }
                if (shop.max_group_size <= 6) {
                    soloScore += 8;
                    soloReasons.push('アットホームな雰囲気');
                }
                if (shop.customer_rating >= 4.5) {
                    soloScore += 5;
                    soloReasons.push('高評価（居心地良し）');
                }

                if (soloScore > 0) {
                    emotionalScore += soloScore;
                    scoreBreakdown.solo = soloScore;
                    emotionalReasons.push({
                        concern: '一人参加不安',
                        solution: soloReasons.join('、'),
                        jijiEmpathy: emotionalNeeds.solo.empathy,
                        score: soloScore
                    });
                }
            }

            // コミュニケーション不安
            if (emotionalNeeds.communication) {
                let commScore = 0;
                const commReasons = [];

                if (shop.english_support && emotionalNeeds.communication.keywords.includes('英語')) {
                    commScore += 10;
                    commReasons.push('英語対応可能');
                }
                if (shop.female_instructor) {
                    commScore += 6;
                    commReasons.push('女性インストラクター在籍');
                }
                if (shop.beginner_friendly) {
                    commScore += 8;
                    commReasons.push('質問しやすい雰囲気');
                }

                if (commScore > 0) {
                    emotionalScore += commScore;
                    scoreBreakdown.communication = commScore;
                    emotionalReasons.push({
                        concern: 'コミュニケーション不安',
                        solution: commReasons.join('、'),
                        jijiEmpathy: emotionalNeeds.communication.empathy,
                        score: commScore
                    });
                }
            }

            // ベースサービススコア計算
            const serviceScore = this.calculateServiceScore(shop);

            return {
                ...shop,
                emotional_score: emotionalScore,
                emotional_reasons: emotionalReasons,
                service_score: serviceScore,
                total_score: emotionalScore + serviceScore,
                score_breakdown: {
                    emotional: emotionalScore,
                    service: serviceScore,
                    total: emotionalScore + serviceScore,
                    details: scoreBreakdown
                }
            };
        }).sort((a, b) => b.total_score - a.total_score);
    }

    /**
     * サービス基本スコア計算
     * @param {Object} shop - ショップデータ
     * @returns {number} サービススコア
     */
    calculateServiceScore(shop) {
        let score = 0;

        // Jiji認定グレード
        switch (shop.jiji_grade) {
            case 'S級認定':
                score += 20;
                break;
            case 'A級認定':
                score += 15;
                break;
            case 'B級認定':
                score += 10;
                break;
            default:
                score += 5;
        }

        // 顧客評価
        if (shop.customer_rating >= 4.8) score += 15;
        else if (shop.customer_rating >= 4.5) score += 10;
        else if (shop.customer_rating >= 4.0) score += 5;

        // レビュー数（信頼性）
        if (shop.review_count >= 100) score += 10;
        else if (shop.review_count >= 50) score += 7;
        else if (shop.review_count >= 20) score += 4;

        // 追加サービス
        if (shop.pickup_service) score += 5;
        if (shop.photo_service) score += 3;
        if (shop.video_service) score += 3;

        return score;
    }

    /**
     * Jijiキャラクター推薦コメント生成（統合版）
     * @param {Array} topShops - トップ3ショップ
     * @param {Object} emotionalNeeds - 感情的ニーズ
     * @param {Object} userProfile - ユーザープロファイル
     * @returns {Array} Jiji推薦リスト
     */
    generateJijiRecommendations(topShops, emotionalNeeds, userProfile = {}) {
        return topShops.map((shop, index) => {
            const ranking = ['第1位', '第2位', '第3位'][index];
            const mainReason = shop.emotional_reasons[0];
            const userName = userProfile.name || 'あなた';

            // Jijiキャラクターの共感メッセージ生成
            let jijiComment = this.generateJijiEmpathyMessage(shop, emotionalNeeds, userProfile);

            const experienceComment = this.generateExperienceComment(shop, emotionalNeeds);
            const personalizedMessage = this.generatePersonalizedMessage(shop, userProfile);

            return {
                ranking,
                shop,
                jijiMainComment: jijiComment,
                jijiPersonalizedMessage: personalizedMessage,
                experiencePreview: experienceComment,
                emotionalMatch: {
                    score: shop.emotional_score,
                    reasons: shop.emotional_reasons,
                    totalScore: shop.total_score
                },
                recommendation: this.generateRecommendationSummary(shop, emotionalNeeds)
            };
        });
    }

    /**
     * 体験談コメント生成
     * @param {Object} shop - ショップデータ
     * @param {Object} emotionalNeeds - 感情的ニーズ
     * @returns {string} 体験談コメント
     */
    generateExperienceComment(shop, emotionalNeeds) {
        // 感情的ニーズに基づいた体験談選択
        if (emotionalNeeds.safety) {
            return `「最初は不安でしたが、スタッフの方が『大丈夫、一緒にゆっくりやりましょう』と声をかけてくれて安心できました」`;
        }
        if (emotionalNeeds.solo) {
            return `「一人参加で緊張しましたが、同じような方もいて、すぐに打ち解けることができました」`;
        }
        if (emotionalNeeds.skill) {
            return `「泳ぎが苦手でしたが、インストラクターが私のペースに合わせてくれて、無理なく楽しめました」`;
        }
        if (emotionalNeeds.cost) {
            return `「予算を抑えたかったのですが、この価格でこのサービスは大満足です」`;
        }

        return `「期待以上の素晴らしい体験でした。また利用したいと思います」`;
    }

    /**
     * 推薦サマリー生成
     * @param {Object} shop - ショップデータ
     * @param {Object} emotionalNeeds - 感情的ニーズ
     * @returns {string} 推薦理由サマリー
     */
    generateRecommendationSummary(shop, emotionalNeeds) {
        const reasons = [];
        
        if (shop.jiji_grade === 'S級認定') reasons.push('Jiji最高認定');
        if (shop.customer_rating >= 4.7) reasons.push('高評価');
        if (shop.emotional_score >= 40) reasons.push('感情的マッチング度◎');
        if (shop.beginner_friendly) reasons.push('初心者に優しい');

        return `${reasons.join('・')}で特におすすめです！`;
    }

    /**
     * Jijiキャラクターのメインメッセージ生成（統合版）
     * @param {Object} userProfile - ユーザープロファイル
     * @param {Object} emotionalNeeds - 感情的ニーズ
     * @returns {string} Jijiメインメッセージ
     */
    generateMainMessage(userProfile, emotionalNeeds) {
        const concerns = Object.keys(emotionalNeeds);
        const userName = userProfile.name || 'あなた';
        const experience = userProfile.diving_experience || 'none';

        // Jijiキャラクターらしい親しみやすいメッセージ
        let message = '';

        // 経験レベルに応じた挨拶
        if (experience === 'none') {
            message = `${userName}さん、ダイビングデビューですね！🤿 `;
        } else if (experience === 'beginner') {
            message = `${userName}さん、ダイビング楽しんでますか？🌊 `;
        } else {
            message = `${userName}さん、いつもお疲れ様です！🏝️ `;
        }

        // 感情的共感メッセージ
        if (concerns.includes('safety')) {
            message += '安全面の心配、僕も最初はドキドキでした。でも心配いりません、';
        }
        if (concerns.includes('solo')) {
            message += '一人参加って勇気いりますよね。僕もそうでした。でも大丈夫、';
        }
        if (concerns.includes('skill')) {
            message += 'スキルの不安、よく分かります。みんな通る道ですよ。';
        }
        if (concerns.includes('cost')) {
            message += '予算の心配もありますよね。学生時代の僕もそうでした。';
        }

        // Jijiらしい前向きな締めくくり
        message += `${userName}さんにピッタリのショップを見つけました！沖縄の海、一緒に楽しみましょう✨🐠`;

        return message;
    }

    /**
     * フォールバック メッセージ生成
     * @returns {string} エラー時メッセージ
     */
    generateFallbackMessage() {
        return "ごめんなさい、ちょっとデータの調子が悪いみたい。でも大丈夫、一緒に最高のショップを見つけましょう！LINE で直接相談してくださいね。";
    }

    /**
     * 平均スコア計算
     * @param {Array} shops - ショップリスト
     * @returns {number} 平均スコア
     */
    getAverageScore(shops) {
        if (shops.length === 0) return 0;
        const total = shops.reduce((sum, shop) => sum + (shop.total_score || 0), 0);
        return Math.round(total / shops.length);
    }

    /**
     * Jijiキャラクターの共感メッセージ生成
     */
    generateJijiEmpathyMessage(shop, emotionalNeeds, userProfile) {
        const userName = userProfile.name || 'あなた';
        const mainReason = shop.emotional_reasons[0];
        
        if (!mainReason) {
            return `${shop.shop_name}は僕のおすすめショップです！${userName}さんきっと気に入ると思いますよ🌊`;
        }

        // Jijiキャラクターの個性を活かした共感表現
        let empathyStart = '';
        if (mainReason.concern.includes('安全')) {
            empathyStart = '僕も最初は「大丈夫かな？」って不安でした。';
        } else if (mainReason.concern.includes('一人')) {
            empathyStart = '一人参加、僕もドキドキしたの覚えてます。';
        } else if (mainReason.concern.includes('スキル')) {
            empathyStart = 'スキルの心配、みんな通る道ですよね。';
        } else if (mainReason.concern.includes('予算')) {
            empathyStart = '予算のこと、すごく分かります。';
        } else {
            empathyStart = `${userName}さんの気持ち、よく分かります。`;
        }

        let solution = `でも${shop.shop_name}なら${mainReason.solution}だから安心です！`;
        
        // 追加の安心要素
        if (shop.emotional_reasons.length > 1) {
            const secondReason = shop.emotional_reasons[1];
            solution += `それに${secondReason.solution}もあるので、本当におすすめなんです。`;
        }

        // Jijiらしい親しみやすい締めくくり
        let encouragement = '';
        if (userProfile.diving_experience === 'none') {
            encouragement = 'きっと素敵なダイビングデビューになりますよ🤿✨';
        } else {
            encouragement = 'また新しい海の思い出を作りましょう🐠🌊';
        }

        return `${empathyStart} ${solution} ${encouragement}`;
    }

    /**
     * 個別化されたJijiメッセージ生成
     */
    generatePersonalizedMessage(shop, userProfile) {
        const area = shop.area;
        const userName = userProfile.name || 'あなた';
        const experience = userProfile.diving_experience || 'none';
        
        // エリア特性に応じたメッセージ
        let areaMessage = '';
        if (area === '石垣島') {
            areaMessage = 'マンタに会えるチャンスもありますよ！';
        } else if (area === '宮古島') {
            areaMessage = '地形ダイビングの美しさは格別です！';
        } else if (area === '慶良間') {
            areaMessage = 'ウミガメとの遭遇率がとても高いんです！';
        } else {
            areaMessage = 'きっと素敵な海の体験ができますよ！';
        }

        // 経験レベルに応じたアドバイス
        let experienceAdvice = '';
        if (experience === 'none') {
            experienceAdvice = '初めてでも丁寧にサポートしてくれるので安心してくださいね。';
        } else if (experience === 'beginner') {
            experienceAdvice = 'スキルアップにもぴったりのショップです。';
        } else {
            experienceAdvice = '経験豊富な${userName}さんでも新しい発見があると思います。';
        }

        return `${areaMessage} ${experienceAdvice} 僕も一緒に応援してますから🌊✨`;
    }

    /**
     * デバッグ用：マッチング詳細ログ
     * @param {Object} result - マッチング結果
     */
    logMatchingDetails(result) {
        if (!result.success) {
            console.log('❌ マッチング失敗:', result.error);
            return;
        }

        console.log('\n🎯 感情的マッチング結果詳細:');
        console.log(`📊 総合統計: ${result.matchingStats.totalShops}店舗中${result.matchingStats.filteredShops}店舗が条件適合`);
        
        result.recommendations.forEach((rec, index) => {
            console.log(`\n${rec.ranking}: ${rec.shop.shop_name}`);
            console.log(`  💝 感情スコア: ${rec.shop.emotional_score}`);
            console.log(`  🏆 総合スコア: ${rec.shop.total_score}`);
            console.log(`  💬 Jijiコメント: ${rec.jijiMainComment}`);
            if (rec.jijiPersonalizedMessage) {
                console.log(`  🎭 個別メッセージ: ${rec.jijiPersonalizedMessage}`);
            }
        });
    }
}

module.exports = { JijiEmotionalMatcher };