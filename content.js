// Main content script for Research Assistant Chrome Extension
class OverleafAIAssistant {
    constructor() {
      this.init();
      this.pendingAIRequests = new Map();
      this.activeEditPreviews = new Map();
    }
  
    init() {
      // Wait for Overleaf to fully load
      this.waitForOverleaf(() => {
        this.setupCommentInterception();
        this.injectAIResponseUI();
        console.log('Research Assistant initialized');
      });
    }
  
    waitForOverleaf(callback) {
      const checkForComments = () => {
        const commentPanel = document.querySelector('.review-panel');
        if (commentPanel) {
          callback();
        } else {
          setTimeout(checkForComments, 1000);
        }
      };
      checkForComments();
    }
  
    setupCommentInterception() {
      // Monitor for new comments being created
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check for comment submission
              this.checkForAICommentSubmission(node);
              // Check for new comment threads
              this.checkForNewComments(node);
            }
          });
        });
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
  
      // Also intercept existing comment submissions
      this.interceptCommentForms();
    }
  
    interceptCommentForms() {
      document.addEventListener('click', (e) => {
        if (e.target.matches('.comment-submit-btn, [data-ol-comment-submit]')) {
          this.handleCommentSubmission(e);
        }
      });
    }
  
    async handleCommentSubmission(event) {
      const commentTextarea = event.target.closest('.comment-form')?.querySelector('textarea');
      if (!commentTextarea) return;
  
      const commentText = commentTextarea.value;
      
      // Check if comment mentions AI assistant
      if (this.isAICommentRequest(commentText)) {
        event.preventDefault();
        event.stopPropagation();
        
        // Get highlighted text context
        const highlightedText = this.getHighlightedContext();
        
        // Process AI request
        await this.processAIRequest(commentText, highlightedText, commentTextarea);
      }
    }
  
    isAICommentRequest(text) {
      return /@ra\b|@researchassistant\b/i.test(text);
    }
  
    getHighlightedContext() {
      // Get the currently highlighted text from Overleaf editor
      const editorElement = document.querySelector('.ace_editor');
      if (!editorElement) return '';
  
      const aceEditor = window.ace?.edit(editorElement);
      if (!aceEditor) return '';
  
      const selectedText = aceEditor.getSelectedText();
      if (selectedText) return selectedText;
  
      // If no selection, get surrounding context
      const cursor = aceEditor.getCursorPosition();
      const session = aceEditor.getSession();
      const currentLine = session.getLine(cursor.row);
      
      return currentLine || '';
    }
  
    async processAIRequest(commentText, context, textareaElement) {
      try {
        // Show loading indicator
        this.showAIProcessingIndicator(textareaElement);
  
        // Extract AI command from comment
        const aiQuery = this.extractAIQuery(commentText);
        
        // Send to AI service
        const aiResponse = await this.callAIService({
          query: aiQuery,
          context: context,
          requestType: this.determineRequestType(aiQuery)
        });
  
        // Create AI response in comment thread
        await this.createAIResponse(aiResponse, textareaElement, context);
  
      } catch (error) {
        console.error('AI request failed:', error);
        this.showAIError(textareaElement, error.message);
      }
    }
  
    extractAIQuery(commentText) {
      // Remove @ra or @researchassistant and return the actual query
      return commentText.replace(/@ra\b|@researchassistant\b/gi, '').trim();
    }
  
    determineRequestType(query) {
      const lowerQuery = query.toLowerCase();
      
      if (lowerQuery.includes('edit') || lowerQuery.includes('rewrite') || lowerQuery.includes('improve')) {
        return 'edit';
      } else if (lowerQuery.includes('citation') || lowerQuery.includes('reference')) {
        return 'citation';
      } else if (lowerQuery.includes('methodology') || lowerQuery.includes('method')) {
        return 'methodology';
      } else {
        return 'general';
      }
    }
  
    async callAIService(request) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'processAIRequest',
          data: request
        }, (response) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });
    }
  
    async createAIResponse(aiResponse, originalTextarea, context) {
      // First, submit the original user comment
      await this.submitOriginalComment(originalTextarea);
      
      // Then add AI response to the comment thread
      setTimeout(() => {
        this.addAIResponseToThread(aiResponse, context);
      }, 500);
    }
  
    async submitOriginalComment(textareaElement) {
      // Find and click the submit button to create the original comment
      const submitBtn = textareaElement.closest('.comment-form')?.querySelector('.comment-submit-btn');
      if (submitBtn) {
        submitBtn.click();
      }
    }
  
    addAIResponseToThread(aiResponse, context) {
      // Find the most recently created comment thread
      const commentThreads = document.querySelectorAll('.comment-thread');
      const latestThread = commentThreads[commentThreads.length - 1];
      
      if (!latestThread) return;
  
      // Create AI response element
      const aiResponseElement = this.createAIResponseElement(aiResponse, context);
      
      // Add to comment thread
      latestThread.appendChild(aiResponseElement);
      
      // If AI suggested edits, show edit preview
      if (aiResponse.suggestedEdit) {
        this.showEditPreview(aiResponse.suggestedEdit, context, latestThread);
      }
    }
  
    createAIResponseElement(aiResponse, context) {
      const aiResponseDiv = document.createElement('div');
      aiResponseDiv.className = 'comment ai-comment';
      aiResponseDiv.innerHTML = `
        <div class="comment-header">
          <div class="comment-author ai-author">
            <span class="ai-avatar">🤖</span>
            <span class="author-name">Research Assistant</span>
          </div>
          <div class="comment-timestamp">just now</div>
        </div>
        <div class="comment-body">
          <div class="ai-response-content">${this.formatAIResponse(aiResponse.content)}</div>
          ${aiResponse.suggestedEdit ? this.createEditPreviewHTML(aiResponse.suggestedEdit) : ''}
        </div>
        <div class="comment-actions">
          <button class="ai-continue-btn" onclick="window.continueAIConversation(this)">Continue conversation</button>
        </div>
      `;
      
      return aiResponseDiv;
    }
  
    formatAIResponse(content) {
      // Format AI response with proper styling
      return content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    }
  
    createEditPreviewHTML(suggestedEdit) {
      return `
        <div class="ai-edit-preview">
          <div class="edit-preview-header">
            <span class="edit-icon">✏️</span>
            <span>Suggested Edit</span>
          </div>
          <div class="edit-preview-content">
            <div class="edit-before">
              <strong>Current:</strong>
              <div class="text-preview">${suggestedEdit.original}</div>
            </div>
            <div class="edit-after">
              <strong>Suggested:</strong>
              <div class="text-preview">${suggestedEdit.modified}</div>
            </div>
          </div>
          <div class="edit-preview-actions">
            <button class="accept-edit-btn" onclick="window.acceptAIEdit(this, '${suggestedEdit.id}')">
              Accept Edit
            </button>
            <button class="reject-edit-btn" onclick="window.rejectAIEdit(this, '${suggestedEdit.id}')">
              Decline
            </button>
          </div>
        </div>
      `;
    }
  
    showAIProcessingIndicator(textareaElement) {
      const indicator = document.createElement('div');
      indicator.className = 'ai-processing-indicator';
      indicator.innerHTML = `
        <div class="processing-spinner"></div>
        <span>Research Assistant is thinking...</span>
      `;
      
      textareaElement.closest('.comment-form').appendChild(indicator);
    }
  
    injectAIResponseUI() {
      // Add global functions for AI interactions
      window.continueAIConversation = (button) => {
        this.continueConversation(button);
      };
      
      window.acceptAIEdit = (button, editId) => {
        this.acceptEdit(button, editId);
      };
      
      window.rejectAIEdit = (button, editId) => {
        this.rejectEdit(button, editId);
      };
    }
  
    continueConversation(button) {
      // Show input field for follow-up question
      const commentThread = button.closest('.comment-thread');
      const followUpHTML = `
        <div class="ai-followup-input">
          <textarea placeholder="Ask a follow-up question..." class="followup-textarea"></textarea>
          <button class="send-followup-btn" onclick="window.sendFollowUp(this)">Send</button>
        </div>
      `;
      
      button.closest('.comment-actions').innerHTML = followUpHTML;
    }
  
    async acceptEdit(button, editId) {
      try {
        // Apply the edit to the Overleaf editor
        const edit = this.activeEditPreviews.get(editId);
        if (edit) {
          await this.applyEditToDocument(edit);
          button.closest('.ai-edit-preview').innerHTML = '<div class="edit-applied">✅ Edit applied successfully</div>';
        }
      } catch (error) {
        console.error('Failed to apply edit:', error);
      }
    }
  
    async applyEditToDocument(edit) {
      // Get Ace editor instance
      const editorElement = document.querySelector('.ace_editor');
      const aceEditor = window.ace?.edit(editorElement);
      
      if (!aceEditor) return;
  
      // Find and replace the text
      aceEditor.find(edit.original);
      aceEditor.replace(edit.modified);
    }
  
    rejectEdit(button, editId) {
      button.closest('.ai-edit-preview').innerHTML = '<div class="edit-rejected">❌ Edit declined</div>';
    }
  }
  
  // Initialize the assistant when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new OverleafAIAssistant();
    });
  } else {
    new OverleafAIAssistant();
  }