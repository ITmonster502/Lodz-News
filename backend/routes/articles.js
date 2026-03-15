const express = require('express');
const router = express.Router();
const { 
  getArticles, 
  getArticleStats,
  getArticleById, 
  createArticle, 
  updateArticle, 
  deleteArticle,
  getTrendingArticles,
  cleanupBrokenArticles
} = require('../controllers/articleController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', getArticles);
router.get('/stats', protect, adminOnly, getArticleStats);
router.get('/trending', getTrendingArticles);
router.delete('/cleanup-broken', protect, adminOnly, cleanupBrokenArticles);
router.get('/:id([0-9a-fA-F]{24})', getArticleById);
router.post('/', protect, adminOnly, createArticle);
router.put('/:id([0-9a-fA-F]{24})', protect, adminOnly, updateArticle);
router.delete('/:id([0-9a-fA-F]{24})', protect, adminOnly, deleteArticle);

module.exports = router;
