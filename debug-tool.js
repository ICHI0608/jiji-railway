// debug-tool.js - エラーデバッグとテスト用ツール
const ConversationManager = require('./conversation');

class DebugTool {
    constructor() {
        this.conversationManager = new ConversationManager();
    }

    // 構文エラーチェック
    static checkSyntax() {
        console.log("=== 構文チェック開始 ===");
        
        try {
            // ConversationManagerの読み込みテスト
            const ConversationManager = require('./conversation');
            console.log("✅ conversation.js の構文OK");
            
            // インスタンス生成テスト
            const manager = new ConversationManager();
            console.log("✅ ConversationManager インスタンス生成OK");
            
            // 基本メソッドの存在確認
            const methods = [
                'generateResponse',
                'handleReminderRequest',
                'formatResponse',
                'isReminderRequest'
            ];
            
            methods.forEach(method => {
                if (typeof manager[method] === 'function') {
                    console.log(`✅ ${method} メソッド存在確認OK`);
                } else {
                    console.log(`❌ ${method} メソッドが見つかりません`);
                }
            });
            
        } catch (error) {
            console.log("❌ 構文エラー検出:");
            console.log(error.message);
            console.log("スタックトレース:");
            console.log(error.stack);
        }
        
        console.log("=== 構文チェック完了 ===\n");
    }

    // リマインド機能のテスト
    async testReminderFunction() {
        console.log("=== リマインド機能テスト ===");
        
        const testMessages = [
            "リマインドを設定して",
            "明日のダイビングを忘れないでリマインドして",
            "予約のリマインダーをお願いします",
            "アラームを設定したい",
            "通知機能はありますか？"
        ];

        for (const message of testMessages) {
            try {
                console.log(`\n入力: "${message}"`);
                
                // リマインド判定テスト
                const isReminder = this.conversationManager.isReminderRequest(message);
                console.log(`リマインド判定: ${isReminder}`);
                
                if (isReminder) {
                    const response = this.conversationManager.handleReminderRequest(message);
                    console.log(`応答: ${response.substring(0, 50)}...`);
                    console.log("✅ リマインド応答生成OK");
                }
                
            } catch (error) {
                console.log(`❌ エラー: ${error.message}`);
            }
        }
        
        console.log("\n=== リマインド機能テスト完了 ===\n");
    }

    // 文字列フォーマットテスト
    testStringFormatting() {
        console.log("=== 文字列フォーマットテスト ===");
        
        const testStrings = [
            "こんにちは。元気ですか？\n\n\n今日は良い天気ですね。",
            "テスト\n\n\n\n\n改行が多すぎる。",
            "普通の文章です。問題ないはずです。",
            "改行なし文章テスト"
        ];

        testStrings.forEach((str, index) => {
            try {
                console.log(`\nテスト${index + 1}:`);
                console.log(`入力: "${str}"`);
                
                const formatted = this.conversationManager.formatResponse(str);
                console.log(`出力: "${formatted}"`);
                console.log("✅ フォーマット処理OK");
                
            } catch (error) {
                console.log(`❌ フォーマットエラー: ${error.message}`);
            }
        });
        
        console.log("\n=== 文字列フォーマットテスト完了 ===\n");
    }

    // 総合テスト実行
    async runAllTests() {
        console.log("🧪 Jiji Bot エラー診断・テストツール");
        console.log("=====================================\n");
        
        // 1. 構文チェック
        DebugTool.checkSyntax();
        
        // 2. 文字列フォーマットテスト
        this.testStringFormatting();
        
        // 3. リマインド機能テスト
        await this.testReminderFunction();
        
        console.log("🎉 全テスト完了！");
        console.log("問題が解決されない場合は、以下を確認してください：");
        console.log("1. Node.js のバージョン");
        console.log("2. 必要なパッケージのインストール状況");
        console.log("3. 環境変数の設定");
        console.log("4. ファイルのエンコーディング（UTF-8推奨）");
    }
}

// 直接実行時のテスト
if (require.main === module) {
    const debugTool = new DebugTool();
    debugTool.runAllTests().catch(console.error);
}

module.exports = DebugTool;