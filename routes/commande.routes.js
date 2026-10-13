const express = require('express');
const router = express.Router();
const commandeController = require('../controllers/commandeController');
const { authentifier } = require('../middleware/auth');

// Toutes les routes nécessitent une authentification
router.use(authentifier);

// ── Devis & Création ─────────────────────────────────────────────
router.post('/quote',         commandeController.devis);
router.post('/',              commandeController.creerCommande);

// ── Liste & Détail ────────────────────────────────────────────────
router.get('/',               commandeController.listerCommandes);
router.get('/coursier/mes-courses', commandeController.mesCourses); // avant /:id
router.get('/:id',            commandeController.detailCommande);

// ── Actions client ────────────────────────────────────────────────
router.post('/:id/confirm',   commandeController.confirmerCommande);
router.post('/:id/cancel',    commandeController.annulerCommande);

// ── Actions coursier ──────────────────────────────────────────────
router.post('/:id/accept',    commandeController.accepterCourse);
router.patch('/:id/status',   commandeController.mettreAJourStatut);
router.post('/:id/proof',     commandeController.soumettrePreuve);

module.exports = router;
