# 🚀 Phase 1: Google Cloud Setup & Data Migration

## 📋 Implementation Steps

### **Step 1: Google Cloud Service Account Setup**
```bash
# Display setup instructions
npm run setup-auth
```

Follow the displayed instructions to:
1. Create Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account with "Editor" role
4. Download JSON credentials file

### **Step 2: Configure Local Environment**
```bash
# After downloading credentials, run:
mkdir credentials
# Move your downloaded JSON file to credentials/google-service-account.json
npm run setup-auth -- --configure
```

This will:
- Create `.env` file with proper configuration
- Set up environment variables
- Prepare for Google Sheets integration

### **Step 3: Create Google Sheets & Migrate Data**
```bash
# Create spreadsheet and migrate 79 shops data
npm run setup-sheets
```

This will:
- Create new Google Sheet with 34-column structure
- Parse CSV data (79 shops)
- Convert to target format with proper data types
- Migrate all data to Google Sheets
- Update `.env` with spreadsheet ID

### **Step 4: Test Connection**
```bash
# Test Google Sheets connection
npm run test-sheets

# Test with feature demonstration
npm run test-sheets -- --demo
```

### **Step 5: Test Complete System**
```bash
# Test emotional matching with real data
npm run test-matching
```

## 🎯 **Expected Results**

After completing Phase 1, you will have:

### ✅ **Google Cloud Setup**
- Service account with proper permissions
- Google Sheets API enabled
- Local authentication configured

### ✅ **Data Infrastructure**
- 79 shops migrated to Google Sheets
- 34-column data structure implemented
- All data properly formatted and typed

### ✅ **System Integration**
- Google Sheets API fully functional
- CSV data successfully imported
- Connection tested and verified

## 📊 **Data Structure Overview**

### **34-Column Schema**
```
Basic Info (6): shop_id, shop_name, area, phone_line, website, operating_hours
Service (5): fun_dive_available, trial_dive_options, max_group_size, etc.
Pricing (5): fun_dive_price_2tanks, equipment_rental_included, etc.
Safety (5): safety_equipment, insurance_coverage, etc.
Features (5): beginner_friendly, solo_welcome, etc.
Specialty (3): speciality_areas, certification_level, experience_years
Ratings (5): customer_rating, review_count, jiji_grade, etc.
```

### **Sample Data After Migration**
- **石垣島**: 25+ shops with マンタ specialties
- **宮古島**: 20+ shops with 地形ダイビング
- **慶良間**: 15+ shops with ウミガメ encounters
- **本島**: 19+ shops with various specialties

## 🔄 **Next Steps After Phase 1**

### **Ready for Phase 2:**
1. **API Integration**: Connect Google Sheets to emotional matching
2. **Web Interface**: Integrate with existing website
3. **Real-time Matching**: Enable live shop recommendations
4. **User Profiles**: Add user data storage

### **Commands for Phase 2:**
```bash
# Start development server
npm run dev

# Test emotional matching with real data
npm run test-matching

# Monitor system performance
npm run debug
```

## 🛠️ **Troubleshooting**

### **Common Issues:**
1. **Authentication Error**: Check credentials file path
2. **API Quota**: Verify Google Sheets API is enabled
3. **Permission Error**: Ensure service account has Editor role
4. **Data Format**: CSV parsing might need adjustment

### **Debug Commands:**
```bash
# Check environment configuration
node -e "console.log(require('dotenv').config())"

# Test authentication only
node -e "const auth = require('./setup-google-auth.js'); auth.configureEnvironment()"

# Validate CSV data
node -e "const csv = require('./migrate-csv-data.js'); new csv().parseCSV()"
```

---

## 🎉 **Success Indicators**

You'll know Phase 1 is complete when:
- ✅ Google Sheet is created with 79 shops
- ✅ All 34 columns are properly formatted
- ✅ Connection test passes all checks
- ✅ Emotional matching works with real data
- ✅ System is ready for Phase 2 integration

**Time Estimate**: 2-3 hours for complete setup
**Next Phase**: API Integration & Web Interface