const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authentifier, autoriser } = require('../middleware/auth');

// Toutes les routes admin nécessitent d'être authentifié ET d'avoir le rôle admin
router.use(authentifier);
router.use(autoriser('admin'));

// ── Tableau de bord ───────────────────────────────────────────────
router.get('/analytics/dashboard', adminController.tableauDeBord);

// ── Gestion des utilisateurs ──────────────────────────────────────
router.get('/users',              adminController.listerUtilisateurs);
router.get('/users/:id',          adminController.ficheUtilisateur);
router.patch('/users/:id/status', adminController.changerStatutUtilisateur);

// ── Validation des coursiers ──────────────────────────────────────
router.get('/courier-verifications',             adminController.fileValidationCoursiers);
router.post('/courier-verifications/:id/decision', adminController.deciderValidationCoursier);

// ── Supervision des commandes ─────────────────────────────────────
router.get('/orders', adminController.superviserCommandes);

// ── Gestion des litiges ───────────────────────────────────────────
router.get('/disputes',             adminController.listerLitiges);
router.post('/disputes/:id/resolve', adminController.resoudreLitige);

// ── Paramètres tarifaires ─────────────────────────────────────────
router.patch('/settings/pricing', async (req, res, next) => {
  try {
    // En prod : sauvegarder en base dans une collection "settings"
    // Pour l'instant, on retourne ce qui a été envoyé
    const { prixBase, prixParKm, commissionRate } = req.body;
    // TODO : persister dans une collection Settings
    return res.json({ success: true, data: { prixBase, prixParKm, commissionRate },
      message: 'Paramètres mis à jour (redémarrage requis pour appliquer via .env)' });
  } catch (err) { next(err); }
});

// ── Promotions ────────────────────────────────────────────────────
const Promotion = require('../models/Promotion');
const { repondreOk, repondreCreé, repondre404 } = require('../utils/reponses');

router.get('/promotions', async (req, res, next) => {
  try {
    const promotions = await Promotion.find().sort({ createdAt: -1 });
    return repondreOk(res, { promotions });
  } catch (err) { next(err); }
});

router.post('/promotions', async (req, res, next) => {
  try {
    const promo = await Promotion.create({ ...req.body, creeParId: req.userId });
    return repondreCreé(res, { promo }, 'Promotion créée');
  } catch (err) { next(err); }
});

router.patch('/promotions/:id', async (req, res, next) => {
  try {
    const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!promo) return repondre404(res, 'Promotion introuvable');
    return repondreOk(res, { promo }, 'Promotion mise à jour');
  } catch (err) { next(err); }
});

module.exports = router;
