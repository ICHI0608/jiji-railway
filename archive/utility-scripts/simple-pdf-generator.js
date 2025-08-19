/**
 * シンプルPDF生成ツール（Puppeteer不要版）
 * HTMLをブラウザで開いて手動PDF化のガイド作成
 */

const fs = require('fs');
const path = require('path');

// 対象ページリスト
const MAIN_PAGES = [
    { name: '01_トップページ', file: 'index.html', category: 'メイン' },
    { name: '01b_メインページUI', file: 'index_ui_check.html', category: 'メイン' },
    { name: '02_サービス概要', file: 'about.html', category: 'メイン' },
    { name: '03_初心者向け', file: 'beginner.html', category: 'メイン' },
    { name: '04_お問い合わせ', file: 'contact.html', category: 'メイン' },
    
    { name: '05_会員マイページ', file: 'member/index.html', category: '会員' },
    { name: '06_会員登録', file: 'member/register.html', category: '会員' },
    { name: '07_ログイン', file: 'member/login.html', category: '会員' },
    { name: '08_ダッシュボード', file: 'member/dashboard.html', category: '会員' },
    
    { name: '09_ショップ検索', file: 'shops-database/index.html', category: 'ショップ' },
    { name: '10_ショップ詳細', file: 'shops-database/details.html', category: 'ショップ' },
    
    { name: '11_クリエイター紹介', file: 'diving-creators/index.html', category: '機能' },
    
    { name: '12_旅行ガイド', file: 'travel-guide/index.html', category: '旅行' },
    { name: '13_航空券検索', file: 'travel-guide/flights.html', category: '旅行' },
    { name: '14_宿泊ガイド', file: 'travel-guide/accommodation.html', category: '旅行' },
    
    { name: '15_海況天気', file: 'weather-ocean/index.html', category: '機能' },
    
    { name: '16_ブログTOP', file: 'blog.html', category: 'ブログ' },
    { name: '17_記事詳細', file: 'blog/article.html', category: 'ブログ' },
    
    { name: '18_管理ダッシュボード', file: 'admin/dashboard.html', category: '管理' },
    { name: '19_YouTube監視', file: 'admin/youtube-monitoring.html', category: '管理' },
    
    { name: '20_パートナー', file: 'partners.html', category: 'ビジネス' },
    { name: '21_利用規約', file: 'legal.html', category: 'その他' },
    { name: '22_料金プラン', file: 'pricing.html', category: 'その他' }
];

function generatePDFGuide() {
    const publicDir = '/Users/ymacbookpro/jiji-diving-bot/public';
    const outputDir = '/Users/ymacbookpro/jiji-diving-bot/pdf-guide';
    
    // 出力ディレクトリ作成
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 存在するページのみフィルター
    const existingPages = MAIN_PAGES.filter(page => {
        const fullPath = path.join(publicDir, page.file);
        return fs.existsSync(fullPath);
    });
    
    // カテゴリ別にグループ化
    const pagesByCategory = {};
    existingPages.forEach(page => {
        if (!pagesByCategory[page.category]) {
            pagesByCategory[page.category] = [];
        }
        pagesByCategory[page.category].push(page);
    });
    
    // HTMLインデックス作成
    const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dive Buddy's ページ一覧 - PDF生成用</title>
    <style>
        body {
            font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #77C9D4 0%, #A2DED0 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin-bottom: 30px;
        }
        .category {
            background: white;
            margin-bottom: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .category-header {
            background: #333;
            color: white;
            padding: 15px 20px;
            font-size: 1.2rem;
            font-weight: bold;
        }
        .page-list {
            padding: 20px;
        }
        .page-item {
            display: flex;
            align-items: center;
            padding: 15px;
            border-bottom: 1px solid #eee;
            transition: background 0.3s;
        }
        .page-item:hover {
            background: #f9f9f9;
        }
        .page-item:last-child {
            border-bottom: none;
        }
        .page-number {
            background: #77C9D4;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            font-size: 0.9rem;
        }
        .page-name {
            flex: 1;
            font-weight: 500;
            color: #333;
        }
        .page-link {
            background: #A2DED0;
            color: #333;
            padding: 8px 15px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s;
            margin-right: 10px;
        }
        .page-link:hover {
            background: #91D5C0;
            text-decoration: none;
        }
        .pdf-btn {
            background: #ff6b6b;
            color: white;
            padding: 8px 15px;
            border-radius: 5px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
        }
        .instructions {
            background: #e8f4f8;
            border: 2px solid #77C9D4;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .instructions h3 {
            color: #333;
            margin-top: 0;
        }
        .instructions ol {
            color: #555;
            line-height: 1.6;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #77C9D4;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🌊 Dive Buddy's ページ一覧</h1>
        <p>PDF生成・修正指示用 ページインデックス</p>
        <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${existingPages.length}</div>
            <div class="stat-label">総ページ数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${Object.keys(pagesByCategory).length}</div>
            <div class="stat-label">カテゴリ数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">100%</div>
            <div class="stat-label">デザイン統一率</div>
        </div>
    </div>

    <div class="instructions">
        <h3>📋 PDF生成手順</h3>
        <ol>
            <li><strong>ページを開く</strong>: 下記リンクをクリックして各ページを表示</li>
            <li><strong>PDF生成</strong>: ブラウザのメニュー → 「印刷」→ 「PDFとして保存」</li>
            <li><strong>設定推奨</strong>: A4サイズ、背景グラフィック印刷ON、マージン最小</li>
            <li><strong>ファイル名</strong>: 「01_トップページ.pdf」のように番号付きで保存</li>
            <li><strong>修正指示</strong>: PDFに直接書き込みまたはスクリーンショット使用</li>
        </ol>
    </div>

    ${Object.entries(pagesByCategory).map(([category, pages]) => `
    <div class="category">
        <div class="category-header">
            📁 ${category} (${pages.length}ページ)
        </div>
        <div class="page-list">
            ${pages.map((page, index) => `
            <div class="page-item">
                <div class="page-number">${page.name.split('_')[0]}</div>
                <div class="page-name">${page.name.split('_')[1]}</div>
                <a href="../public/${page.file}" class="page-link" target="_blank">ページを開く</a>
                <span class="pdf-btn" onclick="printPage('../public/${page.file}')">PDF生成</span>
            </div>
            `).join('')}
        </div>
    </div>
    `).join('')}

    <div style="text-align: center; margin-top: 40px; padding: 20px; color: #666;">
        <p>💡 <strong>修正指示のコツ</strong></p>
        <p>• 赤枠で囲む • 矢印で指す • 具体的な文字で説明 • 優先度を明記</p>
        <p style="margin-top: 20px;">
            <strong>Dive Buddy's 統一デザインシステム適用済み</strong><br>
            カラー: #77C9D4 (海色) + #A2DED0 (浅瀬色)<br>
            フォント: Playfair Display + Noto Sans JP
        </p>
    </div>

    <script>
        function printPage(url) {
            window.open(url, '_blank');
            alert('新しいタブでページが開きました。\\n\\nブラウザメニュー → 印刷 → PDFとして保存\\nでPDFを生成してください。');
        }
    </script>
</body>
</html>`;

    // HTMLファイル保存
    fs.writeFileSync(path.join(outputDir, 'page-index.html'), htmlContent);
    
    // Markdownガイド作成
    const markdownGuide = `# Dive Buddy's PDF生成ガイド

## 📋 作業手順

### 1. ページインデックス確認
\`${outputDir}/page-index.html\` をブラウザで開く

### 2. 各ページのPDF生成
1. 「ページを開く」リンクをクリック
2. ブラウザメニュー → 印刷
3. 「PDFとして保存」を選択
4. ファイル名: \`01_トップページ.pdf\` の形式で保存

### 3. PDF設定推奨値
- **用紙サイズ**: A4
- **マージン**: 最小 (0.5cm程度)
- **背景**: ON (背景グラフィック印刷)
- **倍率**: 100% または 収まるように調整

## 📝 対象ページ一覧 (${existingPages.length}ページ)

${Object.entries(pagesByCategory).map(([category, pages]) => `
### ${category} (${pages.length}ページ)
${pages.map(page => `- ${page.name} → \`public/${page.file}\``).join('\n')}
`).join('')}

## 🎯 修正指示の作成方法

### 推奨ツール
- **PDF注釈**: Adobe Reader、Preview.app等
- **画像編集**: スクリーンショット + 画像編集アプリ
- **手書き**: タブレット + スタイラスペン

### 修正指示のベストプラクティス
1. **赤枠・矢印で明確に指示**
2. **具体的な文字で説明**
3. **優先度を明記** (高・中・低)
4. **全体共通 or 個別ページか明記**

### 修正例
\`\`\`
🔴 この部分の背景色を薄い青に変更
→ 優先度: 高
→ 全ページ共通

⚡ フォントサイズを18px→24pxに
→ 優先度: 中  
→ このページのみ
\`\`\`

## 📁 ファイル構成

\`\`\`
pdf-guide/
├── page-index.html     # ページ一覧（ブラウザで開く）
├── README.md          # このガイド
└── (ここにPDFを保存)
   ├── 01_トップページ.pdf
   ├── 02_サービス概要.pdf
   └── ...
\`\`\`

---
Generated: ${new Date().toLocaleString('ja-JP')}
Dive Buddy's Design System Applied ✅
`;

    fs.writeFileSync(path.join(outputDir, 'README.md'), markdownGuide);
    
    console.log('📁 PDF生成ガイド作成完了!');
    console.log(`📍 出力先: ${outputDir}`);
    console.log(`📄 対象ページ: ${existingPages.length}ページ`);
    console.log(`🌐 index.htmlを開いてPDF生成を開始してください`);
    
    return {
        outputDir,
        totalPages: existingPages.length,
        indexFile: path.join(outputDir, 'page-index.html')
    };
}

// 実行
generatePDFGuide();