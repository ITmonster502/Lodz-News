const express = require('express');
const router = express.Router();
const { getCommentsByArticle, createComment, moderateComment, getAllComments } = require('../controllers/commentController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.get('/', protect, adminOnly, getAllComments);
router.get('/:articleId', getCommentsByArticle);
router.post('/', protect, createComment);
router.put('/:id/moderate', protect, adminOnly, moderateComment);

module.exports = router;
