
class SEOScoreGenerator {
  constructor() {
    this.weights = {
      keyword: 25,
      content: 20,
      meta: 15,
      structure: 15,
      links: 10,
      images: 10,
      readability: 5
    };
  }

  async analyzeBlogPost(blogData) {
    const scores = {
      keyword: this.analyzeKeyword(blogData),
      content: this.analyzeContent(blogData),
      meta: this.analyzeMeta(blogData),
      structure: this.analyzeStructure(blogData),
      links: this.analyzeLinks(blogData),
      images: this.analyzeImages(blogData),
      readability: this.analyzeReadability(blogData)
    };

    const totalScore = this.calculateTotalScore(scores);
    const recommendations = this.generateRecommendations(scores, blogData);

    return {
      overallScore: totalScore,
      passed: totalScore >= 70,
      categoryScores: scores,
      recommendations: recommendations,
      details: this.getDetailedAnalysis(blogData, scores)
    };
  }

  analyzeKeyword(blogData) {
    const { focusKeyword, title, content, metaDescription, slug } = blogData;
    
    if (!focusKeyword) return { score: 0, maxScore: 25, percentage: 0, issues: ['No focus keyword provided'], details: {} };

    const keywordLower = focusKeyword.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const contentLower = (content || '').toLowerCase();
    const descLower = (metaDescription || '').toLowerCase();
    const slugLower = (slug || '').toLowerCase();

    let score = 0;
    const issues = [];

    if (titleLower.includes(keywordLower)) {
      const position = titleLower.indexOf(keywordLower);
      if (position <= 30) {
        score += 8;
      } else {
        score += 5;
        issues.push('Keyword in title but not at beginning');
      }
    } else {
      issues.push('Keyword not found in title');
    }

    if (descLower.includes(keywordLower)) {
      score += 5;
    } else {
      issues.push('Keyword not found in meta description');
    }

    const keywordInUrl = keywordLower.replace(/\s+/g, '-');
    if (slugLower.includes(keywordInUrl)) {
      score += 4;
    } else {
      issues.push('Keyword not found in URL');
    }

    if (contentLower) {
      const words = contentLower.split(/\s+/);
      const keywordCount = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
      const density = words.length > 0 ? (keywordCount / words.length) * 100 : 0;

      if (density >= 0.5 && density <= 2.5) {
        score += 8;
      } else if (density < 0.5) {
        issues.push(`Keyword density too low (${density.toFixed(2)}%)`);
      } else {
        issues.push(`Keyword density too high (${density.toFixed(2)}%) - risk of keyword stuffing`);
        score += 3;
      }
    }

    return {
      score: score,
      maxScore: 25,
      percentage: (score / 25) * 100,
      issues: issues,
      details: {
        inTitle: titleLower.includes(keywordLower),
        inMeta: descLower.includes(keywordLower),
        inUrl: slugLower.includes(keywordInUrl),
        density: contentLower ? ((contentLower.match(new RegExp(keywordLower, 'g')) || []).length / contentLower.split(/\s+/).length * 100).toFixed(2) + '%' : '0%'
      }
    };
  }

  analyzeContent(blogData) {
    const { content } = blogData;
    let score = 0;
    const issues = [];

    if (!content) {
      return {
        score: 0,
        maxScore: 20,
        percentage: 0,
        issues: ['No content provided'],
        details: { wordCount: 0, paragraphs: 0, sentences: 0, avgSentenceLength: 0 }
      };
    }

    const textContent = content.replace(/<[^>]*>/g, ' ');
    const words = textContent.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    if (wordCount >= 1000) {
      score += 12;
    } else if (wordCount >= 600) {
      score += 9;
    } else if (wordCount >= 300) {
      score += 6;
    } else {
      issues.push(`Content too short (${wordCount} words). Aim for at least 600.`);
      score += 3;
    }

    const paragraphs = content.split(/<\/p>|<br\s*\/?>/i).filter(p => p.trim().length > 0);
    const longParagraphs = paragraphs.filter(p => {
      const pWords = p.replace(/<[^>]*>/g, ' ').split(/\s+/).length;
      return pWords > 150;
    });

    if (longParagraphs.length === 0) {
      score += 4;
    } else {
      issues.push(`${longParagraphs.length} paragraphs are too long (>150 words)`);
      score += 2;
    }

    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;
    
    if (avgSentenceLength <= 20) {
      score += 4;
    } else if (avgSentenceLength <= 25) {
      score += 2;
      issues.push('Some sentences are too long. Keep average under 20 words.');
    } else {
      issues.push('Sentences are too long. Reduce complexity.');
    }

    return {
      score: score,
      maxScore: 20,
      percentage: (score / 20) * 100,
      issues: issues,
      details: {
        wordCount: wordCount,
        paragraphs: paragraphs.length,
        sentences: sentences.length,
        avgSentenceLength: avgSentenceLength.toFixed(1)
      }
    };
  }

  analyzeMeta(blogData) {
    const { title, metaDescription } = blogData;
    let score = 0;
    const issues = [];

    const titleLength = (title || '').length;
    if (titleLength >= 50 && titleLength <= 60) {
      score += 8;
    } else if (titleLength >= 40 && titleLength <= 70) {
      score += 5;
      if (titleLength < 50) issues.push('Title is a bit short');
      if (titleLength > 60) issues.push('Title is a bit long');
    } else {
      if (titleLength < 40) issues.push('Title too short (aim for 50-60 chars)');
      if (titleLength > 70) issues.push('Title too long - will be truncated in search');
      score += 2;
    }

    const descLength = (metaDescription || '').length;
    if (descLength >= 150 && descLength <= 160) {
      score += 7;
    } else if (descLength >= 120 && descLength <= 180) {
      score += 4;
      if (descLength < 150) issues.push('Meta description is a bit short');
      if (descLength > 160) issues.push('Meta description is a bit long');
    } else {
      if (descLength < 120) issues.push('Meta description too short (aim for 150-160)');
      if (descLength > 180) issues.push('Meta description too long - will be truncated');
      score += 1;
    }

    return {
      score: score,
      maxScore: 15,
      percentage: (score / 15) * 100,
      issues: issues,
      details: {
        titleLength: titleLength,
        descriptionLength: descLength
      }
    };
  }

  analyzeStructure(blogData) {
    const { content } = blogData;
    let score = 0;
    const issues = [];

    if (!content) {
      return {
        score: 0,
        maxScore: 15,
        percentage: 0,
        issues: ['No content to analyze'],
        details: { h1: 0, h2: 0, h3: 0, lists: 0 }
      };
    }

    const h1Count = (content.match(/<h1[^>]*>/gi) || []).length;
    if (h1Count === 1) {
      score += 3;
    } else if (h1Count === 0) {
      issues.push('No H1 heading found');
    } else {
      issues.push('Multiple H1 tags found. Use only one.');
      score += 1;
    }

    const h2Count = (content.match(/<h2[^>]*>/gi) || []).length;
    if (h2Count >= 3) {
      score += 6;
    } else if (h2Count >= 1) {
      score += 3;
      issues.push('Add more H2 headings for better structure');
    } else {
      issues.push('No H2 headings found. Add subheadings.');
    }

    const h3Count = (content.match(/<h3[^>]*>/gi) || []).length;
    if (h3Count > 0) {
      score += 3;
    } else {
      issues.push('Consider adding H3 tags for hierarchy');
      score += 1;
    }

    const ulCount = (content.match(/<ul[^>]*>/gi) || []).length;
    const olCount = (content.match(/<ol[^>]*>/gi) || []).length;
    if (ulCount + olCount >= 1) {
      score += 3;
    } else {
      issues.push('No lists found. Use bullet/numbered lists for readability');
    }

    return {
      score: score,
      maxScore: 15,
      percentage: (score / 15) * 100,
      issues: issues,
      details: {
        h1: h1Count,
        h2: h2Count,
        h3: h3Count,
        lists: ulCount + olCount
      }
    };
  }

  analyzeLinks(blogData) {
    const { content } = blogData;
    let score = 0;
    const issues = [];

    if (!content) {
      return {
        score: 0,
        maxScore: 10,
        percentage: 0,
        issues: ['No content to analyze links'],
        details: { internal: 0, external: 0 }
      };
    }

    const internalLinks = (content.match(/<a[^>]*href=["'](\/[^"']*|#[^"']*)["']/gi) || []).length;
    if (internalLinks >= 3) {
      score += 5;
    } else if (internalLinks >= 1) {
      score += 3;
      issues.push('Add more internal links to related content');
    } else {
      issues.push('No internal links found');
    }

    const externalLinks = (content.match(/<a[^>]*href=["']https?:\/\/[^"']*["']/gi) || []).length;
    if (externalLinks >= 2) {
      score += 5;
    } else if (externalLinks >= 1) {
      score += 3;
      issues.push('Add more external links to authoritative sources');
    } else {
      issues.push('No external links found');
    }

    return {
      score: score,
      maxScore: 10,
      percentage: (score / 10) * 100,
      issues: issues,
      details: {
        internal: internalLinks,
        external: externalLinks
      }
    };
  }

  analyzeImages(blogData) {
    const { content } = blogData;
    let score = 0;
    const issues = [];

    if (!content) {
      return {
        score: 0,
        maxScore: 10,
        percentage: 0,
        issues: ['No content to analyze images'],
        details: { total: 0, withAlt: 0 }
      };
    }

    const images = content.match(/<img[^>]*>/gi) || [];
    const imageCount = images.length;

    if (imageCount >= 3) {
      score += 4;
    } else if (imageCount >= 1) {
      score += 2;
      issues.push('Add more images to improve engagement');
    } else {
      issues.push('No images found. Add relevant images.');
    }

    let imagesWithAlt = 0;
    images.forEach(img => {
      if (/alt=["'][^"']+["']/i.test(img)) {
        imagesWithAlt++;
      }
    });

    if (imageCount > 0) {
      const altPercentage = (imagesWithAlt / imageCount) * 100;
      if (altPercentage === 100) {
        score += 6;
      } else if (altPercentage >= 50) {
        score += 3;
        issues.push(`${imageCount - imagesWithAlt} images missing alt text`);
      } else {
        issues.push('Most images missing alt text');
        score += 1;
      }
    }

    return {
      score: score,
      maxScore: 10,
      percentage: (score / 10) * 100,
      issues: issues,
      details: {
        total: imageCount,
        withAlt: imagesWithAlt
      }
    };
  }

  analyzeReadability(blogData) {
    const { content } = blogData;
    let score = 0;
    const issues = [];

    if (!content) {
      return {
        score: 0,
        maxScore: 5,
        percentage: 0,
        issues: ['No content to analyze readability'],
        details: { 
          transitionWords: 0, 
          passiveVoice: '0%',
          fleschScore: 0,
          fleschGrade: 'No content',
          avgWordsPerSentence: 0,
          avgSyllablesPerWord: 0
        }
      };
    }

    const textContent = content.replace(/<[^>]*>/g, ' ').trim();
    const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = textContent.split(/\s+/).filter(w => w.length > 0);

    const fleschData = this.calculateFleschReadingEase(textContent);

    if (fleschData.score >= 60) {
      score += 2; 
    } else if (fleschData.score >= 30) {
      score += 1; 
      issues.push('Content could be easier to read (Flesch score: ' + fleschData.score.toFixed(1) + ')');
    } else {
      issues.push('Content is very difficult to read (Flesch score: ' + fleschData.score.toFixed(1) + ')');
    }

    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 'additionally', 
                             'consequently', 'meanwhile', 'nevertheless', 'finally', 'firstly',
                             'also', 'furthermore', 'indeed', 'in fact', 'for example', 'for instance',
                             'in addition', 'in conclusion', 'on the other hand', 'similarly'];
    let transitionCount = 0;
    transitionWords.forEach(word => {
      const regex = new RegExp('\\b' + word + '\\b', 'gi');
      transitionCount += (textContent.match(regex) || []).length;
    });

    const transitionDensity = words.length > 0 ? (transitionCount / words.length) * 100 : 0;
    if (transitionDensity >= 0.5) {
      score += 2;
    } else if (transitionDensity >= 0.2) {
      score += 1;
      issues.push('Use more transition words for better flow');
    } else {
      issues.push('Add transition words to improve readability');
    }

    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    if (avgWordsPerSentence <= 20) {
      score += 1;
    } else {
      issues.push('Sentences are too long - aim for under 20 words per sentence');
    }

    return {
      score: score,
      maxScore: 5,
      percentage: (score / 5) * 100,
      issues: issues,
      details: {
        transitionWords: transitionCount,
        transitionDensity: transitionDensity.toFixed(2) + '%',
        fleschScore: fleschData.score,
        fleschGrade: fleschData.grade,
        avgWordsPerSentence: avgWordsPerSentence.toFixed(1),
        avgSyllablesPerWord: fleschData.avgSyllablesPerWord,
        totalWords: words.length,
        totalSentences: sentences.length
      }
    };
  }

  calculateFleschReadingEase(text) {
    if (!text || text.trim().length === 0) {
      return { score: 0, grade: 'No content', avgSyllablesPerWord: 0 };
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (sentences.length === 0 || words.length === 0) {
      return { score: 0, grade: 'No content', avgSyllablesPerWord: 0 };
    }

    let totalSyllables = 0;
    words.forEach(word => {
      totalSyllables += this.countSyllables(word);
    });

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = totalSyllables / words.length;

    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

    let grade;
    if (score >= 90) grade = 'Very Easy';
    else if (score >= 80) grade = 'Easy';
    else if (score >= 70) grade = 'Fairly Easy';
    else if (score >= 60) grade = 'Standard';
    else if (score >= 50) grade = 'Fairly Difficult';
    else if (score >= 30) grade = 'Difficult';
    else grade = 'Very Difficult';

    return {
      score: Math.max(0, Math.min(100, score)), 
      grade: grade,
      avgSyllablesPerWord: avgSyllablesPerWord.toFixed(2)
    };
  }

  countSyllables(word) {
    if (!word) return 0;
    
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length === 0) return 0;
    if (word.length === 1) return 1;

    let syllableCount = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiouy'.includes(word[i]);
      
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      
      previousWasVowel = isVowel;
    }

    if (word.endsWith('e') && syllableCount > 1) {
      syllableCount--;
    }

    if (word.length >= 3 && word.endsWith('le') && !'aeiouy'.includes(word[word.length - 3])) {
      syllableCount++;
    }
    
    return Math.max(1, syllableCount);
  }

  calculateTotalScore(scores) {
    let totalScore = 0;
    Object.keys(scores).forEach(category => {
      const weight = this.weights[category];
      const categoryScore = scores[category].score;
      const categoryMax = scores[category].maxScore;
      totalScore += (categoryScore / categoryMax) * weight;
    });
    return Math.round(totalScore);
  }

  generateRecommendations(scores, blogData) {
    const recommendations = [];
    
    Object.keys(scores).forEach(category => {
      if (scores[category].issues.length > 0) {
        recommendations.push({
          category: category.charAt(0).toUpperCase() + category.slice(1),
          priority: scores[category].percentage < 50 ? 'high' : 'medium',
          issues: scores[category].issues
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getDetailedAnalysis(blogData, scores) {
    return {
      keyword: scores.keyword.details,
      content: scores.content.details,
      meta: scores.meta.details,
      structure: scores.structure.details,
      links: scores.links.details,
      images: scores.images.details,
      readability: scores.readability.details
    };
  }
}

module.exports = SEOScoreGenerator;