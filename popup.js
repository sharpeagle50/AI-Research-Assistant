// Popup script for Research Assistant Pro
document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const planName = document.getElementById('planName');
    const planDetails = document.getElementById('planDetails');
    const statusIndicator = document.getElementById('statusIndicator');
    const loadingState = document.getElementById('loadingState');
    const freeUserContent = document.getElementById('freeUserContent');
    const proUserContent = document.getElementById('proUserContent');
    const statusMessage = document.getElementById('statusMessage');
    
    // Free user elements
    const upgradeBtn = document.getElementById('upgradeBtn');
    const redeemCode = document.getElementById('redeemCode');
    const redeemBtn = document.getElementById('redeemBtn');
    
    // Pro user elements
    const modelSelect = document.getElementById('modelSelect');
    const saveModelBtn = document.getElementById('saveModelBtn');
    const refreshStatusBtn = document.getElementById('refreshStatusBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let currentUserPlan = 'free';
    let currentModel = 'anthropic_sonnet';

    // Initialize popup
    init();

    async function init() {
        showLoading(true);
        await checkSubscriptionStatus();
        setupEventListeners();
        showLoading(false);
    }

    function setupEventListeners() {
        // Free user actions
        upgradeBtn?.addEventListener('click', handleUpgrade);
        redeemBtn?.addEventListener('click', handleRedeemCode);
        
        // Pro user actions
        saveModelBtn?.addEventListener('click', handleSaveModel);
        refreshStatusBtn?.addEventListener('click', handleRefreshStatus);
        logoutBtn?.addEventListener('click', handleLogout);
        
        // Model selection
        modelSelect?.addEventListener('change', function() {
            currentModel = this.value;
        });
        
        // Enter key for redeem code
        redeemCode?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleRedeemCode();
            }
        });
    }

    async function checkSubscriptionStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'getUserPlan' 
            });
            
            if (response) {
                currentUserPlan = response.plan;
                currentModel = response.model || 'anthropic_sonnet';
                updateUI();
            } else {
                // Fallback to verifying with backend
                await verifySubscription();
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            updateUI(); // Show as free user
        }
    }

    async function verifySubscription() {
        try {
            const response = await chrome.runtime.sendMessage({ 
                action: 'verifySubscription' 
            });
            
            if (response && response.status) {
                currentUserPlan = response.status.plan;
                updateUI();
            }
        } catch (error) {
            console.error('Error verifying subscription:', error);
            showStatus('Error verifying subscription status', 'error');
        }
    }

    function updateUI() {
        if (currentUserPlan === 'pro') {
            showProUser();
        } else {
            showFreeUser();
        }
    }

    function showFreeUser() {
        planName.textContent = 'Free Plan';
        planDetails.textContent = 'Upgrade to unlock AI features';
        statusIndicator.textContent = '🔴';
        
        freeUserContent.style.display = 'block';
        proUserContent.style.display = 'none';
    }

    function showProUser() {
        planName.textContent = 'Pro Plan';
        planDetails.textContent = 'Full access to all AI models';
        statusIndicator.textContent = '🟢';
        
        freeUserContent.style.display = 'none';
        proUserContent.style.display = 'block';
        
        // Set current model in dropdown
        if (modelSelect) {
            modelSelect.value = currentModel;
        }
    }

    function showLoading(show) {
        if (loadingState) {
            loadingState.style.display = show ? 'block' : 'none';
        }
        
        if (freeUserContent) {
            freeUserContent.style.display = show ? 'none' : (currentUserPlan === 'free' ? 'block' : 'none');
        }
        
        if (proUserContent) {
            proUserContent.style.display = show ? 'none' : (currentUserPlan === 'pro' ? 'block' : 'none');
        }
    }

    async function handleUpgrade() {
        // Open payment page in new tab
        const paymentUrl = 'https://your-research-assistant-api.com/subscribe'; // Replace with your payment URL
        
        try {
            await chrome.tabs.create({ url: paymentUrl });
            showStatus('Payment page opened. Complete subscription and refresh this popup.', 'success');
        } catch (error) {
            console.error('Error opening payment page:', error);
            showStatus('Error opening payment page. Please try again.', 'error');
        }
    }

    async function handleRedeemCode() {
        const code = redeemCode?.value?.trim();
        
        if (!code) {
            showStatus('Please enter a redeem code', 'error');
            return;
        }

        redeemBtn.disabled = true;
        redeemBtn.textContent = 'Redeeming...';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'redeemCode',
                code: code
            });

            if (response.result && response.result.success) {
                currentUserPlan = response.result.plan;
                showStatus(response.result.message || 'Code redeemed successfully!', 'success');
                
                // Clear the input
                if (redeemCode) {
                    redeemCode.value = '';
                }
                
                // Update UI after short delay
                setTimeout(() => {
                    updateUI();
                }, 1500);
                
            } else {
                throw new Error(response.error || 'Invalid redeem code');
            }
        } catch (error) {
            console.error('Redeem error:', error);
            showStatus(error.message || 'Failed to redeem code', 'error');
        } finally {
            redeemBtn.disabled = false;
            redeemBtn.textContent = 'Redeem Code';
        }
    }

    async function handleSaveModel() {
        if (!modelSelect) return;

        const selectedModel = modelSelect.value;
        saveModelBtn.disabled = true;
        saveModelBtn.textContent = 'Saving...';

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'updateModel',
                model: selectedModel
            });

            if (response.success) {
                currentModel = selectedModel;
                showStatus('Model selection saved!', 'success');
            } else {
                throw new Error('Failed to save model selection');
            }
        } catch (error) {
            console.error('Error saving model:', error);
            showStatus('Error saving model selection', 'error');
        } finally {
            saveModelBtn.disabled = false;
            saveModelBtn.textContent = 'Save Model Selection';
        }
    }

    async function handleRefreshStatus() {
        refreshStatusBtn.disabled = true;
        refreshStatusBtn.textContent = 'Refreshing...';
        
        showLoading(true);
        await verifySubscription();
        showLoading(false);
        
        refreshStatusBtn.disabled = false;
        refreshStatusBtn.textContent = 'Refresh Status';
        
        showStatus('Status refreshed', 'success');
    }

    async function handleLogout() {
        try {
            // Clear stored data
            await chrome.storage.sync.clear();
            
            // Reset to free user
            currentUserPlan = 'free';
            updateUI();
            
            showStatus('Logged out successfully', 'success');
        } catch (error) {
            console.error('Error logging out:', error);
            showStatus('Error logging out', 'error');
        }
    }

    function showStatus(message, type) {
        if (!statusMessage) return;
        
        statusMessage.textContent = message;
        statusMessage.className = `status ${type}`;
        statusMessage.style.display = 'block';
        
        // Hide after 4 seconds
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 4000);
    }

    // Helper function to get model display name
    function getModelDisplayName(modelKey) {
        const modelNames = {
            'anthropic_sonnet': 'Claude Sonnet 4',
            'anthropic_opus': 'Claude Opus 4', 
            'openai_41': 'GPT-4.1',
            'openai_41_mini': 'GPT-4.1 Mini'
        };
        return modelNames[modelKey] || modelKey;
    }

    // Auto-refresh subscription status every 30 seconds when popup is open
    setInterval(async () => {
        if (currentUserPlan === 'free') {
            await checkSubscriptionStatus();
        }
    }, 30000);
});