const express = require('express');
const router = express.Router();
const walletController   = require('../controllers/walletController');
const litigeController   = require('../controllers/litigeController');
const Notification       = require('../models/Notification');
const { authentifier }   = require('../middleware/auth');
const { repondreOk }     = require('../utils/reponses');

router.use(authentifier);

// ── Wallet ────────────────────────────────────────────────────────
router.get('/wallet',                 walletController.monWallet);
router.get('/wallet/transactions',    walletController.historiqueTransactions);
router.post('/wallet/withdraw',       walletController.demanderRetrait);

// ── Litiges ───────────────────────────────────────────────────────
router.get('/disputes',               litigeController.mesLitiges);
router.post('/disputes',              litigeController.ouvrirLitige);
router.get('/disputes/:id',           litigeController.detailLitige);
router.post('/disputes/:id/evidence', litigeController.ajouterPreuve);

// ── Évaluations ───────────────────────────────────────────────────
router.post('/ratings',               litigeController.soumettreEvaluation);

// ── Notifications ─────────────────────────────────────────────────
router.get('/notifications', async (req, res, next) => {
  try {
    const { lu, page = 1, limit = 30 } = req.query;
    const filtre = { userId: req.userId };
    if (typeof lu !== 'undefined') filtre.lu = lu === 'true';

    const total = await Notification.countDocuments(filtre);
    const notifications = await Notification.find(filtre)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { notifications }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { lu: true, luLe: new Date() }
    );
    return repondreOk(res, {}, 'Notification marquée comme lue');
  } catch (err) { next(err); }
});

router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, lu: false },
      { lu: true, luLe: new Date() }
    );
    return repondreOk(res, {}, 'Toutes les notifications marquées comme lues');
  } catch (err) { next(err); }
});

module.exports = router;
