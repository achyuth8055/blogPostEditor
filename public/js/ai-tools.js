document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');

    async function runAiCheck(toolId, options = {}) {
        
        let resultContainer = document.getElementById(`${toolId}-result`);
        const toolType = toolId.replace('ai-', '');
        const dropdownContainer = document.getElementById(`ai-${toolType}-dropdown`);

        if (dropdownContainer && ['plagiarism', 'readability'].includes(toolType)) {
            resultContainer = dropdownContainer.querySelector(`#${toolId}-result`);
        }
        
        const button = document.getElementById(toolId);
        const checkAgainButton = document.getElementById(`${toolType}-check-again`);

        if (!resultContainer || !button || !editor) return;

        resultContainer.innerHTML = "";
        resultContainer.classList.remove("hidden");
        button.disabled = true;

        if (checkAgainButton) {
            checkAgainButton.disabled = true;
        }

        const originalButtonContent = button.innerHTML;
        button.innerHTML = `
            <span class="material-symbols-outlined animate-spin text-gray-500">progress_activity</span>
            <span class="text-sm">Analyzing...</span>
        `;

        let originalCheckAgainContent = '';
        if (checkAgainButton) {
            originalCheckAgainContent = checkAgainButton.innerHTML;
            checkAgainButton.innerHTML = `
                <span class="material-symbols-outlined animate-spin">progress_activity</span>
                <span>Checking...</span>
            `;
        }

        const loader = document.createElement("div");
        loader.className = "flex items-center justify-center py-4";
        loader.innerHTML = `
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
            <span class="text-sm text-gray-600">Processing with AI...</span>
        `;
        resultContainer.appendChild(loader);

        try {
            let result;
            const content = editor.innerText.trim();
            
            if (!content) {
                throw new Error('Please write some content first.');
            }

            switch (toolId) {
                case 'ai-plagiarism':
                    result = await window.editorUtils.callAi('/api/ai/plagiarism', { content });
                    break;
                case 'ai-keywords':
                    if (options.keywords) {
                        result = await window.editorUtils.callAi('/api/ai/keywords', { content, keywords: options.keywords });
                    }
                    break;
                case 'ai-readability':
                    
                    if (window.seoTools) {
                        result = await window.seoTools.getFleschReadingEase();
                    } else {
                        result = await window.editorUtils.callAi('/api/ai/readability', { content });
                    }
                    break;
                default:
                    throw new Error('Unknown AI tool');
            }

            loader.remove();
            
            if (toolId === 'ai-plagiarism') {
                const score = result.score || 0;
                const scoreColor = score < 20 ? 'text-green-600' : score < 50 ? 'text-yellow-600' : 'text-red-600';
                
                resultContainer.innerHTML = `
                    <div class="text-center mb-2">
                        <span class="text-2xl font-bold ${scoreColor}">${score}%</span>
                        <p class="text-xs text-gray-600">Similarity Score</p>
                    </div>
                    <div class="bg-gray-50 p-2 rounded text-xs">
                        <p>${result.summary || 'Content appears to be original.'}</p>
                    </div>
                `;
                
                if (result.sources && result.sources.length > 0) {
                    const sourcesDiv = document.createElement('div');
                    sourcesDiv.className = 'mt-2';
                    sourcesDiv.innerHTML = '<p class="text-xs font-medium mb-1">Similar Sources:</p>';
                    result.sources.slice(0, 3).forEach(source => {
                        const sourceItem = document.createElement('div');
                        sourceItem.className = 'text-xs text-blue-600 mb-1';
                        sourceItem.textContent = `${source.url || 'Unknown'} (${source.similarity || 0}%)`;
                        sourcesDiv.appendChild(sourceItem);
                    });
                    resultContainer.appendChild(sourcesDiv);
                }
            } else if (toolId === 'ai-keywords') {
                const score = result.score || 0;
                const found = result.foundKeywords || [];
                const missing = result.missingKeywords || [];
                
                resultContainer.innerHTML = `
                    <div class="text-center mb-2">
                        <span class="text-lg font-bold text-blue-600">${score}%</span>
                        <p class="text-xs text-gray-600">Keywords Found</p>
                    </div>
                    <div class="text-xs">
                        ${found.length > 0 ? `<p class="text-green-600 mb-1">✓ Found: ${found.join(', ')}</p>` : ''}
                        ${missing.length > 0 ? `<p class="text-red-600">✗ Missing: ${missing.join(', ')}</p>` : ''}
                    </div>
                `;
            } else if (toolId === 'ai-readability') {
                const score = result.score || 0;
                const grade = result.grade || 'Unknown';

                let scoreColor = 'text-red-600';
                if (score >= 70) scoreColor = 'text-green-600';
                else if (score >= 60) scoreColor = 'text-yellow-600';
                else if (score >= 30) scoreColor = 'text-orange-600';
                
                resultContainer.innerHTML = `
                    <div class="text-center mb-2">
                        <span class="text-lg font-bold ${scoreColor}">${score.toFixed ? score.toFixed(1) : score}</span>
                        <p class="text-xs text-gray-600">Flesch Reading Ease</p>
                    </div>
                    <div class="text-xs text-center">
                        <p class="text-gray-600">Reading Level: <span class="font-medium">${grade}</span></p>
                    </div>
                    <div class="bg-gray-50 p-2 rounded text-xs mt-2">
                        <div class="grid grid-cols-2 gap-2">
                            <p>Words: ${result.wordCount || 0}</p>
                            <p>Sentences: ${result.sentenceCount || 0}</p>
                            <p>Avg/Sentence: ${result.avgWordsPerSentence || 0}</p>
                            <p>Syllables/Word: ${result.avgSyllablesPerWord || 0}</p>
                        </div>
                    </div>
                    ${result.error ? `<div class="text-red-500 text-xs mt-1">Note: ${result.error}</div>` : ''}
                `;
            }

            if (['plagiarism', 'readability'].includes(toolType)) {
                showDropdownResult(toolType);
                
                setTimeout(() => {
                    resultContainer.classList.add('result-highlight');
                    setTimeout(() => {
                        resultContainer.classList.remove('result-highlight');
                    }, 2000);
                }, 100);
            }

        } catch (error) {
            console.error('AI Check error:', error);
            loader.remove();
            resultContainer.innerHTML = `<div class="text-red-600 text-sm p-2 border border-red-200 rounded">❌ Error: ${error.message}</div>`;

            if (['plagiarism', 'readability'].includes(toolType)) {
                showDropdownResult(toolType);
            }
        } finally {
            button.disabled = false;
            button.innerHTML = originalButtonContent;

            if (checkAgainButton) {
                checkAgainButton.disabled = false;
                checkAgainButton.innerHTML = originalCheckAgainContent;
            }
        }
    }

    document.getElementById("ai-format")?.addEventListener("click", async (e) => {
        e.preventDefault();
        if (!editor.innerText.trim()) {
            window.editorUtils?.flash("Write something first to format!");
            return;
        }

        const loadingModal = document.getElementById("formatLoadingModal");
        const statusText = document.getElementById("formatStatusText");
        loadingModal.style.display = 'flex';

        const statusMessages = [
            "Analyzing content structure...",
            "Optimizing formatting...",
            "Enhancing readability...",
            "Applying AI improvements...",
            "Finalizing changes..."
        ];
        
        let statusIndex = 0;
        const statusInterval = setInterval(() => {
            if (statusIndex < statusMessages.length - 1) {
                statusIndex++;
                statusText.querySelector('.loading-text').textContent = statusMessages[statusIndex];
            }
        }, 800);

        try {
            const result = await window.editorUtils.callAi('/api/ai/format', { content: editor.innerHTML });

            clearInterval(statusInterval);
            statusText.querySelector('.loading-text').textContent = "Applying changes...";

            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (result?.formatted) {
                editor.innerHTML = result.formatted;

                const lists = editor.querySelectorAll('ul, ol');
                lists.forEach(list => {
                    if (list.tagName === 'UL') {
                        list.style.listStyleType = 'disc';
                        list.style.listStylePosition = 'outside';
                    } else if (list.tagName === 'OL') {
                        list.style.listStyleType = 'decimal';
                        list.style.listStylePosition = 'outside';
                    }
                    list.querySelectorAll('li').forEach(li => {
                        li.style.display = 'list-item';
                    });
                });
                
                window.editorUtils?.updatePreview();
                window.editorUtils?.updateUndoRedoButtons();
                window.editorUtils?.flash("Content formatted with AI!");
                window.editorUtils?.debouncedAutoSave();
            }
        } catch (error) {
            clearInterval(statusInterval);
            window.editorUtils?.flash(`Auto format failed: ${error.message}`);
        } finally {
            
            loadingModal.style.display = 'none';

            setTimeout(() => {
                statusText.querySelector('.loading-text').textContent = statusMessages[0];
            }, 300);
        }
    });

    document.getElementById("ai-plagiarism")?.addEventListener("click", (e) => {
        e.preventDefault();
        runAiCheck("ai-plagiarism");
    });
    document.getElementById("ai-readability")?.addEventListener("click", (e) => {
        e.preventDefault();
        runAiCheck("ai-readability");
    });

    const keywordsModal = document.getElementById('keywordsModal');
    document.getElementById('ai-keywords')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (keywordsModal) {
            keywordsModal.style.display = 'flex';
            document.getElementById('keywordsInput')?.focus();
        }
    });
    
    document.getElementById('cancelKeywords')?.addEventListener('click', () => {
        if (keywordsModal) keywordsModal.style.display = 'none';
    });
    
    document.getElementById('applyKeywords')?.addEventListener('click', () => {
        const keywordsRaw = document.getElementById('keywordsInput')?.value || '';
        const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(Boolean);
        if (keywords.length > 0) {
            runAiCheck("ai-keywords", { keywords });
        }
        if (keywordsModal) keywordsModal.style.display = 'none';
    });

    window.toggleDropdown = function(toolType) {
        const dropdown = document.getElementById(`ai-${toolType}-dropdown`);
        const toggle = dropdown?.querySelector('.ai-tool-dropdown-toggle');
        
        if (!dropdown) return;
        
        const isCollapsed = dropdown.classList.contains('collapsed');
        
        if (isCollapsed) {
            dropdown.classList.remove('collapsed');
            dropdown.classList.add('expanded');
            toggle?.classList.add('rotated');
        } else {
            dropdown.classList.add('collapsed');
            dropdown.classList.remove('expanded');
            toggle?.classList.remove('rotated');
        }
    };

    document.querySelectorAll('.ai-tool-dropdown-header').forEach(header => {
        header.setAttribute('tabindex', '0');
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });
    });

    function createRipple(event) {
        const button = event.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.className = 'ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    document.querySelectorAll('.ai-tool-button-enhanced, .check-again-button').forEach(button => {
        button.addEventListener('click', createRipple);
    });

    function showDropdownResult(toolType) {
        const dropdown = document.getElementById(`ai-${toolType}-dropdown`);
        if (dropdown) {
            dropdown.classList.remove('collapsed');
            dropdown.classList.add('expanded');
            const toggle = dropdown.querySelector('.ai-tool-dropdown-toggle');
            toggle?.classList.add('rotated');
        }
    }

    function hideDropdown(toolType) {
        const dropdown = document.getElementById(`ai-${toolType}-dropdown`);
        if (dropdown) {
            dropdown.classList.add('collapsed');
            dropdown.classList.remove('expanded');
            const toggle = dropdown.querySelector('.ai-tool-dropdown-toggle');
            toggle?.classList.remove('rotated');
        }
    }

    document.getElementById('plagiarism-check-again')?.addEventListener('click', () => {
        runAiCheck('ai-plagiarism');
    });
    
    document.getElementById('readability-check-again')?.addEventListener('click', () => {
        runAiCheck('ai-readability');
    });

    window.runAiCheck = runAiCheck;
    window.showDropdownResult = showDropdownResult;
    window.hideDropdown = hideDropdown;
});