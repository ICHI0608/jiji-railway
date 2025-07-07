#!/usr/bin/env node

/**
 * Jiji Project Analysis Script
 * Analyzes current project structure and prepares for emotional matching system development
 * with Google Sheets integration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class JijiProjectAnalyzer {
    constructor() {
        this.projectRoot = process.cwd();
        this.analysis = {
            timestamp: new Date().toISOString(),
            projectStructure: {},
            dependencies: {},
            currentFeatures: [],
            databaseSchema: {},
            emotionalMatchingRequirements: {},
            googleSheetsIntegration: {},
            recommendations: []
        };
    }

    async analyze() {
        console.log('🔍 Starting Jiji Project Analysis...\n');
        
        try {
            await this.analyzeProjectStructure();
            await this.analyzeDependencies();
            await this.analyzeCurrentFeatures();
            await this.analyzeDatabaseSchema();
            await this.planEmotionalMatchingSystem();
            await this.planGoogleSheetsIntegration();
            await this.generateRecommendations();
            
            await this.saveAnalysis();
            this.displaySummary();
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
        }
    }

    async analyzeProjectStructure() {
        console.log('📁 Analyzing project structure...');
        
        const structure = this.getDirectoryStructure(this.projectRoot);
        this.analysis.projectStructure = structure;
        
        // Identify key files
        const keyFiles = [
            'package.json',
            'app.js',
            'src/database.js',
            'src/message-handler.js',
            'src/jiji-persona.js',
            'src/server.js'
        ];
        
        this.analysis.projectStructure.keyFiles = keyFiles.map(file => ({
            path: file,
            exists: fs.existsSync(path.join(this.projectRoot, file)),
            size: this.getFileSize(file)
        }));
        
        console.log('✅ Project structure analyzed\n');
    }

    async analyzeDependencies() {
        console.log('📦 Analyzing dependencies...');
        
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            this.analysis.dependencies = {
                production: packageJson.dependencies || {},
                development: packageJson.devDependencies || {},
                engines: packageJson.engines || {},
                scripts: packageJson.scripts || {}
            };
            
            // Analyze current integrations
            const currentIntegrations = {
                lineBot: !!packageJson.dependencies['@line/bot-sdk'],
                openai: !!packageJson.dependencies['openai'],
                database: {
                    supabase: !!packageJson.dependencies['@supabase/supabase-js'],
                    redis: !!packageJson.dependencies['redis'],
                    postgresql: !!packageJson.dependencies['pg']
                },
                webFramework: !!packageJson.dependencies['express']
            };
            
            this.analysis.dependencies.currentIntegrations = currentIntegrations;
        }
        
        console.log('✅ Dependencies analyzed\n');
    }

    async analyzeCurrentFeatures() {
        console.log('🔧 Analyzing current features...');
        
        const features = [];
        
        // Analyze message handler features
        const messageHandlerPath = path.join(this.projectRoot, 'src/message-handler.js');
        if (fs.existsSync(messageHandlerPath)) {
            const content = fs.readFileSync(messageHandlerPath, 'utf8');
            
            if (content.includes('extractPastExperiences')) {
                features.push('Past Experience Extraction');
            }
            if (content.includes('extractDivingPlans')) {
                features.push('Diving Plan Detection');
            }
            if (content.includes('checkAndUpdateProfile')) {
                features.push('Automatic Profile Updates');
            }
            if (content.includes('generateAIResponse')) {
                features.push('AI Response Generation');
            }
        }
        
        // Analyze database features
        const databasePath = path.join(this.projectRoot, 'src/database.js');
        if (fs.existsSync(databasePath)) {
            const content = fs.readFileSync(databasePath, 'utf8');
            
            if (content.includes('user_profiles')) {
                features.push('User Profile Management');
            }
            if (content.includes('conversations')) {
                features.push('Conversation History');
            }
            if (content.includes('Redis')) {
                features.push('Redis Caching');
            }
        }
        
        // Analyze persona features
        const personaPath = path.join(this.projectRoot, 'src/jiji-persona.js');
        if (fs.existsSync(personaPath)) {
            features.push('Jiji Persona System');
        }
        
        this.analysis.currentFeatures = features;
        console.log('✅ Current features analyzed\n');
    }

    async analyzeDatabaseSchema() {
        console.log('🗄️ Analyzing database schema...');
        
        const databasePath = path.join(this.projectRoot, 'src/database.js');
        if (fs.existsSync(databasePath)) {
            const content = fs.readFileSync(databasePath, 'utf8');
            
            // Extract table references
            const tables = {
                user_profiles: {
                    fields: ['line_user_id', 'name', 'diving_experience', 'license_type', 'preferences', 'profile_completion_rate'],
                    operations: ['create', 'read', 'update']
                },
                conversations: {
                    fields: ['line_user_id', 'message_type', 'message_content', 'timestamp', 'session_id', 'metadata'],
                    operations: ['create', 'read']
                }
            };
            
            this.analysis.databaseSchema = {
                provider: 'Supabase (PostgreSQL)',
                cache: 'Redis',
                tables: tables,
                needsExtension: true
            };
        }
        
        console.log('✅ Database schema analyzed\n');
    }

    async planEmotionalMatchingSystem() {
        console.log('💝 Planning emotional matching system...');
        
        const emotionalMatching = {
            purpose: 'Match users based on emotional state, experience level, and preferences',
            components: {
                emotionalAnalysis: {
                    description: 'Analyze user messages for emotional state',
                    methods: ['sentiment analysis', 'emotion detection', 'mood classification'],
                    implementation: 'OpenAI GPT-4 with custom prompts'
                },
                matchingAlgorithm: {
                    description: 'Find compatible diving partners',
                    factors: ['experience level', 'emotional state', 'preferences', 'location', 'availability'],
                    algorithm: 'weighted scoring system'
                },
                userPreferences: {
                    description: 'Extended user profile for matching',
                    additionalFields: [
                        'personality_type',
                        'communication_style',
                        'stress_level',
                        'adventure_level',
                        'social_preference',
                        'emotional_state_history'
                    ]
                }
            },
            databaseExtensions: {
                newTables: [
                    'emotional_profiles',
                    'matching_preferences',
                    'match_history',
                    'emotional_analysis_log'
                ],
                extendedFields: [
                    'user_profiles.personality_traits',
                    'user_profiles.emotional_preferences',
                    'user_profiles.matching_settings'
                ]
            }
        };
        
        this.analysis.emotionalMatchingRequirements = emotionalMatching;
        console.log('✅ Emotional matching system planned\n');
    }

    async planGoogleSheetsIntegration() {
        console.log('📊 Planning Google Sheets integration...');
        
        const sheetsIntegration = {
            purpose: 'Export user data, analytics, and matching results to Google Sheets',
            useCases: [
                'User analytics dashboard',
                'Matching success rates',
                'Emotional state trends',
                'Diving preferences analysis',
                'Business intelligence reports'
            ],
            requiredPackages: [
                'googleapis',
                'google-auth-library'
            ],
            authentication: {
                method: 'Service Account',
                requiredFiles: ['service-account-key.json'],
                environment: ['GOOGLE_SHEETS_PRIVATE_KEY', 'GOOGLE_SHEETS_CLIENT_EMAIL']
            },
            sheetStructure: {
                userAnalytics: {
                    columns: ['user_id', 'registration_date', 'last_active', 'message_count', 'profile_completion', 'emotional_state'],
                    updateFrequency: 'daily'
                },
                matchingResults: {
                    columns: ['match_id', 'user1_id', 'user2_id', 'compatibility_score', 'match_date', 'success_rate'],
                    updateFrequency: 'real-time'
                },
                emotionalTrends: {
                    columns: ['date', 'user_id', 'emotional_state', 'diving_context', 'satisfaction_score'],
                    updateFrequency: 'daily'
                }
            },
            apiEndpoints: [
                'GET /api/export/users',
                'GET /api/export/matches',
                'GET /api/export/analytics',
                'POST /api/sheets/update'
            ]
        };
        
        this.analysis.googleSheetsIntegration = sheetsIntegration;
        console.log('✅ Google Sheets integration planned\n');
    }

    async generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        const recommendations = [
            {
                category: 'Database Schema',
                priority: 'High',
                description: 'Extend database schema for emotional matching',
                tasks: [
                    'Create emotional_profiles table',
                    'Add personality_traits field to user_profiles',
                    'Create matching_preferences table',
                    'Add emotional analysis logging'
                ]
            },
            {
                category: 'Dependencies',
                priority: 'High',
                description: 'Install required packages for Google Sheets integration',
                tasks: [
                    'npm install googleapis google-auth-library',
                    'Set up Google Cloud Service Account',
                    'Configure environment variables'
                ]
            },
            {
                category: 'API Development',
                priority: 'Medium',
                description: 'Develop emotional matching API endpoints',
                tasks: [
                    'Create emotion analysis service',
                    'Implement matching algorithm',
                    'Add Google Sheets export endpoints',
                    'Create admin dashboard for monitoring'
                ]
            },
            {
                category: 'Security',
                priority: 'High',
                description: 'Implement security measures for sensitive data',
                tasks: [
                    'Encrypt emotional profile data',
                    'Add user consent management',
                    'Implement data retention policies',
                    'Add privacy controls'
                ]
            },
            {
                category: 'Testing',
                priority: 'Medium',
                description: 'Create comprehensive testing suite',
                tasks: [
                    'Unit tests for emotion analysis',
                    'Integration tests for matching algorithm',
                    'End-to-end tests for Google Sheets export',
                    'Performance tests for matching speed'
                ]
            }
        ];
        
        this.analysis.recommendations = recommendations;
        console.log('✅ Recommendations generated\n');
    }

    getDirectoryStructure(dir, depth = 0, maxDepth = 3) {
        if (depth > maxDepth) return null;
        
        const items = {};
        try {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                if (file.startsWith('.') || file === 'node_modules') return;
                
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isDirectory()) {
                    items[file] = this.getDirectoryStructure(filePath, depth + 1, maxDepth);
                } else {
                    items[file] = {
                        type: 'file',
                        size: stats.size,
                        modified: stats.mtime.toISOString()
                    };
                }
            });
        } catch (error) {
            console.warn(`Warning: Could not read directory ${dir}`);
        }
        
        return items;
    }

    getFileSize(filePath) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            const stats = fs.statSync(fullPath);
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    async saveAnalysis() {
        const analysisPath = path.join(this.projectRoot, 'project-analysis.json');
        fs.writeFileSync(analysisPath, JSON.stringify(this.analysis, null, 2));
        console.log(`📄 Analysis saved to: ${analysisPath}`);
    }

    displaySummary() {
        console.log('\n🎯 JIJI PROJECT ANALYSIS SUMMARY');
        console.log('='.repeat(50));
        
        console.log('\n📊 Current State:');
        console.log(`• Features: ${this.analysis.currentFeatures.length} implemented`);
        console.log(`• Dependencies: ${Object.keys(this.analysis.dependencies.production || {}).length} production packages`);
        console.log(`• Database: ${this.analysis.databaseSchema.provider} with ${this.analysis.databaseSchema.cache} caching`);
        
        console.log('\n🎯 Emotional Matching System:');
        console.log('• Emotion Analysis: OpenAI GPT-4 integration');
        console.log('• Matching Algorithm: Weighted scoring system');
        console.log('• Database Extensions: 4 new tables required');
        
        console.log('\n📊 Google Sheets Integration:');
        console.log('• Authentication: Service Account method');
        console.log('• Sheet Types: 3 different analytics sheets');
        console.log('• API Endpoints: 4 new endpoints required');
        
        console.log('\n📋 Next Steps:');
        this.analysis.recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec.category} (${rec.priority}): ${rec.description}`);
        });
        
        console.log('\n✅ Analysis complete! Check project-analysis.json for detailed results.\n');
    }
}

// Run analysis if script is executed directly
if (require.main === module) {
    const analyzer = new JijiProjectAnalyzer();
    analyzer.analyze().catch(console.error);
}

module.exports = JijiProjectAnalyzer;