document.addEventListener('DOMContentLoaded', () => {
    
    return;

    const chatBotHtml = `
        <div class="chat-bot-container" style="display: none !important;">
            <button class="chat-bot-toggle" id="chatBotToggle">
                <span class="material-symbols-outlined">smart_toy</span>
            </button>
            <div class="chat-bot-window" id="chatBotWindow">
                <div class="chat-bot-header">
                    <div>
                        <div style="font-weight: 600;">AI Writing Assistant</div>
                        <div style="font-size: 12px; opacity: 0.9;">Ask me anything about your content</div>
                    </div>
                    <button class="chat-bot-close" id="chatBotClose" style="background: none; border: none; color: white; cursor: pointer;">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="chat-bot-messages" id="chatBotMessages"></div>
                <div class="chat-bot-input-area">
                    <input 
                        type="text" 
                        class="chat-bot-input" 
                        id="chatBotInput" 
                        placeholder="Type your question here..."
                        maxlength="200"
                    >
                    <button class="chat-bot-send" id="chatBotSend">
                        <span class="material-symbols-outlined">send</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatBotHtml);

    const chatBotToggle = document.getElementById('chatBotToggle');
    const chatBotWindow = document.getElementById('chatBotWindow');
    const chatBotClose = document.getElementById('chatBotClose');
    const chatBotMessages = document.getElementById('chatBotMessages');
    const chatBotInput = document.getElementById('chatBotInput');
    const chatBotSend = document.getElementById('chatBotSend');

    let isOpen = false;
    let chatHistory = JSON.parse(localStorage.getItem('ai-chat-history') || '[]');

    function saveChatHistory() {
        localStorage.setItem('ai-chat-history', JSON.stringify(chatHistory));
    }

    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isUser ? 'user' : 'bot'}`;
        messageDiv.textContent = message;
        
        chatBotMessages.appendChild(messageDiv);
        chatBotMessages.scrollTop = chatBotMessages.scrollHeight;

        chatHistory.push({ message, isUser, timestamp: Date.now() });
        if (chatHistory.length > 50) { 
            chatHistory = chatHistory.slice(-50);
        }
        saveChatHistory();
    }

    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.id = 'typingIndicator';
        typingDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatBotMessages.appendChild(typingDiv);
        chatBotMessages.scrollTop = chatBotMessages.scrollHeight;
        return typingDiv;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function loadChatHistory() {
        chatBotMessages.innerHTML = '';
        if (chatHistory.length === 0) {
            
        } else {
            chatHistory.forEach(chat => {
                addMessage(chat.message, chat.isUser);
            });
        }
    }

    async function sendMessage() {
        const message = chatBotInput.value.trim();
        if (!message) return;

        addMessage(message, true);
        chatBotInput.value = '';
        chatBotSend.disabled = true;

        const typingIndicator = addTypingIndicator();

        try {
            const editor = document.getElementById('editor');
            const context = editor ? editor.innerText.substring(0, 1000) : '';
            
            const response = await window.editorUtils.callAi('/api/ai/chat', {
                message: message,
                context: context,
                history: chatHistory.slice(-10) 
            });

            removeTypingIndicator();
            addMessage(response.reply || 'Sorry, I could not process your request.', false);
        } catch (error) {
            removeTypingIndicator();
            addMessage('Sorry, I encountered an error. Please try again.', false);
            console.error('Chat error:', error);
        } finally {
            chatBotSend.disabled = false;
        }
    }

    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            chatBotWindow.style.display = 'flex';
            loadChatHistory();
            chatBotInput.focus();
            chatBotToggle.innerHTML = '<span class="material-symbols-outlined">close</span>';
        } else {
            chatBotWindow.style.display = 'none';
            chatBotToggle.innerHTML = '<span class="material-symbols-outlined">smart_toy</span>';
        }
    }

    chatBotToggle.addEventListener('click', toggleChat);
    chatBotClose.addEventListener('click', toggleChat);
    chatBotSend.addEventListener('click', sendMessage);
    
    chatBotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatBotMessages.addEventListener('dblclick', () => {
        if (confirm('Clear chat history?')) {
            chatHistory = [];
            saveChatHistory();
            loadChatHistory();
        }
    });

    chatBotInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
});