/**
 * 🎨 Dive Buddy's リッチメニュー画像生成
 * 開発用シンプル画像作成
 */

const fs = require('fs');
const path = require('path');

/**
 * シンプルなリッチメニュー画像をHTMLで作成
 */
function createSimpleRichMenuHTML() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 2500px;
            height: 1686px;
            font-family: 'Hiragino Kaku Gothic Pro', 'ヒラギノ角ゴ Pro W3', Meiryo, メイリオ, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
        }
        
        .header {
            height: 200px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 120px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .menu-grid {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 0;
        }
        
        .menu-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            text-decoration: none;
            transition: all 0.3s ease;
            border: 3px solid rgba(255,255,255,0.2);
            position: relative;
        }
        
        .menu-item:hover {
            background: rgba(255,255,255,0.1);
        }
        
        .menu-item:nth-child(1) { background: rgba(255, 107, 107, 0.3); }
        .menu-item:nth-child(2) { background: rgba(102, 187, 255, 0.3); }
        .menu-item:nth-child(3) { background: rgba(255, 193, 61, 0.3); }
        .menu-item:nth-child(4) { background: rgba(158, 255, 158, 0.3); }
        .menu-item:nth-child(5) { background: rgba(255, 158, 255, 0.3); }
        .menu-item:nth-child(6) { background: rgba(158, 255, 255, 0.3); }
        
        .menu-emoji {
            font-size: 200px;
            margin-bottom: 30px;
        }
        
        .menu-title {
            font-size: 80px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        
        .menu-subtitle {
            font-size: 45px;
            opacity: 0.9;
            text-align: center;
            line-height: 1.2;
        }
    </style>
</head>
<body>
    <div class="header">
        🌺 Dive Buddy's Menu
    </div>
    
    <div class="menu-grid">
        <div class="menu-item">
            <div class="menu-emoji">🤿</div>
            <div class="menu-title">体験相談</div>
            <div class="menu-subtitle">気軽に相談</div>
        </div>
        
        <div class="menu-item">
            <div class="menu-emoji">🏪</div>
            <div class="menu-title">ショップDB</div>
            <div class="menu-subtitle">ショップ検索</div>
        </div>
        
        <div class="menu-item">
            <div class="menu-emoji">📋</div>
            <div class="menu-title">アンケート</div>
            <div class="menu-subtitle">プロファイル</div>
        </div>
        
        <div class="menu-item">
            <div class="menu-emoji">🗓️</div>
            <div class="menu-title">旅行計画</div>
            <div class="menu-subtitle">日程・予算</div>
        </div>
        
        <div class="menu-item">
            <div class="menu-emoji">☀️</div>
            <div class="menu-title">海況情報</div>
            <div class="menu-subtitle">天気・海況</div>
        </div>
        
        <div class="menu-item">
            <div class="menu-emoji">❓</div>
            <div class="menu-title">ヘルプ</div>
            <div class="menu-subtitle">使い方ガイド</div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * HTMLファイル作成
 */
function createRichMenuHTMLFile() {
    const htmlContent = createSimpleRichMenuHTML();
    const outputPath = path.join(__dirname, '../assets/rich-menu-template.html');
    
    // assetsディレクトリ作成
    const assetsDir = path.dirname(outputPath);
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }
    
    // HTMLファイル作成
    fs.writeFileSync(outputPath, htmlContent, 'utf8');
    
    console.log('🎨 リッチメニューHTMLテンプレート作成完了:', outputPath);
    console.log('');
    console.log('📋 次のステップ:');
    console.log('1. ブラウザでHTMLファイルを開く');
    console.log('2. ブラウザのスクリーンショット機能で2500×1686pxで保存');
    console.log('3. 保存した画像を assets/rich-menu-v28.jpg として配置');
    console.log('4. LINE Developers Consoleでリッチメニュー設定');
    
    return outputPath;
}

/**
 * 本格制作用の仕様書生成
 */
function createDesignSpecification() {
    const spec = `
# 🎨 Dive Buddy's リッチメニュー デザイン仕様書

## 基本仕様
- **サイズ**: 2500×1686px
- **フォーマット**: JPEG（推奨）
- **ファイルサイズ**: 1MB以下
- **カラーモード**: RGB

## デザインコンセプト
- **テーマ**: 沖縄の美しい海・リゾート感
- **雰囲気**: 親しみやすく、信頼できる
- **ターゲット**: ダイビング初心者〜経験者

## カラーパレット

### メインカラー
- **オーシャンブルー**: #667eea 〜 #4facfe
- **サンセットピンク**: #f093fb 〜 #f5576c
- **トロピカルイエロー**: #ffd93d 〜 #ff6b6b

### アクセントカラー
- **コーラルピンク**: #ff9a9e
- **アクアミント**: #a8edea
- **ライムグリーン**: #d299c2

## レイアウト構成

### ヘッダー部分（上部200px）
- **ロゴ**: 🌺 Dive Buddy's Menu
- **フォント**: Bold, 120px
- **背景**: グラデーション（#667eea → #764ba2）

### メニューグリッド（3×2）
各セクション: 833×743px

#### 上段
1. **体験相談** (🤿)
   - 背景色: オレンジ系グラデーション
   - 説明: "気軽に相談"

2. **ショップDB** (🏪)
   - 背景色: ブルー系グラデーション
   - 説明: "ショップ検索"

3. **アンケート** (📋)
   - 背景色: イエロー系グラデーション
   - 説明: "プロファイル"

#### 下段
4. **旅行計画** (🗓️)
   - 背景色: グリーン系グラデーション
   - 説明: "日程・予算"

5. **海況情報** (☀️)
   - 背景色: パープル系グラデーション
   - 説明: "天気・海況"

6. **ヘルプ** (❓)
   - 背景色: シアン系グラデーション
   - 説明: "使い方ガイド"

## フォント仕様
- **メインタイトル**: 80px, Bold
- **サブタイトル**: 45px, Regular
- **絵文字**: 200px
- **推奨フォント**: Hiragino Kaku Gothic Pro

## 制作ツール推奨
- **Adobe Photoshop**: 高品質制作
- **Figma**: チーム制作・共有
- **Canva**: 簡単制作
- **GIMP**: 無料代替

## 注意事項
- タップ可能エリアの視認性確保
- 文字の可読性重視
- 沖縄らしさの表現
- ブランド統一感の維持

## 納品形式
- **ファイル名**: rich-menu-v28.jpg
- **配置場所**: /assets/rich-menu-v28.jpg
- **予備**: PSDまたはFigmaファイルも保存推奨
`;

    const specPath = path.join(__dirname, '../docs/rich-menu-design-spec.md');
    fs.writeFileSync(specPath, spec, 'utf8');
    console.log('📝 デザイン仕様書作成完了:', specPath);
    
    return specPath;
}

// コマンドライン実行
if (require.main === module) {
    console.log('🎨 Dive Buddy\'s リッチメニュー制作ツール');
    console.log('');
    
    // HTMLテンプレート作成
    const htmlPath = createRichMenuHTMLFile();
    
    // デザイン仕様書作成
    const specPath = createDesignSpecification();
    
    console.log('');
    console.log('✅ 制作準備完了！');
    console.log('');
    console.log('🔗 作成されたファイル:');
    console.log(`   - HTMLテンプレート: ${htmlPath}`);
    console.log(`   - デザイン仕様書: ${specPath}`);
}

module.exports = {
    createRichMenuHTMLFile,
    createDesignSpecification,
    createSimpleRichMenuHTML
};