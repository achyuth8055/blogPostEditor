
const { getCollection, ObjectId } = require('../lib/db');

function isValidObjectId(value) {
  return ObjectId.isValid(value);
}

function cleanPostContent(content) {
  if (!content || typeof content !== 'string') return content;

  return content
    .replace(/<div class="image-resize-tooltip">.*?<\/div>/g, '')
    .replace(/Click to select • Drag handles to resize • Ctrl\+Arrow keys for precision/g, '')
    .trim();
}

async function saveOrUpdatePost({ 
  postId, 
  postTitle, 
  postContent, 
  postXml = '', 
  status = 'draft', 
  seoData = null, 
  metaDescription = '', 
  focusKeyword = '', 
  urlSlug = '',
  canonicalUrl = '',
  ogTitle = '',
  ogDescription = ''
}) {
  const postsCollection = getCollection('posts');
  const now = new Date();

  console.log('=== saveOrUpdatePost called ===');
  console.log('  postId:', postId);
  console.log('  postTitle:', postTitle);
  console.log('  status:', status);

  const normalizedPostId = typeof postId === 'string' ? postId.trim() : '';
  console.log('  normalizedPostId:', normalizedPostId);
  console.log('  isValidObjectId:', isValidObjectId(normalizedPostId));

  let cleanedContent = cleanPostContent(postContent);
  
  if (typeof cleanedContent === 'string') {
    const beforeLength = cleanedContent.length;
    cleanedContent = cleanedContent
      .replace(/\sclass="[^"]*"/g, '')          
      .replace(/\sstyle="[^"]*"/g, '')          
      .replace(/\sdata-[\w-]+="[^"]*"/g, '')    
      .replace(/\son[a-z]+="[^"]*"/gi, '');     
    const afterLength = cleanedContent.length;
    console.log(`[SERVER CLEANER] Stripped ${beforeLength - afterLength} chars from HTML`);
  }
  const contentXml = typeof postXml === 'string' ? postXml.trim() : '';

  if (!urlSlug && postTitle) {
    urlSlug = postTitle
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  if (normalizedPostId && isValidObjectId(normalizedPostId)) {
    
    console.log('[UPDATE CHECK] Looking for document with ID:', normalizedPostId);
    console.log('[UPDATE CHECK] Creating ObjectId with value:', normalizedPostId);
    
    let objectIdToFind;
    try {
      objectIdToFind = new ObjectId(normalizedPostId);
      console.log('[UPDATE CHECK] ObjectId created successfully:', objectIdToFind.toString());
    } catch (err) {
      console.error('[UPDATE CHECK] Failed to create ObjectId:', err);
      throw new Error('Invalid post ID format');
    }
    
    const existing = await postsCollection.findOne({ _id: objectIdToFind });
    console.log('[UPDATE CHECK] Found existing document?', !!existing);
    if (existing) {
      console.log('[UPDATE CHECK] Existing document ID:', existing._id.toString());
    }
    
    if (existing) {
      
      const updateFields = {
        title: postTitle,
        content: cleanedContent,
        updatedAt: now,
      };
      if (contentXml) updateFields.contentXml = contentXml;

      if (metaDescription) updateFields.metaDescription = metaDescription;
      if (focusKeyword) updateFields.focusKeyword = focusKeyword;
      if (urlSlug) updateFields.urlSlug = urlSlug;
      if (canonicalUrl) updateFields.canonicalUrl = canonicalUrl;
      if (ogTitle) updateFields.ogTitle = ogTitle;
      if (ogDescription) updateFields.ogDescription = ogDescription;
      if (seoData) updateFields.seoAnalysis = seoData;

      if (status === 'published') {
        updateFields.status = status;
      }
      
      const result = await postsCollection.findOneAndUpdate(
        { _id: objectIdToFind },
        {
          $set: updateFields,
        },
        { returnDocument: 'after' }
      );

      if (result) {
        console.log('✓ Updated existing post:', normalizedPostId);
        return result._id.toString();
      } else {
        throw new Error('Failed to update post');
      }
    } else {
      console.error(`❌ Post ID ${normalizedPostId} not found in database - preventing duplicate creation`);
      throw new Error('Post not found. Please refresh the page and try again.');
    }
  }

  const newPost = {
    title: postTitle,
    content: cleanedContent,
    status: status,
    createdAt: now,
    updatedAt: now,
  };
  if (contentXml) newPost.contentXml = contentXml;

  if (metaDescription) newPost.metaDescription = metaDescription;
  if (focusKeyword) newPost.focusKeyword = focusKeyword;
  if (urlSlug) newPost.urlSlug = urlSlug;
  if (canonicalUrl) newPost.canonicalUrl = canonicalUrl;
  if (ogTitle) newPost.ogTitle = ogTitle;
  if (ogDescription) newPost.ogDescription = ogDescription;
  if (seoData) newPost.seoAnalysis = seoData;

  const insertResult = await postsCollection.insertOne(newPost);
  console.log('✓ Created new post:', insertResult.insertedId.toString());

  return insertResult.insertedId.toString();
}

exports.cleanExistingPosts = async (req, res) => {
  try {
    const result = await cleanExistingPostsInternal();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const cleanExistingPostsInternal = async () => {
  try {
    const postsCollection = getCollection('posts');
    const posts = await postsCollection.find({}).toArray();
    let cleanedCount = 0;
    
    for (const post of posts) {
      const cleanedContent = cleanPostContent(post.content);
      if (cleanedContent !== post.content) {
        await postsCollection.updateOne(
          { _id: post._id },
          { $set: { content: cleanedContent, updatedAt: new Date() } }
        );
        cleanedCount++;
      }
    }
    
    console.log(`Cleaned ${cleanedCount} posts from tooltip text`);
    return { success: true, cleanedCount };
  } catch (error) {
    console.error('Error cleaning existing posts:', error);
    return { success: false, error: error.message };
  }
};

exports.getHomePage = async (req, res, next) => {
  try {
    res.render('home', {
      pageTitle: 'AI Blog - Home'
    });
  } catch (error) {
    next(error);
  }
};

exports.createNewPost = async (req, res, next) => {
  try {
    console.log('\n🆕 Creating new post from home page...');
    const postId = await saveOrUpdatePost({
      postId: null,
      postTitle: 'Untitled Draft',
      postContent: '',
      postXml: '<document></document>',
      status: 'draft'
    });
    console.log('✓ New post created:', postId);
    res.json({ success: true, postId });
  } catch (error) {
    console.error('Error creating new post:', error);
    next(error);
  }
};

exports.getDrafts = async (req, res, next) => {
  try {
    const postsCollection = getCollection('posts');
    const drafts = await postsCollection
      .find({ status: 'draft' })
      .sort({ updatedAt: -1 })
      .toArray();
    
    res.json(drafts);
  } catch (error) {
    console.error('Error getting drafts:', error);
    next(error);
  }
};

exports.getPublished = async (req, res, next) => {
  try {
    const postsCollection = getCollection('posts');
    const published = await postsCollection
      .find({ status: 'published' })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(published);
  } catch (error) {
    console.error('Error getting published posts:', error);
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    
    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid post ID' });
    }
    
    const postsCollection = getCollection('posts');
    const result = await postsCollection.deleteOne({ _id: new ObjectId(postId) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    
    console.log('✓ Deleted post:', postId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    next(error);
  }
};

exports.getEditorPage = async (req, res, next) => {
  try {
    const requestedPostId = req.query.postId;

    if (!requestedPostId) {
      console.log('⚠️ No postId provided, redirecting to home page');
      return res.redirect('/home');
    }

    if (!isValidObjectId(requestedPostId)) {
      console.log('⚠️ Invalid postId, redirecting to home page');
      return res.redirect('/home');
    }

    const post = await getCollection('posts').findOne({
      _id: new ObjectId(requestedPostId),
    });

    if (!post) {
      console.log('⚠️ Post not found, redirecting to home page');
      return res.redirect('/home');
    }

    const postData = {
      postId: post._id.toString(),
      postTitle: post.title,
      postContent: post.content,
      status: post.status || 'draft',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      urlSlug: post.urlSlug || '',
      canonicalUrl: post.canonicalUrl || '',
      ogTitle: post.ogTitle || '',
      ogDescription: post.ogDescription || '',
      seoAnalysis: post.seoAnalysis || null,
    };

    console.log('✓ Loading post in editor:', postData.postId);

    const displayTitle = (postData.postTitle === 'Untitled Draft') ? '' : postData.postTitle;

    res.render('editor', {
      pageTitle: displayTitle || 'Create New Blog Post',
      postId: postData.postId,
      postTitle: displayTitle,
      postContent: postData.postContent,
      postStatus: postData.status,
      metaDescription: postData.metaDescription || '',
      focusKeyword: postData.focusKeyword || '',
      urlSlug: postData.urlSlug || '',
      canonicalUrl: postData.canonicalUrl || '',
      ogTitle: postData.ogTitle || '',
      ogDescription: postData.ogDescription || '',
      seoAnalysis: postData.seoAnalysis || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitPost = async (req, res, next) => {
  try {
    const { 
      postTitle, 
      postContent, 
      postXml, 
      postId, 
      seoData, 
      metaDescription, 
      focusKeyword, 
      urlSlug,
      canonicalUrl,
      ogTitle,
      ogDescription
    } = req.body;
    try {
      const htmlBytes = Buffer.byteLength(postContent || '', 'utf8');
      const xmlBytes = Buffer.byteLength(postXml || '', 'utf8');
      console.log('Submit sizes -> HTML bytes:', htmlBytes, 'XML bytes:', xmlBytes);
    } catch (_) {}

    if (!postTitle || postTitle.trim() === '' || postTitle.trim() === 'Untitled Draft' || typeof postContent === 'undefined') {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Please provide a proper title for your blog post before publishing.',
        error: {},
      });
    }

    let parsedSeoData = null;
    if (seoData) {
      try {
        parsedSeoData = JSON.parse(seoData);
      } catch (e) {
        console.warn('Failed to parse SEO data:', e);
      }
    }

    const savedId = await saveOrUpdatePost({ 
      postId, 
      postTitle, 
      postContent,
      postXml,
      status: 'published',
      seoData: parsedSeoData,
      metaDescription: metaDescription || '',
      focusKeyword: focusKeyword || '',
      urlSlug: urlSlug || '',
      canonicalUrl: canonicalUrl || '',
      ogTitle: ogTitle || '',
      ogDescription: ogDescription || ''
    });

    console.log('Post submitted/updated with SEO data:', savedId);
    res.redirect(`/post/${savedId}`);
  } catch (error) {
    next(error);
  }
};

exports.savePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { 
      postTitle, 
      postContent, 
      postXml, 
      seoData, 
      metaDescription, 
      focusKeyword, 
      urlSlug,
      canonicalUrl,
      ogTitle,
      ogDescription
    } = req.body;
    
    console.log('');
    console.log('═══ SAVE DRAFT REQUEST ═══');
    console.log('[SAVE] req.params.postId:', postId);
    console.log('[SAVE] postTitle:', postTitle);
    console.log('[SAVE] Valid ObjectId?', isValidObjectId(postId));
    
    try {
      const htmlBytes = Buffer.byteLength(postContent || '', 'utf8');
      const xmlBytes = Buffer.byteLength(postXml || '', 'utf8');
      console.log('Draft save sizes -> HTML bytes:', htmlBytes, 'XML bytes:', xmlBytes);
    } catch (_) {}

    if (!postTitle || typeof postContent === 'undefined') {
      console.error('Auto-save validation failed:', {
        postId,
        postTitle,
        postContent: typeof postContent,
      });
      return res.status(400).json({ message: 'Missing required fields for saving.' });
    }

    let parsedSeoData = null;
    if (seoData && typeof seoData === 'string') {
      try {
        parsedSeoData = JSON.parse(seoData);
      } catch (e) {
        console.warn('Failed to parse SEO data in draft save:', e);
      }
    } else if (seoData && typeof seoData === 'object') {
      parsedSeoData = seoData;
    }

    const savedId = await saveOrUpdatePost({ 
      postId, 
      postTitle, 
      postContent,
      postXml,
      status: 'draft',
      seoData: parsedSeoData,
      metaDescription: metaDescription || '',
      focusKeyword: focusKeyword || '',
      urlSlug: urlSlug || '',
      canonicalUrl: canonicalUrl || '',
      ogTitle: ogTitle || '',
      ogDescription: ogDescription || ''
    });

    console.log('Post auto-saved with SEO data:', savedId);

    res.status(200).json({
      message: 'Post saved successfully',
      postId: savedId,
    });
  } catch (error) {
    console.error('❌ [SAVE DRAFT] Controller error:', error);

    let errorMessage = 'Failed to save draft due to a server error.';
    let statusCode = 500;
    
    if (error.name === 'ValidationError') {
      errorMessage = 'Invalid data provided. Please check your content and try again.';
      statusCode = 400;
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      if (error.code === 11000) {
        errorMessage = 'A post with this title already exists. Please choose a different title.';
        statusCode = 409;
      } else {
        errorMessage = 'Database error occurred. Please try again in a few moments.';
        statusCode = 503;
      }
    } else if (error.message.includes('Post not found')) {
      errorMessage = 'The post you are trying to save was not found. Please refresh the page and try again.';
      statusCode = 404;
    } else if (error.message.includes('Invalid post ID')) {
      errorMessage = 'Invalid post ID. Please refresh the page and try again.';
      statusCode = 400;
    }
    
    res.status(statusCode).json({
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.viewPost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    if (!isValidObjectId(postId)) {
      return res.status(404).render('error', {
        title: 'Post Not Found',
        message: 'The requested post does not exist.',
        error: {},
      });
    }

    const post = await getCollection('posts').findOne({ _id: new ObjectId(postId) });

    if (!post) {
      return res.status(404).render('error', {
        title: 'Post Not Found',
        message: 'The requested post does not exist.',
        error: {},
      });
    }

    res.render('post', {
      pageTitle: post.title,
      postTitle: post.title,
      postContent: post.content,
      updatedAt: post.updatedAt,
      createdAt: post.createdAt,
      postId: post._id.toString(),
    });
  } catch (error) {
    next(error);
  }
};

exports.getBlogListPage = async (req, res, next) => {
  try {
    const postsCollection = getCollection('posts');
    const publishedPosts = await postsCollection
      .find({ status: 'published' })
      .sort({ createdAt: -1 })
      .toArray();

    res.render('blog-list', {
      pageTitle: 'CCTA Blog - All Posts',
      posts: publishedPosts
    });
  } catch (error) {
    console.error('Error loading blog list:', error);
    next(error);
  }
};

exports.createOrUpdatePost = async (req, res, next) => {
  try {
    const { title, content, tags = [], postId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post title is required.' 
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Post content is required.' 
      });
    }

    const postsCollection = getCollection('posts');
    const now = new Date();

    let result;

    if (postId && isValidObjectId(postId)) {

      result = await postsCollection.findOneAndUpdate(
        { _id: new ObjectId(postId) },
        {
          $set: {
            title: title.trim(),
            content: content.trim(),
            tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
            updatedAt: now,
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        return res.status(404).json({ 
          success: false, 
          message: 'Post not found.' 
        });
      }
    } else {
      result = await postsCollection.insertOne({
        title: title.trim(),
        content: content.trim(),
        tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
        createdAt: now,
        updatedAt: now,
      });
    }

    const savedPostId = postId || result.insertedId.toString();

    res.json({
      success: true,
      message: postId ? 'Post updated successfully!' : 'Post created successfully!',
      postId: savedPostId,
      data: {
        title: title.trim(),
        tags: Array.isArray(tags) ? tags.filter(tag => tag.trim()) : [],
        updatedAt: now,
      }
    });

  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save post. Please try again.' 
    });
  }
};
