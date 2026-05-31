const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/guardian.controller');

// 사용자(user) 전용 라우트
router.post('/request', authenticate, authorize('user'), ctrl.requestGuardian);
router.get('/', authenticate, authorize('user'), ctrl.listMyGuardians);
router.patch('/:relationId/permission', authenticate, authorize('user'), ctrl.updatePermission);
router.delete('/:relationId', authenticate, authorize('user'), ctrl.revokeGuardian);

// 보호자(guardian) 전용 라우트
router.patch('/:relationId/respond', authenticate, authorize('guardian'), ctrl.respondToRequest);
router.get('/linked-users', authenticate, authorize('guardian'), ctrl.listLinkedUsers);

module.exports = router;
