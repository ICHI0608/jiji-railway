/**
 * ショップデータベース検索・表示機能
 * SHOP-001: 79店舗×34項目データのWeb表示対応
 */

const { supabase, redisClient } = require('./database');

// ===== ショップデータベース検索・表示機能 =====

/**
 * 全ショップ一覧取得（高度検索・フィルタリング対応）
 * @param {Object} filters - 検索フィルター
 * @returns {Promise<Array>} ショップ一覧
 */
async function getShopsList(filters = {}) {
    const useSupabase = supabase !== null;
    
    if (!useSupabase) {
        console.log('ℹ️ Supabase無効 - サンプルショップデータ返却');
        return getSampleShopsData(filters);
    }

    try {
        let query = supabase
            .from('shop_master')
            .select(`
                shop_id,
                shop_name,
                area,
                phone_line,
                website,
                operating_hours,
                fun_dive_available,
                trial_dive_options,
                license_course_available,
                trial_dive_price_beach,
                trial_dive_price_boat,
                fun_dive_price_2tanks,
                max_group_size,
                private_guide_available,
                beginner_friendly,
                solo_participant_ok,
                female_instructor_available,
                english_support_available,
                pickup_service_available,
                photo_service_available,
                video_service_available,
                jiji_grade,
                last_updated
            `);

        // エリアフィルター（複数エリア対応）
        if (filters.area) {
            if (Array.isArray(filters.area)) {
                query = query.in('area', filters.area);
            } else {
                query = query.eq('area', filters.area);
            }
        }

        // 価格範囲フィルター（最小・最大価格）
        if (filters.minPrice) {
            query = query.gte('trial_dive_price_beach', filters.minPrice);
        }
        if (filters.maxPrice) {
            query = query.lte('trial_dive_price_beach', filters.maxPrice);
        }

        // グレードフィルター
        if (filters.grade) {
            if (Array.isArray(filters.grade)) {
                query = query.in('jiji_grade', filters.grade);
            } else {
                query = query.eq('jiji_grade', filters.grade);
            }
        }

        // サービスフィルター（AND条件）
        if (filters.beginnerFriendly) {
            query = query.eq('beginner_friendly', true);
        }

        if (filters.soloOk) {
            query = query.eq('solo_participant_ok', true);
        }

        if (filters.femaleInstructor) {
            query = query.eq('female_instructor_available', true);
        }

        if (filters.englishSupport) {
            query = query.eq('english_support_available', true);
        }

        if (filters.pickupService) {
            query = query.eq('pickup_service_available', true);
        }

        if (filters.photoService) {
            query = query.eq('photo_service_available', true);
        }

        if (filters.videoService) {
            query = query.eq('video_service_available', true);
        }

        if (filters.privateGuide) {
            query = query.eq('private_guide_available', true);
        }

        if (filters.licenseCoursesAvailable) {
            query = query.eq('license_course_available', true);
        }

        if (filters.funDiveAvailable) {
            query = query.eq('fun_dive_available', true);
        }

        // グループサイズフィルター
        if (filters.maxGroupSize) {
            query = query.lte('max_group_size', filters.maxGroupSize);
        }

        // 高度検索キーワード（複数フィールド対応）
        if (filters.keyword) {
            const searchFields = [
                'shop_name',
                'trial_dive_options',
                'area'
            ];
            
            const searchConditions = searchFields.map(field => 
                `${field}.ilike.%${filters.keyword}%`
            ).join(',');
            
            query = query.or(searchConditions);
        }

        // 複数ソートオプション
        const sortBy = filters.sortBy || 'jiji_grade';
        const sortOrder = filters.sortOrder || 'desc';
        
        // カスタムソート処理
        if (sortBy === 'price_asc') {
            query = query.order('trial_dive_price_beach', { ascending: true });
        } else if (sortBy === 'price_desc') {
            query = query.order('trial_dive_price_beach', { ascending: false });
        } else if (sortBy === 'name') {
            query = query.order('shop_name', { ascending: true });
        } else if (sortBy === 'area') {
            query = query.order('area', { ascending: true }).order('shop_name', { ascending: true });
        } else if (sortBy === 'grade') {
            // グレード順（premium > standard > basic）
            query = query.order('jiji_grade', { ascending: false });
        } else {
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        // ページネーション対応
        const limit = Math.min(filters.limit || 50, 100);
        const offset = filters.offset || 0;
        
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
            console.error('❌ ショップ一覧取得エラー:', error);
            return getSampleShopsData(filters);
        }

        console.log(`✅ ショップ一覧取得成功: ${data.length}件 (offset: ${offset})`);
        return data || [];

    } catch (error) {
        console.error('❌ ショップ一覧取得エラー:', error);
        return getSampleShopsData(filters);
    }
}

/**
 * ショップ詳細情報取得
 * @param {string} shopId - ショップID
 * @returns {Promise<Object|null>} ショップ詳細情報
 */
async function getShopDetails(shopId) {
    const useSupabase = supabase !== null;
    
    if (!useSupabase) {
        console.log('ℹ️ Supabase無効 - サンプルショップ詳細データ返却');
        return getSampleShopDetails(shopId);
    }

    try {
        const { data, error } = await supabase
            .from('shop_master')
            .select('*')
            .eq('shop_id', shopId)
            .single();

        if (error) {
            console.error(`❌ ショップ詳細取得エラー (${shopId}):`, error);
            return getSampleShopDetails(shopId);
        }

        if (!data) {
            console.log(`⚠️ ショップが見つかりません: ${shopId}`);
            return null;
        }

        // レビュー情報も同時取得（別途実装予定）
        const reviews = []; // await getShopReviews(shopId, 10);
        const averageRatings = {}; // await calculateShopAverageRatings(shopId);

        const shopDetails = {
            ...data,
            reviews: reviews || [],
            average_ratings: averageRatings || {}
        };

        console.log(`✅ ショップ詳細取得成功: ${shopId}`);
        return shopDetails;

    } catch (error) {
        console.error(`❌ ショップ詳細取得エラー (${shopId}):`, error);
        return getSampleShopDetails(shopId);
    }
}

/**
 * ショップ統計情報取得
 * @returns {Promise<Object>} 統計情報
 */
async function getShopsStatistics() {
    const useSupabase = supabase !== null;
    
    if (!useSupabase) {
        return {
            total_shops: 79,
            by_area: {
                '石垣島': 32,
                '宮古島': 24,
                '沖縄本島': 23
            },
            by_grade: {
                'premium': 8,
                'standard': 25,
                'basic': 46
            }
        };
    }

    try {
        const { data, error } = await supabase
            .from('shop_master')
            .select('area, jiji_grade');

        if (error) {
            console.error('❌ ショップ統計取得エラー:', error);
            return {};
        }

        const stats = {
            total_shops: data.length,
            by_area: {},
            by_grade: {}
        };

        data.forEach(shop => {
            // エリア別集計
            stats.by_area[shop.area] = (stats.by_area[shop.area] || 0) + 1;
            
            // グレード別集計
            stats.by_grade[shop.jiji_grade] = (stats.by_grade[shop.jiji_grade] || 0) + 1;
        });

        return stats;

    } catch (error) {
        console.error('❌ ショップ統計取得エラー:', error);
        return {};
    }
}

/**
 * エリア別ショップ検索
 * @param {string} area - エリア名
 * @param {Object} options - 追加オプション
 * @returns {Promise<Array>} エリア内ショップ一覧
 */
async function getShopsByArea(area, options = {}) {
    const filters = { area, ...options };
    return await getShopsList(filters);
}

/**
 * 初心者向けショップ検索
 * @param {Object} options - 検索オプション
 * @returns {Promise<Array>} 初心者向けショップ一覧
 */
async function getBeginnerFriendlyShops(options = {}) {
    const filters = { 
        beginnerFriendly: true,
        soloOk: true,
        ...options 
    };
    return await getShopsList(filters);
}

/**
 * Jiji AI推薦ショップ取得
 * @param {Object} userPreferences - ユーザー嗜好
 * @returns {Promise<Array>} 推薦ショップ一覧
 */
async function getRecommendedShops(userPreferences = {}) {
    const filters = {
        beginnerFriendly: userPreferences.isBeginners || true,
        soloOk: userPreferences.isSolo || false,
        femaleInstructor: userPreferences.preferFemaleInstructor || false,
        area: userPreferences.preferredArea,
        maxPrice: userPreferences.maxBudget,
        sortBy: 'jiji_grade',
        sortOrder: 'desc',
        limit: 10
    };

    const shops = await getShopsList(filters);
    
    // Jiji推薦ロジック適用
    return shops.map(shop => ({
        ...shop,
        jiji_match_score: calculateJijiMatchScore(shop, userPreferences),
        recommendation_reason: generateRecommendationReason(shop, userPreferences)
    })).sort((a, b) => b.jiji_match_score - a.jiji_match_score);
}

/**
 * Jijiマッチスコア計算
 * @param {Object} shop - ショップデータ
 * @param {Object} userPreferences - ユーザー嗜好
 * @returns {number} マッチスコア (0-100)
 */
function calculateJijiMatchScore(shop, userPreferences) {
    let score = 0;
    
    // 基本適性スコア
    if (shop.beginner_friendly && userPreferences.isBeginners) score += 25;
    if (shop.solo_participant_ok && userPreferences.isSolo) score += 20;
    if (shop.female_instructor_available && userPreferences.preferFemaleInstructor) score += 15;
    
    // グレード別ボーナス
    if (shop.jiji_grade === 'premium') score += 20;
    else if (shop.jiji_grade === 'standard') score += 10;
    
    // サービス充実度
    if (shop.photo_service_available) score += 5;
    if (shop.pickup_service_available) score += 5;
    if (shop.private_guide_available) score += 5;
    
    // 価格適性
    if (userPreferences.maxBudget && shop.trial_dive_price_beach <= userPreferences.maxBudget) {
        score += 5;
    }
    
    return Math.min(score, 100);
}

/**
 * 推薦理由生成
 * @param {Object} shop - ショップデータ
 * @param {Object} userPreferences - ユーザー嗜好
 * @returns {string} 推薦理由
 */
function generateRecommendationReason(shop, userPreferences) {
    const reasons = [];
    
    if (shop.beginner_friendly && userPreferences.isBeginners) {
        reasons.push('初心者に優しい');
    }
    
    if (shop.solo_participant_ok && userPreferences.isSolo) {
        reasons.push('一人参加歓迎');
    }
    
    if (shop.female_instructor_available && userPreferences.preferFemaleInstructor) {
        reasons.push('女性インストラクター在籍');
    }
    
    if (shop.jiji_grade === 'premium') {
        reasons.push('Dive Buddy\'s プレミアム認定');
    }
    
    if (shop.photo_service_available) {
        reasons.push('写真撮影サービス有');
    }
    
    return reasons.length > 0 ? reasons.join('・') : 'バランスの良いサービス';
}

/**
 * サンプルショップデータ（開発・テスト用）
 */
function getSampleShopsData(filters = {}) {
    const sampleShops = [
        {
            shop_id: 'ishigaki_001',
            shop_name: '石垣島マリンサービス',
            area: '石垣島',
            phone_line: '0980-XX-XXXX',
            website: 'https://example-ishigaki.com',
            operating_hours: '8:00-18:00',
            fun_dive_available: true,
            trial_dive_options: '体験ダイビング、シュノーケリング',
            license_course_available: true,
            trial_dive_price_beach: 8000,
            trial_dive_price_boat: 12000,
            fun_dive_price_2tanks: 15000,
            max_group_size: 6,
            private_guide_available: true,
            beginner_friendly: true,
            solo_participant_ok: true,
            female_instructor_available: true,
            english_support_available: false,
            pickup_service_available: true,
            photo_service_available: true,
            video_service_available: false,
            jiji_grade: 'premium',
            last_updated: '2025-07-25'
        },
        {
            shop_id: 'miyako_001',
            shop_name: '宮古ブルーダイビング',
            area: '宮古島',
            phone_line: '0980-YY-YYYY',
            website: 'https://example-miyako.com',
            operating_hours: '8:30-17:30',
            fun_dive_available: true,
            trial_dive_options: '体験ダイビング、セット割あり',
            license_course_available: true,
            trial_dive_price_beach: 7500,
            trial_dive_price_boat: 11000,
            fun_dive_price_2tanks: 14000,
            max_group_size: 4,
            private_guide_available: true,
            beginner_friendly: true,
            solo_participant_ok: true,
            female_instructor_available: true,
            english_support_available: true,
            pickup_service_available: true,
            photo_service_available: true,
            video_service_available: true,
            jiji_grade: 'standard',
            last_updated: '2025-07-25'
        },
        {
            shop_id: 'okinawa_001',
            shop_name: '沖縄本島ダイビングクラブ',
            area: '沖縄本島',
            phone_line: '098-ZZ-ZZZZ',
            website: 'https://example-okinawa.com',
            operating_hours: '9:00-17:00',
            fun_dive_available: true,
            trial_dive_options: '体験ダイビング、青の洞窟ツアー',
            license_course_available: false,
            trial_dive_price_beach: 6500,
            trial_dive_price_boat: 9500,
            fun_dive_price_2tanks: 12000,
            max_group_size: 8,
            private_guide_available: false,
            beginner_friendly: true,
            solo_participant_ok: false,
            female_instructor_available: false,
            english_support_available: false,
            pickup_service_available: false,
            photo_service_available: true,
            video_service_available: false,
            jiji_grade: 'basic',
            last_updated: '2025-07-25'
        },
        {
            shop_id: 'ishigaki_002',
            shop_name: 'マンタポイント専門店',
            area: '石垣島',
            phone_line: '0980-AA-AAAA',
            website: 'https://example-manta.com',
            operating_hours: '7:30-17:00',
            fun_dive_available: true,
            trial_dive_options: 'マンタ体験ダイビング、上級者向け',
            license_course_available: true,
            trial_dive_price_beach: 9500,
            trial_dive_price_boat: 14000,
            fun_dive_price_2tanks: 18000,
            max_group_size: 4,
            private_guide_available: true,
            beginner_friendly: false,
            solo_participant_ok: true,
            female_instructor_available: false,
            english_support_available: true,
            pickup_service_available: true,
            photo_service_available: true,
            video_service_available: true,
            jiji_grade: 'premium',
            last_updated: '2025-07-25'
        },
        {
            shop_id: 'miyako_002',
            shop_name: '宮古島ファミリーダイビング',
            area: '宮古島',
            phone_line: '0980-BB-BBBB',
            website: 'https://example-family.com',
            operating_hours: '9:00-16:00',
            fun_dive_available: true,
            trial_dive_options: 'ファミリー体験、キッズ対応',
            license_course_available: false,
            trial_dive_price_beach: 6800,
            trial_dive_price_boat: 9800,
            fun_dive_price_2tanks: 13500,
            max_group_size: 6,
            private_guide_available: false,
            beginner_friendly: true,
            solo_participant_ok: false,
            female_instructor_available: true,
            english_support_available: false,
            pickup_service_available: true,
            photo_service_available: true,
            video_service_available: false,
            jiji_grade: 'basic',
            last_updated: '2025-07-25'
        }
    ];

    // フィルタリング適用（拡張版）
    let filteredShops = sampleShops.filter(shop => {
        // エリアフィルター
        if (filters.area && shop.area !== filters.area) return false;
        
        // 価格範囲フィルター
        if (filters.minPrice && shop.trial_dive_price_beach < filters.minPrice) return false;
        if (filters.maxPrice && shop.trial_dive_price_beach > filters.maxPrice) return false;
        
        // グレードフィルター
        if (filters.grade && shop.jiji_grade !== filters.grade) return false;
        
        // サービスフィルター
        if (filters.beginnerFriendly && !shop.beginner_friendly) return false;
        if (filters.soloOk && !shop.solo_participant_ok) return false;
        if (filters.femaleInstructor && !shop.female_instructor_available) return false;
        if (filters.englishSupport && !shop.english_support_available) return false;
        if (filters.pickupService && !shop.pickup_service_available) return false;
        if (filters.photoService && !shop.photo_service_available) return false;
        if (filters.privateGuide && !shop.private_guide_available) return false;
        if (filters.licenseCoursesAvailable && !shop.license_course_available) return false;
        if (filters.funDiveAvailable && !shop.fun_dive_available) return false;
        
        // キーワード検索（複数フィールド対応）
        if (filters.keyword) {
            const keyword = filters.keyword.toLowerCase();
            const searchText = `${shop.shop_name} ${shop.trial_dive_options} ${shop.area}`.toLowerCase();
            if (!searchText.includes(keyword)) return false;
        }
        
        return true;
    });

    // ソート適用（拡張版）
    if (filters.sortBy) {
        filteredShops.sort((a, b) => {
            switch (filters.sortBy) {
                case 'price_asc':
                    return a.trial_dive_price_beach - b.trial_dive_price_beach;
                case 'price_desc':
                    return b.trial_dive_price_beach - a.trial_dive_price_beach;
                case 'name':
                    return a.shop_name.localeCompare(b.shop_name);
                case 'area':
                    return a.area.localeCompare(b.area) || a.shop_name.localeCompare(b.shop_name);
                case 'grade':
                    // グレード順（premium > standard > basic）
                    const gradeOrder = { 'premium': 3, 'standard': 2, 'basic': 1 };
                    return (gradeOrder[b.jiji_grade] || 0) - (gradeOrder[a.jiji_grade] || 0);
                default:
                    const aVal = a[filters.sortBy];
                    const bVal = b[filters.sortBy];
                    
                    if (filters.sortOrder === 'asc') {
                        return aVal > bVal ? 1 : -1;
                    } else {
                        return aVal < bVal ? 1 : -1;
                    }
            }
        });
    }

    // 制限適用
    if (filters.limit) {
        filteredShops = filteredShops.slice(0, filters.limit);
    }

    return filteredShops;
}

/**
 * サンプルショップ詳細データ
 */
function getSampleShopDetails(shopId) {
    const sampleShops = getSampleShopsData();
    const shop = sampleShops.find(s => s.shop_id === shopId);
    
    if (!shop) return null;

    return {
        ...shop,
        reviews: [
            {
                review_id: 'rev_001',
                user_id: 'user_001',
                overall_rating: 4.5,
                beginner_friendliness: 5.0,
                safety_rating: 4.0,
                instructor_rating: 4.5,
                equipment_rating: 4.0,
                value_rating: 4.0,
                location_rating: 5.0,
                review_text: '初心者でしたが、とても丁寧に教えていただき安心してダイビングできました！石垣島の海は本当に美しく、魚もたくさん見れて最高の思い出になりました。',
                review_date: '2025-07-20',
                helpful_count: 5
            },
            {
                review_id: 'rev_002',
                user_id: 'user_002',
                overall_rating: 4.0,
                beginner_friendliness: 4.0,
                safety_rating: 5.0,
                instructor_rating: 4.0,
                equipment_rating: 4.5,
                value_rating: 3.5,
                location_rating: 4.5,
                review_text: '女性一人での参加でしたが、女性インストラクターの方が丁寧にサポートしてくれて安心でした。',
                review_date: '2025-07-18',
                helpful_count: 3
            }
        ],
        average_ratings: {
            overall_rating: 4.3,
            beginner_friendliness: 4.5,
            safety_rating: 4.5,
            instructor_rating: 4.3,
            equipment_rating: 4.2,
            value_rating: 3.8,
            location_rating: 4.7,
            total_reviews: 12
        }
    };
}

module.exports = {
    getShopsList,
    getShopDetails,
    getShopsStatistics,
    getShopsByArea,
    getBeginnerFriendlyShops,
    getRecommendedShops,
    calculateJijiMatchScore,
    generateRecommendationReason
};