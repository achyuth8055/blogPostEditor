

const DEFAULT_OPTIONS = {
  endpoint: 'https:
  apiPath: '/v2/check',
  apiKey: null,              
  language: 'en-US',
  motherTongue: undefined,
  disabledRules: [],
  debounceMs: 600,
  minChars: 12,
  maxIssues: 100,
  useShadowDom: false,       
  overlayZIndex: 10,
  underlineStyle: 'wavy',    
  highlightColor: '#ef4444', 
  enableForContentEditable: true,
};

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function createElement(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  Object.entries(attrs).forEach(([k, v]) => {
    if (v !== undefined && v !== null) el.setAttribute(k, v);
  });
  return el;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default class GrammarChecker {
  static #cssInjected = false;
  static #instances = new Set();

  constructor(element, options = {}) {
    if (!element) throw new Error('GrammarChecker requires a target element');

    this.el = element;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.isTextarea = this.el.tagName === 'TEXTAREA';
    this.isContentEditable = !this.isTextarea && this.el.isContentEditable;
    this.inlineHighlights = [];
    this.ignoredIssues = new Set();
    this.usingInlineHighlights = this.isContentEditable && this.options.enableForContentEditable;

    console.log('[GrammarChecker] Initializing on element:', this.el.tagName, this.el.id || '(no id)');
    console.log('[GrammarChecker] isTextarea:', this.isTextarea, 'isContentEditable:', this.isContentEditable);
    console.log('[GrammarChecker] Options:', this.options);

    const attr = this.el.getAttribute('data-grammar-check');
    if (attr && attr !== 'true') {
      
      console.warn('[GrammarChecker] data-grammar-check is not "true", skipping');
      return;
    }

    GrammarChecker.#ensureCSSInjected(this.options);
    this.#setupOverlay();
    this.#bind();

    GrammarChecker.#instances.add(this);
    console.log('[GrammarChecker] Initialized successfully, scheduling initial check');
    this.checkNow(); 
  }

  destroy() {
    this.#unbind();
    this.#teardownOverlay();
    GrammarChecker.#instances.delete(this);
  }

  async checkNow() {
    console.log('[GrammarChecker] 🔍 checkNow invoked');
    const text = this.#getPlainText();
    console.log('[GrammarChecker] Text length:', text?.length || 0, 'minChars:', this.options.minChars);
    
    if (!text || text.length < this.options.minChars) {
      console.log('[GrammarChecker] ⏭️ Text too short, skipping check');
      this.#renderHighlights([]);
      return;
    }
    try {
      console.log('[GrammarChecker] 📡 Fetching grammar matches...');
      const matches = await this.#checkWithLanguageTool(text);
      console.log('[GrammarChecker] ✅ Received', Array.isArray(matches) ? matches.length : 0, 'matches');
      this.#renderHighlights(matches);
    } catch (err) {

      console.error('[GrammarChecker] ❌ Check failed:', err && err.message ? err.message : err);
    }
  }

  #bind() {
    
    const debounced = debounce(() => this.checkNow(), this.options.debounceMs);
    this._scheduleCheck = debounced;
    this._onInput = () => this._scheduleCheck();
    this._onScroll = () => this.#syncScroll();
    this._onResize = () => this.#syncOverlayMetrics();

    this.el.addEventListener('input', this._onInput);
    this.el.addEventListener('keyup', this._onInput);
    this.el.addEventListener('change', this._onInput);
    this.el.addEventListener('scroll', this._onScroll);
    window.addEventListener('resize', this._onResize);

    this.resizeObserver = new ResizeObserver(this.#syncOverlayMetrics.bind(this));
    this.resizeObserver.observe(this.el);
  }

  #unbind() {
    this.el.removeEventListener('input', this._onInput);
    this.el.removeEventListener('keyup', this._onInput);
    this.el.removeEventListener('change', this._onInput);
    this.el.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  #setupOverlay() {
    if (this.usingInlineHighlights) {
      
      this.overlayHost = null;
      this.overlayRoot = null;
      this.mirror = null;
      return;
    }

    const wrapper = createElement('div', 'gt-wrapper');
    const style = window.getComputedStyle(this.el);
    
    wrapper.style.position = 'relative';
    wrapper.style.display = style.display === 'inline' ? 'inline-block' : 'block';
    wrapper.style.width = style.width;

    this.el.parentNode.insertBefore(wrapper, this.el);
    wrapper.appendChild(this.el);

    this.overlayHost = createElement('div', 'gt-overlay-host');
    this.overlayHost.style.position = 'absolute';
    this.overlayHost.style.left = '0';
    this.overlayHost.style.top = '0';
    this.overlayHost.style.right = '0';
    this.overlayHost.style.bottom = '0';
    this.overlayHost.style.pointerEvents = 'none';
    this.overlayHost.style.zIndex = String(this.options.overlayZIndex);

    wrapper.appendChild(this.overlayHost);

    this.overlayRoot = this.options.useShadowDom
      ? this.overlayHost.attachShadow({ mode: 'open' })
      : this.overlayHost;

    this.mirror = createElement('pre', 'gt-mirror');
    this.mirror.style.margin = '0';
    this.mirror.style.whiteSpace = 'pre-wrap';
    this.mirror.style.wordWrap = 'break-word';

    const typoProps = [
      'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
      'lineHeight', 'tabSize', 'textTransform', 'textIndent', 'wordSpacing',
      'textRendering'
    ];
    typoProps.forEach(p => {
      this.mirror.style[p] = style[p];
    });

    this.mirror.style.paddingTop = style.paddingTop;
    this.mirror.style.paddingRight = style.paddingRight;
    this.mirror.style.paddingBottom = style.paddingBottom;
    this.mirror.style.paddingLeft = style.paddingLeft;

    this.mirror.style.borderRadius = style.borderRadius;

    this.mirror.style.overflow = 'hidden';

    this.overlayRoot.appendChild(this.mirror);

    this.el.style.backgroundColor = style.backgroundColor; 

    this.#syncOverlayMetrics();
    this.#syncScroll();
  }

  #teardownOverlay() {
    if (this.usingInlineHighlights) {
      this.#removeActivePopover(false);
      this.#clearInlineHighlights();
      return;
    }
    if (!this.overlayHost) return;
    const wrapper = this.overlayHost.parentElement;
    
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(this.el, wrapper);
      wrapper.parentNode.removeChild(wrapper);
    }
    this.overlayHost = null;
    this.overlayRoot = null;
    this.mirror = null;
  }

  #syncOverlayMetrics() {
    if (this.usingInlineHighlights || !this.overlayHost) return;
    const rect = this.el.getBoundingClientRect();
    
    this.overlayHost.style.width = this.el.clientWidth + 'px';
    this.overlayHost.style.height = this.el.clientHeight + 'px';
  }

  #syncScroll() {
    if (this.usingInlineHighlights || !this.mirror) return;
    this.mirror.scrollTop = this.el.scrollTop;
    this.mirror.scrollLeft = this.el.scrollLeft;
  }

  #getPlainText() {
    if (this.isTextarea) return this.el.value;
    if (this.isContentEditable && this.options.enableForContentEditable) {
      return this.el.innerText; 
    }
    return '';
  }

  async #checkWithLanguageTool(text) {
    const url = `${this.options.endpoint}${this.options.apiPath}`;

    const payload = {
      language: this.options.language,
      text,
    };
    if (this.options.motherTongue) payload.motherTongue = this.options.motherTongue;
    if (this.options.disabledRules && this.options.disabledRules.length) {
      payload.disabledRules = this.options.disabledRules;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.options.apiKey) headers['Authorization'] = `Bearer ${this.options.apiKey}`;

    console.log('[GrammarChecker] Calling API:', url, 'with text length:', text.length);
    const res = await fetch(url, { 
      method: 'POST', 
      headers, 
      body: JSON.stringify(payload) 
    });
    
    console.log('[GrammarChecker] API response status:', res.status);
    if (!res.ok) {
      const errorText = await res.text();
      console.error('[GrammarChecker] API error:', errorText);
      throw new Error(`LanguageTool error ${res.status}`);
    }
    
    const json = await res.json();
    console.log('[GrammarChecker] API returned', json.matches?.length || 0, 'matches');
    
    return Array.isArray(json.matches) ? json.matches.slice(0, this.options.maxIssues) : [];
  }

  #classifyMatch(m) {
    const issueType = (m.rule && m.rule.issueType) ? String(m.rule.issueType).toLowerCase() : '';
    const categoryId = (m.rule && m.rule.category && (m.rule.category.id || m.rule.category.categoryId))
      ? String(m.rule.category.id || m.rule.category.categoryId).toLowerCase() : '';
    const ruleId = (m.rule && m.rule.id) ? String(m.rule.id).toLowerCase() : '';
    if (issueType.includes('misspelling') || issueType.includes('typographical') || /spelling|typo/.test(ruleId) || /typo/.test(categoryId)) return 'typo';
    if (issueType.includes('style') || /style/.test(categoryId)) return 'style';
    return 'grammar';
  }

  #buildMatchTip(m) {
    const tipTitle = escapeHtml(m.message || (m.rule && m.rule.description) || 'Issue');
    const replacements = Array.isArray(m.replacements) ? m.replacements : [];
    const suggestionsText = replacements.length
      ? 'Suggestions: ' + escapeHtml(replacements.slice(0, 3).map(r => r.value).join(', '))
      : '';
    return suggestionsText ? `${tipTitle}\n${suggestionsText}` : tipTitle;
  }

  #buildUnderlineStyleString(color) {
    const underline = this.options.underlineStyle;
    const base = underline === 'wavy'
      ? `underline wavy ${color}`
      : underline === 'dotted'
        ? `underline dotted ${color}`
        : `underline ${color}`;
    return `text-decoration: ${base}; text-decoration-thickness: 1.5px; text-underline-offset: 3px;`;
  }

  #applyUnderlineStyle(el, color) {
    if (!el) return;
    const underline = this.options.underlineStyle;
    if (underline === 'wavy') {
      el.style.textDecoration = `underline wavy ${color}`;
    } else if (underline === 'dotted') {
      el.style.textDecoration = `underline dotted ${color}`;
    } else {
      el.style.textDecoration = `underline ${color}`;
    }
    el.style.textDecorationThickness = '1.5px';
    el.style.textUnderlineOffset = '3px';
  }

  #buildIssueKey(match, start, end) {
    const ruleId = match?.rule?.id || 'rule';
    const message = match?.message || '';
    return `${ruleId}:${start}:${end}:${message}`.toLowerCase();
  }

  #parseSuggestions(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (error) {
      console.warn('[GrammarChecker] Failed to parse suggestions payload:', error);
      return [];
    }
  }

  #renderHighlights(matches) {
    if (this.usingInlineHighlights) {
      this.#renderInlineHighlights(matches);
      return;
    }

    if (!this.mirror) return;
    const text = this.#getPlainText() || '';
    if (!matches || matches.length === 0) {
      this.mirror.innerHTML = escapeHtml(text);
      return;
    }

    let html = '';
    let lastIndex = 0;

    matches
      .sort((a, b) => a.offset - b.offset)
      .forEach(m => {
        const start = m.offset;
        const end = m.offset + m.length;
        if (start > lastIndex) {
          html += escapeHtml(text.slice(lastIndex, start));
        }
        const tip = this.#buildMatchTip(m);
        const type = this.#classifyMatch(m);
        const color = type === 'style' ? '#3b82f6'  : (type === 'typo' ? '#10b981'  : '#ef4444' );
        const underlineCss = this.#buildUnderlineStyleString(color);
        html += `<span class="gt-underline gt-${type}" data-gt-tip="${tip}" style="${underlineCss}">` +
                escapeHtml(text.slice(start, end)) +
                '</span>';
        lastIndex = end;
      });

    if (lastIndex < text.length) html += escapeHtml(text.slice(lastIndex));

    this.mirror.innerHTML = html;

    this.#attachMirrorTooltips();
  }

  #attachMirrorTooltips() {
    if (!this.overlayRoot) return;
    const root = this.overlayRoot instanceof ShadowRoot ? this.overlayRoot : this.overlayRoot;

    if (this._tooltipHandlerAttached) return;
    this._tooltipHandlerAttached = true;

    root.addEventListener('mousemove', (e) => {
      const target = e.composedPath ? e.composedPath()[0] : e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches || !target.matches('.gt-underline')) return;
      const tip = target.getAttribute('data-gt-tip');
      if (!tip) return;
      this.#showTooltip(tip, e.clientX, e.clientY);
    });
    root.addEventListener('mouseleave', () => this.#hideTooltip());
  }

  #showTooltip(text, x, y) {
    if (!this._tooltipEl) {
      this._tooltipEl = createElement('div', 'gt-tooltip');
      const host = this.overlayRoot instanceof ShadowRoot ? this.overlayRoot : this.overlayRoot;
      host.appendChild(this._tooltipEl);
    }
    const el = this._tooltipEl;
    el.textContent = text;
    el.style.display = 'block';
    el.style.left = x + 12 + 'px';
    el.style.top = y + 12 + 'px';
  }

  #hideTooltip() {
    if (this._tooltipEl) this._tooltipEl.style.display = 'none';
  }

  #renderInlineHighlights(matches) {
    this.#removeActivePopover(false);
    this.#clearInlineHighlights();

    if (!Array.isArray(matches) || matches.length === 0) return;

    const text = this.#getPlainText() || '';
    if (!text) return;

    const nodes = this.#buildTextNodeMap();
    if (!nodes.length) return;

    const sortedMatches = [...matches].sort((a, b) => (a.offset || 0) - (b.offset || 0));
    sortedMatches.reverse(); 

    sortedMatches.forEach((match) => {
      const start = Math.max(0, match.offset || 0);
      const end = Math.min(text.length, start + (match.length || 0));
      if (end <= start) return;

      const issueKey = this.#buildIssueKey(match, start, end);
      if (this.ignoredIssues.has(issueKey)) {
        return;
      }

      const range = this.#createRangeFromOffsets(nodes, start, end);
      if (!range) return;

      const wrapper = document.createElement('span');
      const type = this.#classifyMatch(match);
      const color = type === 'style' ? '#3b82f6' : (type === 'typo' ? '#10b981' : '#ef4444');
      wrapper.className = `gt-inline-highlight gt-${type}`;
      wrapper.dataset.gtTip = this.#buildMatchTip(match);
      wrapper.dataset.gtMessage = match.message || '';
      wrapper.dataset.gtIssueKey = issueKey;

      const suggestions = Array.isArray(match.replacements)
        ? match.replacements.slice(0, 5).map((r) => r.value).filter(Boolean)
        : [];
      if (suggestions.length) {
        wrapper.dataset.gtSuggestions = JSON.stringify(suggestions);
        wrapper.style.cursor = 'pointer';
      } else {
        wrapper.style.cursor = 'default';
      }

      this.#applyUnderlineStyle(wrapper, color);
      wrapper.style.backgroundColor = 'transparent';
      wrapper.style.color = '';

      try {
        range.surroundContents(wrapper);
      } catch (error) {
        console.warn('[GrammarChecker] surroundContents failed, falling back to manual insert:', error);
        const frag = range.extractContents();
        wrapper.appendChild(frag);
        range.insertNode(wrapper);
      }

      this.inlineHighlights.push(wrapper);
    });

    this.#attachInlineHandlers();
  }

  #buildTextNodeMap() {
    const nodes = [];
    const walker = document.createTreeWalker(
      this.el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.parentNode) return NodeFilter.FILTER_REJECT;
          if (node.parentNode.closest && node.parentNode.closest('.gt-inline-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.textContent || node.textContent.length === 0) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let offset = 0;
    let node;
    while ((node = walker.nextNode())) {
      const length = node.textContent.length;
      if (!length) continue;
      nodes.push({ node, start: offset, end: offset + length });
      offset += length;
    }
    return nodes;
  }

  #createRangeFromOffsets(nodes, start, end) {
    const startPos = this.#locateTextPosition(nodes, start);
    const endPos = this.#locateTextPosition(nodes, end);
    if (!startPos || !endPos) return null;
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    return range;
  }

  #locateTextPosition(nodes, index) {
    for (let i = 0; i < nodes.length; i++) {
      const info = nodes[i];
      if (index < info.end) {
        return { node: info.node, offset: index - info.start };
      }
      if (index === info.end && i < nodes.length - 1) {
        return { node: nodes[i + 1].node, offset: 0 };
      }
    }
    const last = nodes[nodes.length - 1];
    if (!last) return null;
    return { node: last.node, offset: last.node.textContent.length };
  }

  #attachInlineHandlers() {
    if (!this.inlineHighlights.length) return;
    this.inlineHighlights.forEach((wrapper) => {
      const handleEnter = () => wrapper.classList.add('gt-inline-highlight--active');
      const handleLeave = () => {
        wrapper.classList.remove('gt-inline-highlight--active');
      };
      const handleClick = (event) => {
        if (this.#parseSuggestions(wrapper.dataset.gtSuggestions).length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.#showSuggestionPopover(wrapper, event);
      };

      wrapper.addEventListener('mouseenter', handleEnter);
      wrapper.addEventListener('mouseleave', handleLeave);
      wrapper.addEventListener('click', handleClick);

      wrapper.__gtHandlers = { handleEnter, handleLeave, handleClick };
    });
  }

  #clearInlineHighlights() {
    if (!this.inlineHighlights.length) return;
    this.inlineHighlights.forEach((wrapper) => {
      if (!wrapper || !wrapper.parentNode) return;
      const handlers = wrapper.__gtHandlers;
      if (handlers) {
        wrapper.removeEventListener('mouseenter', handlers.handleEnter);
        wrapper.removeEventListener('mouseleave', handlers.handleLeave);
        wrapper.removeEventListener('click', handlers.handleClick);
        delete wrapper.__gtHandlers;
      }
      while (wrapper.firstChild) {
        wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.parentNode.removeChild(wrapper);
    });
    this.inlineHighlights = [];
  }

  #showSuggestionPopover(wrapper, event) {
    const suggestions = this.#parseSuggestions(wrapper.dataset.gtSuggestions);
    const message = wrapper.dataset.gtMessage || wrapper.dataset.gtTip || 'Suggested change';
    this.#removeActivePopover();

    const popover = document.createElement('div');
    popover.className = 'gt-suggestion-popover';

    const title = document.createElement('div');
    title.className = 'gt-suggestion-popover__title';
    title.textContent = message;
    popover.appendChild(title);

    if (suggestions.length) {
      const list = document.createElement('div');
      list.className = 'gt-suggestion-popover__list';
      suggestions.forEach((suggestion, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gt-suggestion-popover__option';
        button.textContent = suggestion;
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.#applySuggestion(wrapper, suggestion);
        });
        list.appendChild(button);
      });
      popover.appendChild(list);
    } else {
      const empty = document.createElement('div');
      empty.className = 'gt-suggestion-popover__empty';
      empty.textContent = 'No automatic suggestions available for this issue.';
      popover.appendChild(empty);
    }

    const footer = document.createElement('div');
    footer.className = 'gt-suggestion-popover__footer';

    const ignoreBtn = document.createElement('button');
    ignoreBtn.type = 'button';
    ignoreBtn.className = 'gt-suggestion-popover__ignore';
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#ignoreIssue(wrapper);
    });

    const recheckBtn = document.createElement('button');
    recheckBtn.type = 'button';
    recheckBtn.className = 'gt-suggestion-popover__recheck';
    recheckBtn.textContent = 'Re-check';
    recheckBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#removeActivePopover();
      this.checkNow();
    });

    footer.appendChild(ignoreBtn);
    footer.appendChild(recheckBtn);
    popover.appendChild(footer);

    document.body.appendChild(popover);
    this._activePopover = popover;
    this._activePopoverTarget = wrapper;

    const rect = wrapper.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = (event?.clientY || rect.bottom) + window.scrollY + 8;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    this._onPopoverDocumentClick = (evt) => {
      if (!popover.contains(evt.target) && evt.target !== wrapper) {
        this.#removeActivePopover();
      }
    };
    document.addEventListener('mousedown', this._onPopoverDocumentClick);
  }

  #removeActivePopover(restoreFocus = true) {
    if (this._activePopover) {
      if (this._activePopover.parentNode) {
        this._activePopover.parentNode.removeChild(this._activePopover);
      }
      this._activePopover = null;
    }
    if (this._onPopoverDocumentClick) {
      document.removeEventListener('mousedown', this._onPopoverDocumentClick);
      this._onPopoverDocumentClick = null;
    }
    if (restoreFocus && this._activePopoverTarget && this._activePopoverTarget.parentNode) {
      this.el.focus({ preventScroll: true });
    }
    this._activePopoverTarget = null;
  }

  #applySuggestion(wrapper, suggestion) {
    if (!wrapper || !wrapper.parentNode) return;
    const textNode = document.createTextNode(suggestion);
    wrapper.parentNode.insertBefore(textNode, wrapper);
    wrapper.parentNode.removeChild(wrapper);
    this.inlineHighlights = this.inlineHighlights.filter((w) => w !== wrapper);
    this.#removeActivePopover(false);
    this.checkNow();
  }

  #ignoreIssue(wrapper) {
    if (!wrapper || !wrapper.parentNode) return;
    const issueKey = wrapper.dataset.gtIssueKey;
    if (issueKey) {
      this.ignoredIssues.add(issueKey);
    }
    while (wrapper.firstChild) {
      wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.parentNode.removeChild(wrapper);
    this.inlineHighlights = this.inlineHighlights.filter((w) => w !== wrapper);
    this.#removeActivePopover(false);
  }

  static #ensureCSSInjected(options) {
    if (GrammarChecker.#cssInjected) return;
    const css = `
      .gt-wrapper { position: relative; }
      .gt-overlay-host { pointer-events: none; }
      .gt-mirror { color: transparent; background: transparent; }
      
      .gt-mirror { color: transparent; }
      .gt-mirror .gt-underline { color: inherit; text-underline-offset: 3px; }

      .gt-tooltip {
        position: fixed;
        z-index: 99999;
        background: #ffffff;
        color: #111827; 
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 12px;
        line-height: 1.2;
        max-width: 320px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.12);
        border: 1px solid #e5e7eb; 
        display: none;
        pointer-events: none;
        white-space: pre-wrap;
      }
      .gt-inline-highlight {
        position: relative;
        border-bottom: none;
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      .gt-inline-highlight--active {
        background-color: rgba(59, 130, 246, 0.08);
      }
      .gt-inline-highlight.gt-typo {
        color: inherit;
      }
      .gt-suggestion-popover {
        position: absolute;
        z-index: 100000;
        min-width: 220px;
        max-width: 320px;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
        padding: 12px;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .gt-suggestion-popover__title {
        font-size: 13px;
        font-weight: 600;
        color: #111827;
        margin-bottom: 10px;
        line-height: 1.4;
      }
      .gt-suggestion-popover__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 10px;
      }
      .gt-suggestion-popover__option {
        appearance: none;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 13px;
        text-align: left;
        transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
        cursor: pointer;
      }
      .gt-suggestion-popover__option:hover {
        background: #eef2ff;
        border-color: #6366f1;
        transform: translateY(-1px);
      }
      .gt-suggestion-popover__empty {
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 10px;
      }
      .gt-suggestion-popover__footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .gt-suggestion-popover__ignore,
      .gt-suggestion-popover__recheck {
        appearance: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border: 1px solid transparent;
        transition: background 0.2s ease, color 0.2s ease;
      }
      .gt-suggestion-popover__ignore {
        background: #fff7ed;
        color: #c2410c;
        border-color: #fdba74;
      }
      .gt-suggestion-popover__ignore:hover {
        background: #fed7aa;
      }
      .gt-suggestion-popover__recheck {
        background: #eff6ff;
        color: #1d4ed8;
        border-color: #bfdbfe;
      }
      .gt-suggestion-popover__recheck:hover {
        background: #bfdbfe;
      }
    `;
    const styleTag = document.createElement('style');
    styleTag.setAttribute('data-gt-style', 'true');
    styleTag.textContent = css;
    document.head.appendChild(styleTag);
    GrammarChecker.#cssInjected = true;
  }
}

export function autoInitGrammarChecker(options = {}) {
  const { root = document, ...restOptions } = options;
  console.log('[GrammarChecker] autoInitGrammarChecker called with root:', root);
  const nodes = root.querySelectorAll('[data-grammar-check="true"]');
  console.log('[GrammarChecker] Found', nodes.length, 'elements with data-grammar-check="true"');
  const instances = [];
  nodes.forEach((node, i) => {
    console.log(`[GrammarChecker] Initializing ${i+1}/${nodes.length}:`, node.tagName, node.id || '(no id)');
    instances.push(new GrammarChecker(node, restOptions));
  });
  console.log('[GrammarChecker] autoInitGrammarChecker complete, created', instances.length, 'instances');
  return instances;
}

export function initGrammarCheckerFor(el, options = {}) {
  return new GrammarChecker(el, options);
}
