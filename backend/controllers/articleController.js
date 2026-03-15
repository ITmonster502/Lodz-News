const Article = require('../models/Article');

exports.getArticles = async (req, res) => {
  try {
    const { category, search, status, page, limit } = req.query;
    let query = {};
    
    // Only admins/editors can see all articles, others see only published and not in the future
    if (status !== 'all') {
      query.status = 'published';
      query.published_date = { $lte: new Date() };
    }
    
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = parseInt(limit, 10);
    const limitNum = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 50;
    const skipNum = (pageNum - 1) * limitNum;

    let q = Article.find(query)
      .populate('author', 'username')
      .populate('category', 'name')
      .sort({ published_date: -1 });
    q = q.skip(skipNum).limit(limitNum);
    const articles = await q;
    res.json(articles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTrendingArticles = async (req, res) => {
  try {
    const articles = await Article.find({ 
      status: 'published',
      published_date: { $lte: new Date() }
    })
      .populate('category', 'name')
      .sort({ views: -1 })
      .limit(5);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getArticleStats = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};

    if (status !== 'all') {
      query.status = 'published';
      query.published_date = { $lte: new Date() };
    }

    const totalArticles = await Article.countDocuments(query);
    const viewsAgg = await Article.aggregate([
      { $match: query },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    const totalViews = viewsAgg[0]?.totalViews || 0;

    const topArticle = await Article.findOne(query)
      .populate('author', 'username')
      .populate('category', 'name')
      .sort({ views: -1 })
      .select('title views featured_image category author published_date status');

    res.json({ totalArticles, totalViews, topArticle });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id)
      .populate('author', 'username')
      .populate('category', 'name');
    if (article) {
      article.views += 1;
      await article.save();
      res.json(article);
    } else {
      res.status(404).json({ message: 'Article not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const { title, content, category, tags, status, featured_image } = req.body;
    const article = await Article.create({
      title,
      content,
      category,
      tags,
      status,
      featured_image,
      author: req.user._id
    });
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (article) {
      article.title = req.body.title || article.title;
      article.content = req.body.content || article.content;
      article.category = req.body.category || article.category;
      article.tags = req.body.tags || article.tags;
      article.status = req.body.status || article.status;
      if (Object.prototype.hasOwnProperty.call(req.body, 'featured_image')) {
        article.featured_image = req.body.featured_image;
      }
      const updatedArticle = await article.save();
      res.json(updatedArticle);
    } else {
      res.status(404).json({ message: 'Article not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (article) {
      await article.deleteOne();
      res.json({ message: 'Article removed' });
    } else {
      res.status(404).json({ message: 'Article not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cleanupBrokenArticles = async (req, res) => {
  try {
    // Находим статьи, содержащие символ � в заголовке или контенте
    const result = await Article.deleteMany({
      $or: [
        { title: { $regex: '�' } },
        { content: { $regex: '�' } }
      ]
    });
    res.json({ message: 'Cleanup successful', count: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
