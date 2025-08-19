const {
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    saveConversation,
    getConversationHistory,
    userExists,
    testDatabaseConnection
} = require('./src/database.js');

// テスト用のユーザーID
const TEST_USER_ID = 'test_user_001';

async function runDatabaseTests() {
    console.log('🧪 データベース機能テスト開始\n');

    try {
        // 1. データベース接続テスト
        console.log('📌 1. データベース接続テスト');
        await testDatabaseConnection();
        console.log('');

        // 2. ユーザー存在チェック（初回は存在しないはず）
        console.log('📌 2. ユーザー存在チェック（初回）');
        const existsBefore = await userExists(TEST_USER_ID);
        console.log(`ユーザー存在: ${existsBefore}`);
        console.log('');

        // 3. 新規ユーザープロファイル作成
        console.log('📌 3. 新規ユーザープロファイル作成');
        const createResult = await createUserProfile(TEST_USER_ID, {
            name: 'テスト太郎',
            diving_experience: 'beginner',
            license_type: 'OWD',
            preferences: {
                favorite_spots: ['青の洞窟', '慶良間'],
                preferred_time: 'morning'
            }
        });
        console.log('作成結果:', createResult.success ? '✅ 成功' : '❌ 失敗');
        if (!createResult.success) console.log('エラー:', createResult.error);
        console.log('');

        // 4. ユーザープロファイル取得（データベースから）
        console.log('📌 4. ユーザープロファイル取得（DB）');
        const getResult1 = await getUserProfile(TEST_USER_ID);
        console.log('取得結果:', getResult1.success ? '✅ 成功' : '❌ 失敗');
        console.log('キャッシュから:', getResult1.fromCache ? 'Yes' : 'No');
        if (getResult1.success) {
            console.log('ユーザー名:', getResult1.data.name);
            console.log('完成度:', getResult1.data.profile_completion_rate + '%');
        }
        console.log('');

        // 5. ユーザープロファイル取得（キャッシュから）
        console.log('📌 5. ユーザープロファイル取得（キャッシュ）');
        const getResult2 = await getUserProfile(TEST_USER_ID);
        console.log('取得結果:', getResult2.success ? '✅ 成功' : '❌ 失敗');
        console.log('キャッシュから:', getResult2.fromCache ? 'Yes' : 'No');
        console.log('');

        // 6. ユーザープロファイル更新
        console.log('📌 6. ユーザープロファイル更新');
        const updateResult = await updateUserProfile(TEST_USER_ID, {
            diving_experience: 'advanced',
            license_type: 'AOW'
        });
        console.log('更新結果:', updateResult.success ? '✅ 成功' : '❌ 失敗');
        if (updateResult.success) {
            console.log('新しい完成度:', updateResult.data.profile_completion_rate + '%');
        }
        console.log('');

        // 7. 会話保存テスト
        console.log('📌 7. 会話保存テスト');
        const saveResult1 = await saveConversation(
            TEST_USER_ID,
            'user',
            'こんにちは！ダイビングの相談をしたいです',
            'session_001'
        );
        console.log('会話保存1:', saveResult1.success ? '✅ 成功' : '❌ 失敗');

        const saveResult2 = await saveConversation(
            TEST_USER_ID,
            'assistant',
            'こんにちは！ダイビングのことなら何でも聞いてくださいね🐠',
            'session_001'
        );
        console.log('会話保存2:', saveResult2.success ? '✅ 成功' : '❌ 失敗');
        console.log('');

        // 8. 会話履歴取得
        console.log('📌 8. 会話履歴取得');
        const historyResult = await getConversationHistory(TEST_USER_ID, 10);
        console.log('履歴取得:', historyResult.success ? '✅ 成功' : '❌ 失敗');
        if (historyResult.success) {
            console.log('会話件数:', historyResult.data.length + '件');
            historyResult.data.forEach((conv, index) => {
                console.log(`  ${index + 1}. [${conv.message_type}] ${conv.message_content.substring(0, 30)}...`);
            });
        }
        console.log('');

        // 9. ユーザー存在チェック（作成後）
        console.log('📌 9. ユーザー存在チェック（作成後）');
        const existsAfter = await userExists(TEST_USER_ID);
        console.log(`ユーザー存在: ${existsAfter}`);
        console.log('');

        console.log('🎉 全テスト完了！');

    } catch (error) {
        console.error('❌ テスト実行中にエラーが発生:', error);
    }
}

// テスト実行
runDatabaseTests();
