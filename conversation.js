// conversation.js - 会話管理クラス
class ConversationManager {
  constructor(maxHistoryLength = 10) {
    this.conversations = {}; // ユーザーIDをキーとした会話履歴の保存
    this.maxHistoryLength = maxHistoryLength; // 保持する最大メッセージ数
  }

  // 新しいメッセージを追加
  addMessage(userId, role, content) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }
    
    this.conversations[userId].push({ role, content });
    
    // 最大数を超えたら古いメッセージを削除
    if (this.conversations[userId].length > this.maxHistoryLength) {
      // システムメッセージは保持
      const systemMessages = this.conversations[userId].filter(msg => msg.role === 'system');
      const otherMessages = this.conversations[userId]
        .filter(msg => msg.role !== 'system')
        .slice(-(this.maxHistoryLength - systemMessages.length));
      
      this.conversations[userId] = [...systemMessages, ...otherMessages];
    }
  }

  // ユーザーの会話履歴を取得
  getConversation(userId) {
    return this.conversations[userId] || [];
  }

  // 会話をリセット (システムメッセージは保持)
  resetConversation(userId) {
    const systemMessages = this.conversations[userId]?.filter(msg => msg.role === 'system') || [];
    this.conversations[userId] = systemMessages;
  }

  // システムメッセージを設定
  setSystemMessage(userId, content) {
    // 既存のシステムメッセージを削除
    if (this.conversations[userId]) {
      this.conversations[userId] = this.conversations[userId].filter(msg => msg.role !== 'system');
    } else {
      this.conversations[userId] = [];
    }
    
    // 新しいシステムメッセージを先頭に追加
    this.conversations[userId].unshift({ role: 'system', content });
  }
}

module.exports = ConversationManager;