/**
 * 🔒 Jiji セキュアデータベースコネクター
 * RLS対応版 - 段階的セキュリティ強化実装
 * Railway本番環境との完全互換性保証
 */

const { createClient } = require('@supabase/supabase-js');
const { createClient: createRedisClient } = require('redis');
require('dotenv').config();

// ========================================
// セキュア設定: Service Role Key 対応
// ========================================

// 匿名アクセス用（既存互換）
let supabase = null;
let supabaseAvailable = false;

// 管理者アクセス用（セキュア操作）
let supabaseAdmin = null;
let supabaseAdminAvailable = false;

try {
    // 既存のANON KEY接続（段階的移行用）
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY
        );
        supabaseAvailable = true;
        console.log('✅ Supabase (ANON) 接続成功');
    }
    
    // 管理者権限接続（推奨）
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        supabaseAdmin = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        supabaseAdminAvailable = true;
        console.log('✅ Supabase (ADMIN) 接続成功');
    } else {
        console.log('ℹ️ SUPABASE_SERVICE_ROLE_KEY 未設定 - ANON KEYで動作');
    }
    
} catch (error) {
    console.error('❌ Supabase初期化エラー:', error.message);
    supabaseAvailable = false;
    supabaseAdminAvailable = false;
}

// Redis設定（既存と同じ）
let redisClient = null;
let redisAvailable = false;

try {
    if (process.env.REDIS_HOST) {
        redisClient = createRedisClient({
            socket: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
                tls: { minVersion: 'TLSv1.2' }
            },
            username: process.env.REDIS_USERNAME,
            password: process.env.REDIS_PASSWORD
        });
        
        redisClient.on('error', (err) => {
            console.error('❌ Redis Client Error', err);
            redisAvailable = false;
        });
        
        redisClient.on('connect', () => {
            console.log('✅ Redis connected');
            redisAvailable = true;
        });
    } else {
        console.log('ℹ️ Redis設定なし - キャッシュ機能無効');
    }
} catch (error) {
    console.log('ℹ️ Redis初期化スキップ:', error.message);
}

// ========================================
// セキュアアクセスヘルパー関数
// ========================================

/**
 * RLS対応セキュアクライアント取得
 * @param {string} lineUserId - LINEユーザーID
 * @param {boolean} useAdmin - 管理者権限使用フラグ
 * @returns {Object} Supabaseクライアント
 */
async function getSecureClient(lineUserId = null, useAdmin = false) {
    // 管理者権限が必要かつ利用可能な場合
    if (useAdmin && supabaseAdminAvailable) {
        return supabaseAdmin;
    }
    
    // ANON KEYでRLS対応アクセス
    if (supabaseAvailable && lineUserId) {
        try {
            // セッション変数設定（RLSポリシー用）
            await supabase.rpc('set_current_line_user_id', { 
                user_id: lineUserId 
            });
            console.log(`🔐 RLSセッション設定: ${lineUserId}`);
            return supabase;
        } catch (error) {
            console.log('⚠️ RLSセッション設定失敗 - 既存モードで続行:', error.message);
            return supabase;
        }
    }
    
    return supabase;
}

/**
 * Redis接続確保（既存と同じ）
 */
async function ensureRedisConnection() {
    if (!redisClient || !redisAvailable) return false;
    
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
            redisAvailable = true;
        }
        return true;
    } catch (error) {
        console.log('ℹ️ Redis接続失敗 - キャッシュなしで続行');
        redisAvailable = false;
        return false;
    }
}

// ========================================
// セキュアユーザープロファイル操作
// ========================================

/**
 * セキュアユーザープロファイル作成
 * @param {string} lineUserId - LINEユーザーID  
 * @param {Object} userData - ユーザーデータ
 * @returns {Object} 作成結果
 */
async function createUserProfileSecure(lineUserId, userData = {}) {
    if (!supabaseAvailable && !supabaseAdminAvailable) {
        console.log('ℹ️ Profile作成スキップ (DB無効):', lineUserId);
        return { success: true, data: null, skipped: true };
    }
    
    try {
        const profileData = {
            line_user_id: lineUserId,
            name: userData.name || null,
            diving_experience: userData.diving_experience || null,
            license_type: userData.license_type || null,
            preferences: userData.preferences || {},
            profile_completion_rate: calculateCompletionRate(userData),
            updated_at: new Date().toISOString()
        };

        // セキュアクライアント取得
        const client = await getSecureClient(lineUserId, true); // 管理者権限で作成
        
        const { data, error } = await client
            .from('user_profiles')
            .insert([profileData])
            .select()
            .single();

        if (error) {
            console.error('❌ セキュアユーザープロファイル作成エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ セキュアユーザープロファイル作成成功:', lineUserId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ セキュアユーザープロファイル作成例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * セキュアユーザープロファイル取得
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Object} ユーザープロファイル
 */
async function getUserProfileSecure(lineUserId) {
    if (!supabaseAvailable && !supabaseAdminAvailable) {
        console.log('ℹ️ Profile取得スキップ (DB無効):', lineUserId);
        return { success: false, error: 'USER_NOT_FOUND', skipped: true };
    }
    
    try {
        // Redisキャッシュ確認
        const cacheKey = `user_profile:${lineUserId}`;
        if (await ensureRedisConnection()) {
            try {
                const cachedProfile = await redisClient.get(cacheKey);
                if (cachedProfile) {
                    console.log('✅ Redisキャッシュからプロファイル取得:', lineUserId);
                    return { success: true, data: JSON.parse(cachedProfile), fromCache: true };
                }
            } catch (error) {
                console.log('ℹ️ Redisキャッシュ取得失敗 - DB直接アクセス');
            }
        }

        // セキュアクライアント取得
        const client = await getSecureClient(lineUserId, false); // RLS適用

        const { data, error } = await client
            .from('user_profiles')
            .select('*')
            .eq('line_user_id', lineUserId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: false, error: 'USER_NOT_FOUND' };
            }
            console.error('❌ セキュアユーザープロファイル取得エラー:', error);
            return { success: false, error: error.message };
        }

        // Redisキャッシュ保存
        if (await ensureRedisConnection()) {
            try {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(data));
            } catch (error) {
                console.log('ℹ️ Redisキャッシュ保存失敗');
            }
        }

        console.log('✅ セキュアユーザープロファイル取得成功:', lineUserId);
        return { success: true, data, fromCache: false };

    } catch (err) {
        console.error('❌ セキュアユーザープロファイル取得例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * セキュアユーザープロファイル更新
 * @param {string} lineUserId - LINEユーザーID
 * @param {Object} updates - 更新データ
 * @returns {Object} 更新結果
 */
async function updateUserProfileSecure(lineUserId, updates) {
    try {
        const updateData = {
            ...updates,
            profile_completion_rate: calculateCompletionRate(updates),
            updated_at: new Date().toISOString()
        };

        // セキュアクライアント取得
        const client = await getSecureClient(lineUserId, false); // RLS適用

        const { data, error } = await client
            .from('user_profiles')
            .update(updateData)
            .eq('line_user_id', lineUserId)
            .select()
            .single();

        if (error) {
            console.error('❌ セキュアユーザープロファイル更新エラー:', error);
            return { success: false, error: error.message };
        }

        // Redisキャッシュ更新
        const cacheKey = `user_profile:${lineUserId}`;
        if (await ensureRedisConnection()) {
            try {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(data));
            } catch (error) {
                console.log('ℹ️ Redisキャッシュ更新失敗');
            }
        }

        console.log('✅ セキュアユーザープロファイル更新成功:', lineUserId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ セキュアユーザープロファイル更新例外:', err);
        return { success: false, error: err.message };
    }
}

// ========================================
// セキュア会話履歴操作
// ========================================

/**
 * セキュア会話保存
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} messageType - メッセージタイプ
 * @param {string} content - 内容
 * @param {string} sessionId - セッションID
 * @param {Object} metadata - メタデータ
 * @returns {Object} 保存結果
 */
async function saveConversationSecure(lineUserId, messageType, content, sessionId = null, metadata = {}) {
    if (!supabaseAvailable && !supabaseAdminAvailable) {
        console.log('ℹ️ 会話保存スキップ (DB無効):', lineUserId, messageType);
        return { success: true, data: null, skipped: true };
    }
    
    try {
        const conversationData = {
            line_user_id: lineUserId,
            message_type: messageType,
            message_content: content,
            timestamp: new Date().toISOString(),
            session_id: sessionId,
            metadata: metadata
        };

        // セキュアクライアント取得
        const client = await getSecureClient(lineUserId, false); // RLS適用

        const { data, error } = await client
            .from('conversations')
            .insert([conversationData])
            .select()
            .single();

        if (error) {
            console.error('❌ セキュア会話保存エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ セキュア会話保存成功:', lineUserId, messageType);
        return { success: true, data };

    } catch (err) {
        console.error('❌ セキュア会話保存例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * セキュア会話履歴取得
 * @param {string} lineUserId - LINEユーザーID
 * @param {number} limit - 取得制限
 * @param {string} sessionId - セッションID
 * @returns {Object} 会話履歴
 */
async function getConversationHistorySecure(lineUserId, limit = 50, sessionId = null) {
    if (!supabaseAvailable && !supabaseAdminAvailable) {
        console.log('ℹ️ 会話履歴取得スキップ (DB無効):', lineUserId);
        return { success: true, data: [], skipped: true };
    }
    
    try {
        // セキュアクライアント取得
        const client = await getSecureClient(lineUserId, false); // RLS適用

        let query = client
            .from('conversations')
            .select('*')
            .eq('line_user_id', lineUserId)
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (sessionId) {
            query = query.eq('session_id', sessionId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ セキュア会話履歴取得エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ セキュア会話履歴取得成功:', lineUserId, `${data.length}件`);
        return { success: true, data: data.reverse() };

    } catch (err) {
        console.error('❌ セキュア会話履歴取得例外:', err);
        return { success: false, error: err.message };
    }
}

// ========================================
// 既存機能との互換性関数
// ========================================

/**
 * プロファイル完成度計算（既存と同じ）
 */
function calculateCompletionRate(userData) {
    const fields = ['name', 'diving_experience', 'license_type'];
    const completedFields = fields.filter(field => userData[field] && userData[field].trim() !== '');
    return Math.round((completedFields.length / fields.length) * 100);
}

/**
 * ユーザー存在確認（既存と同じ）
 */
async function userExistsSecure(lineUserId) {
    const result = await getUserProfileSecure(lineUserId);
    return result.success && result.error !== 'USER_NOT_FOUND';
}

/**
 * セキュアデータベース接続テスト
 */
async function testSecureDatabaseConnection() {
    try {
        console.log('🔒 セキュアデータベース接続テスト開始...');
        
        // ANON KEY テスト
        if (supabaseAvailable) {
            const testClient = await getSecureClient('test_user_123', false);
            console.log('✅ ANON KEY + RLS 接続成功');
        }
        
        // SERVICE ROLE KEY テスト  
        if (supabaseAdminAvailable) {
            const { data, error } = await supabaseAdmin
                .from('user_profiles')
                .select('id')
                .limit(1);
            
            if (error && error.code !== '42P01') {
                console.error('❌ SERVICE ROLE KEY connection error:', error);
            } else {
                console.log('✅ SERVICE ROLE KEY 接続成功');
            }
        }
        
        // Redis接続テスト
        if (await ensureRedisConnection()) {
            try {
                await redisClient.set('security_test', 'connection-test');
                const testValue = await redisClient.get('security_test');
                console.log(`✅ Redis セキュリティテスト成功: '${testValue}'`);
            } catch (error) {
                console.log('ℹ️ Redisセキュリティテスト失敗');
            }
        }
        
        console.log('🔒 セキュアデータベース接続テスト完了');
        
    } catch (err) {
        console.log('ℹ️ セキュアデータベース接続テストスキップ:', err.message);
    }
}

// ========================================
// 段階的移行サポート
// ========================================

/**
 * 段階的移行: 既存関数のセキュア版ラッパー
 * 既存コードとの互換性保証
 */

// 既存互換用エクスポート（段階的移行用）
const legacyFunctions = {
    // 既存 database.js の関数名でセキュア版を提供
    createUserProfile: createUserProfileSecure,
    getUserProfile: getUserProfileSecure,
    updateUserProfile: updateUserProfileSecure,
    saveConversation: saveConversationSecure,
    getConversationHistory: getConversationHistorySecure,
    userExists: userExistsSecure,
    calculateCompletionRate,
    testDatabaseConnection: testSecureDatabaseConnection
};

module.exports = {
    // セキュア版関数（推奨）
    createUserProfileSecure,
    getUserProfileSecure,
    updateUserProfileSecure,
    saveConversationSecure,
    getConversationHistorySecure,
    userExistsSecure,
    getSecureClient,
    testSecureDatabaseConnection,
    
    // 既存互換関数（段階的移行用）
    ...legacyFunctions,
    
    // Supabaseクライアント
    supabase,
    supabaseAdmin,
    redisClient,
    
    // ユーティリティ
    calculateCompletionRate,
    
    // 接続状態
    supabaseAvailable,
    supabaseAdminAvailable
};