/**
 * Dive Buddy's 全ページPDF書き出しツール
 * 統一デザインシステム適用後の全ページをPDF化
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// PDF出力設定
const PDF_CONFIG = {
    format: 'A4',
    printBackground: true,
    margin: {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
    },
    scale: 0.8,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:10px; margin: auto;">Dive Buddy\'s - ページ確認用PDF</div>',
    footerTemplate: '<div style="font-size:10px; margin: auto;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
};

// 対象ページリスト（利用予定の主要ページ）
const PAGES_TO_EXPORT = [
    // メインページ
    { name: '01_トップページ', url: '/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/index.html' },
    { name: '02_サービス概要', url: '/about.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/about.html' },
    { name: '03_初心者向け', url: '/beginner.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/beginner.html' },
    { name: '04_お問い合わせ', url: '/contact.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/contact.html' },
    
    // 会員システム
    { name: '05_会員マイページ', url: '/member/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/member/index.html' },
    { name: '06_会員登録', url: '/member/register.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/member/register.html' },
    { name: '07_ログイン', url: '/member/login.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/member/login.html' },
    { name: '08_ダッシュボード', url: '/member/dashboard.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/member/dashboard.html' },
    { name: '09_プロフィール', url: '/member/profile.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/member/profile.html' },
    
    // ショップデータベース
    { name: '10_ショップ検索', url: '/shops-database/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/shops-database/index.html' },
    { name: '11_ショップ詳細', url: '/shops-database/details.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/shops-database/details.html' },
    { name: '12_ショップ一覧', url: '/shops-database/shops.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/shops-database/shops.html' },
    
    // ダイビングクリエイター
    { name: '13_クリエイター紹介', url: '/diving-creators/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/diving-creators/index.html' },
    
    // 旅行ガイド
    { name: '14_旅行ガイドTOP', url: '/travel-guide/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/index.html' },
    { name: '15_航空券検索', url: '/travel-guide/flights.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/flights.html' },
    { name: '16_宿泊ガイド', url: '/travel-guide/accommodation.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/accommodation.html' },
    { name: '17_交通情報', url: '/travel-guide/transport.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/transport.html' },
    { name: '18_費用計算', url: '/travel-guide/cost-simulator.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/cost-simulator.html' },
    { name: '19_石垣島ガイド', url: '/travel-guide/ishigaki.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/ishigaki.html' },
    { name: '20_宮古島ガイド', url: '/travel-guide/miyako.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/travel-guide/miyako.html' },
    
    // 海況・天気
    { name: '21_海況天気', url: '/weather-ocean/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/weather-ocean/index.html' },
    
    // ブログ
    { name: '22_ブログTOP', url: '/blog.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/blog.html' },
    { name: '23_ブログ一覧', url: '/blog/index.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/blog/index.html' },
    { name: '24_記事詳細', url: '/blog/article.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/blog/article.html' },
    
    // 管理画面
    { name: '25_管理ダッシュボード', url: '/admin/dashboard.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/admin/dashboard.html' },
    { name: '26_記事作成', url: '/admin/blog-editor.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/admin/blog-editor.html' },
    { name: '27_YouTube監視', url: '/admin/youtube-monitoring.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/admin/youtube-monitoring.html' },
    
    // パートナー・ショップ
    { name: '28_パートナーTOP', url: '/partners.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/partners.html' },
    { name: '29_掲載案内', url: '/partners/advertising.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/partners/advertising.html' },
    { name: '30_ショップログイン', url: '/shop/login.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/shop/login.html' },
    
    // その他重要ページ
    { name: '31_利用規約', url: '/legal.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/legal.html' },
    { name: '32_料金プラン', url: '/pricing.html', path: '/Users/ymacbookpro/jiji-diving-bot/public/pricing.html' }
];

async function generatePagePDF(page, pageInfo, outputDir) {
    try {
        console.log(`📄 PDF生成中: ${pageInfo.name}`);
        
        // HTMLファイルを直接読み込み
        const htmlContent = fs.readFileSync(pageInfo.path, 'utf8');
        
        // ベースURLを設定してHTMLを読み込み
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // CSSが完全に適用されるまで少し待機
        await page.waitForTimeout(2000);
        
        // PDF生成
        const pdfPath = path.join(outputDir, `${pageInfo.name}.pdf`);
        await page.pdf({
            ...PDF_CONFIG,
            path: pdfPath
        });
        
        console.log(`✅ 完了: ${pageInfo.name}`);
        return pdfPath;
        
    } catch (error) {
        console.error(`❌ エラー ${pageInfo.name}:`, error.message);
        return null;
    }
}

async function generateAllPDFs() {
    console.log('🚀 Dive Buddy\'s PDF書き出し開始...');
    
    // 出力ディレクトリ作成
    const outputDir = '/Users/ymacbookpro/jiji-diving-bot/pdf-export';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    let browser;
    const generatedPDFs = [];
    
    try {
        // Puppeteer起動
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // ビューポート設定（デスクトップサイズ）
        await page.setViewport({
            width: 1200,
            height: 800,
            deviceScaleFactor: 1
        });
        
        // 各ページのPDF生成
        for (const pageInfo of PAGES_TO_EXPORT) {
            if (fs.existsSync(pageInfo.path)) {
                const pdfPath = await generatePagePDF(page, pageInfo, outputDir);
                if (pdfPath) {
                    generatedPDFs.push(pdfPath);
                }
            } else {
                console.log(`⚠️ ファイルなし: ${pageInfo.path}`);
            }
        }
        
    } catch (error) {
        console.error('❌ PDF生成エラー:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // 結果レポート
    console.log(`\n🎉 PDF生成完了!`);
    console.log(`📁 出力先: ${outputDir}`);
    console.log(`📄 生成数: ${generatedPDFs.length}/${PAGES_TO_EXPORT.length}`);
    
    // インデックスファイル作成
    const indexContent = `# Dive Buddy's ページPDF一覧

生成日時: ${new Date().toLocaleString('ja-JP')}
総ページ数: ${generatedPDFs.length}

## 📋 生成されたPDF

${PAGES_TO_EXPORT.map((page, index) => 
    `${index + 1}. **${page.name}** - ${page.url}`
).join('\n')}

## 📁 ファイル構成

${generatedPDFs.map(pdf => `- ${path.basename(pdf)}`).join('\n')}

## 🎯 用途

- UI/UXデザイン確認
- 修正指示作成
- 品質チェック
- クライアント確認

---
Generated by Dive Buddy's PDF Export Tool
`;
    
    fs.writeFileSync(path.join(outputDir, 'README.md'), indexContent);
    
    return { outputDir, generatedPDFs, totalPages: PAGES_TO_EXPORT.length };
}

// 実行
if (require.main === module) {
    generateAllPDFs()
        .then(result => {
            console.log('✅ PDF書き出し処理完了');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ 処理失敗:', error);
            process.exit(1);
        });
}

module.exports = { generateAllPDFs, PAGES_TO_EXPORT };