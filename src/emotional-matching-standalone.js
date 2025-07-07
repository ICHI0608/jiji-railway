/**
 * Jiji感情的マッチングシステム - スタンドアローンテスト版
 * Google Sheets APIなしでのテスト実行
 */

// Google Sheets依存を除去したテスト版のマッチングシステム
class JijiEmotionalMatcherStandalone {
    constructor() {
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

        // テスト用ショップデータ
        this.mockShopData = [
            {
                shop_id: 'ISH001',
                shop_name: '石垣島マリンサービス',
                area: '石垣島',
                phone_line: '0980-XX-XXXX',
                website: 'https://ishigaki-marine.com',
                operating_hours: '8:00-18:00',
                fun_dive_available: true,
                trial_dive_options: 'ビーチ・ボート両対応',
                license_course_available: true,
                max_group_size: 4,
                private_guide_available: true,
                fun_dive_price_2tanks: 13500,
                trial_dive_price_beach: 8500,
                trial_dive_price_boat: 12000,
                equipment_rental_included: true,
                additional_fees: '',
                safety_equipment: true,
                insurance_coverage: true,
                female_instructor: true,
                english_support: false,
                pickup_service: true,
                beginner_friendly: true,
                solo_welcome: true,
                family_friendly: true,
                photo_service: true,
                video_service: false,
                speciality_areas: '初心者指導・マクロ撮影',
                certification_level: 'PADI',
                experience_years: 15,
                customer_rating: 4.9,
                review_count: 127,
                incident_record: '',
                jiji_grade: 'S級認定',
                last_updated: '2024-01-15T10:00:00Z',
                notes: '初心者に特に優しい。一人参加大歓迎。'
            },
            {
                shop_id: 'MYK001',
                shop_name: '宮古島ブルーダイビング',
                area: '宮古島',
                phone_line: '0980-YY-YYYY',
                website: 'https://miyako-blue.com',
                operating_hours: '8:30-17:30',
                fun_dive_available: true,
                trial_dive_options: 'ボート専門',
                license_course_available: true,
                max_group_size: 6,
                private_guide_available: false,
                fun_dive_price_2tanks: 12800,
                trial_dive_price_beach: 0,
                trial_dive_price_boat: 11500,
                equipment_rental_included: true,
                additional_fees: '器材洗浄料500円',
                safety_equipment: true,
                insurance_coverage: true,
                female_instructor: true,
                english_support: true,
                pickup_service: true,
                beginner_friendly: true,
                solo_welcome: false,
                family_friendly: true,
                photo_service: true,
                video_service: true,
                speciality_areas: '青の洞窟・地形ダイビング',
                certification_level: 'PADI',
                experience_years: 8,
                customer_rating: 4.7,
                review_count: 89,
                incident_record: '',
                jiji_grade: 'A級認定',
                last_updated: '2024-01-10T14:30:00Z',
                notes: '青の洞窟専門。カップルに人気。'
            },
            {
                shop_id: 'KER001',
                shop_name: '慶良間アイランドダイビング',
                area: '慶良間',
                phone_line: '098-ZZ-ZZZZ',
                website: 'https://kerama-island.com',
                operating_hours: '7:00-18:00',
                fun_dive_available: true,
                trial_dive_options: 'ボート専門',
                license_course_available: true,
                max_group_size: 8,
                private_guide_available: true,
                fun_dive_price_2tanks: 14200,
                trial_dive_price_beach: 0,
                trial_dive_price_boat: 13000,
                equipment_rental_included: false,
                additional_fees: '器材レンタル3000円、ランチ1200円',
                safety_equipment: true,
                insurance_coverage: true,
                female_instructor: false,
                english_support: true,
                pickup_service: false,
                beginner_friendly: true,
                solo_welcome: true,
                family_friendly: true,
                photo_service: false,
                video_service: false,
                speciality_areas: 'ウミガメ・大物狙い',
                certification_level: 'PADI',
                experience_years: 20,
                customer_rating: 4.8,
                review_count: 203,
                incident_record: '',
                jiji_grade: 'S級認定',
                last_updated: '2024-01-12T09:15:00Z',
                notes: 'ウミガメ遭遇率95%。安全管理徹底。'
            },
            {
                shop_id: 'ISH002',
                shop_name: '石垣島初心者ダイビングセンター',
                area: '石垣島',
                phone_line: '0980-AA-AAAA',
                website: 'https://ishigaki-beginner.com',
                operating_hours: '9:00-17:00',
                fun_dive_available: false,
                trial_dive_options: 'ビーチ専門',
                license_course_available: true,
                max_group_size: 3,
                private_guide_available: true,
                fun_dive_price_2tanks: 0,
                trial_dive_price_beach: 9800,
                trial_dive_price_boat: 0,
                equipment_rental_included: true,
                additional_fees: '',
                safety_equipment: true,
                insurance_coverage: true,
                female_instructor: true,
                english_support: false,
                pickup_service: true,
                beginner_friendly: true,
                solo_welcome: true,
                family_friendly: false,
                photo_service: true,
                video_service: false,
                speciality_areas: '体験ダイビング専門',
                certification_level: 'PADI',
                experience_years: 12,
                customer_rating: 4.6,
                review_count: 156,
                incident_record: '',
                jiji_grade: 'S級認定',
                last_updated: '2024-01-08T11:20:00Z',
                notes: '体験ダイビング専門。時間制限なし。'
            },
            {
                shop_id: 'MYK002',
                shop_name: '宮古島アドベンチャーダイビング',
                area: '宮古島',
                phone_line: '0980-BB-BBBB',
                website: 'https://miyako-adventure.com',
                operating_hours: '8:00-19:00',
                fun_dive_available: true,
                trial_dive_options: 'ボート専門',
                license_course_available: true,
                max_group_size: 8,
                private_guide_available: true,
                fun_dive_price_2tanks: 16500,
                trial_dive_price_beach: 0,
                trial_dive_price_boat: 14000,
                equipment_rental_included: false,
                additional_fees: '器材レンタル4000円',
                safety_equipment: true,
                insurance_coverage: true,
                female_instructor: false,
                english_support: true,
                pickup_service: false,
                beginner_friendly: false,
                solo_welcome: true,
                family_friendly: false,
                photo_service: false,
                video_service: true,
                speciality_areas: '地形ダイビング・ドリフト',
                certification_level: 'PADI',
                experience_years: 25,
                customer_rating: 4.5,
                review_count: 78,
                incident_record: '',
                jiji_grade: 'A級認定',
                last_updated: '2024-01-14T16:45:00Z',
                notes: '上級者向け。スキルアップ重視。'
            }
        ];
    }

    /**
     * メイン感情的マッチング実行（スタンドアローン版）
     */
    async findOptimalShops(userProfile, userConcerns = [], preferredArea = null) {
        try {
            console.log('🎯 感情的マッチング開始:', { 
                user: userProfile?.name, 
                concerns: userConcerns.length,
                area: preferredArea 
            });

            // 1. モックデータからショップ取得
            let allShops = [...this.mockShopData];
            if (preferredArea) {
                allShops = allShops.filter(shop => shop.area === preferredArea);
            }
            console.log(`📊 取得ショップ数: ${allShops.length}`);

            // 2. 基本条件フィルタリング
            const candidates = this.filterBasicRequirements(allShops, userProfile);
            console.log(`🔍 基本条件後: ${candidates.length}店舗`);

            // 3. 感情的不安分析
            const emotionalNeeds = this.analyzeUserConcerns(userProfile, userConcerns);
            console.log('💝 感情分析結果:', Object.keys(emotionalNeeds));

            // 4. 34項目感情スコア計算
            const rankedShops = this.calculateEmotionalScores(candidates, emotionalNeeds);
            console.log(`🏆 スコア計算完了: トップ3の平均スコア ${this.getAverageScore(rankedShops.slice(0, 3))}`);

            // 5. Jijiキャラクターコメント生成
            const recommendations = this.generateJijiRecommendations(rankedShops.slice(0, 3), emotionalNeeds);

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
                dataSource: 'mock_data',
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

    // ===== 以下、元のマッチングロジックと同じ =====

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

                const price = shop.fun_dive_price_2tanks || shop.trial_dive_price_beach;
                if (price <= 12000) {
                    costScore += 15;
                    costReasons.push(`良心的価格（¥${price}）`);
                } else if (price <= 15000) {
                    costScore += 8;
                    costReasons.push(`適正価格（¥${price}）`);
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

    generateJijiRecommendations(topShops, emotionalNeeds) {
        return topShops.map((shop, index) => {
            const ranking = ['第1位', '第2位', '第3位'][index];
            const mainReason = shop.emotional_reasons[0];

            let jijiComment = '';
            
            if (mainReason) {
                jijiComment = `${mainReason.jijiEmpathy}。でも${shop.shop_name}なら${mainReason.solution}で安心です。`;
                
                if (shop.emotional_reasons.length > 1) {
                    const secondReason = shop.emotional_reasons[1];
                    jijiComment += `さらに${secondReason.solution}もあるので、${secondReason.concern.replace('不安', '')}の面でも安心できます。`;
                }
            } else {
                jijiComment = `${shop.shop_name}は信頼できるショップです。きっと素敵なダイビングになりますよ。`;
            }

            const experienceComment = this.generateExperienceComment(shop, emotionalNeeds);

            return {
                ranking,
                shop,
                jijiMainComment: jijiComment,
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

    generateExperienceComment(shop, emotionalNeeds) {
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

    generateRecommendationSummary(shop, emotionalNeeds) {
        const reasons = [];
        
        if (shop.jiji_grade === 'S級認定') reasons.push('Jiji最高認定');
        if (shop.customer_rating >= 4.7) reasons.push('高評価');
        if (shop.emotional_score >= 40) reasons.push('感情的マッチング度◎');
        if (shop.beginner_friendly) reasons.push('初心者に優しい');

        return `${reasons.join('・')}で特におすすめです！`;
    }

    generateMainMessage(userProfile, emotionalNeeds) {
        const concerns = Object.keys(emotionalNeeds);
        const userName = userProfile.name || 'あなた';

        let message = `${userName}の気持ち、よく分かります。`;

        if (concerns.includes('safety')) {
            message += '安全面の心配、僕も最初は同じでした。';
        }
        if (concerns.includes('solo')) {
            message += '一人参加の勇気、すごいと思います。';
        }
        if (concerns.includes('skill')) {
            message += 'スキルの不安、みんな通る道です。';
        }

        message += `でも大丈夫！${userName}にピッタリのショップを見つけました。一歩ずつ、素敵なダイビング体験を積んでいきましょう✨`;

        return message;
    }

    generateFallbackMessage() {
        return "ごめんなさい、ちょっとデータの調子が悪いみたい。でも大丈夫、一緒に最高のショップを見つけましょう！LINE で直接相談してくださいね。";
    }

    getAverageScore(shops) {
        if (shops.length === 0) return 0;
        const total = shops.reduce((sum, shop) => sum + (shop.total_score || 0), 0);
        return Math.round(total / shops.length);
    }
}

module.exports = { JijiEmotionalMatcherStandalone };