const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');

router.post('/create', postController.createNewPost);
router.get('/drafts', postController.getDrafts);
router.get('/published', postController.getPublished);
router.delete('/:postId', postController.deletePost);
router.post('/', postController.createOrUpdatePost);
router.post('/save/:postId', postController.savePost);

module.exports = router;
