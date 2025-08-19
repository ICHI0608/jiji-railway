/**
 * ショップデータベース拡張版（協議会・漁協対応）
 * 34項目から38項目への拡張実装
 */

const { supabase } = require('./database');

/**
 * 拡張ショップデータベーススキーマ定義
 */
const EXTENDED_SHOP_SCHEMA = {
    // 既存34項目に追加する4項目
    newFields: {
        council_membership: 'TEXT', // 協議会加入状況
        council_name: 'TEXT',       // 協議会名
        cooperative_membership: 'TEXT', // 漁協・組合加入状況  
        safety_certification_level: 'TEXT' // 安全認証レベル (S/A/B/未加入)
    },
    
    // 地域別協議会マッピング
    regionCouncils: {
        'miyako': 'ちゅら海連絡協議会',
        'ishigaki': '八重山ダイビング事業者連絡協議会', 
        'okinawa_main': '沖縄県ダイビング事業者協会',
        'kerama': '慶良間ダイビング協会'
    },
    
    // 安全認証レベル定義
    safetyLevels: {
        'S': { name: 'S級認定', color: '#FFD700', priority: 4 },
        'A': { name: 'A級認定', color: '#C0C0C0', priority: 3 },
        'B': { name: 'B級認定', color: '#CD7F32', priority: 2 },
        'unaffiliated': { name: '未加入', color: '#808080', priority: 1 }
    }
};

/**
 * 地域から該当する協議会名を取得
 */
function getRegionCouncil(area) {
    const regionMapping = {
        '宮古島': 'miyako',
        '石垣島': 'ishigaki', 
        '八重山': 'ishigaki',
        '沖縄本島': 'okinawa_main',
        '那覇': 'okinawa_main',
        '恩納村': 'okinawa_main',
        '慶良間': 'kerama',
        '座間味': 'kerama'
    };
    
    for (const [areaKey, regionCode] of Object.entries(regionMapping)) {
        if (area && area.includes(areaKey)) {
            return EXTENDED_SHOP_SCHEMA.regionCouncils[regionCode] || null;
        }
    }
    return null;
}

/**
 * ショップの安全認証レベルを算出
 */
function calculateSafetyCertificationLevel(shop) {
    const {
        council_membership,
        cooperative_membership,
        jiji_grade,
        beginner_friendly,
        safety_record_years
    } = shop;

    // S級認定条件
    if (council_membership === 'member' && 
        cooperative_membership === 'member' &&
        jiji_grade >= 4.5 &&
        beginner_friendly === true &&
        (safety_record_years >= 3)) {
        return 'S';
    }
    
    // A級認定条件
    if (council_membership === 'member' && jiji_grade >= 4.0) {
        return 'A';
    }
    
    // B級認定条件
    if (cooperative_membership === 'member' || council_membership === 'member') {
        return 'B';
    }
    
    // 未加入
    return 'unaffiliated';
}

/**
 * 拡張ショップデータ取得（協議会・漁協情報付き）
 */
async function getExtendedShopsList(filters = {}) {
    try {
        let query = supabase
            .from('diving_shops')
            .select(`
                *,
                council_membership,
                council_name, 
                cooperative_membership,
                safety_certification_level
            `);

        // 協議会フィルター
        if (filters.councilMember === true) {
            query = query.eq('council_membership', 'member');
        }
        
        // 安全認証レベルフィルター
        if (filters.safetyLevel) {
            query = query.eq('safety_certification_level', filters.safetyLevel);
        }
        
        // 漁協組合フィルター
        if (filters.cooperativeMember === true) {
            query = query.eq('cooperative_membership', 'member');
        }

        // 既存フィルター適用
        if (filters.area) {
            query = query.eq('area', filters.area);
        }
        
        if (filters.minRating) {
            query = query.gte('jiji_grade', filters.minRating);
        }

        const { data: shops, error } = await query
            .order('safety_certification_level', { ascending: false })
            .order('jiji_grade', { ascending: false });

        if (error) {
            console.error('拡張ショップデータ取得エラー:', error);
            return [];
        }

        // データ拡張処理
        const extendedShops = shops.map(shop => ({
            ...shop,
            // 協議会名が未設定の場合は地域から推定
            council_name: shop.council_name || getRegionCouncil(shop.area),
            
            // 安全認証レベルが未設定の場合は算出
            safety_certification_level: shop.safety_certification_level || 
                calculateSafetyCertificationLevel(shop),
            
            // 安全認証情報の詳細
            safetyInfo: EXTENDED_SHOP_SCHEMA.safetyLevels[
                shop.safety_certification_level || 'unaffiliated'
            ],
            
            // 協議会・組合の加入メリット説明
            membershipBenefits: generateMembershipBenefits(shop)
        }));

        return extendedShops;

    } catch (error) {
        console.error('拡張ショップデータ取得システムエラー:', error);
        return [];
    }
}

/**
 * 協議会・組合加入メリット生成
 */
function generateMembershipBenefits(shop) {
    const benefits = [];
    
    if (shop.council_membership === 'member') {
        benefits.push(
            '統一安全基準による信頼性',
            '緊急時連携体制完備',
            '定期的な安全講習受講',
            '業界全体の品質向上'
        );
    }
    
    if (shop.cooperative_membership === 'member') {
        benefits.push(
            '海域使用権の適切な管理',
            '地域漁業との調和',
            '海洋環境保護活動参加'
        );
    }
    
    return benefits;
}

/**
 * 協議会・漁協情報付きショップ詳細取得
 */
async function getExtendedShopDetail(shopId) {
    try {
        const { data: shop, error } = await supabase
            .from('diving_shops')
            .select(`
                *,
                council_membership,
                council_name,
                cooperative_membership, 
                safety_certification_level
            `)
            .eq('shop_id', shopId)
            .single();

        if (error || !shop) {
            console.error('ショップ詳細取得エラー:', error);
            return null;
        }

        // 協議会・漁協情報の詳細を追加
        const extendedShop = {
            ...shop,
            council_name: shop.council_name || getRegionCouncil(shop.area),
            safety_certification_level: shop.safety_certification_level || 
                calculateSafetyCertificationLevel(shop),
            safetyInfo: EXTENDED_SHOP_SCHEMA.safetyLevels[
                shop.safety_certification_level || 'unaffiliated'
            ],
            membershipBenefits: generateMembershipBenefits(shop),
            
            // 協議会の詳細情報
            councilDetails: await getCouncilDetails(shop.area),
            
            // 安全への取り組み詳細
            safetyMeasures: generateSafetyMeasures(shop)
        };

        return extendedShop;

    } catch (error) {
        console.error('ショップ詳細取得システムエラー:', error);
        return null;
    }
}

/**
 * 地域協議会の詳細情報取得
 */
async function getCouncilDetails(area) {
    const councilsData = require('../data/okinawa-councils-cooperatives.json');
    
    for (const region of councilsData.okinawa_diving_councils.regions) {
        const council = region.primaryCouncil;
        if (getRegionCouncil(area) === council.name) {
            return {
                name: council.name,
                purpose: council.purpose,
                safetyRules: council.safetyRules,
                environmentalRules: council.environmentalRules,
                benefits: council.benefits
            };
        }
    }
    return null;
}

/**
 * 安全への取り組み詳細生成
 */
function generateSafetyMeasures(shop) {
    const measures = [];
    
    if (shop.safety_certification_level === 'S') {
        measures.push(
            '協議会認定の最高水準安全基準',
            '年2回以上の安全講習受講',
            '3年以上の無事故記録',
            '環境保護活動積極参加'
        );
    } else if (shop.safety_certification_level === 'A') {
        measures.push(
            '協議会認定の安全基準遵守',
            '年1回以上の安全講習受講',
            '基本的な環境保護活動参加'
        );
    } else if (shop.safety_certification_level === 'B') {
        measures.push(
            '基本的な安全基準遵守',
            '地域組合との連携'
        );
    }
    
    return measures;
}

/**
 * データベーススキーマ拡張用SQL生成
 */
function generateExtendedSchemaSql() {
    return `
-- ショップデータベース拡張（協議会・漁協対応）
ALTER TABLE diving_shops 
ADD COLUMN IF NOT EXISTS council_membership TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS council_name TEXT,
ADD COLUMN IF NOT EXISTS cooperative_membership TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS safety_certification_level TEXT DEFAULT 'unaffiliated';

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_council_membership ON diving_shops(council_membership);
CREATE INDEX IF NOT EXISTS idx_safety_certification ON diving_shops(safety_certification_level);
CREATE INDEX IF NOT EXISTS idx_cooperative_membership ON diving_shops(cooperative_membership);

-- コメント追加
COMMENT ON COLUMN diving_shops.council_membership IS '協議会加入状況 (member/non_member/unknown)';
COMMENT ON COLUMN diving_shops.council_name IS '加入協議会名';
COMMENT ON COLUMN diving_shops.cooperative_membership IS '漁協・組合加入状況 (member/non_member/unknown)';
COMMENT ON COLUMN diving_shops.safety_certification_level IS '安全認証レベル (S/A/B/unaffiliated)';
    `;
}

module.exports = {
    getExtendedShopsList,
    getExtendedShopDetail,
    calculateSafetyCertificationLevel,
    getRegionCouncil,
    generateExtendedSchemaSql,
    EXTENDED_SHOP_SCHEMA
};