const mongoose = require('mongoose');
const slugify = require('slugify');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String },
  content: { type: String, required: true },
  excerpt: { type: String },
  featured_image: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  tags: [{ type: String }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  published_date: { type: Date, default: Date.now },
  status: { type: String, enum: ['draft', 'published', 'scheduled'], default: 'draft' },
  source_link: { type: String, unique: true, sparse: true },
  views: { type: Number, default: 0 }
});

articleSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Article', articleSchema);
