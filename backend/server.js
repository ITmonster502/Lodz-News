const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for local development simplicity
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  skip: (req) => {
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }
});
app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/articles', require('./routes/articles'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/auto-import', require('./routes/autoImport'));

const Category = require('./models/Category');
const Article = require('./models/Article');
const cron = require('node-cron');
const { runAutoImport } = require('./controllers/autoImportController');

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await Category.syncIndexes();
    const defaultCategoryNames = [
      'Новости',
      'Спорт',
      'Культура',
      'Технологии',
      'Бизнес',
      'Музыка',
      'Фильмы'
    ];
    for (const name of defaultCategoryNames) {
      const exists = await Category.findOne({ name });
      if (!exists) await Category.create({ name });
    }

    await Article.syncIndexes();
    await Article.updateMany(
      { featured_image: { $regex: 'via\\.placeholder\\.com', $options: 'i' } },
      { $set: { featured_image: '/assets/placeholder.svg' } }
    );

    // Schedule auto-import every 6 hours
    cron.schedule('0 */6 * * *', () => {
      runAutoImport();
    });
    // Initial run on server start
    runAutoImport();
  })
  .catch(err => console.error('Could not connect to MongoDB:', err));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

setInterval(() => {}, 60 * 1000);
