const express = require('express');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/reformat', aiController.reformatContent);
router.post('/spellcheck', aiController.spellCheckContent);
router.post('/tone/analyze', aiController.analyzeTone);
router.post('/tone/rewrite', aiController.rewriteWithTone);
router.post('/summarize', aiController.summarizeText);
router.post('/process-text', aiController.processText);
router.post('/improve', aiController.improveText);
router.post('/expand', aiController.expandText);
router.post('/grammar-fix', aiController.fixGrammar);

router.post('/format', aiController.formatContent);
router.post('/plagiarism', aiController.checkPlagiarism);
router.post('/keywords', aiController.checkKeywords);
router.post('/readability', aiController.checkReadability);
router.post('/chat', aiController.chatAssistant);
router.post('/ai-chat', aiController.aiAssistantChat);

module.exports = router;
