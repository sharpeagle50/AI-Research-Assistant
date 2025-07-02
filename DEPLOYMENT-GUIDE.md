# Research Assistant Pro - Deployment Guide

## 🏗️ Architecture Overview

Your Chrome extension now uses a **monetized backend architecture**:

```
User → Chrome Extension → Your Backend Server → AI APIs (with your keys)
```

## 📋 Features Implemented

✅ **$250/month Pro Plan**  
✅ **Admin Redeem Code**: `RA_ADMIN_2025_UNLIMITED` (for your personal use)  
✅ **Secure API Key Storage** (on your backend)  
✅ **Rate Limiting** (1000 requests/day per user)  
✅ **Multiple AI Models** (GPT-4.1, Claude Sonnet 4, Claude Opus 4)  

---

## 🚀 Backend Deployment

### Step 1: Choose a Hosting Platform

**Recommended Options:**
- **Railway** (easiest): https://railway.app
- **Vercel** (serverless): https://vercel.com
- **Render** (simple): https://render.com

### Step 2: Deploy Backend Server

1. **Create new folder for backend:**
```bash
mkdir research-assistant-backend
cd research-assistant-backend
```

2. **Copy these files to the backend folder:**
   - `backend-server-template.js` → rename to `server.js`
   - `backend-package.json` → rename to `package.json`

3. **Install dependencies:**
```bash
npm install
```

4. **Set environment variables** (in your hosting platform):
```
OPENAI_API_KEY=your-actual-openai-key
ANTHROPIC_API_KEY=your-actual-anthropic-key
NODE_ENV=production
```

5. **Deploy to your chosen platform**

### Step 3: Update Extension Configuration

In `background.js`, update the `BACKEND_URL`:
```javascript
BACKEND_URL: 'https://your-deployed-backend.railway.app', // Replace with your actual URL
```

---

## 🔧 Chrome Extension Setup

### Step 1: Final Extension Preparation

1. **Update background.js** with your backend URL
2. **Ensure all API keys are removed** from the code
3. **Test the admin redeem code**: `RA_ADMIN_2025_UNLIMITED`

### Step 2: Load Extension for Testing

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select your extension folder

### Step 3: Test Your Setup

1. **Click extension icon** → Should show "Free Plan"
2. **Enter redeem code**: `RA_ADMIN_2025_UNLIMITED`
3. **Verify Pro access** → Should show "Pro Plan" with model selection
4. **Test on Overleaf** → Comment with `@ra test message`

---

## 💰 Monetization Setup

### Option 1: Simple Payment Page

Create a basic payment page that redirects users to:
- **Stripe Checkout**
- **PayPal**
- **Manual payment processing**

### Option 2: Integrate Payment API

Modify the backend to handle Stripe webhooks for automatic subscription management.

---

## 🔑 Admin Features

### Your Admin Code
- **Code**: `RA_ADMIN_2025_UNLIMITED`
- **Grants**: Full Pro access for 1 year
- **Usage**: Enter in extension popup → instant Pro access

### Generate More Codes
Add more codes to the backend `CONFIG.ADMIN_CODES` array:
```javascript
ADMIN_CODES: [
  'RA_ADMIN_2025_UNLIMITED',
  'DEMO_CODE_2025',
  'BETA_USER_001',
  // Add more as needed
]
```

---

## 📊 Usage Analytics

The backend tracks:
- **Daily request counts** per user
- **Model usage** statistics  
- **Session duration**
- **Rate limiting** enforcement

---

## 🔒 Security Features

✅ **API keys** stored securely on backend  
✅ **Session tokens** for user authentication  
✅ **Rate limiting** to prevent abuse  
✅ **CORS protection** for extension origin  
✅ **Input validation** for all requests  

---

## 🌟 User Experience Flow

### Free Users:
1. Install extension
2. See "Free Plan" status
3. Prompted to upgrade for $250/month
4. Can redeem codes if available

### Pro Users:
1. Pay $250/month OR redeem admin code
2. Get full access to all AI models
3. 1000 requests per day limit
4. Model selection in popup

### Admin (You):
1. Use redeem code: `RA_ADMIN_2025_UNLIMITED`
2. Instant Pro access
3. Unlimited usage
4. All models available

---

## 🚨 Important Security Notes

1. **Never commit API keys** to git repositories
2. **Use environment variables** for all secrets
3. **Rotate admin codes** periodically
4. **Monitor usage** to prevent abuse
5. **Set up proper CORS** headers

---

## 📈 Scaling Considerations

### For Higher Usage:
- **Database**: Replace in-memory storage with Redis/PostgreSQL
- **CDN**: Use CloudFlare for global distribution
- **Load Balancing**: Multiple server instances
- **Monitoring**: Add logging and analytics

### Revenue Optimization:
- **Multiple Plans**: Basic ($99), Pro ($250), Enterprise ($500)
- **Usage Tiers**: Different request limits
- **Academic Discounts**: Student pricing
- **Team Plans**: Multi-user subscriptions

---

## 🎯 Next Steps

1. **Deploy backend server**
2. **Update extension with backend URL** 
3. **Test admin redeem code**
4. **Set up payment processing**
5. **Launch to Chrome Web Store**

Your extension is now ready for **production use** with a **sustainable monetization model**! 🚀 