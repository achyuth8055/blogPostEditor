const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

router.get('/home', postController.getHomePage);
router.get('/blog', postController.getBlogListPage); 
router.get('/', postController.getEditorPage);
router.get('/post/:postId', postController.viewPost); 

router.post('/submit', postController.submitPost); 

router.post('/save/:postId', postController.savePost);
router.get('/clean-posts', postController.cleanExistingPosts);

module.exports = router;

