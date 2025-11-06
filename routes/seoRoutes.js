const express = require('express');
const router = express.Router();
const BlogSEOService = require('../services/blog-seo-service');

const seoService = new BlogSEOService();

router.post('/analyze', async (req, res) => {
  try {
    const blogData = {
      title: req.body.title || '',
      content: req.body.content || '',
      metaDescription: req.body.metaDescription || '',
      focusKeyword: req.body.focusKeyword || '',
      slug: req.body.slug || seoService.generateSlug(req.body.title || ''),
      siteUrl: process.env.SITE_URL || 'http:
    };

    const analysis = await seoService.analyzeBlogBeforePublish(blogData);
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('SEO analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SEO analysis failed',
      message: error.message 
    });
  }
});

router.post('/keyword-suggestions', async (req, res) => {
  try {
    const { content, title } = req.body;
    const suggestions = seoService.extractKeywordSuggestions(content, title);
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Keyword suggestion error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate keyword suggestions',
      message: error.message 
    });
  }
});

router.get('/recommendations/:contentType', async (req, res) => {
  try {
    const contentType = req.params.contentType;
    const recommendations = seoService.getContentTypeRecommendations(contentType);
    res.json({ success: true, recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recommendations',
      message: error.message 
    });
  }
});

router.post('/generate-slug', async (req, res) => {
  try {
    const { title } = req.body;
    const slug = seoService.generateSlug(title);
    res.json({ success: true, slug });
  } catch (error) {
    console.error('Slug generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate slug',
      message: error.message 
    });
  }
});

router.post('/flesch-reading-ease', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.json({
        success: true,
        data: {
          score: 0,
          grade: 'No content',
          wordCount: 0,
          sentenceCount: 0,
          avgWordsPerSentence: 0,
          avgSyllablesPerWord: 0
        }
      });
    }

    const fleschData = seoService.calculateFleschReadingEase(content);
    res.json({ success: true, data: fleschData });
  } catch (error) {
    console.error('Flesch Reading Ease calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to calculate Flesch Reading Ease',
      message: error.message 
    });
  }
});

module.exports = router;