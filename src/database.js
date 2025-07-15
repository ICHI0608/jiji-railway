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

// ===== V2.8 拡張: ショップサブスクリプション操作関数 =====

/**
 * ショップサブスクリプション作成
 * @param {string} shopId - ショップID
 * @param {string} planType - プランタイプ ('premium', 'standard', 'basic')
 * @param {number} monthlyFee - 月額料金
 * @returns {Object} 作成結果
 */
async function createShopSubscription(shopId, planType, monthlyFee) {
    try {
        const subscriptionData = {
            shop_id: shopId,
            plan_type: planType,
            monthly_fee: monthlyFee,
            start_date: new Date().toISOString().split('T')[0],
            status: 'active',
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('shop_subscriptions')
            .insert([subscriptionData])
            .select()
            .single();

        if (error) {
            console.error('❌ ショップサブスクリプション作成エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ショップサブスクリプション作成成功:', shopId, planType);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ショップサブスクリプション作成例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ショップサブスクリプション取得
 * @param {string} shopId - ショップID
 * @returns {Object} サブスクリプション情報
 */
async function getShopSubscription(shopId) {
    try {
        const { data, error } = await supabase
            .from('shop_subscriptions')
            .select('*')
            .eq('shop_id', shopId)
            .eq('status', 'active')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: false, error: 'SUBSCRIPTION_NOT_FOUND' };
            }
            console.error('❌ ショップサブスクリプション取得エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ショップサブスクリプション取得成功:', shopId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ショップサブスクリプション取得例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== V2.8 拡張: ユーザーレビュー操作関数 =====

/**
 * ユーザーレビュー作成
 * @param {Object} reviewData - レビューデータ
 * @returns {Object} 作成結果
 */
async function createUserReview(reviewData) {
    try {
        const reviewRecord = {
            review_id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            shop_id: reviewData.shop_id,
            line_user_id: reviewData.line_user_id,
            overall_rating: reviewData.overall_rating,
            beginner_friendliness: reviewData.beginner_friendliness || null,
            safety_rating: reviewData.safety_rating || null,
            staff_rating: reviewData.staff_rating || null,
            satisfaction_rating: reviewData.satisfaction_rating || null,
            cost_performance: reviewData.cost_performance || null,
            detailed_review: reviewData.detailed_review || '',
            photos: reviewData.photos || [],
            experience_date: reviewData.experience_date || new Date().toISOString().split('T')[0],
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_reviews')
            .insert([reviewRecord])
            .select()
            .single();

        if (error) {
            console.error('❌ ユーザーレビュー作成エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ユーザーレビュー作成成功:', reviewRecord.review_id);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ユーザーレビュー作成例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ショップのレビュー一覧取得
 * @param {string} shopId - ショップID
 * @param {number} limit - 取得件数制限
 * @returns {Object} レビュー一覧
 */
async function getShopReviews(shopId, limit = 50) {
    try {
        const { data, error } = await supabase
            .from('user_reviews')
            .select('*')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('❌ ショップレビュー取得エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ショップレビュー取得成功:', shopId, `${data.length}件`);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ショップレビュー取得例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ショップの平均評価計算
 * @param {string} shopId - ショップID
 * @returns {Object} 平均評価データ
 */
async function calculateShopAverageRatings(shopId) {
    try {
        const { data: reviews, error } = await supabase
            .from('user_reviews')
            .select('overall_rating, beginner_friendliness, safety_rating, staff_rating, satisfaction_rating, cost_performance')
            .eq('shop_id', shopId);

        if (error) {
            console.error('❌ ショップ平均評価計算エラー:', error);
            return { success: false, error: error.message };
        }

        if (reviews.length === 0) {
            return { 
                success: true, 
                data: { 
                    review_count: 0,
                    average_ratings: null 
                } 
            };
        }

        const averages = {
            overall_rating: 0,
            beginner_friendliness: 0,
            safety_rating: 0,
            staff_rating: 0,
            satisfaction_rating: 0,
            cost_performance: 0
        };

        reviews.forEach(review => {
            Object.keys(averages).forEach(key => {
                if (review[key]) {
                    averages[key] += review[key];
                }
            });
        });

        Object.keys(averages).forEach(key => {
            averages[key] = Math.round((averages[key] / reviews.length) * 10) / 10;
        });

        console.log('✅ ショップ平均評価計算成功:', shopId);
        return { 
            success: true, 
            data: { 
                review_count: reviews.length,
                average_ratings: averages 
            } 
        };

    } catch (err) {
        console.error('❌ ショップ平均評価計算例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== V2.8 拡張: ユーザーポイント操作関数 =====

/**
 * ポイント記録作成
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} actionType - アクションタイプ
 * @param {number} pointsEarned - 獲得ポイント
 * @param {string} description - 説明
 * @returns {Object} 作成結果
 */
async function addUserPoints(lineUserId, actionType, pointsEarned, description) {
    try {
        // 現在の残高を取得
        const currentBalance = await getUserPointBalance(lineUserId);
        const newBalance = (currentBalance.data || 0) + pointsEarned;

        const pointRecord = {
            line_user_id: lineUserId,
            action_type: actionType,
            points_earned: pointsEarned,
            points_spent: 0,
            balance: newBalance,
            description: description,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('user_points')
            .insert([pointRecord])
            .select()
            .single();

        if (error) {
            console.error('❌ ユーザーポイント追加エラー:', error);
            return { success: false, error: error.message };
        }

        // 会員プロフィールの総ポイント更新
        await updateMemberTotalPoints(lineUserId, newBalance);

        console.log('✅ ユーザーポイント追加成功:', lineUserId, `+${pointsEarned}P`);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ユーザーポイント追加例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ユーザーポイント残高取得
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Object} ポイント残高
 */
async function getUserPointBalance(lineUserId) {
    try {
        const { data, error } = await supabase
            .from('user_points')
            .select('balance')
            .eq('line_user_id', lineUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: true, data: 0 }; // 初回は0ポイント
            }
            console.error('❌ ユーザーポイント残高取得エラー:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data: data.balance };

    } catch (err) {
        console.error('❌ ユーザーポイント残高取得例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * ポイント履歴取得
 * @param {string} lineUserId - LINEユーザーID
 * @param {number} limit - 取得件数制限
 * @returns {Object} ポイント履歴
 */
async function getUserPointHistory(lineUserId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('user_points')
            .select('*')
            .eq('line_user_id', lineUserId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('❌ ユーザーポイント履歴取得エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ ユーザーポイント履歴取得成功:', lineUserId, `${data.length}件`);
        return { success: true, data };

    } catch (err) {
        console.error('❌ ユーザーポイント履歴取得例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== V2.8 拡張: 会員プロフィール操作関数 =====

/**
 * 会員プロフィール作成
 * @param {string} lineUserId - LINEユーザーID
 * @returns {Object} 作成結果
 */
async function createMemberProfile(lineUserId) {
    try {
        const memberData = {
            line_user_id: lineUserId,
            registration_date: new Date().toISOString().split('T')[0],
            total_points: 0,
            membership_level: 'basic',
            profile_completion_rate: 0
        };

        const { data, error } = await supabase
            .from('member_profiles')
            .insert([memberData])
            .select()
            .single();

        if (error) {
            console.error('❌ 会員プロフィール作成エラー:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ 会員プロフィール作成成功:', lineUserId);
        return { success: true, data };

    } catch (err) {
        console.error('❌ 会員プロフィール作成例外:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 会員総ポイント更新
 * @param {string} lineUserId - LINEユーザーID
 * @param {number} totalPoints - 総ポイント
 * @returns {Object} 更新結果
 */
async function updateMemberTotalPoints(lineUserId, totalPoints) {
    try {
        const { data, error } = await supabase
            .from('member_profiles')
            .update({ total_points: totalPoints })
            .eq('line_user_id', lineUserId)
            .select()
            .single();

        if (error) {
            console.error('❌ 会員総ポイント更新エラー:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };

    } catch (err) {
        console.error('❌ 会員総ポイント更新例外:', err);
        return { success: false, error: err.message };
    }
}

// ===== V2.8 拡張: テーブル作成関数 =====

/**
 * V2.8 新規テーブル作成
 * @returns {Object} 作成結果
 */
async function createV28Tables() {
    try {
        console.log('🔧 V2.8 テーブル作成開始...');

        // ショップサブスクリプションテーブル
        const shopSubscriptionsSQL = `
            CREATE TABLE IF NOT EXISTS shop_subscriptions (
                id SERIAL PRIMARY KEY,
                shop_id VARCHAR(50) NOT NULL,
                plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('premium', 'standard', 'basic')),
                monthly_fee INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'cancelled')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_shop_id ON shop_subscriptions(shop_id);
            CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_status ON shop_subscriptions(status);
        `;

        // ユーザーレビューテーブル
        const userReviewsSQL = `
            CREATE TABLE IF NOT EXISTS user_reviews (
                id SERIAL PRIMARY KEY,
                review_id VARCHAR(100) UNIQUE NOT NULL,
                shop_id VARCHAR(50) NOT NULL,
                line_user_id VARCHAR(100) NOT NULL,
                overall_rating DECIMAL(2,1) CHECK (overall_rating >= 1 AND overall_rating <= 5),
                beginner_friendliness DECIMAL(2,1) CHECK (beginner_friendliness >= 1 AND beginner_friendliness <= 5),
                safety_rating DECIMAL(2,1) CHECK (safety_rating >= 1 AND safety_rating <= 5),
                staff_rating DECIMAL(2,1) CHECK (staff_rating >= 1 AND staff_rating <= 5),
                satisfaction_rating DECIMAL(2,1) CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
                cost_performance DECIMAL(2,1) CHECK (cost_performance >= 1 AND cost_performance <= 5),
                detailed_review TEXT,
                photos JSONB,
                experience_date DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_user_reviews_shop_id ON user_reviews(shop_id);
            CREATE INDEX IF NOT EXISTS idx_user_reviews_line_user_id ON user_reviews(line_user_id);
            CREATE INDEX IF NOT EXISTS idx_user_reviews_created_at ON user_reviews(created_at);
        `;

        // ユーザーポイントテーブル
        const userPointsSQL = `
            CREATE TABLE IF NOT EXISTS user_points (
                id SERIAL PRIMARY KEY,
                line_user_id VARCHAR(100) NOT NULL,
                action_type VARCHAR(50) NOT NULL,
                points_earned INTEGER DEFAULT 0,
                points_spent INTEGER DEFAULT 0,
                balance INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_user_points_line_user_id ON user_points(line_user_id);
            CREATE INDEX IF NOT EXISTS idx_user_points_created_at ON user_points(created_at);
        `;

        // 会員プロフィールテーブル
        const memberProfilesSQL = `
            CREATE TABLE IF NOT EXISTS member_profiles (
                id SERIAL PRIMARY KEY,
                line_user_id VARCHAR(100) UNIQUE NOT NULL,
                registration_date DATE NOT NULL,
                total_points INTEGER DEFAULT 0,
                membership_level VARCHAR(20) DEFAULT 'basic',
                profile_completion_rate INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_member_profiles_line_user_id ON member_profiles(line_user_id);
        `;

        console.log('✅ V2.8 テーブル作成完了');
        console.log('ℹ️  実際のテーブル作成はSupabase Dashboardで実行してください');
        console.log('ℹ️  SQL文は上記の通りです');

        return { success: true, message: 'V2.8テーブル定義準備完了' };

    } catch (err) {
        console.error('❌ V2.8 テーブル作成例外:', err);
        return { success: false, error: err.message };
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
    // V2.8: ショップサブスクリプション操作
    createShopSubscription,
    getShopSubscription,
    // V2.8: ユーザーレビュー操作
    createUserReview,
    getShopReviews,
    calculateShopAverageRatings,
    // V2.8: ユーザーポイント操作
    addUserPoints,
    getUserPointBalance,
    getUserPointHistory,
    // V2.8: 会員プロフィール操作
    createMemberProfile,
    updateMemberTotalPoints,
    // V2.8: テーブル作成
    createV28Tables,
    // ユーティリティ
    userExists,
    calculateCompletionRate,
    // テスト関数
    testDatabaseConnection
};