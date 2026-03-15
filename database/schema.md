# Database Schema - Łódź News Platform

## Collections

### Users
- `username` (String, required, unique)
- `email` (String, required, unique)
- `password` (String, required, hashed)
- `role` (String, enum: ['reader', 'editor', 'admin'], default: 'reader')
- `created_at` (Date, default: Date.now)

### Articles
- `title` (String, required)
- `slug` (String, unique, generated from title)
- `content` (String, required)
- `excerpt` (String)
- `featured_image` (String, URL/Path)
- `category` (ObjectId, ref: 'Category', required)
- `tags` (Array of Strings)
- `author` (ObjectId, ref: 'User', required)
- `published_date` (Date, default: Date.now)
- `status` (String, enum: ['draft', 'published', 'scheduled'], default: 'draft')
- `views` (Number, default: 0)

### Categories
- `name` (String, required, unique)
- `slug` (String, unique, generated from name)

### Comments
- `article` (ObjectId, ref: 'Article', required)
- `user` (ObjectId, ref: 'User', required)
- `content` (String, required)
- `status` (String, enum: ['pending', 'approved', 'rejected'], default: 'pending')
- `created_at` (Date, default: Date.now)
