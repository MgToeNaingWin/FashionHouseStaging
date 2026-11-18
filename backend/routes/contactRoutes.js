const express = require('express');
const router = express.Router();
const authMiddleware = require('../src/utils/middleware/authMiddleware');
const adminMiddleware = require('../src/utils/middleware/adminMiddleware');
const contactController = require('../controllers/contactController');
const { contactValidator } = require('../src/utils/middleware/validator');

// Public: customers submit the contact form (no authentication required)
router.post('/', contactValidator, contactController.createMessage);

// Admin-only management routes
router.get('/unread-count', authMiddleware, adminMiddleware, contactController.getUnreadCount);

router.get('/', authMiddleware, adminMiddleware, contactController.listMessages);

// :id routes come last so "unread-count" is never captured as an id
router.get('/:id', authMiddleware, adminMiddleware, contactController.getMessage);

router.put('/:id/read', authMiddleware, adminMiddleware, contactController.setMessageRead);

router.delete('/:id', authMiddleware, adminMiddleware, contactController.deleteMessage);

module.exports = router;
