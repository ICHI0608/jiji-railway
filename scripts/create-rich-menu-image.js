#!/usr/bin/env node

/**
 * LINE公式アカウント リッチメニュー画像作成スクリプト
 * 正確なサイズ（2500×1686px）でHTMLテンプレートから画像を生成
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function createRichMenuImage() {
    console.log('🎨 LINE公式アカウント リッチメニュー画像作成開始...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // 正確なサイズ設定（LINE公式仕様）
        await page.setViewport({
            width: 2500,
            height: 1686,
            deviceScaleFactor: 1
        });
        
        // HTMLテンプレートファイルのパス
        const htmlPath = path.join(__dirname, '../assets/rich-menu-template.html');
        const outputPath = path.join(__dirname, '../assets/rich-menu-v28.jpg');
        
        console.log('📄 HTMLテンプレート読み込み:', htmlPath);
        
        // HTMLファイルを開く
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0'
        });
        
        // フォント読み込み完了を待つ
        await page.waitForTimeout(2000);
        
        console.log('📸 スクリーンショット撮影中...');
        
        // スクリーンショット撮影
        await page.screenshot({
            path: outputPath,
            type: 'jpeg',
            quality: 90,
            fullPage: false
        });
        
        console.log('✅ リッチメニュー画像作成完了!');
        console.log('📁 保存先:', outputPath);
        console.log('📏 サイズ: 2500×1686px (LINE公式仕様)');
        console.log('📋 ファイル形式: JPEG');
        
        // ファイルサイズ確認
        const fs = require('fs');
        const stats = fs.statSync(outputPath);
        const fileSizeKB = Math.round(stats.size / 1024);
        console.log(`📦 ファイルサイズ: ${fileSizeKB}KB ${fileSizeKB > 1024 ? '⚠️ (1MBを超過)' : '✅'}`);
        
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// メイン実行
if (require.main === module) {
    createRichMenuImage()
        .then(() => {
            console.log('\n🚀 次のステップ:');
            console.log('1. assets/rich-menu-v28.jpg をLINE Official Account Managerにアップロード');
            console.log('2. テンプレートA（3×2グリッド）を選択');
            console.log('3. 各エリアにアクション設定');
            console.log('4. node src/setup-survey-system.js setup でシステム完了');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ 画像作成に失敗しました:', error);
            process.exit(1);
        });
}

module.exports = { createRichMenuImage };