
const SEOScoreGenerator = require('./seo-score-generator');

class BlogSEOService {
  constructor() {
    this.seoAnalyzer = new SEOScoreGenerator();
  }

  async analyzeBlogBeforePublish(blogData) {
    const results = {};

    try {
     
      results.seoScore = await this.seoAnalyzer.analyzeBlogPost(blogData);
      results.metadata = {
        analyzedAt: new Date().toISOString(),
        wordCount: this.getWordCount(blogData.content),
        readingTime: this.calculateReadingTime(blogData.content),
        slug: this.generateSlug(blogData.title)
      };

      console.log('SEO analysis completed successfully');
      return results;
    } catch (error) {
      console.error('SEO Analysis failed:', error);
      return {
        error: 'SEO analysis failed',
        message: error.message
      };
    }
  }

  generateSlug(title) {
    if (!title) return '';
    
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') 
      .replace(/[\s_-]+/g, '-') 
      .replace(/^-+|-+$/g, ''); 
  }

  calculateReadingTime(content) {
    if (!content) return 0;
    
    const textContent = content.replace(/<[^>]*>/g, ' ');
    const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
    const minutes = Math.ceil(words.length / 200);
    
    return minutes;
  }

  getWordCount(content) {
    if (!content) return 0;
    
    const textContent = content.replace(/<[^>]*>/g, ' ');
    const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
    
    return words.length;
  }

  extractKeywordSuggestions(content, title) {
    if (!content && !title) return [];

    const text = (title + ' ' + content).toLowerCase();
    const textContent = text.replace(/<[^>]*>/g, ' ');

    const words = textContent
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !/^\d+$/.test(word)); 

    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const suggestions = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    return suggestions;
  }

  getContentTypeRecommendations(contentType = 'blog') {
    const recommendations = {
      blog: {
        minWords: 600,
        maxWords: 2500,
        recommendedSections: ['Introduction', 'Main Content', 'Conclusion', 'Call to Action'],
        seoTips: [
          'Include your focus keyword in the first paragraph',
          'Use H2 and H3 tags for section headers',
          'Add internal and external links',
          'Include relevant images with alt text',
          'End with a call to action'
        ]
      },
      tutorial: {
        minWords: 800,
        maxWords: 3000,
        recommendedSections: ['Overview', 'Prerequisites', 'Step-by-step Guide', 'Conclusion'],
        seoTips: [
          'Use numbered lists for steps',
          'Include code examples if applicable',
          'Add screenshots or diagrams',
          'Link to related tutorials',
          'Include a summary at the end'
        ]
      },
      review: {
        minWords: 500,
        maxWords: 2000,
        recommendedSections: ['Product Overview', 'Features', 'Pros and Cons', 'Verdict'],
        seoTips: [
          'Include product specifications',
          'Add comparison with alternatives',
          'Use schema markup for ratings',
          'Include affiliate disclaimers if applicable',
          'Add purchase links'
        ]
      }
    };

    return recommendations[contentType] || recommendations.blog;
  }

  calculateFleschReadingEase(content) {
    const textContent = content.replace(/<[^>]*>/g, ' ').trim();
    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = textContent.split(/\s+/).filter(w => w.length > 0);
    
    const fleschData = this.seoAnalyzer.calculateFleschReadingEase(textContent);

    return {
      ...fleschData,
      wordCount: words.length,
      sentenceCount: sentences.length,
      avgWordsPerSentence: sentences.length > 0 ? (words.length / sentences.length).toFixed(1) : 0
    };
  }

  getReadabilityAnalysis(content) {
    const blogData = { content };
    return this.seoAnalyzer.analyzeReadability(blogData);
  }
}

module.exports = BlogSEOService;