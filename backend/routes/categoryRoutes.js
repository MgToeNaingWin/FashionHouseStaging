const express = require('express');
const router = express.Router();
const authMiddleware = require('../src/utils/middleware/authMiddleware');
const adminMiddleware = require('../src/utils/middleware/adminMiddleware');
const categoryController = require('../controllers/categoryController');

// Public routes

router.get('/', categoryController.getCategories);

// GET /:id - requires authentication
router.get('/:id', authMiddleware, categoryController.getCategoryById);

// POST / - admin only. Category mutations are administrative actions; without
// adminMiddleware any authenticated customer could rewrite storefront taxonomy.
router.post('/', authMiddleware, adminMiddleware, categoryController.createCategory);

// PUT /:id - admin only
router.put('/:id', authMiddleware, adminMiddleware, categoryController.updateCategory);

// DELETE /:id - admin only
router.delete('/:id', authMiddleware, adminMiddleware, categoryController.deleteCategory);

// Admin-only aliases (kept for backwards compatibility). These also need
// authMiddleware first so req.user exists when adminMiddleware runs.

router.post('/admin', authMiddleware, adminMiddleware, categoryController.createCategory);
router.put('/admin/:id', authMiddleware, adminMiddleware, categoryController.updateCategory);
router.delete('/admin/:id', authMiddleware, adminMiddleware, categoryController.deleteCategory);

module.exports = router;