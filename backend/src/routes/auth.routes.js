const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/register', register); // UC-01, UC-08
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

module.exports = router;
