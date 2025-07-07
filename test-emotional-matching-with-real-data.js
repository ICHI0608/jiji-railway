#!/usr/bin/env node

/**
 * Jiji感情的マッチングシステム - リアルデータテスト
 * 79店舗の実データを使用したマッチングテスト
 */

const MockJijiSheetsConnector = require('./src/sheets-connector-mock');
const { JIJI_PERSONA, generateSystemPrompt } = require('./src/jiji-persona');

class JijiEmotionalMatcherWithRealData {
    constructor() {
        this.sheetsConnector = new MockJijiSheetsConnector();
        this.jijiPersona = JIJI_PERSONA;
        
        // 6つの感情カテゴリと重み
        this.emotionalConcerns = {
            safety: { 
                weight: 25, 
                keywords: ['安全', '不安', '怖い', '初めて', '心配', '事故', 'リスク', '保険']
            },
            skill: { 
                weight: 20, 
                keywords: ['下手', 'できない', '初心者', '未経験', 'スキル', '技術', '講習']
            },
            solo: { 
                weight: 18, 
                keywords: ['一人', 'ぼっち', '独り', 'ソロ', '女性一人', '男性一人']
            },
            cost: { 
                weight: 15, 
                keywords: ['高い', '料金', '安い', '予算', 'コスト', '費用', '節約']
            },
            physical: { 
                weight: 12, 
                keywords: ['体力', '疲れる', '泳げない', '筋力', '持久力', '年齢']
            },
            communication: { 
                weight: 10, 
                keywords: ['英語', '言葉', 'コミュニケーション', '外国人', '言語']
            }
        };
    }

    analyzeEmotionalConcerns(userMessage) {
        const concerns = {};
        let totalScore = 0;

        Object.keys(this.emotionalConcerns).forEach(category => {
            const categoryData = this.emotionalConcerns[category];
            let matchCount = 0;

            categoryData.keywords.forEach(keyword => {
                if (userMessage.includes(keyword)) {
                    matchCount++;
                }
            });

            const categoryScore = Math.min(matchCount * 15, categoryData.weight);
            concerns[category] = categoryScore;
            totalScore += categoryScore;
        });

        return { concerns, totalScore };
    }

    async calculateShopMatchingScore(shop, emotionalConcerns) {
        let emotionalScore = 0;
        
        // 安全性の懸念
        if (emotionalConcerns.safety > 0) {
            if (shop.safety_equipment) emotionalScore += 15;
            if (shop.insurance_coverage) emotionalScore += 10;
            if (shop.experience_years >= 10) emotionalScore += 8;
            if (shop.incident_record === 'なし') emotionalScore += 7;
        }

        // スキルの懸念
        if (emotionalConcerns.skill > 0) {
            if (shop.beginner_friendly) emotionalScore += 15;
            if (shop.license_course_available) emotionalScore += 10;
            if (shop.max_group_size <= 4) emotionalScore += 8;
            if (shop.private_guide_available) emotionalScore += 7;
        }

        // 一人参加の懸念
        if (emotionalConcerns.solo > 0) {
            if (shop.solo_welcome) emotionalScore += 15;
            if (shop.max_group_size <= 6) emotionalScore += 10;
            if (shop.customer_rating >= 4.5) emotionalScore += 8;
        }

        // 費用の懸念
        if (emotionalConcerns.cost > 0) {
            if (shop.fun_dive_price_2tanks <= 14000) emotionalScore += 15;
            else if (shop.fun_dive_price_2tanks <= 16000) emotionalScore += 10;
            else if (shop.fun_dive_price_2tanks <= 18000) emotionalScore += 5;
            
            if (shop.equipment_rental_included) emotionalScore += 8;
        }

        // 体力的な懸念
        if (emotionalConcerns.physical > 0) {
            if (shop.pickup_service) emotionalScore += 10;
            if (shop.trial_dive_options) emotionalScore += 8;
            if (shop.max_group_size <= 4) emotionalScore += 7;
        }

        // コミュニケーションの懸念
        if (emotionalConcerns.communication > 0) {
            if (shop.english_support) emotionalScore += 12;
            if (shop.female_instructor) emotionalScore += 8;
        }

        // サービススコア算出
        let serviceScore = 0;
        
        // Jijiグレードによるスコア
        switch (shop.jiji_grade) {
            case 'S级': serviceScore += 20; break;
            case 'A级': serviceScore += 15; break;
            case 'B级': serviceScore += 10; break;
            case 'C级': serviceScore += 5; break;
        }
        
        // 顧客評価によるスコア
        if (shop.customer_rating >= 4.8) serviceScore += 15;
        else if (shop.customer_rating >= 4.5) serviceScore += 10;
        else if (shop.customer_rating >= 4.0) serviceScore += 5;
        
        // レビュー数によるスコア
        if (shop.review_count >= 100) serviceScore += 10;
        else if (shop.review_count >= 50) serviceScore += 7;
        else if (shop.review_count >= 20) serviceScore += 4;

        // 総合スコア
        const totalScore = emotionalScore + serviceScore;
        
        return {
            shop,
            emotionalScore,
            serviceScore,
            totalScore,
            recommendation: this.generateRecommendationReason(shop, emotionalConcerns)
        };
    }

    generateRecommendationReason(shop, concerns) {
        const reasons = [];
        
        if (concerns.safety > 0 && shop.safety_equipment && shop.insurance_coverage) {
            reasons.push('安全設備・保険完備で安心');
        }
        
        if (concerns.skill > 0 && shop.beginner_friendly) {
            reasons.push('初心者向けサポートが充実');
        }
        
        if (concerns.solo > 0 && shop.solo_welcome) {
            reasons.push('一人参加歓迎');
        }
        
        if (concerns.cost > 0 && shop.fun_dive_price_2tanks <= 15000) {
            reasons.push('リーズナブルな料金設定');
        }
        
        if (shop.customer_rating >= 4.7) {
            reasons.push('高評価の信頼できるショップ');
        }
        
        return reasons.join('、');
    }

    generateJijiMessage(bestMatch, concerns) {
        const shop = bestMatch.shop;
        let message = `${shop.shop_name}がぴったりだと思います！`;
        
        if (concerns.safety > 0) {
            message += `安全面もしっかりしているので安心してダイビングを楽しめますよ。`;
        }
        
        if (concerns.skill > 0) {
            message += `初心者の方にも丁寧に指導してくれるので、スキルアップにも最適です。`;
        }
        
        if (concerns.solo > 0) {
            message += `一人参加の方も多いので、きっと素敵な出会いがあるはずです！`;
        }
        
        message += `${shop.area}での素晴らしいダイビング体験を、Jijiも応援しています！🐠`;
        
        return message;
    }

    async findBestMatches(userMessage, userArea = null, maxResults = 3) {
        console.log(`\n🔍 感情分析とマッチング開始...`);
        console.log(`📝 ユーザーメッセージ: "${userMessage}"`);
        
        // 感情分析
        const { concerns, totalScore } = this.analyzeEmotionalConcerns(userMessage);
        console.log(`💭 感情スコア合計: ${totalScore}点`);
        
        // 全ショップデータ取得
        let allShops = await this.sheetsConnector.getAllShops();
        
        // エリアフィルタリング
        if (userArea) {
            allShops = allShops.filter(shop => shop.area === userArea);
            console.log(`🏝️  エリア絞り込み (${userArea}): ${allShops.length}店舗`);
        }
        
        // 各ショップのマッチングスコア計算
        const matchingResults = await Promise.all(
            allShops.map(shop => this.calculateShopMatchingScore(shop, concerns))
        );
        
        // スコア順にソート
        const sortedResults = matchingResults
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, maxResults);
        
        return {
            emotionalAnalysis: { concerns, totalScore },
            recommendations: sortedResults,
            searchArea: userArea,
            totalShopsSearched: allShops.length
        };
    }

    async displayResults(results) {
        console.log('\n🎯 マッチング結果\n');
        console.log('='.repeat(50));
        
        // 感情分析結果
        console.log('\n💭 感情分析結果:');
        Object.entries(results.emotionalAnalysis.concerns).forEach(([category, score]) => {
            if (score > 0) {
                const categoryNames = {
                    safety: '安全性への懸念',
                    skill: 'スキルへの不安',
                    solo: '一人参加の心配',
                    cost: '料金の心配',
                    physical: '体力面の不安',
                    communication: 'コミュニケーション'
                };
                console.log(`  ${categoryNames[category]}: ${score}点`);
            }
        });
        
        // 推奨ショップ
        console.log('\n🏆 推奨ショップ:');
        results.recommendations.forEach((result, index) => {
            const shop = result.shop;
            console.log(`\n${index + 1}. ${shop.shop_name} (${shop.area})`);
            console.log(`   総合スコア: ${result.totalScore}点 (感情: ${result.emotionalScore}, サービス: ${result.serviceScore})`);
            console.log(`   評価: ${shop.customer_rating}★ (${shop.review_count}件) | グレード: ${shop.jiji_grade}`);
            console.log(`   料金: ¥${shop.fun_dive_price_2tanks.toLocaleString()} | 最大グループ: ${shop.max_group_size}名`);
            console.log(`   推薦理由: ${result.recommendation}`);
            console.log(`   特徴: ${shop.speciality_areas}`);
            if (shop.website) {
                console.log(`   ウェブサイト: ${shop.website}`);
            }
        });

        // Jijiからのメッセージ
        console.log('\n💬 Jijiからのメッセージ:');
        const bestMatch = results.recommendations[0];
        if (bestMatch) {
            const jijiMessage = this.generateJijiMessage(bestMatch, results.emotionalAnalysis.concerns);
            console.log(`   "${jijiMessage}"`);
        }
    }
}

// テストシナリオ
const testScenarios = [
    {
        name: '初心者・安全重視・石垣島',
        message: '石垣島でダイビングしたいのですが、初めてで安全面が心配です。事故とか大丈夫でしょうか？',
        area: '石垣島'
    },
    {
        name: '一人参加・女性・宮古島',
        message: '宮古島で一人参加を考えています。女性一人でも大丈夫でしょうか？',
        area: '宮古島'
    },
    {
        name: '予算重視・スキル不安',
        message: '予算をなるべく抑えたくて、でも下手なので丁寧に教えてもらえるところがいいです。',
        area: null
    },
    {
        name: 'リアルユーザーメッセージ',
        message: 'ダイビング初心者で一人参加です。石垣島でマンタを見たいのですが、泳ぎが得意ではないので体力面も心配です。安全で初心者に優しいショップを教えてください。',
        area: '石垣島'
    }
];

async function runTests() {
    console.log('\n🚀 Jiji感情的マッチングシステム - リアルデータテスト\n');
    console.log('='.repeat(60));
    
    const matcher = new JijiEmotionalMatcherWithRealData();
    
    // データ統計表示
    const stats = await matcher.sheetsConnector.getShopStatistics();
    console.log('\n📊 データベース統計:');
    console.log(`  総ショップ数: ${stats.totalShops}`);
    console.log(`  対応エリア: ${stats.areas.join(', ')}`);
    console.log(`  平均評価: ${stats.avgRating}★`);
    console.log(`  平均料金: ¥${stats.avgPrice.toLocaleString()}`);
    console.log(`  初心者対応: ${stats.beginnerFriendly}店舗`);
    
    // 各テストシナリオ実行
    for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        
        console.log('\n' + '='.repeat(60));
        console.log(`🧪 テスト ${i + 1}: ${scenario.name}`);
        console.log('='.repeat(60));
        
        try {
            const results = await matcher.findBestMatches(scenario.message, scenario.area);
            await matcher.displayResults(results);
            
            // パフォーマンス情報
            console.log(`\n⚡ 検索対象: ${results.totalShopsSearched}店舗`);
            console.log(`⏱️  処理時間: 瞬時`);
            
        } catch (error) {
            console.error(`❌ テスト失敗: ${error.message}`);
        }
        
        if (i < testScenarios.length - 1) {
            console.log('\n' + '-'.repeat(40));
            console.log('次のテストまで待機中...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('\n🎉 全テスト完了！');
    console.log('💡 Next: Phase 2 API統合開始');
}

// テスト実行
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = JijiEmotionalMatcherWithRealData;