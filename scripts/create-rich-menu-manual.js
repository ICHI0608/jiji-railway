#!/usr/bin/env node

/**
 * LINE公式リッチメニュー画像 手動作成ガイド
 * 正確なサイズ（2500×1686px）での作成手順
 */

const path = require('path');

function printManualInstructions() {
    console.log('🎨 LINE公式アカウント リッチメニュー画像 手動作成ガイド');
    console.log('='.repeat(60));
    console.log('');
    
    console.log('📏 LINE公式仕様（2024-2025年版）');
    console.log('• サイズ: 2500×1686px (Large テンプレート)');
    console.log('• 形式: JPEG推奨');
    console.log('• ファイルサイズ: 1MB以下');
    console.log('• テンプレート: 3×2グリッド（6エリア）');
    console.log('');
    
    console.log('🌐 Method 1: ブラウザスクリーンショット（推奨）');
    console.log('----------------------------------------');
    
    const htmlPath = path.join(__dirname, '../assets/rich-menu-template.html');
    console.log(`1. HTMLファイルをブラウザで開く:`);
    console.log(`   open "${htmlPath}"`);
    console.log('');
    console.log('2. ブラウザで以下を実行:');
    console.log('   • Safari/Chrome開発者ツール起動 (⌘+⌥+I)');
    console.log('   • レスポンシブデザインモード (⌘+⌥+M)');
    console.log('   • 画面サイズを 2500×1686 に設定');
    console.log('   • 倍率100%確認');
    console.log('');
    console.log('3. スクリーンショット撮影:');
    console.log('   • ⌘+Shift+4 で範囲選択撮影');
    console.log('   • または ⌘+Shift+3 で全画面撮影後トリミング');
    console.log('');
    console.log('4. ファイル保存:');
    const outputPath = path.join(__dirname, '../assets/rich-menu-v28.jpg');
    console.log(`   • JPEGで保存: "${outputPath}"`);
    console.log('');
    
    console.log('🎨 Method 2: 画像編集ソフト');
    console.log('-------------------------');
    console.log('• Photoshop: 新規ドキュメント 2500×1686px');
    console.log('• GIMP: ファイル→新しい画像→2500×1686px');
    console.log('• Canva: カスタムサイズ 2500×1686px');
    console.log('• Figma: Frame 2500×1686px');
    console.log('');
    
    console.log('🌊 デザイン要素');
    console.log('---------------');
    console.log('ヘッダー (200px高): 🌺 Dive Buddy\'s Menu');
    console.log('グリッド (6エリア、各833×743px):');
    console.log('  左上: 🤿 体験相談     中上: 🏪 ショップDB    右上: 📋 アンケート');
    console.log('  左下: 🗓️ 旅行計画     中下: ☀️ 海況情報      右下: ❓ ヘルプ');
    console.log('');
    
    console.log('✅ 完成後の確認事項');
    console.log('------------------');
    console.log('□ サイズ: 2500×1686px');
    console.log('□ 形式: JPEG');
    console.log('□ ファイルサイズ: 1MB以下');
    console.log('□ 6エリアが明確に区別可能');
    console.log('□ 文字が読みやすい');
    console.log('');
    
    console.log('🚀 次のステップ');
    console.log('---------------');
    console.log('1. 作成した画像をLINE Official Account Managerにアップロード');
    console.log('2. テンプレートA（3×2グリッド）選択');
    console.log('3. 各エリアアクション設定:');
    console.log('   エリア1: メッセージ「体験相談」');
    console.log('   エリア2: メッセージ「ショップDB」');
    console.log('   エリア3: メッセージ「アンケート開始」');
    console.log('   エリア4: メッセージ「旅行計画」');
    console.log('   エリア5: メッセージ「海況情報」');
    console.log('   エリア6: メッセージ「ヘルプ」');
    console.log('4. 保存・公開');
    console.log('5. node src/setup-survey-system.js setup でシステム完了');
    console.log('');
    
    console.log('📱 macOS スクリーンショットのコツ');
    console.log('--------------------------------');
    console.log('• ⌘+Shift+4: 範囲指定撮影');
    console.log('• スペースキー: ウィンドウ撮影モード');
    console.log('• Shift押しながら: 縦横方向固定');
    console.log('• Option押しながら: 中央から範囲拡大');
    console.log('• 撮影後: デスクトップに自動保存');
    console.log('');
    
    console.log('🔍 サイズ確認方法');
    console.log('-----------------');
    console.log('ターミナルで確認:');
    console.log('  file assets/rich-menu-v28.jpg');
    console.log('  → "2500 x 1686" と表示されればOK');
    console.log('');
    
    console.log('⚠️  よくある問題');
    console.log('----------------');
    console.log('• サイズが合わない → HTMLを正確な倍率で表示');
    console.log('• 文字がぼやける → 高解像度での撮影');
    console.log('• ファイルサイズ超過 → JPEG品質を80-90%に調整');
    console.log('• 色が薄い → 画面の明度設定確認');
}

if (require.main === module) {
    printManualInstructions();
}

module.exports = { printManualInstructions };