document.addEventListener('DOMContentLoaded', () => {
    const aiAssistantButton = document.getElementById('ai-assistant-button');
    const aiAssistantModal = document.getElementById('ai-assistant-modal');
    const aiAssistantClose = document.getElementById('ai-assistant-close');
    const aiAssistantMessages = document.getElementById('ai-assistant-messages');
    const aiAssistantInput = document.getElementById('ai-assistant-input');
    const aiAssistantSend = document.getElementById('ai-assistant-send');

    let conversationHistory = [];
    let isProcessing = false;

    aiAssistantButton?.addEventListener('click', () => {
        aiAssistantModal.classList.add('show');
        aiAssistantInput.focus();
    });

    aiAssistantClose?.addEventListener('click', closeModal);
    aiAssistantModal?.addEventListener('click', (e) => {
        if (e.target === aiAssistantModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && aiAssistantModal.classList.contains('show')) {
            closeModal();
        }
    });

    function closeModal() {
        aiAssistantModal.classList.remove('show');
    }

    aiAssistantSend?.addEventListener('click', sendMessage);
    aiAssistantInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    async function sendMessage() {
        const message = aiAssistantInput.value.trim();
        if (!message || isProcessing) return;

        isProcessing = true;
        aiAssistantSend.disabled = true;
        aiAssistantInput.value = '';

        addMessage(message, 'user');

        const editorContent = document.getElementById('editor').innerHTML || '';
        const title = document.getElementById('title')?.value || '';
        const focusKeyword = document.getElementById('seo-focus-keyword-sidebar')?.value || '';

        let typingIndicator;
        try {
            
            typingIndicator = addTypingIndicator();

            const response = await fetch('/api/ai/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    context: {
                        content: editorContent,
                        title: title,
                        focusKeyword: focusKeyword
                    },
                    conversationHistory: conversationHistory.slice(-10) 
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Request failed with status ${response.status}`);
            }

            const data = await response.json();

            removeTypingIndicator(typingIndicator);

            if (data?.success && data.response) {
                addMessage(data.response, 'ai');

                conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: data.response }
                );
                if (conversationHistory.length > 12) {
                    conversationHistory = conversationHistory.slice(-12);
                }
            } else {
                const fallbackMessage = data?.error || 'Sorry, I encountered an error. Please try again.';
                addMessage(fallbackMessage, 'ai');
            }
        } catch (error) {
            console.error('AI Assistant Error:', error);
            removeTypingIndicator(typingIndicator);
            addMessage('Sorry, I\'m having trouble responding right now. Please try again in a moment.', 'ai');
        } finally {
            isProcessing = false;
            aiAssistantSend.disabled = false;
            aiAssistantInput.focus();
        }
    }

    function addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${sender}`;
        
        const avatar = document.createElement('div');
        avatar.className = `ai-message-avatar ${sender}`;
        avatar.innerHTML = `<span class="material-symbols-outlined">${sender === 'ai' ? 'psychology' : 'person'}</span>`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'ai-message-content';
        messageContent.innerHTML = formatMessage(content);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        aiAssistantMessages.appendChild(messageDiv);
        aiAssistantMessages.scrollTop = aiAssistantMessages.scrollHeight;
        
        return messageDiv;
    }

    function addTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message ai-typing';
        typingDiv.innerHTML = `
            <div class="ai-message-avatar ai">
                <span class="material-symbols-outlined">psychology</span>
            </div>
            <div class="ai-message-content">
                <div class="typing-animation">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        
        aiAssistantMessages.appendChild(typingDiv);
        aiAssistantMessages.scrollTop = aiAssistantMessages.scrollHeight;
        
        return typingDiv;
    }

    function removeTypingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        } else {
            
            const typingIndicators = aiAssistantMessages.querySelectorAll('.ai-typing');
            typingIndicators.forEach(indicator => indicator.remove());
        }
    }

    function formatMessage(content) {
        
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }
});

const typingCSS = `
.ai-typing .ai-message-content {
    padding: 1rem 1.25rem;
}

.typing-animation {
    display: flex;
    gap: 0.25rem;
    align-items: center;
}

.typing-animation span {
    width: 8px;
    height: 8px;
    background: #667eea;
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;
}

.typing-animation span:nth-child(2) {
    animation-delay: 0.2s;
}

.typing-animation span:nth-child(3) {
    animation-delay: 0.4s;
}

@keyframes typing {
    0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.6;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = typingCSS;
document.head.appendChild(styleSheet);
