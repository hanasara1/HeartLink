const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/dashboard.controller');

// 보호자 대시보드
router.get('/guardian', authenticate, authorize('guardian'), ctrl.getGuardianDashboard);
router.get('/guardian/users/:userId', authenticate, authorize('guardian'), ctrl.getLinkedUserDetail);

// 사용자 본인 대시보드
router.get('/user', authenticate, authorize('user'), ctrl.getUserDashboard);

module.exports = router;
