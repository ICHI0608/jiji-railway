/**
 * Jiji感情的マッチングシステム - テスト・デモ用
 * スプレッドシートなしでのテスト実行
 */

const { JijiEmotionalMatcher } = require('./emotional-matching');

// テスト用ショップデータ（79店舗の一部をモック）
const mockShopData = [
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

// テスト用ユーザープロファイル
const testUserProfiles = [
    {
        name: '田中美咲',
        diving_experience: 'none',
        license_type: 'none',
        participation_style: 'solo',
        preferred_area: '石垣島',
        budget_range: 'medium'
    },
    {
        name: '佐藤健一',
        diving_experience: 'beginner',
        license_type: 'OWD',
        participation_style: 'solo',
        preferred_area: '宮古島',
        budget_range: 'low'
    },
    {
        name: '山田カップル',
        diving_experience: 'beginner',
        license_type: 'OWD',
        participation_style: 'couple',
        preferred_area: '慶良間',
        budget_range: 'high'
    }
];

// テスト用不安・懸念メッセージ
const testConcerns = [
    [
        '初めてのダイビングで不安です',
        '泳ぎが得意じゃないけど大丈夫？',
        '器材が壊れたりしないか心配',
        '一人で参加しても浮かない？'
    ],
    [
        'まだ経験が少なくて自信がない',
        'お金をそんなにかけられない',
        '一人参加で知らない人ばかりだと緊張する'
    ],
    [
        '彼女と一緒に安全に楽しみたい',
        'ウミガメに会えるかな？',
        '写真もたくさん撮りたい'
    ]
];

class JijiEmotionalMatchingTest {
    constructor() {
        // モック用のSheets Connector
        this.mockSheetsConnector = {
            getShopsForMatching: async (area = null) => {
                let shops = [...mockShopData];
                if (area) {
                    shops = shops.filter(shop => shop.area === area);
                }
                return shops;
            }
        };

        // EmotionalMatcher のインスタンス作成（モック注入）
        this.matcher = new JijiEmotionalMatcher();
        this.matcher.sheetsConnector = this.mockSheetsConnector;
    }

    /**
     * 全テストシナリオ実行
     */
    async runAllTests() {
        console.log('🧪 Jiji感情的マッチングシステム - テスト開始\n');
        console.log('=' .repeat(60));

        for (let i = 0; i < testUserProfiles.length; i++) {
            const userProfile = testUserProfiles[i];
            const userConcerns = testConcerns[i];

            console.log(`\n📋 テストケース ${i + 1}: ${userProfile.name}さん`);
            console.log('-'.repeat(40));
            
            await this.runSingleTest(userProfile, userConcerns, i + 1);
        }

        console.log('\n✅ 全テスト完了！');
        console.log('=' .repeat(60));
    }

    /**
     * 単一テストケース実行
     */
    async runSingleTest(userProfile, userConcerns, testNumber) {
        try {
            console.log(`👤 プロファイル:`, {
                name: userProfile.name,
                experience: userProfile.diving_experience,
                license: userProfile.license_type,
                style: userProfile.participation_style,
                area: userProfile.preferred_area
            });

            console.log(`💭 不安・懸念:`, userConcerns);

            // マッチング実行
            const startTime = Date.now();
            const result = await this.matcher.findOptimalShops(
                userProfile, 
                userConcerns, 
                userProfile.preferred_area
            );
            const executionTime = Date.now() - startTime;

            if (!result.success) {
                console.error(`❌ マッチング失敗: ${result.error}`);
                return;
            }

            // 結果表示
            console.log(`\n🎯 マッチング結果 (実行時間: ${executionTime}ms):`);
            console.log(`📊 統計: ${result.matchingStats.totalShops}店舗中${result.matchingStats.filteredShops}店舗が条件適合`);
            console.log(`🎭 Jijiメッセージ: "${result.jijiMainMessage}"`);

            console.log('\n🏆 おすすめショップ TOP3:');
            result.recommendations.forEach((rec, index) => {
                console.log(`\n${rec.ranking}: ${rec.shop.shop_name}`);
                console.log(`  💝 感情スコア: ${rec.shop.emotional_score}点`);
                console.log(`  🏅 総合スコア: ${rec.shop.total_score}点`);
                console.log(`  💰 価格: ¥${rec.shop.fun_dive_price_2tanks || rec.shop.trial_dive_price_beach}`);
                console.log(`  🤿 Jijiコメント: "${rec.jijiMainComment}"`);
                console.log(`  📝 体験談: "${rec.experiencePreview}"`);
                
                if (rec.shop.emotional_reasons.length > 0) {
                    console.log(`  🔍 感情的マッチ理由:`);
                    rec.shop.emotional_reasons.forEach(reason => {
                        console.log(`    • ${reason.concern}: ${reason.solution} (${reason.score}点)`);
                    });
                }
            });

            // 詳細スコア分析
            this.analyzeScoreBreakdown(result.recommendations[0].shop);

        } catch (error) {
            console.error(`❌ テストケース ${testNumber} でエラー:`, error);
        }
    }

    /**
     * スコア内訳分析
     */
    analyzeScoreBreakdown(topShop) {
        console.log('\n📊 スコア詳細分析（第1位ショップ）:');
        
        if (topShop.score_breakdown) {
            console.log(`  感情スコア: ${topShop.score_breakdown.emotional}点`);
            console.log(`  サービススコア: ${topShop.score_breakdown.service}点`);
            console.log(`  総合スコア: ${topShop.score_breakdown.total}点`);
            
            if (topShop.score_breakdown.details) {
                console.log('  感情スコア内訳:');
                Object.entries(topShop.score_breakdown.details).forEach(([category, score]) => {
                    console.log(`    ${category}: ${score}点`);
                });
            }
        }
    }

    /**
     * 特定シナリオテスト
     */
    async testSpecificScenario(scenarioName) {
        console.log(`🎭 特定シナリオテスト: ${scenarioName}`);
        
        switch (scenarioName) {
            case 'extreme_anxiety':
                await this.testExtremeAnxiety();
                break;
            case 'budget_conscious':
                await this.testBudgetConscious();
                break;
            case 'solo_female':
                await this.testSoloFemale();
                break;
            default:
                console.log('❓ 未知のシナリオです');
        }
    }

    /**
     * 極度の不安ケース
     */
    async testExtremeAnxiety() {
        const profile = {
            name: '極度不安太郎',
            diving_experience: 'none',
            license_type: 'none',
            participation_style: 'solo',
            preferred_area: '石垣島'
        };

        const concerns = [
            '海がとても怖い',
            '泳げない',
            '器材が故障したらどうしよう',
            '事故に遭わないか心配',
            '一人で参加して大丈夫？',
            'お金もあまりない',
            '恥ずかしくて質問できない'
        ];

        await this.runSingleTest(profile, concerns, 'EXTREME');
    }

    /**
     * 予算重視ケース
     */
    async testBudgetConscious() {
        const profile = {
            name: '節約花子',
            diving_experience: 'beginner',
            license_type: 'OWD',
            participation_style: 'solo',
            preferred_area: '宮古島'
        };

        const concerns = [
            '学生なのでお金がない',
            '追加料金がかからないか心配',
            'コスパの良いショップを知りたい',
            'でも安全性は妥協したくない'
        ];

        await this.runSingleTest(profile, concerns, 'BUDGET');
    }

    /**
     * 女性一人参加ケース
     */
    async testSoloFemale() {
        const profile = {
            name: '一人旅さくら',
            diving_experience: 'beginner',
            license_type: 'OWD',
            participation_style: 'solo',
            preferred_area: '慶良間'
        };

        const concerns = [
            '女性一人で参加しても大丈夫？',
            '男性ばかりだと居心地悪い',
            '女性のインストラクターがいると安心',
            '写真もたくさん撮りたい'
        ];

        await this.runSingleTest(profile, concerns, 'SOLO_FEMALE');
    }

    /**
     * パフォーマンステスト
     */
    async performanceTest() {
        console.log('⚡ パフォーマンステスト開始');
        
        const iterations = 10;
        const times = [];

        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            
            await this.matcher.findOptimalShops(
                testUserProfiles[0], 
                testConcerns[0], 
                '石垣島'
            );
            
            const endTime = Date.now();
            times.push(endTime - startTime);
        }

        const averageTime = times.reduce((a, b) => a + b) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);

        console.log(`📊 パフォーマンス結果 (${iterations}回実行):`);
        console.log(`  平均実行時間: ${averageTime.toFixed(2)}ms`);
        console.log(`  最短時間: ${minTime}ms`);
        console.log(`  最長時間: ${maxTime}ms`);
    }
}

// テスト実行
if (require.main === module) {
    const tester = new JijiEmotionalMatchingTest();
    
    // コマンドライン引数による実行制御
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // デフォルト: 全テスト実行
        tester.runAllTests();
    } else if (args[0] === 'performance') {
        tester.performanceTest();
    } else if (args[0] === 'scenario') {
        tester.testSpecificScenario(args[1] || 'extreme_anxiety');
    } else {
        console.log('📖 使用方法:');
        console.log('  node emotional-matching-test.js                # 全テスト実行');
        console.log('  node emotional-matching-test.js performance    # パフォーマンステスト');
        console.log('  node emotional-matching-test.js scenario [名前] # 特定シナリオテスト');
    }
}

module.exports = { JijiEmotionalMatchingTest, mockShopData };