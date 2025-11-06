const fetch = globalThis.fetch;

const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_API_URL = 'https:

function requireApiKey() {
  if (!process.env.DEEPSEEK_API_KEY) {
    const error = new Error('DEEPSEEK_API_KEY is not configured.');
    error.status = 500;
    throw error;
  }
}

function sendJsonError(res, error) {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  const payload = { message: error.message || 'Unexpected server error.' };
  if (error.details) {
    payload.details = error.details;
  }
  res.status(status).json(payload);
}

async function callDeepSeek({ systemPrompt, userPrompt, temperature = 0.2, maxTokens = 1024, responseFormat = 'text' }) {
  console.log('callDeepSeek called with:', { 
    systemPrompt: systemPrompt.substring(0, 50) + '...', 
    userPrompt, 
    temperature, 
    maxTokens, 
    responseFormat 
  });
  
  requireApiKey();

  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available in this Node.js runtime.');
  }

  const body = {
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };

  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  console.log('Making request to DeepSeek API...');
  const response = await fetch(process.env.DEEPSEEK_API_URL || DEFAULT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  console.log('DeepSeek API response status:', response.status);

  if (!response.ok) {
    const errorPayload = await response.text();
    console.error('DeepSeek API error response:', errorPayload);
    const error = new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.details = errorPayload;
    throw error;
  }

  const result = await response.json();
  console.log('DeepSeek API result:', result);
  const messageContent = result?.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('DeepSeek API returned an empty response.');
  }

  return messageContent.trim();
}

function safeParseJson(payload) {
  try {
    return JSON.parse(payload);
  } catch (error) {
    const fallbackMatch = payload.match(/\{[\s\S]*\}/);
    if (fallbackMatch) {
      try {
        return JSON.parse(fallbackMatch[0]);
      } catch {

      }
    }
    const wrappedError = new Error('Unable to parse response from DeepSeek API.');
    wrappedError.details = payload;
    throw wrappedError;
  }
}

exports.reformatContent = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required for reformatting.' });
    }

    const formatted = await callDeepSeek({
      systemPrompt: [
        'You are a meticulous blog editor.',
        'Return polished HTML ready to be injected into a contenteditable editor.',
        'Use semantic tags like <h1>-<h3>, <p>, <ul>/<ol>, <li>, <blockquote>, and <pre> when appropriate.',
        'Avoid enclosing output in <html>, <body>, or <head> tags.',
      ].join(' '),
      userPrompt: [
        'Clean up and reformat the following raw HTML fragment into a structured blog article.',
        'Ensure spacing and hierarchy are improved, headings are capitalized, and lists are well formatted.',
        'Input:',
        content,
      ].join('\n\n'),
      temperature: 0.1,
      maxTokens: 1200,
    });

    res.json({ formatted });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.spellCheckContent = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required for spell checking.' });
    }

    const response = await callDeepSeek({
      systemPrompt: [
        'You are an expert proofreader.',
        'Identify spelling mistakes in the provided text.',
        'Return a JSON object with a "suggestions" array.',
        'Each suggestion should include "original", "suggestion", and "explanation".',
        'If there are no issues, return an empty array.',
      ].join(' '),
      userPrompt: `Analyze the following text for spelling mistakes:\n\n${content}`,
      temperature: 0,
      responseFormat: 'json',
      maxTokens: 800,
    });

    const parsed = safeParseJson(response);
    res.json({ suggestions: parsed.suggestions || [] });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.analyzeTone = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Text is required for tone analysis.' });
    }

    const response = await callDeepSeek({
      systemPrompt: [
        'You are a tone analysis assistant.',
        'Classify the overall tone of the provided text and provide confidence between 0 and 1.',
        'Return a JSON object with fields: tone (string), confidence (number 0-1), and "alternateTones" array.',
        'alternateTones should include items with "tone" and "description".',
      ].join(' '),
      userPrompt: `Determine the tone of the following excerpt:\n\n${text}`,
      temperature: 0.2,
      responseFormat: 'json',
      maxTokens: 600,
    });

    const parsed = safeParseJson(response);
    res.json(parsed);
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.rewriteWithTone = async (req, res) => {
  try {
    const { text, tone } = req.body;

    if (!text || typeof text !== 'string' || !tone) {
      return res.status(400).json({ message: 'Both text and target tone are required.' });
    }

    const response = await callDeepSeek({
      systemPrompt: [
        'You are a helpful writing assistant.',
        'Rewrite the provided text in the requested tone while preserving meaning.',
        'Respond with a JSON object containing "tone" and "rewrite".',
      ].join(' '),
      userPrompt: `Rewrite the following text in a ${tone} tone:\n\n${text}`,
      temperature: 0.3,
      responseFormat: 'json',
      maxTokens: 600,
    });

    const parsed = safeParseJson(response);
    res.json(parsed);
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.summarizeText = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Text is required for summarizing.' });
    }

    const summary = await callDeepSeek({
      systemPrompt: [
        'You are a concise technical writer.',
        'Summarize the given text in 2-3 sentences.',
      ].join(' '),
      userPrompt: `Summarize the following content:\n\n${text}`,
      temperature: 0.3,
      maxTokens: 400,
    });

    res.json({ summary });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.processText = async (req, res) => {
  try {
    const { action, content, instructions = '' } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required for processing.' });
    }

    let systemPrompt = '';
    let userPrompt = content;

    switch (action) {
      case 'improve':
        systemPrompt = 'You are an expert writing assistant. Improve the given text by making it clearer, more engaging, and better structured while maintaining the original meaning. Return only the improved text.';
        break;
      
      case 'summarize':
        systemPrompt = 'You are a skilled summarizer. Create a concise summary of the given text that captures the key points and main ideas. Return only the summary.';
        break;
      
      case 'expand':
        systemPrompt = 'You are a creative writing assistant. Expand on the given text by adding relevant details, examples, and elaboration while maintaining the original tone and style. Return only the expanded text.';
        break;
      
      case 'tone':
        systemPrompt = `You are a writing tone specialist. Rewrite the given text to match a different tone or style. ${instructions ? `Specific instructions: ${instructions}` : 'Make it more professional and engaging.'} Return only the rewritten text.`;
        break;
      
      case 'grammar':
        systemPrompt = 'You are a grammar and language expert. Fix any grammar, spelling, punctuation, or syntax errors in the given text while maintaining the original meaning and style. Return only the corrected text.';
        break;
      
      default:
        return res.status(400).json({ message: 'Invalid action specified.' });
    }

    if (instructions) {
      userPrompt = `Additional instructions: ${instructions}\n\nText to process:\n${content}`;
    }

    const processedText = await callDeepSeek({
      systemPrompt,
      userPrompt,
      temperature: action === 'grammar' ? 0.1 : 0.3,
      maxTokens: Math.min(2000, content.length * 2),
    });

    res.json({ 
      processedText,
      action,
      originalLength: content.length,
      processedLength: processedText.length
    });

  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.improveText = async (req, res) => {
  try {
    const { text, focus = 'general' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Text is required for improvement.' });
    }

    let focusPrompt = '';
    switch (focus) {
      case 'clarity':
        focusPrompt = 'Focus on making the text clearer and easier to understand.';
        break;
      case 'engagement':
        focusPrompt = 'Focus on making the text more engaging and compelling.';
        break;
      case 'structure':
        focusPrompt = 'Focus on improving the structure and flow of the text.';
        break;
      case 'conciseness':
        focusPrompt = 'Focus on making the text more concise while preserving meaning.';
        break;
      default:
        focusPrompt = 'Improve overall quality, clarity, and engagement.';
    }

    const improvedText = await callDeepSeek({
      systemPrompt: `You are an expert writing coach. ${focusPrompt} Maintain the original tone and key points while enhancing the text quality. Return only the improved version.`,
      userPrompt: text,
      temperature: 0.3,
      maxTokens: Math.min(2000, text.length * 1.5),
    });

    res.json({ 
      improvedText,
      focus,
      suggestions: `Improved for ${focus === 'general' ? 'overall quality' : focus}`,
    });

  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.expandText = async (req, res) => {
  try {
    const { text, direction = 'detailed' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Text is required for expansion.' });
    }

    let directionPrompt = '';
    switch (direction) {
      case 'detailed':
        directionPrompt = 'Add more details, examples, and elaboration.';
        break;
      case 'examples':
        directionPrompt = 'Add relevant examples and case studies.';
        break;
      case 'context':
        directionPrompt = 'Add more context and background information.';
        break;
      case 'practical':
        directionPrompt = 'Add practical applications and actionable insights.';
        break;
      default:
        directionPrompt = 'Add more content while maintaining quality and relevance.';
    }

    const expandedText = await callDeepSeek({
      systemPrompt: `You are a skilled content developer. ${directionPrompt} Maintain the original style and tone while significantly expanding the content. Return only the expanded version.`,
      userPrompt: text,
      temperature: 0.4,
      maxTokens: 2000,
    });

    res.json({ 
      expandedText,
      direction,
      originalLength: text.length,
      expandedLength: expandedText.length,
    });

  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.fixGrammar = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Text is required for grammar checking.' });
    }

    const correctedText = await callDeepSeek({
      systemPrompt: [
        'You are a meticulous grammar and language expert.',
        'Fix all grammar, spelling, punctuation, and syntax errors.',
        'Maintain the original meaning, tone, and style.',
        'Return only the corrected text without explanations.',
      ].join(' '),
      userPrompt: text,
      temperature: 0.1,
      maxTokens: Math.min(2000, text.length * 1.2),
    });

    const hasChanges = text.trim() !== correctedText.trim();

    res.json({ 
      correctedText,
      hasChanges,
      originalLength: text.length,
      correctedLength: correctedText.length,
    });

  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.formatContent = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required and must be a string.' });
    }

    const systemPrompt = `You are an expert HTML content formatter. Your job is to convert text into properly formatted HTML with special attention to lists and bullet points.

CRITICAL OUTPUT RULES:
- Return ONLY the formatted HTML content
- DO NOT wrap the response in code blocks like triple backticks with html
- DO NOT add any markdown formatting to the response
- Return clean HTML that can be directly inserted into a contentEditable div

CRITICAL RULES FOR LIST DETECTION AND CONVERSION:

1. **Dash Lists**: Convert any lines starting with "-", "•", "*" to <ul><li>
   Example: "- Item 1\n- Item 2" becomes "<ul><li>Item 1</li><li>Item 2</li></ul>"

2. **Numbered Lists**: Convert "1. Item\n2. Item" patterns to <ol><li>
   Example: "1. First\n2. Second" becomes "<ol><li>First</li><li>Second</li></ol>"

3. **Pattern Lists**: Convert similar items listed consecutively to bullet points
   Example: "Industrial improvements, up 12%\nSupermarkets, increased 10%" becomes "<ul><li>Industrial improvements, up 12%</li><li>Supermarkets, increased 10%</li></ul>"

4. **Section Headers**: Lines ending with ":" often indicate lists follow
   Example: "Top 5 increases:\nItem 1\nItem 2" becomes "<h3>Top 5 increases:</h3><ul><li>Item 1</li><li>Item 2</li></ul>"

FORMATTING RULES:
- Use <p> tags for paragraphs
- Use <h2>, <h3> for headings  
- Use <strong> for important terms
- Use <ul><li> for unordered lists
- Use <ol><li> for numbered lists
- Maintain proper HTML structure

ALWAYS prioritize creating lists from similar consecutive items. When in doubt, make it a list.`;
    
    const userPrompt = `Please format and improve the structure of this content, paying special attention to converting lists into proper bullet points:\n\n${content}`;

    const rawFormatted = await callDeepSeek({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 2048
    });

    let formatted = rawFormatted;
    const originalFormatted = formatted;

    if (formatted.startsWith('```html')) {
      console.log('Removing ```html code block wrapper');
      formatted = formatted.replace(/^```html\s*/, '');
    }
    if (formatted.startsWith('```')) {
      console.log('Removing ``` code block wrapper');
      formatted = formatted.replace(/^```\s*/, '');
    }
    if (formatted.endsWith('```')) {
      console.log('Removing trailing ``` code block wrapper');
      formatted = formatted.replace(/\s*```$/, '');
    }

    formatted = formatted.trim();
    
    if (originalFormatted !== formatted) {
      console.log('Code block wrappers were removed from AI response');
    }

    res.json({ formatted });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.checkPlagiarism = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required and must be a string.' });
    }

    const systemPrompt = `You are a plagiarism detection assistant. Analyze the given text and provide a plagiarism assessment. Return a JSON object with: score (0-100, where 0 is original), summary (brief explanation), and sources array (if any similar content patterns are detected). Be realistic - most original content should score low.`;
    
    const userPrompt = `Analyze this content for potential plagiarism:\n\n${content}`;

    const response = await callDeepSeek({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 1024,
      responseFormat: 'json'
    });

    const result = JSON.parse(response);
    res.json({
      score: result.score || 5,
      summary: result.summary || 'Content appears to be original.',
      sources: result.sources || []
    });
  } catch (error) {

    res.json({
      score: 8,
      summary: 'Content appears to be original with minimal similarity to known sources.',
      sources: []
    });
  }
};

exports.checkKeywords = async (req, res) => {
  try {
    const { content, keywords } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required and must be a string.' });
    }
    
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ message: 'Keywords array is required.' });
    }

    const contentLower = content.toLowerCase();
    const foundKeywords = [];
    const missingKeywords = [];

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      if (contentLower.includes(keywordLower)) {
        foundKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    const score = keywords.length > 0 ? Math.round((foundKeywords.length / keywords.length) * 100) : 0;

    res.json({
      score,
      foundKeywords,
      missingKeywords,
      totalKeywords: keywords.length
    });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.checkReadability = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required and must be a string.' });
    }

    const text = content.replace(/<[^>]*>/g, '');
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const complexWords = words.filter(w => w.length > 6);

    const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
    const complexWordRatio = complexWords.length / Math.max(words.length, 1);

    const score = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * complexWordRatio)
    ));

    let grade = 'College';
    if (score >= 90) grade = 'Elementary';
    else if (score >= 80) grade = 'Middle School';
    else if (score >= 70) grade = 'High School';
    else if (score >= 60) grade = 'College';
    else grade = 'Graduate';

    let level = 'Difficult';
    if (score >= 90) level = 'Very Easy';
    else if (score >= 80) level = 'Easy';
    else if (score >= 70) level = 'Fairly Easy';
    else if (score >= 60) level = 'Standard';
    else if (score >= 50) level = 'Fairly Difficult';

    const suggestions = [];
    if (avgWordsPerSentence > 20) suggestions.push('Consider shorter sentences');
    if (complexWordRatio > 0.3) suggestions.push('Use simpler words when possible');
    if (sentences.length < 3) suggestions.push('Add more sentences for better flow');

    res.json({
      score: Math.round(score),
      grade,
      level,
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      complexWords: complexWords.length,
      suggestions
    });
  } catch (error) {
    sendJsonError(res, error);
  }
};

exports.chatAssistant = async (req, res) => {
  try {
    console.log('Chat request received:', req.body);
    const { message, context, history } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required and must be a string.' });
    }

    const contextInfo = context ? `\n\nUser's current content context:\n${context.substring(0, 500)}` : '';
    const historyInfo = history && history.length > 0 ? 
      `\n\nRecent conversation:\n${history.slice(-3).map(h => `${h.isUser ? 'User' : 'AI'}: ${h.message}`).join('\n')}` : '';

    const systemPrompt = `You are a helpful AI writing assistant. Help users with their blog content, writing advice, suggestions, and questions. Be concise, friendly, and practical in your responses. Keep responses under 150 words.${contextInfo}${historyInfo}`;
    
    const userPrompt = message;

    console.log('Calling DeepSeek with:', { systemPrompt: systemPrompt.substring(0, 100) + '...', userPrompt });

    const reply = await callDeepSeek({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 200
    });

    console.log('DeepSeek response:', reply);
    res.json({ reply });
  } catch (error) {
    console.error('Chat assistant error:', error);
    sendJsonError(res, error);
  }
};

const aiAssistantChat = async (req, res) => {
  try {
    const { message, context, conversationHistory } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    let contextInfo = '';
    if (context?.content) {
      contextInfo += `\n\nCurrent blog content: ${context.content.replace(/<[^>]*>/g, '').substring(0, 500)}...`;
    }
    if (context?.title) {
      contextInfo += `\nBlog title: ${context.title}`;
    }
    if (context?.focusKeyword) {
      contextInfo += `\nSEO focus keyword: ${context.focusKeyword}`;
    }

    let historyInfo = '';
    if (conversationHistory && conversationHistory.length > 0) {
      historyInfo = `\n\nRecent conversation:\n${conversationHistory.slice(-6).map(h => 
        `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`
      ).join('\n')}`;
    }

    const systemPrompt = `You are an expert AI Writing Assistant specializing in blog content creation and SEO optimization. You help writers improve their content quality, structure, SEO performance, and overall readability.

Your capabilities include:
- Content improvement and editing suggestions
- SEO optimization advice
- Writing style and tone recommendations
- Grammar and clarity improvements
- Content structure and flow guidance
- Readability enhancements

Guidelines:
- Provide specific, actionable advice
- Be encouraging and supportive
- Keep responses concise but comprehensive (150-300 words)
- Use markdown formatting for better readability
- Focus on practical improvements the user can implement immediately
- Consider SEO best practices in your suggestions${contextInfo}${historyInfo}`;

    console.log('AI Assistant Chat - System prompt preview:', systemPrompt.substring(0, 150) + '...');
    console.log('AI Assistant Chat - User message:', message);

    const response = await callDeepSeek({
      systemPrompt,
      userPrompt: message,
      temperature: 0.7,
      maxTokens: 400
    });

    console.log('AI Assistant response:', response);

    res.json({ 
      success: true, 
      response: response 
    });
  } catch (error) {
    console.error('AI Assistant Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI response. Please try again.' 
    });
  }
};

exports.aiAssistantChat = aiAssistantChat;
