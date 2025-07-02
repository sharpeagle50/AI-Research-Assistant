// Background script for Research Assistant with Payment System
// Your API keys are stored securely on your backend server

const CONFIG = {
  // Your backend server endpoints
  BACKEND_URL: 'https://your-research-assistant-api.com', // Replace with your actual domain
  ENDPOINTS: {
    verifySubscription: '/api/verify-subscription',
    redeemCode: '/api/redeem-code',
    aiRequest: '/api/ai-request'
  },
  
  // Subscription plans
  PLANS: {
    FREE: 'free',
    PRO: 'pro'
  },
  
  // Model configurations (processed on your backend)
  MODELS: {
    anthropic_sonnet: {
      model: 'claude-sonnet-4-20250514',
      displayName: 'Claude Sonnet 4',
      maxTokens: 2000,
      temperature: 0.3
    },
    anthropic_opus: {
      model: 'claude-opus-4-20250514',
      displayName: 'Claude Opus 4',
      maxTokens: 4000,
      temperature: 0.3
    },
    openai_41: {
      model: 'gpt-4.1',
      displayName: 'GPT-4.1',
      maxTokens: 4000,
      temperature: 0.3
    },
    openai_41_mini: {
      model: 'gpt-4.1-mini',
      displayName: 'GPT-4.1 Mini',
      maxTokens: 2000,
      temperature: 0.3
    }
  },
  
  DEFAULT_MODEL: 'anthropic_sonnet',
  
  // Admin redeem code (you can change this)
  ADMIN_CODE: 'RA_ADMIN_2025_UNLIMITED'
};

class AIServiceHandler {
  constructor() {
    this.setupMessageListener();
    this.currentModel = CONFIG.DEFAULT_MODEL;
    this.userPlan = CONFIG.PLANS.FREE;
    this.sessionToken = null;
    this.loadUserData();
    console.log('Research Assistant Pro initialized');
  }

  async loadUserData() {
    try {
      const result = await chrome.storage.sync.get(['userPlan', 'sessionToken', 'selectedModel', 'redeemCode']);
      
      if (result.userPlan) {
        this.userPlan = result.userPlan;
      }
      
      if (result.sessionToken) {
        this.sessionToken = result.sessionToken;
      }
      
      if (result.selectedModel) {
        this.currentModel = result.selectedModel;
      }
      
      if (result.redeemCode === CONFIG.ADMIN_CODE) {
        this.userPlan = CONFIG.PLANS.PRO;
        console.log('Admin access granted');
      }
      
      // Verify subscription status on startup
      await this.verifySubscription();
      
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Background received message:', request.action);
      
      if (request.action === 'processAIRequest') {
        this.handleAIRequest(request.data)
          .then(response => {
            console.log('AI request successful');
            sendResponse({ data: response });
          })
          .catch(error => {
            console.error('AI Request Error:', error);
            sendResponse({ error: error.message });
          });
        return true;
      }
      
      if (request.action === 'verifySubscription') {
        this.verifySubscription()
          .then(status => sendResponse({ status }))
          .catch(error => sendResponse({ error: error.message }));
        return true;
      }
      
      if (request.action === 'redeemCode') {
        this.redeemCode(request.code)
          .then(result => sendResponse({ result }))
          .catch(error => sendResponse({ error: error.message }));
        return true;
      }
      
      if (request.action === 'getUserPlan') {
        sendResponse({ plan: this.userPlan, model: this.currentModel });
        return true;
      }
      
      if (request.action === 'updateModel') {
        this.currentModel = request.model;
        chrome.storage.sync.set({ selectedModel: request.model });
        sendResponse({ success: true });
        return true;
      }
    });
  }

  async handleAIRequest(requestData) {
    // Check subscription status first
    if (this.userPlan !== CONFIG.PLANS.PRO) {
      throw new Error('Pro subscription required. Please upgrade to continue using the Research Assistant.');
    }

    const { query, context, requestType } = requestData;
    
    console.log('Processing AI request:', { 
      query: query.substring(0, 50) + '...', 
      context: context.substring(0, 50) + '...', 
      requestType,
      model: this.currentModel,
      plan: this.userPlan
    });
    
    // Build the AI prompt
    const prompt = this.buildPrompt(query, context, requestType);
    
    // Call your backend API (which uses your API keys)
    const response = await this.callBackendAPI(prompt);
    
    // Process and format response
    return this.processAIResponse(response, requestType, context);
  }

  async callBackendAPI(prompt) {
    const endpoint = `${CONFIG.BACKEND_URL}${CONFIG.ENDPOINTS.aiRequest}`;
    
    const requestBody = {
      prompt: prompt,
      model: this.currentModel,
      userPlan: this.userPlan,
      sessionToken: this.sessionToken
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': '1.0',
        'Authorization': this.sessionToken ? `Bearer ${this.sessionToken}` : ''
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 402) {
        throw new Error('Payment required. Please upgrade to Pro plan.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please verify your subscription.');
      } else {
        throw new Error(`AI request failed: ${errorData.message || response.statusText}`);
      }
    }

    const data = await response.json();
    return data.response;
  }

  async verifySubscription() {
    try {
      const endpoint = `${CONFIG.BACKEND_URL}${CONFIG.ENDPOINTS.verifySubscription}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionToken: this.sessionToken,
          userPlan: this.userPlan
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.userPlan = data.plan;
        this.sessionToken = data.sessionToken;
        
        await chrome.storage.sync.set({
          userPlan: this.userPlan,
          sessionToken: this.sessionToken
        });
        
        return { plan: this.userPlan, valid: true };
      } else {
        this.userPlan = CONFIG.PLANS.FREE;
        await chrome.storage.sync.set({ userPlan: CONFIG.PLANS.FREE });
        return { plan: CONFIG.PLANS.FREE, valid: false };
      }
    } catch (error) {
      console.error('Subscription verification failed:', error);
      this.userPlan = CONFIG.PLANS.FREE;
      return { plan: CONFIG.PLANS.FREE, valid: false };
    }
  }

  async redeemCode(code) {
    try {
      // Check for admin code first
      if (code === CONFIG.ADMIN_CODE) {
        this.userPlan = CONFIG.PLANS.PRO;
        await chrome.storage.sync.set({ 
          userPlan: CONFIG.PLANS.PRO,
          redeemCode: code 
        });
        console.log('Admin code redeemed successfully');
        return { success: true, plan: CONFIG.PLANS.PRO, message: 'Admin access granted!' };
      }

      // Otherwise, verify with backend
      const endpoint = `${CONFIG.BACKEND_URL}${CONFIG.ENDPOINTS.redeemCode}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        const data = await response.json();
        this.userPlan = data.plan;
        this.sessionToken = data.sessionToken;
        
        await chrome.storage.sync.set({
          userPlan: this.userPlan,
          sessionToken: this.sessionToken,
          redeemCode: code
        });
        
        return { success: true, plan: this.userPlan, message: data.message };
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Invalid redeem code');
      }
    } catch (error) {
      console.error('Code redemption failed:', error);
      throw error;
    }
  }

  buildPrompt(query, context, requestType) {
    let basePrompt = `You are a Research Assistant helping with academic paper writing. `;
    
    if (context && context.trim()) {
      basePrompt += `The user has highlighted this text from their paper: "${context.trim()}"

`;
    }

    basePrompt += `User's request: ${query}

`;

    switch (requestType) {
      case 'edit':
        return basePrompt + `Please provide specific suggestions to improve this text. If you suggest concrete edits, format your response as:

EXPLANATION: [Your explanation of what should be improved and why]

EDIT_ORIGINAL: [The exact original text to be replaced]
EDIT_MODIFIED: [Your improved version]

If you're providing general advice rather than specific edits, just provide your helpful suggestions without the EDIT format.`;

      case 'citation':
        return basePrompt + `Please help with citations or references for this text. You can:
1. Suggest what types of sources would support this claim
2. Recommend specific search terms for finding relevant papers
3. Identify areas that need citation support
4. Suggest citation styles or formats if relevant

Focus on being helpful and specific about citation needs.`;

      case 'methodology':
        return basePrompt + `Please analyze this methodology section and provide suggestions for improvement. Consider:
1. Potential issues or gaps in the methodology
2. Missing elements that should be addressed
3. Ways to strengthen the research design
4. Clarity and completeness of the methodological description

Provide constructive, specific feedback.`;

      case 'language':
        return basePrompt + `Please help improve the language, grammar, and clarity of this text. Focus on:
1. Grammar and syntax corrections
2. Clarity and readability improvements
3. Academic writing style enhancements
4. Word choice and flow improvements

If you suggest specific edits, use the EDIT format described above.`;

      case 'followup':
        return basePrompt + `This is a follow-up question in an ongoing conversation. Please provide a helpful response that continues the discussion.`;

      default:
        return basePrompt + `Please provide helpful academic writing assistance for this text. Consider what type of help would be most useful and provide specific, actionable advice.`;
    }
  }

  processAIResponse(rawResponse, requestType, originalContext) {
    const response = {
      content: rawResponse,
      suggestedEdit: null
    };

    // Check if response contains edit suggestions
    const editMatch = rawResponse.match(/EDIT_ORIGINAL:\s*(.*?)\s*EDIT_MODIFIED:\s*(.*?)(?=\n\n|\n[A-Z]|$)/s);
    
    if (editMatch) {
      const original = editMatch[1].trim();
      const modified = editMatch[2].trim();
      
      if (original && modified && original !== modified) {
        response.suggestedEdit = {
          id: this.generateEditId(),
          original: original,
          modified: modified
        };

        response.content = rawResponse
          .replace(/EDIT_ORIGINAL:.*?EDIT_MODIFIED:.*?(?=\n\n|\n[A-Z]|$)/s, '')
          .replace(/EXPLANATION:\s*/i, '')
          .trim();
      }
    }

    if (!response.content.trim()) {
      response.content = rawResponse;
    }

    return response;
  }

  generateEditId() {
    return 'edit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// Initialize the background service
console.log('Initializing Research Assistant Pro...');
const aiServiceHandler = new AIServiceHandler();