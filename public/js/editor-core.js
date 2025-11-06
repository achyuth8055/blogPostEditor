document.addEventListener('DOMContentLoaded', () => {
    const editor = document.getElementById('editor');
    const previewContent = document.getElementById('preview-content');
    const postForm = document.getElementById('post-form');
    const postContentInput = document.getElementById('postContent');
    const blogTitleInput = document.getElementById('blogTitle');
    
    let savedSelectionForAI;
    let autoSaveTimeout;
    const saveStatusEl = document.getElementById('saveStatus');
    const postIdInput = document.getElementById('postId');
    const CURRENT_POST_STORAGE_KEY = 'current-post-id';

    const persistPostId = (value) => {
        if (!value) return;
        try {
            localStorage.setItem(CURRENT_POST_STORAGE_KEY, value);
        } catch (error) {
            console.warn('Unable to persist post ID locally:', error);
        }
    };

    const readStoredPostId = () => {
        try {
            return localStorage.getItem(CURRENT_POST_STORAGE_KEY) || '';
        } catch (error) {
            console.warn('Unable to read stored post ID:', error);
            return '';
        }
    };

    if (postIdInput?.value) {
        persistPostId(postIdInput.value);
    } else {
        const storedPostId = readStoredPostId();
        if (storedPostId) {
            postIdInput.value = storedPostId;
        }
    }

    const cleanContent = (htmlContent) => {
        if (!htmlContent || typeof htmlContent !== 'string') return htmlContent;
        return htmlContent
            .replace(/<div class="image-resize-tooltip">.*?<\/div>/g, '')
            .replace(/Click to select • Drag handles to resize • Ctrl\+Arrow keys for precision/g, '');
    };

    const cleanContentForStorage = (html) => {
        if (!html || typeof html !== 'string') return html;
        
        console.log('[CLEANER] Input HTML length:', html.length);
        console.log('[CLEANER] First 500 chars:', html.substring(0, 500));
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const root = doc.body.firstChild;

        const ALLOWED_ATTRS = {
            a: new Set(['href', 'title', 'target', 'rel']),
            img: new Set(['src', 'alt', 'title', 'width', 'height']),
            p: new Set(['id']),
            h1: new Set(['id']), h2: new Set(['id']), h3: new Set(['id']), h4: new Set(['id']), h5: new Set(['id']), h6: new Set(['id']),
            ul: new Set([]), ol: new Set([]), li: new Set([]),
            strong: new Set([]), em: new Set([]), u: new Set([]), s: new Set([]),
            blockquote: new Set(['cite']), code: new Set([]), pre: new Set([]), br: new Set([]),
            span: new Set([]),
        };

        const shouldRemoveStyleProp = (name, value) => {
            if (!name) return false;
            const n = name.trim().toLowerCase();
            if (n.startsWith('--tw')) return true;
            
            if (typeof value === 'string' && value.includes('--tw-')) return true;
            return false;
        };

        const cleanElement = (el) => {
            
            if (el.hasAttribute && el.hasAttribute('class')) {
                el.removeAttribute('class');
            }

            if (el.hasAttribute && el.hasAttribute('style')) {
                const style = el.getAttribute('style');
                const parts = style.split(';').map(s => s.trim()).filter(Boolean);
                const kept = [];
                for (const decl of parts) {
                    const [prop, ...rest] = decl.split(':');
                    const val = rest.join(':');
                    if (!shouldRemoveStyleProp(prop, val)) {
                        kept.push(`${prop}:${val}`);
                    }
                }
                if (kept.length) {
                    el.setAttribute('style', kept.join(';'));
                } else {
                    el.removeAttribute('style');
                }
            }

            if (el.nodeType === Node.ELEMENT_NODE) {
                const tag = el.tagName.toLowerCase();
                const allowed = ALLOWED_ATTRS[tag] || new Set();
                
                Array.from(el.attributes).forEach(attr => {
                    const name = attr.name.toLowerCase();
                    if (name === 'style') return; 
                    if (!allowed.has(name)) {
                        
                        if (name === 'id' && (tag.startsWith('h') || tag === 'p' || tag === 'section')) return;
                        el.removeAttribute(name);
                    }
                });
            }
        };

        const unwrapIfUnnecessarySpan = (el) => {
            if (el.tagName && el.tagName.toLowerCase() === 'span') {
                
                if (!el.attributes || el.attributes.length === 0) {
                    const parent = el.parentNode;
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                    return true;
                }
            }
            return false;
        };

        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, null);
        const toProcess = [];
        while (walker.nextNode()) toProcess.push(walker.currentNode);

        Array.from(doc.querySelectorAll('*'))
            .forEach(node => {
                Array.from(node.childNodes).forEach(child => {
                    if (child.nodeType === Node.COMMENT_NODE) node.removeChild(child);
                });
            });

        toProcess.forEach(el => {
            if (el.nodeType !== Node.ELEMENT_NODE) return;
            cleanElement(el);
        });
        
        Array.from(root.querySelectorAll('span')).forEach(span => unwrapIfUnnecessarySpan(span));

        const cleaned = root.innerHTML;
        console.log('[CLEANER] Output HTML length:', cleaned.length);
        console.log('[CLEANER] First 500 chars of output:', cleaned.substring(0, 500));
        console.log('[CLEANER] Reduction:', Math.round((1 - cleaned.length / html.length) * 100) + '%');
        
        return cleaned;
    };

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    const performAutoSave = async () => {
        const postId = postIdInput.value;
        if (!postId) {
            console.log("No Post ID, cannot auto-save.");
            return;
        }

        saveStatusEl.textContent = 'Saving...';
        saveStatusEl.style.opacity = '1';

        const rawHtml = editor.innerHTML;
        console.log('[AUTOSAVE] Raw editor HTML length:', rawHtml.length);
        
        const afterBasicClean = cleanContent(rawHtml);
        console.log('[AUTOSAVE] After basic clean length:', afterBasicClean.length);
        
        const cleanedHtml = cleanContentForStorage(afterBasicClean);
        console.log('[AUTOSAVE] After storage cleaner length:', cleanedHtml.length);
        console.log('[AUTOSAVE] Sample (first 500 chars):', cleanedHtml.substring(0, 500));
        
        const postXml = (function toRawXml(html) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
                const root = doc.body.firstChild;
                const ALLOWED_ATTRS = {
                    a: new Set(['href','title','target','rel']),
                    img: new Set(['src','alt','title','width','height']),
                    table: new Set([]), thead: new Set([]), tbody: new Set([]), tfoot: new Set([]),
                    tr: new Set([]), th: new Set(['colspan','rowspan','scope']), td: new Set(['colspan','rowspan']),
                    ul: new Set([]), ol: new Set([]), li: new Set([]),
                    p: new Set(['id']),
                    h1: new Set(['id']), h2: new Set(['id']), h3: new Set(['id']), h4: new Set(['id']), h5: new Set(['id']), h6: new Set(['id']),
                    strong: new Set([]), b: new Set([]), em: new Set([]), i: new Set([]), u: new Set([]), s: new Set([]),
                    blockquote: new Set(['cite']), code: new Set([]), pre: new Set([]), br: new Set([]),
                };
                function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
                function nodeToXml(node){
                    if (node.nodeType === 3) { const txt = node.textContent; return txt && txt.trim() ? esc(txt) : ''; }
                    if (node.nodeType !== 1) return '';
                    const tag = node.tagName.toLowerCase();
                    const allowed = ALLOWED_ATTRS[tag] || new Set();
                    const attrs = Array.from(node.attributes)
                        .filter(a => allowed.has(a.name.toLowerCase()))
                        .map(a => `${a.name}="${esc(a.value)}"`).join(' ');
                    const children = Array.from(node.childNodes).map(nodeToXml).join('');
                    return attrs ? `<${tag} ${attrs}>${children}</${tag}>` : `<${tag}>${children}</${tag}>`;
                }
                const xmlInner = Array.from(root.childNodes).map(nodeToXml).join('');
                return `<document>${xmlInner}</document>`;
            } catch(e) { console.warn('toRawXml failed:', e); return '<document/>'; }
        })(cleanedHtml);

        const data = {
            postTitle: blogTitleInput.value || 'Untitled Draft',
            postContent: cleanedHtml,
            postXml
        };

        try {
            const response = await fetch(`/save/${postId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Auto-save successful:', result);

            const nextPostId = result.postId || postId;
            if (nextPostId) {
                postIdInput.value = nextPostId;
                const postIdField = document.getElementById('postIdField');
                if (postIdField) postIdField.value = nextPostId; 
                window.history.replaceState(null, '', `/?postId=${nextPostId}`);
                persistPostId(nextPostId);
            }
            saveStatusEl.textContent = 'Saved';
            setTimeout(() => { saveStatusEl.style.opacity = '0'; }, 2000);

        } catch (error) {
            console.error('Auto-save failed:', error);
            saveStatusEl.textContent = 'Save failed';
            setTimeout(() => { saveStatusEl.style.opacity = '0'; }, 3000);
        }
    };

    const debouncedAutoSave = debounce(performAutoSave, 2500);

    postForm.addEventListener('submit', (e) => {
        clearTimeout(autoSaveTimeout);
    postContentInput.value = cleanContentForStorage(cleanContent(editor.innerHTML));
        console.log("Manual Save / Submit triggered");
        persistPostId(postIdInput.value);
        const cleaned = cleanContentForStorage(cleanContent(editor.innerHTML));
        postContentInput.value = cleaned;
        const postXmlInput = document.getElementById('postXml');
        if (postXmlInput) {
            
            const xml = (function toRawXml(html) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
                    const root = doc.body.firstChild;
                    const ALLOWED_ATTRS = {
                        a: new Set(['href','title','target','rel']),
                        img: new Set(['src','alt','title','width','height']),
                        table: new Set([]), thead: new Set([]), tbody: new Set([]), tfoot: new Set([]),
                        tr: new Set([]), th: new Set(['colspan','rowspan','scope']), td: new Set(['colspan','rowspan']),
                        ul: new Set([]), ol: new Set([]), li: new Set([]),
                        p: new Set(['id']),
                        h1: new Set(['id']), h2: new Set(['id']), h3: new Set(['id']), h4: new Set(['id']), h5: new Set(['id']), h6: new Set(['id']),
                        strong: new Set([]), b: new Set([]), em: new Set([]), i: new Set([]), u: new Set([]), s: new Set([]),
                        blockquote: new Set(['cite']), code: new Set([]), pre: new Set([]), br: new Set([]),
                    };
                    function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
                    function nodeToXml(node){
                        if (node.nodeType === 3) { const txt = node.textContent; return txt && txt.trim() ? esc(txt) : ''; }
                        if (node.nodeType !== 1) return '';
                        const tag = node.tagName.toLowerCase();
                        const allowed = ALLOWED_ATTRS[tag] || new Set();
                        const attrs = Array.from(node.attributes)
                            .filter(a => allowed.has(a.name.toLowerCase()))
                            .map(a => `${a.name}="${esc(a.value)}"`).join(' ');
                        const children = Array.from(node.childNodes).map(nodeToXml).join('');
                        return attrs ? `<${tag} ${attrs}>${children}</${tag}>` : `<${tag}>${children}</${tag}>`;
                    }
                    const xmlInner = Array.from(doc.body.firstChild.childNodes).map(nodeToXml).join('');
                    return `<document>${xmlInner}</document>`;
                } catch(e) { console.warn('toRawXml failed:', e); return '<document/>'; }
            })(cleaned);
            postXmlInput.value = xml;
        }
    });

    function getFocusKeywords() {
        const inputs = [
            document.getElementById('seo-focus-keyword-sidebar'),
            document.getElementById('seo-focus-keyword')
        ].filter(Boolean);
        let raw = '';
        for (const el of inputs) { if (el && el.value) { raw = el.value; break; } }
        if (!raw) return [];
        return Array.from(new Set(
            raw.split(/[;,\n]/).map(s => s.trim()).filter(Boolean)
        ));
    }

    function clearKeywordHighlights(container) {
        const marks = container.querySelectorAll('.keyword-highlight');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
        });
    }

    function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function highlightKeywordsInElement(container, keywords) {
        if (!keywords.length) return;
        const SKIP = new Set(['SCRIPT','STYLE','CODE','PRE','NOSCRIPT','IFRAME']);
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = node.parentElement;
                if (!p || SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const parts = keywords.map(k => escapeRegExp(k)).join('|');
        if (!parts) return;
        const re = new RegExp(`\\b(${parts})\\b`, 'gi');
        const toProcess = [];
        while (walker.nextNode()) toProcess.push(walker.currentNode);
        toProcess.forEach(textNode => {
            const txt = textNode.nodeValue;
            if (!re.test(txt)) return;
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            txt.replace(re, (match, _g, offset) => {
                if (offset > lastIndex) frag.appendChild(document.createTextNode(txt.slice(lastIndex, offset)));
                const mark = document.createElement('mark');
                mark.className = 'keyword-highlight';
                mark.textContent = match;
                frag.appendChild(mark);
                lastIndex = offset + match.length;
                return match;
            });
            if (lastIndex < txt.length) frag.appendChild(document.createTextNode(txt.slice(lastIndex)));
            textNode.parentNode.replaceChild(frag, textNode);
        });
    }

    const URL_REGEX = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
    const SKIP_LINKIFY = new Set(['SCRIPT','STYLE','CODE','PRE','NOSCRIPT','IFRAME']);

    function linkifyElement(container) {
        if (!container) return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('a')) return NodeFilter.FILTER_REJECT;
                if (SKIP_LINKIFY.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodesToProcess = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (URL_REGEX.test(node.nodeValue)) {
                nodesToProcess.push(node);
            }
            URL_REGEX.lastIndex = 0;
        }

        nodesToProcess.forEach(textNode => {
            const text = textNode.nodeValue;
            if (!text) return;
            URL_REGEX.lastIndex = 0;
            let match;
            let lastIndex = 0;
            const fragment = document.createDocumentFragment();

            while ((match = URL_REGEX.exec(text)) !== null) {
                const rawMatch = match[0];
                const matchIndex = match.index;

                if (matchIndex > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
                }

                let coreUrl = rawMatch;
                let trailing = '';
                const trailingMatch = coreUrl.match(/[.,!?;:)\]]+$/);
                if (trailingMatch) {
                    trailing = trailingMatch[0];
                    coreUrl = coreUrl.slice(0, coreUrl.length - trailing.length);
                }

                if (coreUrl) {
                    const anchor = document.createElement('a');
                    const hrefValue = /^https?:\/\
                    anchor.href = hrefValue;
                    anchor.textContent = coreUrl;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                    anchor.classList.add('auto-link');
                    fragment.appendChild(anchor);
                } else {
                    fragment.appendChild(document.createTextNode(rawMatch));
                }

                if (trailing) {
                    fragment.appendChild(document.createTextNode(trailing));
                }

                lastIndex = matchIndex + rawMatch.length;
            }

            if (lastIndex < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    function linkifyEditorContent() {
        const range = saveSelection();
        linkifyElement(editor);
        if (range) {
            try {
                restoreSelection(range);
            } catch (error) {
                console.warn('Failed to restore selection after linkify:', error);
            }
        }
    }

    const updatePreview = () => {
        previewContent.innerHTML = cleanContent(editor.innerHTML);
        linkifyElement(previewContent);
        const kws = getFocusKeywords();
        clearKeywordHighlights(previewContent);
        if (kws.length) highlightKeywordsInElement(previewContent, kws);
    };

    editor.addEventListener('input', () => {
        linkifyEditorContent();
        updatePreview();
    });
    const keywordInputs = [
        document.getElementById('seo-focus-keyword-sidebar'),
        document.getElementById('seo-focus-keyword')
    ].filter(Boolean);
    keywordInputs.forEach(input => input.addEventListener('input', updatePreview));

    linkifyEditorContent();
    updatePreview();

    const commands = [
        'bold', 'italic', 'underline', 'strikethrough',
        'superscript', 'subscript',
        'justifyLeft', 'justifyCenter', 'justifyRight',
        'insertUnorderedList', 'insertOrderedList',
        'indent', 'outdent', 'removeFormat', 'undo', 'redo'
    ];
   
    const regularCommands = [
        'bold', 'italic', 'underline', 'strikethrough',
        'superscript', 'subscript',
        'indent', 'outdent', 'removeFormat', 'undo', 'redo'
    ];
    
    regularCommands.forEach(command => {
        const button = document.getElementById(command);
        if (button) {
            button.addEventListener('click', () => {
                document.execCommand(command, false, null);
                updateUndoRedoButtons();
                editor.focus();
                updatePreview();
            });
        }
    });

    const alignmentCommands = ['justifyLeft', 'justifyCenter', 'justifyRight'];
    
    alignmentCommands.forEach(command => {
        const button = document.getElementById(command);
        if (button) {
            button.addEventListener('click', () => {
                handleAlignment(command);
                updateUndoRedoButtons();
                editor.focus();
                updatePreview();
            });
        }
    });

    function handleAlignment(command) {
        const selection = window.getSelection();

        let selectedImageContainer = null;
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            let node = range.commonAncestorContainer;

            while (node && node.nodeType !== Node.DOCUMENT_NODE) {
                if (node.nodeType === Node.ELEMENT_NODE && 
                    node.classList && node.classList.contains('resizable-image-container')) {
                    selectedImageContainer = node;
                    break;
                }
                node = node.parentNode;
            }
        }

        if (!selectedImageContainer) {
            selectedImageContainer = editor.querySelector('.resizable-image-container.selected');
        }

        if (selectedImageContainer) {
           
            alignImage(selectedImageContainer, command);
        } else {
         
            document.execCommand(command, false, null);
        }
    }

    function alignImage(container, command) {
      
        container.classList.remove('align-left', 'align-center', 'align-right');

        container.style.float = '';
        container.style.margin = '';
        container.style.textAlign = '';

        switch (command) {
            case 'justifyLeft':
                container.classList.add('align-left');
                break;
            case 'justifyCenter':
                container.classList.add('align-center');
                break;
            case 'justifyRight':
                container.classList.add('align-right');
                break;
        }
        
        console.log(`Image aligned: ${command}`, container);
        updateAlignmentButtons(command);
    }

    function updateAlignmentButtons(activeCommand) {
       
        const alignmentButtons = {
            'justifyLeft': document.getElementById('justifyLeft'),
            'justifyCenter': document.getElementById('justifyCenter'),
            'justifyRight': document.getElementById('justifyRight')
        };

        Object.values(alignmentButtons).forEach(btn => {
            if (btn) btn.classList.remove('active');
        });

        if (alignmentButtons[activeCommand]) {
            alignmentButtons[activeCommand].classList.add('active');
        }
    }

    const unorderedListBtn = document.getElementById('insertUnorderedList');
    if (unorderedListBtn) {
        unorderedListBtn.addEventListener('click', () => {
            insertBulletList();
            flash('✅ Bullet list created! Press Enter to add new items, or Ctrl+Shift+U for shortcut');
        });
    }
    
    const orderedListBtn = document.getElementById('insertOrderedList');
    if (orderedListBtn) {
        orderedListBtn.addEventListener('click', () => {
            insertNumberedList();
            flash('✅ Numbered list created! Press Enter to add new items, or Ctrl+Shift+O for shortcut');
        });
    }

    function updateUndoRedoButtons() {
        const undoButton = document.getElementById('undo');
        const redoButton = document.getElementById('redo');
        
        if (undoButton) {
            undoButton.disabled = !document.queryCommandEnabled('undo');
            undoButton.classList.toggle('opacity-50', undoButton.disabled);
        }
        
        if (redoButton) {
            redoButton.disabled = !document.queryCommandEnabled('redo');
            redoButton.classList.toggle('opacity-50', redoButton.disabled);
        }
    }

    editor.addEventListener('input', updateUndoRedoButtons);

    editor.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                document.execCommand('undo', false, null);
                updateUndoRedoButtons();
            } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                e.preventDefault();
                document.execCommand('redo', false, null);
                updateUndoRedoButtons();
            } else if (e.key === 'u' && e.shiftKey) {
                
                e.preventDefault();
                insertBulletList();
            } else if (e.key === 'o' && e.shiftKey) {
                
                e.preventDefault();
                insertNumberedList();
            }
        }

        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.startContainer;
                const text = container.textContent || '';
                const beforeCursor = text.substring(0, range.startOffset);

                const lines = beforeCursor.split('\n');
                const currentLine = lines[lines.length - 1];
                
                if (currentLine.match(/^\s*-\s/)) {
                    
                    setTimeout(() => {
                        convertTextToList('ul');
                    }, 10);
                } else if (currentLine.match(/^\s*\d+\.\s/)) {
                    
                    setTimeout(() => {
                        convertTextToList('ol');
                    }, 10);
                }
            }
        }
    });

    function createManualList(command, selectedText) {
        const lines = selectedText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return;
        
        const listType = command === 'insertUnorderedList' ? 'ul' : 'ol';
        const listHTML = `<${listType}>${lines.map(line => `<li>${line.trim()}</li>`).join('')}</${listType}>`;
        
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(createElementFromHTML(listHTML));
        }
    }
    
    function createElementFromHTML(htmlString) {
        const template = document.createElement('template');
        template.innerHTML = htmlString.trim();
        return template.content.firstChild;
    }

    function insertBulletList() {
        editor.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            
            const listHTML = '<ul><li>Type your first item here</li></ul><p><br></p>';
            document.execCommand('insertHTML', false, listHTML);
        } else {
            
            const selectedText = selection.toString().trim();
            if (selectedText) {
                const lines = selectedText.split('\n').filter(line => line.trim());
                const listHTML = '<ul>' + lines.map(line => `<li>${line.trim()}</li>`).join('') + '</ul>';
                document.execCommand('insertHTML', false, listHTML);
            } else {
                
                document.execCommand('insertUnorderedList', false, null);
            }
        }
        updatePreview();
        updateUndoRedoButtons();
    }
    
    function insertNumberedList() {
        editor.focus();
        const selection = window.getSelection();
        
        if (selection.rangeCount === 0) {
            
            const listHTML = '<ol><li>Type your first item here</li></ol><p><br></p>';
            document.execCommand('insertHTML', false, listHTML);
        } else {
            
            const selectedText = selection.toString().trim();
            if (selectedText) {
                const lines = selectedText.split('\n').filter(line => line.trim());
                const listHTML = '<ol>' + lines.map(line => `<li>${line.trim()}</li>`).join('') + '</ol>';
                document.execCommand('insertHTML', false, listHTML);
            } else {
                
                document.execCommand('insertOrderedList', false, null);
            }
        }
        updatePreview();
        updateUndoRedoButtons();
    }

    function convertTextToList(listType) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        let container = range.startContainer;

        while (container && container.nodeType !== Node.TEXT_NODE && container.nodeType !== Node.ELEMENT_NODE) {
            container = container.parentNode;
        }
        
        if (!container) return;

        const fullText = editor.textContent;
        const lines = fullText.split('\n');

        const listLines = [];
        let isInList = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (listType === 'ul' && line.match(/^-\s+/)) {
                listLines.push(line.substring(2)); 
                isInList = true;
            } else if (listType === 'ol' && line.match(/^\d+\.\s+/)) {
                listLines.push(line.replace(/^\d+\.\s+/, '')); 
                isInList = true;
            } else if (isInList && line === '') {
                break; 
            }
        }
        
        if (listLines.length > 0) {
            
            const listHTML = `<${listType}>${listLines.map(item => `<li>${item}</li>`).join('')}</${listType}>`;

            editor.innerHTML = editor.innerHTML.replace(
                new RegExp(listLines.map(item => `^\\s*[-\\d\\.\\s]*${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('\\s*\\n\\s*'), 'm'),
                listHTML
            );
            
            updatePreview();
            updateUndoRedoButtons();
        }
    }

    function ensureListStyling() {
        const lists = editor.querySelectorAll('ul, ol');
        lists.forEach(list => {
            if (list.tagName === 'UL') {
                list.style.listStyleType = 'disc';
                list.style.listStylePosition = 'outside';
                list.style.paddingLeft = '1.5rem';
                list.style.margin = '1rem 0';
            } else if (list.tagName === 'OL') {
                list.style.listStyleType = 'decimal';
                list.style.listStylePosition = 'outside';
                list.style.paddingLeft = '1.5rem';
                list.style.margin = '1rem 0';
            }

            const listItems = list.querySelectorAll('li');
            listItems.forEach(li => {
                li.style.display = 'list-item';
                li.style.margin = '0.25rem 0';
            });
        });
    }

    editor.addEventListener('input', ensureListStyling);

    updateUndoRedoButtons();

    const valueCommands = ['foreColor', 'backColor'];
    valueCommands.forEach(command => {
        const input = document.getElementById(command);
        if (input) {
            input.addEventListener('change', (e) => {
                document.execCommand(command, false, e.target.value);
                updateUndoRedoButtons();
                editor.focus();
            });
        }
    });

    document.getElementById('heading').addEventListener('change', (e) => {
        document.execCommand('formatBlock', false, e.target.value);
        updateUndoRedoButtons();
        editor.focus();
    });
    document.getElementById('fontName').addEventListener('change', (e) => {
        document.execCommand('fontName', false, e.target.value);
        updateUndoRedoButtons();
        editor.focus();
    });
    document.getElementById('fontSize').addEventListener('change', (e) => {
        document.execCommand('fontSize', false, e.target.value);
        updateUndoRedoButtons();
        editor.focus();
    });

    function flash(message, duration = 2000) {
        const existingFlash = document.querySelector(".flash-message");
        if (existingFlash) existingFlash.remove();

        const flashEl = document.createElement("div");
        flashEl.textContent = message;
        flashEl.className = "flash-message";
        document.body.appendChild(flashEl);
        setTimeout(() => flashEl.remove(), duration);
    }

    async function callAi(endpoint, payload) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI request failed: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('AI API Error:', error);
            throw error;
        }
    }

    const linkModal = document.getElementById('linkModal');
    const linkUrlInput = document.getElementById('linkUrl');
    const linkTextInput = document.getElementById('linkText');
    const linkTextGroup = document.getElementById('linkTextGroup');
    const createLinkBtn = document.getElementById('createLink');
    const cancelLinkBtn = document.getElementById('cancelLink');
    const applyLinkBtn = document.getElementById('applyLink');
    let savedSelection;

    if (!linkModal || !linkUrlInput || !linkTextInput || !linkTextGroup || !createLinkBtn || !cancelLinkBtn || !applyLinkBtn) {
        console.error('🔗 Link modal elements not found:', {
            linkModal: !!linkModal,
            linkUrlInput: !!linkUrlInput,
            linkTextInput: !!linkTextInput,
            linkTextGroup: !!linkTextGroup,
            createLinkBtn: !!createLinkBtn,
            cancelLinkBtn: !!cancelLinkBtn,
            applyLinkBtn: !!applyLinkBtn
        });
        return;
    }

    console.log('🔗 All link modal elements found, initializing...');

    createLinkBtn.addEventListener('click', () => {
        console.log('🔗 Create Link button clicked');
        savedSelection = saveSelection();
        const selectionText = savedSelection ? savedSelection.toString() : '';
        console.log('🔗 Selection text:', selectionText);

        if (selectionText) {
            linkTextGroup.style.display = 'none';
        } else {
            linkTextGroup.style.display = 'block';
            linkTextInput.value = '';
        }

        linkUrlInput.value = 'https:
        linkModal.classList.remove('hidden');
        linkModal.style.display = 'flex';
        console.log('🔗 Modal display set to flex, classes:', linkModal.className);

        setTimeout(() => {
            linkUrlInput.focus();
            linkUrlInput.select();
        }, 100);
    });

    cancelLinkBtn.addEventListener('click', () => {
        console.log('🔗 Cancel clicked');
        linkModal.classList.add('hidden');
        linkModal.style.display = 'none';
    });
    
    applyLinkBtn.addEventListener('click', () => {
        console.log('🔗 Apply Link clicked');
        
        let url = linkUrlInput.value.trim();
        console.log('🔗 URL entered:', url);
        if (!url || url === 'https:
            console.log('🔗 No URL entered, returning');
            if (window.showErrorModal) {
                window.showErrorModal('URL Required', 'Please enter a valid URL for the link.');
            } else {
                alert('Please enter a valid URL');
            }
            return;
        }

        editor.focus();

        if (savedSelection) {
            restoreSelection(savedSelection);
        }

        if (!/^https?:\/\
            url = `https:
        }
        console.log('🔗 Final URL:', url);

        const selectionText = savedSelection ? savedSelection.toString() : '';
        console.log('🔗 Selection text on apply:', selectionText);

        try {
            if (!selectionText && linkTextInput.value) {
                
                const linkText = linkTextInput.value.trim();
                console.log('🔗 No selection, using custom text:', linkText);
                if (!linkText) {
                    if (window.showErrorModal) {
                        window.showErrorModal('Link Text Required', 'Please enter text for the link.');
                    } else {
                        alert('Please enter text for the link');
                    }
                    return;
                }
                const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>&nbsp;`;
                document.execCommand('insertHTML', false, linkHtml);
                console.log('🔗 Link inserted with custom text');
            } else if (selectionText) {
                
                document.execCommand('createLink', false, url);
                console.log('🔗 Used createLink command for selected text');

                const sel = window.getSelection();
                if (sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    let container = range.commonAncestorContainer;
                    if (container.nodeType !== 1) {
                        container = container.parentNode;
                    }
                    const link = container.closest('a');
                    if (link) {
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener noreferrer');
                        console.log('🔗 Link created and attributes set');
                    }
                }
            } else {
                
                const linkHtml = `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>&nbsp;`;
                document.execCommand('insertHTML', false, linkHtml);
                console.log('🔗 Link inserted without selection');
            }
        } catch (error) {
            console.error('🔗 Error creating link:', error);
            if (window.showErrorModal) {
                window.showErrorModal('Link Creation Failed', 'Failed to create link. Please try again.');
            } else {
                alert('Failed to create link. Please try again.');
            }
        }

        linkUrlInput.value = '';
        linkTextInput.value = '';
        linkModal.classList.add('hidden');
        linkModal.style.display = 'none';
        savedSelection = null;
        
        console.log('🔗 Modal hidden, calling updatePreview');
        updatePreview();
    });

    function saveSelection() {
        if (window.getSelection) {
            const sel = window.getSelection();
            if (sel.getRangeAt && sel.rangeCount) return sel.getRangeAt(0);
        } else if (document.selection && document.selection.createRange) {
            return document.selection.createRange();
        }
        return null;
    }

    function restoreSelection(range) {
        if (range) {
            if (window.getSelection) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            } else if (document.selection && range.select) {
                range.select();
            }
        }
    }

    window.editorUtils = {
        flash,
        callAi,
        updatePreview,
        debouncedAutoSave,
        saveSelection,
        restoreSelection,
        updateUndoRedoButtons,
        ensureListStyling,
        cleanContent,
        cleanContentForStorage
    };
});
