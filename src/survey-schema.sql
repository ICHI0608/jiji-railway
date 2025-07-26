-- 🌊 Jiji LINE Bot アンケートシステム データベーススキーマ
-- Dive Buddy's v2.8 対応

-- ユーザーアンケート基本情報テーブル
CREATE TABLE user_surveys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Q1: ダイビング経験レベル
    experience_level ENUM(
        'okinawa_experienced',      -- 沖縄で何度もダイビング経験あり
        'okinawa_few_times',       -- 沖縄で1-2回だけ経験
        'other_location_experienced', -- 他の場所でダイビング経験あり
        'complete_beginner',       -- ダイビング自体が初心者
        'skipped'                  -- 後で答える
    ) DEFAULT NULL,
    
    -- Q1.5: ライセンス種類
    license_type ENUM(
        'owd',                     -- オープンウォーター
        'aow_plus',               -- アドバンス以上
        'experience_only',        -- 体験ダイビングのみ
        'none',                   -- まだ持っていない
        'skipped'                 -- 後で答える
    ) DEFAULT NULL,
    
    -- Q2: 分岐質問の回答（JSONで柔軟に保存）
    q2_response JSON DEFAULT NULL,
    
    -- アンケート状態管理
    survey_completed BOOLEAN DEFAULT FALSE,
    current_question ENUM('q1', 'q1_5', 'q2', 'completed') DEFAULT 'q1',
    
    -- アンケート進行状況
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- 統計・分析用
    completion_time_seconds INT DEFAULT NULL,
    total_questions_answered INT DEFAULT 0,
    
    INDEX idx_user_id (user_id),
    INDEX idx_survey_status (survey_completed, completed_at),
    INDEX idx_experience_license (experience_level, license_type)
);

-- アンケート詳細回答履歴テーブル
CREATE TABLE survey_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    question_id VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    selected_option VARCHAR(100) NOT NULL,
    option_emoji VARCHAR(10) NOT NULL,
    option_text TEXT NOT NULL,
    
    -- 回答時の状況
    response_time_seconds DECIMAL(5,2) DEFAULT NULL,
    is_back_navigation BOOLEAN DEFAULT FALSE,
    is_skip BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_responses (user_id, question_id),
    INDEX idx_question_analytics (question_id, selected_option),
    
    FOREIGN KEY (user_id) REFERENCES user_surveys(user_id) ON DELETE CASCADE
);

-- アンケート分析・洞察テーブル
CREATE TABLE survey_insights (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    
    -- 分析結果
    user_segment VARCHAR(50) NOT NULL, -- 'experienced_diver', 'beginner', 'intermediate'
    primary_motivation VARCHAR(100) NOT NULL, -- 'safety', 'adventure', 'learning', 'relaxation'
    recommended_approach VARCHAR(100) NOT NULL, -- 'gradual_introduction', 'advanced_challenges'
    
    -- 予測・推薦
    likely_next_questions JSON DEFAULT NULL,
    recommended_conversation_style JSON DEFAULT NULL,
    priority_concerns JSON DEFAULT NULL,
    
    -- 信頼度スコア
    analysis_confidence DECIMAL(3,2) DEFAULT NULL, -- 0.00-1.00
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_insights (user_id),
    INDEX idx_segment_analysis (user_segment, primary_motivation),
    
    FOREIGN KEY (user_id) REFERENCES user_surveys(user_id) ON DELETE CASCADE
);

-- リッチメニュー利用統計テーブル
CREATE TABLE rich_menu_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    menu_action VARCHAR(50) NOT NULL, -- 'survey_start', 'survey_update', 'shop_db', etc.
    
    -- 利用状況
    access_count INT DEFAULT 1,
    first_access TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_access TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- ユーザー行動分析
    before_survey BOOLEAN DEFAULT TRUE,
    after_survey BOOLEAN DEFAULT FALSE,
    
    INDEX idx_user_menu_usage (user_id, menu_action),
    INDEX idx_menu_popularity (menu_action, access_count)
);

-- 初期データ投入（アンケート質問定義）
INSERT INTO survey_questions_master (question_id, question_text, question_type, options_json) VALUES
('q1', '🏝️ ダイビング経験はどのくらい？', 'single_choice', JSON_OBJECT(
    'okinawa_experienced', JSON_OBJECT('emoji', '🌊', 'text', '沖縄で何度もダイビング経験あり'),
    'okinawa_few_times', JSON_OBJECT('emoji', '🤿', 'text', '沖縄で1-2回だけ経験'),
    'other_location_experienced', JSON_OBJECT('emoji', '🏖️', 'text', '他の場所でダイビング経験あり（沖縄は未経験）'),
    'complete_beginner', JSON_OBJECT('emoji', '❓', 'text', 'ダイビング自体が初心者'),
    'skip', JSON_OBJECT('emoji', '⏭️', 'text', '後で答える')
)),
('q1_5', '🎫 ダイビングライセンスは？', 'single_choice', JSON_OBJECT(
    'owd', JSON_OBJECT('emoji', '🎫', 'text', 'オープンウォーター（OWD）'),
    'aow_plus', JSON_OBJECT('emoji', '🏆', 'text', 'アドバンス（AOW）以上'),
    'experience_only', JSON_OBJECT('emoji', '🔰', 'text', '体験ダイビングのみ'),
    'none', JSON_OBJECT('emoji', '❓', 'text', 'まだ持っていない'),
    'skip', JSON_OBJECT('emoji', '⏭️', 'text', '後で答える')
));

-- 質問マスターテーブル（管理用）
CREATE TABLE survey_questions_master (
    question_id VARCHAR(50) PRIMARY KEY,
    question_text TEXT NOT NULL,
    question_type ENUM('single_choice', 'multiple_choice', 'text_input') NOT NULL,
    options_json JSON DEFAULT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);