const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authentifier, coursierValide } = require('../middleware/auth');

// Toutes les routes utilisateur nécessitent une authentification
router.use(authentifier);

// ── Profil ────────────────────────────────────────────────────────
router.get('/',      userController.monProfil);
router.patch('/',    userController.modifierProfil);

// ── Adresses ──────────────────────────────────────────────────────
router.get('/addresses',         userController.listerAdresses);
router.post('/addresses',        userController.ajouterAdresse);
router.patch('/addresses/:id',   userController.modifierAdresse);
router.delete('/addresses/:id',  userController.supprimerAdresse);

// ── Mode Coursier ─────────────────────────────────────────────────
router.post('/courier-activation',  userController.activerModeCoursier);
router.post('/courier-documents',   userController.soumettreDocuments);
router.patch('/courier/disponibilite', userController.changerDisponibilite);
router.patch('/courier/position',   userController.mettreAJourPosition);

module.exports = router;
