// Research Assistant Pro Backend Server
// Deploy this to Vercel, Railway, or any Node.js hosting platform

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fetch = require('node-fetch'); // npm install node-fetch

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['chrome-extension://*', 'https://your-frontend-domain.com'], // Add your domains
  credentials: true
}));
app.use(express.json());

// Configuration - Store these as environment variables
const CONFIG = {
  // Your API keys (store as environment variables in production)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-openai-key-here',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'your-anthropic-key-here',
  
  // Admin codes you can generate
  ADMIN_CODES: [
    'RA_ADMIN_2025_UNLIMITED',
    'DEMO_CODE_2025',
    // Add more codes as needed
  ],
  
  // Payment webhook secret (if using Stripe)
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  
  // Rate limiting
  MAX_REQUESTS_PER_DAY: 1000,
  
  // Model configurations
  MODELS: {
    'anthropic_sonnet': {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      endpoint: 'https://api.anthropic.com/v1/messages',
      maxTokens: 2000
    },
    'anthropic_opus': {
      provider: 'anthropic', 
      model: 'claude-opus-4-20250514',
      endpoint: 'https://api.anthropic.com/v1/messages',
      maxTokens: 4000
    },
    'openai_41': {
      provider: 'openai',
      model: 'gpt-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 4000
    },
    'openai_41_mini': {
      provider: 'openai',
      model: 'gpt-4.1-mini', 
      endpoint: 'https://api.openai.com/v1/chat/completions',
      maxTokens: 2000
    }
  }
};

// In-memory storage (use Redis or database in production)
const userSessions = new Map();
const proUsers = new Set(); // Store pro user IDs
const usageTracking = new Map(); // Track daily usage

// Routes

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    name: 'Research Assistant Pro API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      verifySubscription: '/api/verify-subscription',
      redeemCode: '/api/redeem-code',
      aiRequest: '/api/ai-request'
    },
    documentation: 'https://github.com/your-repo/AI-Research-Assistant',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Verify subscription status
app.post('/api/verify-subscription', (req, res) => {
  const { sessionToken, userPlan } = req.body;
  
  try {
    // Check if user has pro access
    if (sessionToken && userSessions.has(sessionToken)) {
      const userData = userSessions.get(sessionToken);
      
      res.json({
        plan: userData.plan,
        sessionToken: sessionToken,
        valid: userData.plan === 'pro',
        expiresAt: userData.expiresAt
      });
    } else {
      res.json({
        plan: 'free',
        sessionToken: null,
        valid: false
      });
    }
  } catch (error) {
    console.error('Subscription verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redeem code endpoint
app.post('/api/redeem-code', (req, res) => {
  const { code } = req.body;
  
  try {
    // Check if it's an admin code
    if (CONFIG.ADMIN_CODES.includes(code)) {
      const sessionToken = generateSessionToken();
      const userData = {
        plan: 'pro',
        codeUsed: code,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      };
      
      userSessions.set(sessionToken, userData);
      proUsers.add(sessionToken);
      
      res.json({
        success: true,
        plan: 'pro',
        sessionToken: sessionToken,
        message: 'Admin access granted successfully!'
      });
    } else {
      // Invalid code
      res.status(400).json({
        success: false,
        message: 'Invalid redeem code'
      });
    }
  } catch (error) {
    console.error('Code redemption error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI request endpoint
app.post('/api/ai-request', async (req, res) => {
  const { prompt, model, userPlan, sessionToken } = req.body;
  const authHeader = req.headers.authorization;
  
  try {
    // Verify pro access
    if (userPlan !== 'pro' || !sessionToken || !userSessions.has(sessionToken)) {
      return res.status(402).json({
        error: 'Pro subscription required',
        upgradeUrl: 'https://your-research-assistant-api.com/subscribe'
      });
    }
    
    // Check rate limiting
    const dailyUsage = usageTracking.get(sessionToken) || 0;
    if (dailyUsage >= CONFIG.MAX_REQUESTS_PER_DAY) {
      return res.status(429).json({
        error: 'Daily request limit exceeded'
      });
    }
    
    // Get model configuration
    const modelConfig = CONFIG.MODELS[model];
    if (!modelConfig) {
      return res.status(400).json({
        error: 'Invalid model specified'
      });
    }
    
    // Call AI API
    let aiResponse;
    if (modelConfig.provider === 'openai') {
      aiResponse = await callOpenAI(modelConfig, prompt);
    } else if (modelConfig.provider === 'anthropic') {
      aiResponse = await callAnthropic(modelConfig, prompt);
    } else {
      throw new Error('Unsupported AI provider');
    }
    
    // Track usage
    usageTracking.set(sessionToken, dailyUsage + 1);
    
    res.json({
      response: aiResponse,
      model: model,
      usage: dailyUsage + 1
    });
    
  } catch (error) {
    console.error('AI request error:', error);
    res.status(500).json({
      error: 'AI request failed: ' + error.message
    });
  }
});

// Payment webhook (example for Stripe)
app.post('/api/webhook/payment', express.raw({type: 'application/json'}), (req, res) => {
  // Implement payment webhook logic here
  // This would handle successful payments and grant pro access
  
  try {
    // Verify webhook signature
    // Grant pro access to user
    // Send confirmation email
    
    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Helper functions

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function callOpenAI(modelConfig, prompt) {
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful research assistant for academic writing. Provide clear, specific, and actionable advice to help improve academic papers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(modelConfig, prompt) {
  const response = await fetch(modelConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: modelConfig.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Clean up expired sessions daily
setInterval(() => {
  const now = new Date();
  for (const [token, userData] of userSessions.entries()) {
    if (userData.expiresAt && userData.expiresAt < now) {
      userSessions.delete(token);
      proUsers.delete(token);
      usageTracking.delete(token);
    }
  }
  
  // Reset daily usage counts
  usageTracking.clear();
}, 24 * 60 * 60 * 1000); // Every 24 hours

// Start server
app.listen(PORT, () => {
  console.log(`Research Assistant Pro backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Admin codes configured: ${CONFIG.ADMIN_CODES.length}`);
});

module.exports = app; 