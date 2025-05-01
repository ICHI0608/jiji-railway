// data-manager.js - データ管理モジュール
const fs = require('fs');
const path = require('path');

class DataManager {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.divingSpots = [];
    this.faq = [];
    this.loadAllData();
  }

  // すべてのデータを読み込む
  loadAllData() {
    try {
      this.loadDivingSpots();
      this.loadFAQ();
      console.log('✅ すべてのデータを読み込みました');
    } catch (error) {
      console.error('❌ データ読み込みエラー:', error);
    }
  }

  // ダイビングスポット情報を読み込む
  loadDivingSpots() {
    try {
      const filePath = path.join(this.dataDir, 'diving-spots.json');
      const data = fs.readFileSync(filePath, 'utf8');
      this.divingSpots = JSON.parse(data);
      console.log(`✅ ${this.divingSpots.length}件のダイビングスポット情報を読み込みました`);
    } catch (error) {
      console.error('❌ ダイビングスポット読み込みエラー:', error);
      this.divingSpots = [];
    }
  }

  // FAQ情報を読み込む
  loadFAQ() {
    try {
      const filePath = path.join(this.dataDir, 'faq.json');
      const data = fs.readFileSync(filePath, 'utf8');
      this.faq = JSON.parse(data);
      console.log(`✅ ${this.faq.length}件のFAQ情報を読み込みました`);
    } catch (error) {
      console.error('❌ FAQ読み込みエラー:', error);
      this.faq = [];
    }
  }

  // すべてのダイビングスポットを取得
  getAllDivingSpots() {
    return this.divingSpots;
  }

  // 特定のダイビングスポットを取得
  getDivingSpotById(id) {
    return this.divingSpots.find(spot => spot.id === id);
  }

  // 条件に合うダイビングスポットを検索
  searchDivingSpots(query = {}) {
    let results = [...this.divingSpots];
    
    // 難易度でフィルタリング
    if (query.difficulty) {
      results = results.filter(spot => 
        spot.difficulty.includes(query.difficulty));
    }
    
    // エリアでフィルタリング
    if (query.location) {
      results = results.filter(spot => 
        spot.location.includes(query.location));
    }
    
    // 生物でフィルタリング
    if (query.marineLife) {
      results = results.filter(spot => 
        spot.marineLife.some(life => 
          life.includes(query.marineLife)));
    }
    
    return results;
  }

  // すべてのFAQを取得
  getAllFAQ() {
    return this.faq;
  }

  // カテゴリでFAQをフィルタリング
  getFAQByCategory(category) {
    return this.faq.filter(item => item.category === category);
  }

  // キーワードでFAQを検索
  searchFAQ(keyword) {
    return this.faq.filter(item => 
      item.question.includes(keyword) || 
      item.answer.includes(keyword) ||
      item.keywords.some(k => k.includes(keyword)));
  }
}

module.exports = DataManager;