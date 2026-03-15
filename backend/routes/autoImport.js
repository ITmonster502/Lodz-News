const express = require('express');
const router = express.Router();
const { triggerManualImport } = require('../controllers/autoImportController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/trigger', protect, adminOnly, triggerManualImport);

module.exports = router;
