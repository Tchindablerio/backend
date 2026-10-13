const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authentifier } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Limiter les tentatives de connexion (anti brute-force)
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
});

const limiterRegister = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: { success: false, error: { message: 'Trop de créations de compte depuis cette IP.' } },
});

// Routes publiques
router.post('/register', limiterRegister, authController.register);
router.post('/login',    limiterLogin,    authController.login);
router.post('/refresh',                  authController.refresh);

// Routes protégées
router.post('/logout', authentifier, authController.logout);

module.exports = router;
