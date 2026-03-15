const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const makeAdmin = async (email) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOneAndUpdate(
      { email },
      { role: 'admin' },
      { new: true }
    );

    if (user) {
      console.log(`Success: User ${user.username} (${user.email}) is now an admin.`);
    } else {
      console.log(`Error: User with email ${email} not found.`);
    }
  } catch (err) {
    console.error('Database error:', err.message);
  } finally {
    await mongoose.connection.close();
  }
};

const email = process.argv[2];
if (!email) {
  console.log('Usage: node backend/scripts/makeAdmin.js your-email@example.com');
  process.exit(1);
}

makeAdmin(email);
