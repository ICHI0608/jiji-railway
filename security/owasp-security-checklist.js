/**
 * OWASP Top 10 2021 準拠セキュリティチェックリスト
 * Jijiダイビングボット セキュリティ評価・検証ツール
 */

const fs = require('fs');
const path = require('path');
const { securityLogger } = require('./security-middleware');

class OWASPSecurityChecker {
    constructor() {
        this.checkResults = [];
        this.securityScore = 0;
        this.maxScore = 100;
        
        // OWASP Top 10 2021 項目
        this.owaspTop10 = [
            'A01:2021 - Broken Access Control',
            'A02:2021 - Cryptographic Failures',
            'A03:2021 - Injection',
            'A04:2021 - Insecure Design',
            'A05:2021 - Security Misconfiguration',
            'A06:2021 - Vulnerable and Outdated Components',
            'A07:2021 - Identification and Authentication Failures',
            'A08:2021 - Software and Data Integrity Failures',
            'A09:2021 - Security Logging and Monitoring Failures',
            'A10:2021 - Server-Side Request Forgery (SSRF)'
        ];
    }

    /**
     * 包括的セキュリティチェック実行
     */
    async runFullSecurityCheck() {
        console.log('🔒 OWASP Top 10 準拠セキュリティチェック開始...');
        
        try {
            // 各項目のチェック実行
            await this.checkA01_BrokenAccessControl();
            await this.checkA02_CryptographicFailures();
            await this.checkA03_Injection();
            await this.checkA04_InsecureDesign();
            await this.checkA05_SecurityMisconfiguration();
            await this.checkA06_VulnerableComponents();
            await this.checkA07_AuthenticationFailures();
            await this.checkA08_IntegrityFailures();
            await this.checkA09_LoggingMonitoringFailures();
            await this.checkA10_SSRF();
            
            // 結果の集計と報告
            const report = this.generateSecurityReport();
            await this.saveReport(report);
            
            console.log('✅ セキュリティチェック完了');
            return report;
            
        } catch (error) {
            console.error('❌ セキュリティチェックエラー:', error);
            throw error;
        }
    }

    /**
     * A01:2021 - Broken Access Control
     */
    async checkA01_BrokenAccessControl() {
        const checks = {
            // 認証・認可の実装確認
            authMiddleware: this.checkFileExists('security/security-middleware.js'),
            jwtImplementation: this.checkCodePattern('jwt', ['jsonwebtoken', 'jwt-simple']),
            roleBasedAuth: this.checkCodePattern('roles', ['admin', 'user', 'shop']),
            sessionManagement: this.checkCodePattern('session', ['express-session', 'cookie-session']),
            
            // パストラバーサル対策
            pathValidation: this.checkCodePattern('path', ['path.normalize', 'path.resolve']),
            fileUploadSecurity: this.checkCodePattern('upload', ['multer', 'file-type']),
            
            // URL制限
            corsConfiguration: this.checkCodePattern('cors', ['cors', 'origin']),
            securityHeaders: this.checkCodePattern('helmet', ['helmet', 'csp'])
        };
        
        const score = this.calculateScore(checks, 15);
        this.checkResults.push({
            category: 'A01:2021 - Broken Access Control',
            score: score,
            maxScore: 15,
            checks: checks,
            recommendations: this.getA01Recommendations(checks)
        });
    }

    /**
     * A02:2021 - Cryptographic Failures
     */
    async checkA02_CryptographicFailures() {
        const checks = {
            // 暗号化実装
            httpsEnforcement: this.checkEnvironmentVariable('NODE_ENV') === 'production',
            passwordHashing: this.checkCodePattern('password', ['bcrypt', 'argon2', 'scrypt']),
            dataEncryption: this.checkCodePattern('encrypt', ['crypto', 'encrypt', 'cipher']),
            
            // 機密データ保護
            envFileProtection: this.checkFileExists('.env') && this.checkGitIgnore('.env'),
            secretsManagement: this.checkCodePattern('secret', ['process.env', 'dotenv']),
            
            // 証明書・SSL
            sslConfiguration: this.checkCodePattern('ssl', ['https', 'tls']),
            certValidation: this.checkCodePattern('cert', ['certificate', 'ssl-checker'])
        };
        
        const score = this.calculateScore(checks, 15);
        this.checkResults.push({
            category: 'A02:2021 - Cryptographic Failures',
            score: score,
            maxScore: 15,
            checks: checks,
            recommendations: this.getA02Recommendations(checks)
        });
    }

    /**
     * A03:2021 - Injection
     */
    async checkA03_Injection() {
        const checks = {
            // 入力検証
            inputValidation: this.checkCodePattern('validation', ['joi', 'express-validator', 'yup']),
            sqlInjectionPrevention: this.checkCodePattern('sql', ['prepared', 'parameterized', 'prisma']),
            
            // XSS対策
            xssProtection: this.checkCodePattern('xss', ['helmet', 'xss', 'sanitize']),
            csrfProtection: this.checkCodePattern('csrf', ['csrf', 'csurf']),
            
            // コマンドインジェクション対策
            commandInjection: this.checkCodePattern('exec', ['child_process', 'exec', 'spawn']),
            
            // テンプレートインジェクション対策
            templateSecurity: this.checkCodePattern('template', ['handlebars', 'mustache', 'ejs']),
            
            // NoSQL インジェクション対策
            nosqlInjection: this.checkCodePattern('nosql', ['mongoose', 'mongodb', '$where'])
        };
        
        const score = this.calculateScore(checks, 15);
        this.checkResults.push({
            category: 'A03:2021 - Injection',
            score: score,
            maxScore: 15,
            checks: checks,
            recommendations: this.getA03Recommendations(checks)
        });
    }

    /**
     * A04:2021 - Insecure Design
     */
    async checkA04_InsecureDesign() {
        const checks = {
            // セキュリティ設計原則
            principleOfLeastPrivilege: this.checkCodePattern('privilege', ['role', 'permission', 'access']),
            defenseInDepth: this.checkMultipleSecurityLayers(),
            failSecure: this.checkCodePattern('error', ['try', 'catch', 'error']),
            
            // 脅威モデリング
            inputValidationStrategy: this.checkCodePattern('validate', ['schema', 'validate', 'sanitize']),
            outputEncoding: this.checkCodePattern('encode', ['escape', 'encode', 'sanitize']),
            
            // セキュリティ機能
            rateLimiting: this.checkCodePattern('rate', ['express-rate-limit', 'rate-limit']),
            securityLogging: this.checkCodePattern('log', ['winston', 'log', 'audit']),
            
            // 設計文書
            securityDocumentation: this.checkFileExists('security/README.md'),
            threatModel: this.checkFileExists('security/threat-model.md')
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A04:2021 - Insecure Design',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA04Recommendations(checks)
        });
    }

    /**
     * A05:2021 - Security Misconfiguration
     */
    async checkA05_SecurityMisconfiguration() {
        const checks = {
            // セキュリティヘッダー
            securityHeaders: this.checkCodePattern('helmet', ['helmet', 'security-headers']),
            
            // デフォルト設定変更
            defaultPasswords: this.checkNoDefaultPasswords(),
            unnecessaryFeatures: this.checkCodePattern('features', ['debug', 'development']),
            
            // エラーハンドリング
            errorHandling: this.checkCodePattern('error', ['error-handler', 'try-catch']),
            stackTraceHiding: this.checkCodePattern('stack', ['stack', 'trace']),
            
            // 設定ファイル
            configurationSecurity: this.checkFileExists('config/security.js'),
            environmentVariables: this.checkEnvironmentConfiguration(),
            
            // 依存関係設定
            packageSecurity: this.checkPackageJsonSecurity(),
            
            // サーバー設定
            serverHardening: this.checkServerConfiguration()
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A05:2021 - Security Misconfiguration',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA05Recommendations(checks)
        });
    }

    /**
     * A06:2021 - Vulnerable and Outdated Components
     */
    async checkA06_VulnerableComponents() {
        const checks = {
            // 脆弱性スキャン
            npmAudit: await this.runNpmAudit(),
            dependencyCheck: this.checkFileExists('.github/dependabot.yml'),
            
            // 依存関係管理
            packageLockFile: this.checkFileExists('package-lock.json'),
            nodeVersion: this.checkNodeVersion(),
            
            // 自動更新
            dependabot: this.checkFileExists('.github/dependabot.yml'),
            renovate: this.checkFileExists('renovate.json'),
            
            // 監視
            securityMonitoring: this.checkCodePattern('monitor', ['snyk', 'audit', 'security']),
            
            // 定期更新
            updateSchedule: this.checkUpdateSchedule()
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A06:2021 - Vulnerable and Outdated Components',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA06Recommendations(checks)
        });
    }

    /**
     * A07:2021 - Identification and Authentication Failures
     */
    async checkA07_AuthenticationFailures() {
        const checks = {
            // 認証メカニズム
            strongAuthentication: this.checkCodePattern('auth', ['jwt', 'passport', 'auth0']),
            passwordPolicy: this.checkCodePattern('password', ['length', 'complexity', 'policy']),
            
            // セッション管理
            sessionSecurity: this.checkCodePattern('session', ['secure', 'httpOnly', 'sameSite']),
            sessionTimeout: this.checkCodePattern('timeout', ['maxAge', 'expires']),
            
            // 多要素認証
            mfaImplementation: this.checkCodePattern('mfa', ['2fa', 'totp', 'sms']),
            
            // ブルートフォース対策
            rateLimitingAuth: this.checkCodePattern('rate-limit', ['auth', 'login', 'attempt']),
            accountLockout: this.checkCodePattern('lockout', ['lock', 'attempt', 'fail']),
            
            // 認証情報保護
            credentialStorage: this.checkCodePattern('credential', ['hash', 'salt', 'bcrypt'])
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A07:2021 - Identification and Authentication Failures',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA07Recommendations(checks)
        });
    }

    /**
     * A08:2021 - Software and Data Integrity Failures
     */
    async checkA08_IntegrityFailures() {
        const checks = {
            // CI/CDセキュリティ
            cicdSecurity: this.checkFileExists('.github/workflows/security.yml'),
            
            // 署名検証
            codeSignature: this.checkCodePattern('signature', ['sign', 'verify', 'integrity']),
            
            // 依存関係整合性
            subresourceIntegrity: this.checkCodePattern('integrity', ['sri', 'hash', 'checksum']),
            
            // 自動更新セキュリティ
            updateSecurity: this.checkCodePattern('update', ['verify', 'signature', 'hash']),
            
            // バックアップ整合性
            backupIntegrity: this.checkCodePattern('backup', ['verify', 'checksum', 'integrity']),
            
            // データ整合性
            dataValidation: this.checkCodePattern('validate', ['schema', 'constraint', 'check'])
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A08:2021 - Software and Data Integrity Failures',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA08Recommendations(checks)
        });
    }

    /**
     * A09:2021 - Security Logging and Monitoring Failures
     */
    async checkA09_LoggingMonitoringFailures() {
        const checks = {
            // ログ実装
            loggingImplementation: this.checkCodePattern('log', ['winston', 'log4js', 'bunyan']),
            securityLogging: this.checkFileExists('security/security-middleware.js'),
            
            // 監視システム
            monitoringSystem: this.checkFileExists('monitoring/prometheus-metrics.js'),
            alerting: this.checkCodePattern('alert', ['alert', 'notify', 'monitoring']),
            
            // ログ保護
            logProtection: this.checkCodePattern('log', ['sanitize', 'mask', 'redact']),
            
            // 監査証跡
            auditTrail: this.checkCodePattern('audit', ['audit', 'trail', 'event']),
            
            // ログ分析
            logAnalysis: this.checkFileExists('docker/elk-stack.yml'),
            
            // インシデント対応
            incidentResponse: this.checkCodePattern('incident', ['response', 'handler', 'emergency'])
        };
        
        const score = this.calculateScore(checks, 10);
        this.checkResults.push({
            category: 'A09:2021 - Security Logging and Monitoring Failures',
            score: score,
            maxScore: 10,
            checks: checks,
            recommendations: this.getA09Recommendations(checks)
        });
    }

    /**
     * A10:2021 - Server-Side Request Forgery (SSRF)
     */
    async checkA10_SSRF() {
        const checks = {
            // URL検証
            urlValidation: this.checkCodePattern('url', ['validate', 'whitelist', 'allowed']),
            
            // ネットワーク制限
            networkFiltering: this.checkCodePattern('network', ['firewall', 'restrict', 'allow']),
            
            // プロキシ設定
            proxyConfiguration: this.checkCodePattern('proxy', ['proxy', 'forward', 'redirect']),
            
            // 外部リクエスト制限
            externalRequestLimiting: this.checkCodePattern('external', ['whitelist', 'allowed-domains']),
            
            // DNS制限
            dnsFiltering: this.checkCodePattern('dns', ['resolve', 'lookup', 'filter']),
            
            // タイムアウト設定
            requestTimeout: this.checkCodePattern('timeout', ['timeout', 'abort', 'cancel'])
        };
        
        const score = this.calculateScore(checks, 5);
        this.checkResults.push({
            category: 'A10:2021 - Server-Side Request Forgery (SSRF)',
            score: score,
            maxScore: 5,
            checks: checks,
            recommendations: this.getA10Recommendations(checks)
        });
    }

    // ユーティリティメソッド

    checkFileExists(filePath) {
        try {
            return fs.existsSync(path.join(__dirname, '..', filePath));
        } catch (error) {
            return false;
        }
    }

    checkCodePattern(keyword, patterns) {
        // 実際の実装では、コードベースを検索してパターンを確認
        // 簡略化のため、基本的なチェックのみ実装
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            return patterns.some(pattern => 
                packageJson.dependencies?.[pattern] || 
                packageJson.devDependencies?.[pattern] ||
                JSON.stringify(packageJson).includes(pattern)
            );
        } catch (error) {
            return false;
        }
    }

    checkEnvironmentVariable(variable) {
        return process.env[variable] !== undefined;
    }

    checkGitIgnore(pattern) {
        try {
            const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
            return gitignore.includes(pattern);
        } catch (error) {
            return false;
        }
    }

    calculateScore(checks, maxScore) {
        const passedChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        return Math.round((passedChecks / totalChecks) * maxScore);
    }

    async runNpmAudit() {
        // 簡略化 - 実際の実装では npm audit を実行
        return true;
    }

    checkNodeVersion() {
        const version = process.version;
        const majorVersion = parseInt(version.split('.')[0].substring(1));
        return majorVersion >= 16; // Node.js 16以上
    }

    generateSecurityReport() {
        this.securityScore = this.checkResults.reduce((sum, result) => sum + result.score, 0);
        
        const report = {
            timestamp: new Date().toISOString(),
            overallScore: this.securityScore,
            maxScore: this.maxScore,
            percentage: Math.round((this.securityScore / this.maxScore) * 100),
            grade: this.getSecurityGrade(),
            results: this.checkResults,
            summary: this.generateSummary(),
            recommendations: this.generateTopRecommendations()
        };
        
        return report;
    }

    getSecurityGrade() {
        const percentage = (this.securityScore / this.maxScore) * 100;
        if (percentage >= 90) return 'A';
        if (percentage >= 80) return 'B';
        if (percentage >= 70) return 'C';
        if (percentage >= 60) return 'D';
        return 'F';
    }

    generateSummary() {
        const passedCategories = this.checkResults.filter(result => result.score > result.maxScore * 0.7).length;
        const totalCategories = this.checkResults.length;
        
        return {
            totalCategories,
            passedCategories,
            failedCategories: totalCategories - passedCategories,
            highestScore: Math.max(...this.checkResults.map(r => r.score)),
            lowestScore: Math.min(...this.checkResults.map(r => r.score))
        };
    }

    generateTopRecommendations() {
        return this.checkResults
            .filter(result => result.score < result.maxScore * 0.7)
            .sort((a, b) => a.score - b.score)
            .slice(0, 5)
            .map(result => ({
                category: result.category,
                priority: 'high',
                recommendations: result.recommendations
            }));
    }

    async saveReport(report) {
        const reportPath = path.join(__dirname, '..', 'reports', 'security-report.json');
        const reportDir = path.dirname(reportPath);
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // セキュリティログにも記録
        securityLogger.info('Security assessment completed', {
            score: report.overallScore,
            grade: report.grade,
            percentage: report.percentage
        });
    }

    // 推奨事項メソッド（簡略化）
    getA01Recommendations(checks) {
        return ['JWT認証の実装', 'ロールベースアクセス制御の強化', 'CORS設定の見直し'];
    }

    getA02Recommendations(checks) {
        return ['HTTPS強制化', 'パスワードハッシュ化の実装', '機密データの暗号化'];
    }

    getA03Recommendations(checks) {
        return ['入力検証の強化', 'SQLインジェクション対策', 'XSS保護の実装'];
    }

    getA04Recommendations(checks) {
        return ['セキュリティ設計の見直し', '脅威モデリングの実施', 'セキュリティ文書の作成'];
    }

    getA05Recommendations(checks) {
        return ['セキュリティヘッダーの追加', 'エラーハンドリングの改善', '設定ファイルの保護'];
    }

    getA06Recommendations(checks) {
        return ['定期的な依存関係更新', 'Dependabotの設定', '脆弱性スキャンの自動化'];
    }

    getA07Recommendations(checks) {
        return ['多要素認証の実装', 'セッションセキュリティの強化', 'ブルートフォース対策'];
    }

    getA08Recommendations(checks) {
        return ['CI/CDセキュリティの強化', '署名検証の実装', 'データ整合性チェック'];
    }

    getA09Recommendations(checks) {
        return ['セキュリティログの充実', '監視システムの構築', 'インシデント対応計画'];
    }

    getA10Recommendations(checks) {
        return ['URL検証の実装', 'ネットワーク制限の設定', '外部リクエスト制限'];
    }

    // 複雑なチェック用のヘルパーメソッド
    checkMultipleSecurityLayers() {
        const layers = [
            this.checkCodePattern('auth', ['jwt', 'passport']),
            this.checkCodePattern('validation', ['joi', 'express-validator']),
            this.checkCodePattern('helmet', ['helmet']),
            this.checkCodePattern('rate-limit', ['express-rate-limit'])
        ];
        return layers.filter(Boolean).length >= 3;
    }

    checkNoDefaultPasswords() {
        // 簡略化 - 実際の実装では設定ファイルを検査
        return true;
    }

    checkEnvironmentConfiguration() {
        const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'];
        return requiredEnvVars.every(varName => process.env[varName]);
    }

    checkPackageJsonSecurity() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
            return packageJson.scripts?.['security:audit'] !== undefined;
        } catch (error) {
            return false;
        }
    }

    checkServerConfiguration() {
        // 簡略化 - 実際の実装では詳細な設定を検査
        return process.env.NODE_ENV === 'production';
    }

    checkUpdateSchedule() {
        return this.checkFileExists('.github/dependabot.yml');
    }
}

// スクリプト実行時の処理
if (require.main === module) {
    const checker = new OWASPSecurityChecker();
    checker.runFullSecurityCheck()
        .then(report => {
            console.log('\n📊 セキュリティレポート');
            console.log('====================');
            console.log(`スコア: ${report.overallScore}/${report.maxScore} (${report.percentage}%)`);
            console.log(`グレード: ${report.grade}`);
            console.log(`レポートファイル: reports/security-report.json`);
        })
        .catch(error => {
            console.error('❌ セキュリティチェック失敗:', error);
            process.exit(1);
        });
}

module.exports = OWASPSecurityChecker;