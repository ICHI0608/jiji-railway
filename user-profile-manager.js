// user-profile-manager.js - 新規ファイル

const fs = require('fs').promises;
const path = require('path');

class UserProfileManager {
    constructor() {
        this.profilesDir = path.join(__dirname, 'data', 'user_profiles');
        this.learningDir = path.join(__dirname, 'data', 'learning_data');
        this.initializeDirectories();
    }

    async initializeDirectories() {
        try {
            await fs.access(this.profilesDir);
        } catch {
            await fs.mkdir(this.profilesDir, { recursive: true });
        }
        
        try {
            await fs.access(this.learningDir);
        } catch {
            await fs.mkdir(this.learningDir, { recursive: true });
        }
    }

    getUserProfilePath(userId) {
        return path.join(this.profilesDir, `${userId}.json`);
    }

    // ユーザープロファイルの読み込み
    async loadUserProfile(userId) {
        try {
            const filePath = this.getUserProfilePath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // 新規ユーザーの場合、初期プロファイルを作成
            return this.createInitialProfile(userId);
        }
    }

    // 初期プロファイル作成
    createInitialProfile(userId) {
        return {
            userId,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            
            // 基本情報
            basic: {
                isNewUser: true,
                totalInteractions: 0,
                firstInteraction: new Date().toISOString(),
                lastInteraction: new Date().toISOString()
            },

            // ダイビング経験
            diving: {
                experienceLevel: 'unknown', // beginner, intermediate, advanced, professional
                certifications: [], // ['Open Water', 'Advanced', 'Rescue', etc.]
                totalDives: null,
                divingSince: null,
                specialties: [] // ['Deep', 'Wreck', 'Night', etc.]
            },

            // 好み・傾向
            preferences: {
                preferredLocations: [], // ['石垣島', '沖縄', etc.]
                preferredDiveTypes: [], // ['ファンダイブ', '講習', '体験']
                buddyStyle: 'unknown', // 'solo', 'group', 'couple', 'family'
                seasonalPreferences: [] // ['夏', '冬', etc.]
            },

            // 装備情報
            equipment: {
                ownedEquipment: [], // ['BCD', 'Regulator', etc.]
                equipmentBrands: [], // ['SCUBAPRO', 'Aqua Lung', etc.]
                maintenanceHistory: [],
                needsAdvice: []
            },

            // 興味・目標
            interests: {
                currentGoals: [], // ['アドバンス取得', '100本達成', etc.]
                interestedLocations: [],
                plannedActivities: [],
                learningTopics: [] // ['水中写真', 'ナビゲーション', etc.]
            },

            // 行動パターン
            patterns: {
                messageFrequency: 'unknown', // 'daily', 'weekly', 'monthly', 'occasional'
                preferredResponseStyle: 'unknown', // 'detailed', 'concise', 'friendly'
                commonQuestionTypes: [], // ['spot_info', 'equipment', 'safety', etc.]
                reminderPreferences: {
                    enabledTypes: ['diving', 'maintenance', 'learning'],
                    preferredTiming: 'default'
                }
            },

            // 学習メタデータ
            learning: {
                profileCompleteness: 0, // 0-100の完成度
                confidenceScores: {
                    experienceLevel: 0,
                    preferences: 0,
                    equipment: 0,
                    interests: 0
                },
                lastAnalyzed: new Date().toISOString(),
                updateTriggers: [] // プロファイル更新のきっかけ
            }
        };
    }

    // プロファイル保存
    async saveUserProfile(userId, profile) {
        try {
            await this.initializeDirectories();
            profile.lastUpdated = new Date().toISOString();
            profile.basic.lastInteraction = new Date().toISOString();
            profile.basic.totalInteractions = (profile.basic.totalInteractions || 0) + 1;
            
            const filePath = this.getUserProfilePath(userId);
            await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
            
            console.log(`ユーザープロファイル更新: ${userId}`);
            return true;
        } catch (error) {
            console.error('プロファイル保存エラー:', error);
            return false;
        }
    }

    // 会話からプロファイルを更新
    async updateProfileFromMessage(userId, message, messageType = 'user') {
        if (messageType !== 'user') return;

        const profile = await this.loadUserProfile(userId);
        let updated = false;

        // 基本情報の更新
        if (profile.basic.isNewUser && profile.basic.totalInteractions > 3) {
            profile.basic.isNewUser = false;
            updated = true;
        }

        // ダイビング経験の抽出
        const divingUpdates = this.extractDivingInfo(message);
        if (this.mergeUpdates(profile.diving, divingUpdates)) {
            updated = true;
        }

        // 場所情報の抽出
        const locationUpdates = this.extractLocationInfo(message);
        if (this.mergeLocationUpdates(profile.preferences, locationUpdates)) {
            updated = true;
        }

        // 装備情報の抽出
        const equipmentUpdates = this.extractEquipmentInfo(message);
        if (this.mergeUpdates(profile.equipment, equipmentUpdates)) {
            updated = true;
        }

        // 興味・目標の抽出
        const interestUpdates = this.extractInterestInfo(message);
        if (this.mergeUpdates(profile.interests, interestUpdates)) {
            updated = true;
        }

        // プロファイル完成度の計算
        profile.learning.profileCompleteness = this.calculateCompleteness(profile);

        if (updated) {
            profile.learning.lastAnalyzed = new Date().toISOString();
            await this.saveUserProfile(userId, profile);
        }

        return profile;
    }

    // ダイビング情報の抽出
    extractDivingInfo(message) {
        const updates = {};
        
        // 資格情報
        const certifications = {
            'オープンウォーター': 'Open Water',
            'OW': 'Open Water',
            'アドバンス': 'Advanced Open Water',
            'AOW': 'Advanced Open Water',
            'レスキュー': 'Rescue Diver',
            'ダイブマスター': 'Divemaster',
            'DM': 'Divemaster',
            'インストラクター': 'Instructor'
        };

        Object.keys(certifications).forEach(keyword => {
            if (message.includes(keyword)) {
                updates.certifications = updates.certifications || [];
                if (!updates.certifications.includes(certifications[keyword])) {
                    updates.certifications.push(certifications[keyword]);
                }
            }
        });

        // 経験レベル
        if (message.includes('初心者') || message.includes('始めたばかり')) {
            updates.experienceLevel = 'beginner';
        } else if (message.includes('上級者') || message.includes('インストラクター')) {
            updates.experienceLevel = 'professional';
        } else if (message.includes('中級') || message.includes('アドバンス')) {
            updates.experienceLevel = 'intermediate';
        }

        // 本数情報
        const divesMatch = message.match(/(\d+)本/);
        if (divesMatch) {
            updates.totalDives = parseInt(divesMatch[1]);
        }

        return updates;
    }

    // 場所情報の抽出
    extractLocationInfo(message) {
        const locations = [
            '石垣島', '宮古島', '沖縄本島', '沖縄', '伊豆', '伊豆半島', '小笠原',
            'セブ島', 'セブ', 'ボホール', 'プーケット', 'モルディブ', 'パラオ',
            'グレートバリアリーフ', 'レッドシー', 'カリブ海'
        ];

        const mentioned = [];
        const preferred = [];

        locations.forEach(location => {
            if (message.includes(location)) {
                mentioned.push(location);
                
                if (message.includes(location + 'が好き') || 
                    message.includes(location + 'は最高') ||
                    message.includes(location + 'また行きたい')) {
                    preferred.push(location);
                }
            }
        });

        return { mentioned, preferred };
    }

    // 装備情報の抽出
    extractEquipmentInfo(message) {
        const updates = {};
        
        const equipment = {
            'BCD': 'BCD',
            'レギュレーター': 'Regulator',
            'レギュ': 'Regulator',
            'ウェットスーツ': 'Wetsuit',
            'ドライスーツ': 'Drysuit',
            'マスク': 'Mask',
            'フィン': 'Fins',
            'ダイコン': 'Dive Computer'
        };

        Object.keys(equipment).forEach(keyword => {
            if (message.includes(keyword)) {
                if (message.includes('持ってる') || message.includes('自分の') || message.includes('マイ')) {
                    updates.ownedEquipment = updates.ownedEquipment || [];
                    if (!updates.ownedEquipment.includes(equipment[keyword])) {
                        updates.ownedEquipment.push(equipment[keyword]);
                    }
                }
                
                if (message.includes('メンテナンス') || message.includes('手入れ')) {
                    updates.needsAdvice = updates.needsAdvice || [];
                    if (!updates.needsAdvice.includes(equipment[keyword])) {
                        updates.needsAdvice.push(equipment[keyword]);
                    }
                }
            }
        });

        return updates;
    }

    // 興味・目標の抽出
    extractInterestInfo(message) {
        const updates = {};
        
        const goals = {
            'アドバンス': 'アドバンス取得',
            'レスキュー': 'レスキューダイバー取得',
            '100本': '100本達成',
            '水中写真': '水中写真上達',
            'ナビゲーション': 'ナビゲーションスキル向上',
            'ナイトダイブ': 'ナイトダイビング経験',
            'ディープ': 'ディープダイビング'
        };

        Object.keys(goals).forEach(keyword => {
            if (message.includes(keyword) && 
                (message.includes('したい') || message.includes('挑戦') || message.includes('目標'))) {
                updates.currentGoals = updates.currentGoals || [];
                if (!updates.currentGoals.includes(goals[keyword])) {
                    updates.currentGoals.push(goals[keyword]);
                }
            }
        });

        return updates;
    }

    // 更新のマージ
    mergeUpdates(target, updates) {
        let hasChanges = false;

        Object.keys(updates).forEach(key => {
            if (Array.isArray(updates[key])) {
                if (!target[key]) target[key] = [];
                updates[key].forEach(item => {
                    if (!target[key].includes(item)) {
                        target[key].push(item);
                        hasChanges = true;
                    }
                });
            } else if (updates[key] !== target[key]) {
                target[key] = updates[key];
                hasChanges = true;
            }
        });

        return hasChanges;
    }

    // 場所情報の特別マージ
    mergeLocationUpdates(preferences, locationUpdates) {
        let hasChanges = false;

        if (locationUpdates.mentioned && locationUpdates.mentioned.length > 0) {
            if (!preferences.preferredLocations) preferences.preferredLocations = [];
            locationUpdates.mentioned.forEach(location => {
                if (!preferences.preferredLocations.includes(location)) {
                    preferences.preferredLocations.push(location);
                    hasChanges = true;
                }
            });
        }

        return hasChanges;
    }

    // プロファイル完成度の計算
    calculateCompleteness(profile) {
        let score = 0;
        const maxScore = 100;

        // 各セクションの重み
        const weights = {
            diving: 30,      // ダイビング経験
            preferences: 25, // 好み・傾向  
            equipment: 20,   // 装備情報
            interests: 15,   // 興味・目標
            patterns: 10     // 行動パターン
        };

        // ダイビング経験のスコア
        let divingScore = 0;
        if (profile.diving.experienceLevel !== 'unknown') divingScore += 40;
        if (profile.diving.certifications.length > 0) divingScore += 40;
        if (profile.diving.totalDives) divingScore += 20;
        score += (divingScore / 100) * weights.diving;

        // 好み・傾向のスコア
        let preferencesScore = 0;
        if (profile.preferences.preferredLocations.length > 0) preferencesScore += 50;
        if (profile.preferences.preferredDiveTypes.length > 0) preferencesScore += 30;
        if (profile.preferences.buddyStyle !== 'unknown') preferencesScore += 20;
        score += (preferencesScore / 100) * weights.preferences;

        // 装備情報のスコア
        let equipmentScore = 0;
        if (profile.equipment.ownedEquipment.length > 0) equipmentScore += 60;
        if (profile.equipment.equipmentBrands.length > 0) equipmentScore += 40;
        score += (equipmentScore / 100) * weights.equipment;

        // 興味・目標のスコア
        let interestsScore = 0;
        if (profile.interests.currentGoals.length > 0) interestsScore += 60;
        if (profile.interests.interestedLocations.length > 0) interestsScore += 40;
        score += (interestsScore / 100) * weights.interests;

        // 行動パターンのスコア
        let patternsScore = 0;
        if (profile.basic.totalInteractions > 5) patternsScore += 50;
        if (profile.patterns.messageFrequency !== 'unknown') patternsScore += 50;
        score += (patternsScore / 100) * weights.patterns;

        return Math.round(score);
    }

    // プロファイルベースの提案生成
    async generatePersonalizedSuggestion(userId, activityType = 'diving') {
        const profile = await this.loadUserProfile(userId);
        
        if (profile.basic.isNewUser || profile.learning.profileCompleteness < 20) {
            return this.generateNewUserQuestions();
        }

        return this.generateExperiencedUserSuggestion(profile, activityType);
    }

    // 新規ユーザー向け質問
    generateNewUserQuestions() {
        return {
            type: 'questions',
            content: `🤿 ダイビングの予定ですね！初めてお話しさせていただくので、\n詳しく教えてください：\n\n📍 どちらの海域・ダイビングスポットですか？\n⏰ 何時頃の出発予定ですか？\n🤿 ファンダイブ？体験ダイビング？講習？\n👥 お一人での参加？グループ？\n🎒 器材はレンタル？ご自身の器材持参？\n📋 ダイビング経験はどの程度ですか？\n\nこの情報をお聞かせいただければ、\nあなたに最適なリマインド内容を\nご提案させていただきます！`,
            needsFollowUp: true
        };
    }

    // 経験ユーザー向け提案
    generateExperiencedUserSuggestion(profile, activityType) {
        let suggestion = `🤿 ダイビングの予定ですね！\n`;
        
        // 完成度に基づくパーソナライゼーション
        if (profile.learning.profileCompleteness >= 60) {
            suggestion += `いつものダイビングですね！\n\n`;
        } else {
            suggestion += `これまでのお話から推測して、\n\n`;
        }

        // 個別化されたリマインド項目
        const reminderItems = this.generatePersonalizedReminders(profile);
        
        suggestion += `以下の内容でリマインドを設定いたします：\n\n`;
        reminderItems.forEach(item => {
            suggestion += `✅ ${item}\n`;
        });

        suggestion += `\nこの内容でよろしいですか？\n「はい」または修正があれば詳細をお聞かせください。`;

        return {
            type: 'personalized_suggestion',
            content: suggestion,
            reminderItems,
            profileCompleteness: profile.learning.profileCompleteness
        };
    }

    // パーソナライズされたリマインダー生成
    generatePersonalizedReminders(profile) {
        const reminders = [];

        // 場所ベース
        if (profile.preferences.preferredLocations.length > 0) {
            const location = profile.preferences.preferredLocations[0];
            reminders.push(`🌊 ${location}の海況・天気チェック`);
        } else {
            reminders.push(`🌊 海況・天気の最終確認`);
        }

        // 装備ベース
        if (profile.equipment.ownedEquipment.length > 0) {
            profile.equipment.ownedEquipment.slice(0, 2).forEach(equipment => {
                reminders.push(`🔧 ${equipment}の最終点検`);
            });
        } else {
            reminders.push(`🎒 レンタル機材の確認・受取`);
        }

        // 経験レベルベース
        switch (profile.diving.experienceLevel) {
            case 'beginner':
                reminders.push(`📚 基本的な安全確認事項の復習`);
                break;
            case 'intermediate':
                reminders.push(`📊 ダイビング計画の詳細確認`);
                break;
            case 'advanced':
            case 'professional':
                reminders.push(`🎯 高度なスキル実践の機会確認`);
                break;
            default:
                reminders.push(`⚠️ 安全確認事項のチェック`);
        }

        // 目標ベース
        if (profile.interests.currentGoals.length > 0) {
            const goal = profile.interests.currentGoals[0];
            reminders.push(`🎯 ${goal}に向けた今回の実践ポイント`);
        }

        // 体験談フォローアップ
        reminders.push(`📝 ダイビング後の体験談・感想収集`);

        return reminders;
    }
}

module.exports = UserProfileManager;