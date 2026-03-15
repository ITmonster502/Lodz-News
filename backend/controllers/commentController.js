const Comment = require('../models/Comment');

exports.getCommentsByArticle = async (req, res) => {
  try {
    const comments = await Comment.find({ article: req.params.articleId, status: 'approved' })
      .populate('user', 'username')
      .sort({ created_at: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { article, content } = req.body;
    const comment = await Comment.create({
      article,
      user: req.user._id,
      content
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllComments = async (req, res) => {
  try {
    const comments = await Comment.find()
      .populate('user', 'username')
      .populate('article', 'title')
      .sort({ created_at: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.moderateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (comment) {
      comment.status = req.body.status;
      await comment.save();
      res.json(comment);
    } else {
      res.status(404).json({ message: 'Comment not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
