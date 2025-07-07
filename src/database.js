const { createClient } = require('@supabase/supabase-js');
const { createClient: createRedisClient } = require('redis');
require('dotenv').config();

// Supabase クライアント設定
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Redis クライアント設定
const redisClient = createRedisClient({
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        tls: {
            minVersion: 'TLSv1.2'
        }
    },
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));

// Redis接続を管理する関数
async function ensureRedisConnection() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

// ===== ユーザープロファイル操作関数 =====

/**
 * 新規ユーザープロファイルを作成
 * @param {string} lineUserId - LINEユーザーID
 * @param {Object} userData - ユーザーデータ
 * @returns {Object} 作成結果
 */
async function createUserProfile(lineUserId, userData = {}) {
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

        const { data, error } = await supabase
            .from('user_profiles')
            .insert([profileData])
            .select()
            .single();

        if (error) {
            console.error('❌ ユーザープロファイル作成エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ユーザープロファイル作成成功:', lineUserId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ユーザープロファイル作成例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ユーザープロファイルを取得
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Object} ユーザープロファイル
 */
async function getUserProfile(lineUserId) {
    try {
        // まずRedisキャッシュを確認
        await ensureRedisConnection();
        const cacheKey = `user_profile:${lineUserId}`;
        const cachedProfile = await redisClient.get(cacheKey);

        if (cachedProfile) {
            console.log('✅ Redisキャッシュからプロファイル取得:', lineUserId);
            return { success: true, data: JSON.parse(cachedProfile), fromCache: true };
        }

        // キャッシュにない場合はSupabaseから取得
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('line_user_id', lineUserId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // ユーザーが存在しない
                return { success: false, error: 'USER_NOT_FOUND' };
            }
            console.error('❌ ユーザープロファイル取得エラー:', error);
            return { success: false, error: error.message };
        }

        // Redisにキャッシュ（1時間）
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(data));

        console.log('✅ ユーザープロファイル取得成功:', lineUserId);
        return { success: true, data, fromCache: false };

    } catch (err) {
        console.error('❌ ユーザープロファイル取得例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ユーザープロファイルを更新
 * @param {string} lineUserId - LINEユーザーID
 * @param {Object} updates - 更新データ
 * @returns {Object} 更新結果
 */
async function updateUserProfile(lineUserId, updates) {
    try {
        const updateData = {
            ...updates,
            profile_completion_rate: calculateCompletionRate(updates),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('line_user_id', lineUserId)
            .select()
            .single();

        if (error) {
            console.error('❌ ユーザープロファイル更新エラー:', error);
            return { success: false, error: error.message };
        }

        // Redisキャッシュを更新
        await ensureRedisConnection();
        const cacheKey = `user_profile:${lineUserId}`;
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(data));

        console.log('✅ ユーザープロファイル更新成功:', lineUserId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ユーザープロファイル更新例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== 会話履歴操作関数 =====

/**
 * 会話を保存
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} messageType - 'user' または 'assistant'
 * @param {string} content - メッセージ内容
 * @param {string} sessionId - セッションID（オプション）
 * @param {Object} metadata - 追加情報（オプション）
 * @returns {Object} 保存結果
 */
async function saveConversation(lineUserId, messageType, content, sessionId = null, metadata = {}) {
    try {
        const conversationData = {
            line_user_id: lineUserId,
            message_type: messageType,
            message_content: content,
            timestamp: new Date().toISOString(),
            session_id: sessionId,
            metadata: metadata
        };

        const { data, error } = await supabase
            .from('conversations')
            .insert([conversationData])
            .select()
            .single();

        if (error) {
            console.error('❌ 会話保存エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ 会話保存成功:', lineUserId, messageType);
        return { success: true, data };

    } catch (err) {
        console.error('❌ 会話保存例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 会話履歴を取得
 * @param {string} lineUserId - LINEユーザーID
 * @param {number} limit - 取得件数制限（デフォルト: 50）
 * @param {string} sessionId - 特定セッションのみ取得（オプション）
 * @returns {Object} 会話履歴
 */
async function getConversationHistory(lineUserId, limit = 50, sessionId = null) {
    try {
        let query = supabase
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
            console.error('❌ 会話履歴取得エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ 会話履歴取得成功:', lineUserId, `${data.length}件`);
        return { success: true, data: data.reverse() }; // 時系列順に並び替え

    } catch (err) {
        console.error('❌ 会話履歴取得例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== ユーティリティ関数 =====

/**
 * プロファイル完成度を計算
 * @param {Object} userData - ユーザーデータ
 * @returns {number} 完成度（0-100）
 */
function calculateCompletionRate(userData) {
    const fields = ['name', 'diving_experience', 'license_type'];
    const completedFields = fields.filter(field => userData[field] && userData[field].trim() !== '');
    return Math.round((completedFields.length / fields.length) * 100);
}

/**
 * ユーザーが存在するかチェック
 * @param {string} lineUserId - LINEユーザーID
 * @returns {boolean} 存在するかどうか
 */
async function userExists(lineUserId) {
    const result = await getUserProfile(lineUserId);
    return result.success && result.error !== 'USER_NOT_FOUND';
}

// ===== データベース接続テスト（既存） =====

async function testDatabaseConnection() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected successfully');

        const { data, error } = await supabase
            .from('user_profiles')
            .select('id')
            .limit(1);

        if (error && error.code !== '42P01') {
            console.error('❌ Supabase connection error:', error);
        } else {
            console.log('✅ Supabase connected successfully');
        }

        await redisClient.set('test', 'connection-test');
        const testValue = await redisClient.get('test');
        console.log(`✅ Redis test: set 'test', got '${testValue}'`);

    } catch (err) {
        console.error('❌ Database connection test error:', err);
    } finally {
        if (redisClient.isOpen) {
            await redisClient.quit();
            console.log('✅ Redis client connection closed.');
        }
    }
}

// データベース接続テストを実行（コメントアウトして関数実行を無効化）
// testDatabaseConnection();

module.exports = {
    supabase,
    redisClient,
    // ユーザープロファイル操作
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    // 会話履歴操作
    saveConversation,
    getConversationHistory,
    // ユーティリティ
    userExists,
    calculateCompletionRate,
    // テスト関数
    testDatabaseConnection
};