const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/notification.controller');

// 사용자/보호자 공통 (recipient_id 기준이라 role 제한 없음)
router.get('/', authenticate, ctrl.listMyNotifications);
router.get('/unread-count', authenticate, ctrl.getUnreadCount);
router.patch('/read-all', authenticate, ctrl.markAllAsRead);
router.patch('/:id/read', authenticate, ctrl.markAsRead);

module.exports = router;
