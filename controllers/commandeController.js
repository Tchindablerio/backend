const Commande = require('../models/Commande');
const ProfilCoursier = require('../models/ProfilCoursier');
const Promotion = require('../models/Promotion');
const Facture = require('../models/Facture');
const { calculerPrix, calculerCommission, genererNumeroFacture } = require('../utils/calculs');
const { notifs } = require('../utils/notifications');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const {
  repondreOk, repondreCreé, repondre400, repondre403, repondre404, repondre409,
} = require('../utils/reponses');

// ── POST /api/v1/orders/quote ─────────────────────────────────────
exports.devis = async (req, res, next) => {
  try {
    const { latDepart, lngDepart, latArrivee, lngArrivee, typeColis, codePromo } = req.body;
    if (!latDepart || !lngDepart || !latArrivee || !lngArrivee) {
      return repondre400(res, 'Coordonnées de départ et d\'arrivée requises');
    }

    const { prix, distanceKm, dureeEstimee } = calculerPrix(
      latDepart, lngDepart, latArrivee, lngArrivee, typeColis || 'petit_colis'
    );

    let remise = 0;
    let promotionId = null;
    if (codePromo) {
      const promo = await Promotion.findOne({ code: codePromo.toUpperCase() });
      if (promo) {
        const validation = promo.estValide(req.userId, prix);
        if (validation.valide) {
          remise = promo.calculerRemise(prix);
          promotionId = promo._id;
        }
      }
    }

    const prixFinal = Math.max(0, prix - remise);
    return repondreOk(res, {
      prix, remise, prixFinal, distanceKm, dureeEstimee, promotionId,
    }, 'Devis calculé');
  } catch (err) { next(err); }
};

// ── POST /api/v1/orders ───────────────────────────────────────────
exports.creerCommande = async (req, res, next) => {
  try {
    const {
      adresseDepart, adresseArrivee, typeColis, poidsKg,
      instructions, codePromo, methodePaiement,
    } = req.body;

    if (!adresseDepart?.lat || !adresseDepart?.lng || !adresseDepart?.adresseTexte ||
        !adresseArrivee?.lat || !adresseArrivee?.lng || !adresseArrivee?.adresseTexte) {
      return repondre400(res, 'Adresses de départ et d\'arrivée complètes requises (lat, lng, adresseTexte)');
    }

    const { prix, distanceKm, dureeEstimee } = calculerPrix(
      adresseDepart.lat, adresseDepart.lng,
      adresseArrivee.lat, adresseArrivee.lng,
      typeColis || 'petit_colis'
    );

    let remise = 0, promotionId = null;
    if (codePromo) {
      const promo = await Promotion.findOne({ code: codePromo.toUpperCase() });
      if (promo) {
        const validation = promo.estValide(req.userId, prix);
        if (validation.valide) {
          remise = promo.calculerRemise(prix);
          promotionId = promo._id;
          promo.utilisationsActuelles += 1;
          promo.utilisateurs.push(req.userId);
          await promo.save();
        }
      }
    }

    const prixFinal = Math.max(0, prix - remise);
    const { commission, gainCoursier } = calculerCommission(prixFinal);

    const commande = await Commande.create({
      clientId: req.userId,
      adresseDepart,
      adresseArrivee,
      typeColis: typeColis || 'petit_colis',
      poidsKg: poidsKg || 1,
      instructions: instructions || '',
      distanceKm,
      dureeEstimee,
      prix: prixFinal,
      commission,
      gainCoursier,
      remise,
      promotionId,
      statut: 'creee',
      historiqueStatuts: [{ statut: 'creee', par: 'client' }],
    });

    return repondreCreé(res, { commande }, 'Commande créée. Procédez au paiement pour confirmer.');
  } catch (err) { next(err); }
};

// ── POST /api/v1/orders/:id/confirm ──────────────────────────────
// Simule la confirmation après paiement (le vrai paiement est dans paiementController)
exports.confirmerCommande = async (req, res, next) => {
  try {
    const commande = await Commande.findOne({ _id: req.params.id, clientId: req.userId });
    if (!commande) return repondre404(res, 'Commande introuvable');
    if (commande.statut !== 'creee' && commande.statut !== 'payee') {
      return repondre409(res, `Impossible de confirmer une commande en statut : ${commande.statut}`);
    }

    commande.changerStatut('recherche_coursier', 'systeme', 'Paiement confirmé, recherche d\'un coursier');
    await commande.save();

    // Lancer la recherche de coursier en arrière-plan
    lancerMatchingCoursier(commande);

    return repondreOk(res, { commande }, 'Commande confirmée. Recherche d\'un coursier en cours...');
  } catch (err) { next(err); }
};

// ── GET /api/v1/orders ────────────────────────────────────────────
exports.listerCommandes = async (req, res, next) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const filtre = { clientId: req.userId };
    if (statut) filtre.statut = statut;

    const total = await Commande.countDocuments(filtre);
    const commandes = await Commande.find(filtre)
      .populate('coursierId', 'nom prenom photoProfil telephone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { commandes }, 'OK', 200, {
      total, page: Number(page), limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/orders/:id ────────────────────────────────────────
exports.detailCommande = async (req, res, next) => {
  try {
    const commande = await Commande.findById(req.params.id)
      .populate('clientId', 'nom prenom photoProfil telephone')
      .populate('coursierId', 'nom prenom photoProfil telephone')
      .populate('promotionId', 'code type valeur');

    if (!commande) return repondre404(res, 'Commande introuvable');

    // Seuls le client, le coursier ou un admin peuvent voir la commande
    const estClient  = commande.clientId._id.toString() === req.userId.toString();
    const estCoursier = commande.coursierId &&
      commande.coursierId._id.toString() === req.userId.toString();
    const estAdmin   = req.user.rolesActifs.includes('admin');

    if (!estClient && !estCoursier && !estAdmin) {
      return repondre403(res, 'Accès refusé');
    }

    return repondreOk(res, { commande });
  } catch (err) { next(err); }
};

// ── POST /api/v1/orders/:id/cancel ───────────────────────────────
exports.annulerCommande = async (req, res, next) => {
  try {
    const { motif } = req.body;
    const commande = await Commande.findOne({ _id: req.params.id, clientId: req.userId });
    if (!commande) return repondre404(res, 'Commande introuvable');

    const statutsAnnulables = ['creee', 'payee', 'recherche_coursier', 'coursier_assigne', 'en_route_ramassage'];
    if (!statutsAnnulables.includes(commande.statut)) {
      return repondre409(res, `Impossible d'annuler une commande en statut : ${commande.statut}`);
    }

    commande.changerStatut('annulee', 'client', motif || 'Annulation client');
    commande.motifAnnulation = motif || 'Annulation demandée par le client';
    commande.annulePar = 'client';
    await commande.save();

    await notifs.commandeAnnulee(req.userId, commande.motifAnnulation);

    return repondreOk(res, { commande }, 'Commande annulée');
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/orders/:id/status ──────────────────────────────
// Réservé au coursier assigné pour progresser dans les étapes
exports.mettreAJourStatut = async (req, res, next) => {
  try {
    const { statut, details } = req.body;

    const TRANSITIONS_COURSIER = {
      coursier_assigne:   ['en_route_ramassage'],
      en_route_ramassage: ['colis_ramasse'],
      colis_ramasse:      ['en_livraison'],
      en_livraison:       ['livree'],
    };

    const commande = await Commande.findById(req.params.id);
    if (!commande) return repondre404(res, 'Commande introuvable');

    if (!commande.coursierId || commande.coursierId.toString() !== req.userId.toString()) {
      return repondre403(res, 'Vous n\'êtes pas le coursier assigné à cette commande');
    }

    const transitionsAuthorisees = TRANSITIONS_COURSIER[commande.statut] || [];
    if (!transitionsAuthorisees.includes(statut)) {
      return repondre400(res, `Transition invalide : ${commande.statut} → ${statut}`);
    }

    commande.changerStatut(statut, 'coursier', details || '');

    // Si livraison confirmée : déclencher le paiement et les notifications
    if (statut === 'livree') {
      commande.preuveLivraison.dateLivraison = new Date();
      commande.archivageAutomatiqueDate = new Date(Date.now() + 72 * 60 * 60 * 1000); // +72h
      await crediterCoursier(commande);
      await notifs.commandeLivree(commande.clientId, commande._id);
    }

    if (statut === 'colis_ramasse') {
      await notifs.colisRamasse(commande.clientId);
    }

    await commande.save();
    return repondreOk(res, { commande }, 'Statut mis à jour');
  } catch (err) { next(err); }
};

// ── POST /api/v1/orders/:id/proof ────────────────────────────────
exports.soumettrePreuve = async (req, res, next) => {
  try {
    const { type, url, lat, lng } = req.body; // type: 'ramassage' | 'livraison' | 'signature'
    if (!type || !url) return repondre400(res, 'type et url sont requis');

    const commande = await Commande.findById(req.params.id);
    if (!commande) return repondre404(res, 'Commande introuvable');
    if (!commande.coursierId || commande.coursierId.toString() !== req.userId.toString()) {
      return repondre403(res, 'Accès refusé');
    }

    if (type === 'ramassage')  commande.preuveLivraison.photoRamassageUrl = url;
    if (type === 'livraison')  commande.preuveLivraison.photoLivraisonUrl = url;
    if (type === 'signature')  commande.preuveLivraison.signatureUrl = url;
    if (lat && lng) commande.preuveLivraison.positionLivraison = { lat, lng };

    await commande.save();
    return repondreOk(res, { preuveLivraison: commande.preuveLivraison }, 'Preuve enregistrée');
  } catch (err) { next(err); }
};

// ── GET /api/v1/orders/coursier/mes-courses ───────────────────────
exports.mesCourses = async (req, res, next) => {
  try {
    const { statut, page = 1, limit = 20 } = req.query;
    const filtre = { coursierId: req.userId };
    if (statut) filtre.statut = statut;

    const total = await Commande.countDocuments(filtre);
    const commandes = await Commande.find(filtre)
      .populate('clientId', 'nom prenom photoProfil')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { commandes }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/orders/:id/accept ───────────────────────────────
exports.accepterCourse = async (req, res, next) => {
  try {
    const commande = await Commande.findById(req.params.id);
    if (!commande) return repondre404(res, 'Commande introuvable');
    if (commande.statut !== 'recherche_coursier') {
      return repondre409(res, 'Cette course n\'est plus disponible');
    }

    const profil = await ProfilCoursier.findOne({ userId: req.userId, statutValidation: 'valide' });
    if (!profil) return repondre403(res, 'Profil coursier non validé');
    if (!profil.disponible) return repondre403(res, 'Vous êtes hors ligne');

    commande.coursierId = req.userId;
    commande.profilCoursierId = profil._id;
    commande.changerStatut('coursier_assigne', 'coursier', 'Course acceptée');
    await commande.save();

    // Marquer le coursier comme occupé
    profil.disponible = false;
    await profil.save();

    // Notifier le client
    const coursier = req.user;
    await notifs.coursierAssigne(commande.clientId, `${coursier.prenom} ${coursier.nom}`);

    return repondreOk(res, { commande }, 'Course acceptée ! Rendez-vous au point de ramassage.');
  } catch (err) { next(err); }
};

// ── Fonctions internes ────────────────────────────────────────────

// Matching simple : trouver le coursier le plus proche disponible
async function lancerMatchingCoursier(commande) {
  try {
    const RAYON_MAX_KM = 10;
    const coursiers = await ProfilCoursier.find({
      disponible: true,
      statutValidation: 'valide',
      'positionActuelle.lat': { $ne: null },
    }).populate('userId');

    if (!coursiers.length) {
      setTimeout(async () => {
        const cmd = await Commande.findById(commande._id);
        if (cmd && cmd.statut === 'recherche_coursier') {
          cmd.changerStatut('annulee', 'systeme', 'Aucun coursier disponible');
          cmd.motifAnnulation = 'Aucun coursier disponible dans votre zone';
          await cmd.save();
          await notifs.commandeAnnulee(commande.clientId, 'Aucun coursier disponible');
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    // En production : envoyer une notification push à chaque coursier éligible
  } catch (err) {
    console.error('Erreur matching:', err.message);
  }
}

// Créditer le gain du coursier après livraison
async function crediterCoursier(commande) {
  try {
    const wallet = await Wallet.findOne({ userId: commande.coursierId });
    if (!wallet) return;

    const soldeAvant = wallet.soldeDisponible;
    wallet.soldeDisponible += commande.gainCoursier;

    await WalletTransaction.create({
      walletId: wallet._id,
      userId: commande.coursierId,
      type: 'credit',
      montant: commande.gainCoursier,
      soldeAvant,
      soldeApres: wallet.soldeDisponible,
      reference: commande._id.toString(),
      description: `Gain course #${commande._id}`,
    });

    await wallet.save();
    await notifs.gainCredite(commande.coursierId, commande.gainCoursier);

    // Mettre à jour les stats du coursier
    await ProfilCoursier.findOneAndUpdate(
      { userId: commande.coursierId },
      { $inc: { totalCourses: 1 }, disponible: true }
    );
  } catch (err) {
    console.error('Erreur crédit coursier:', err.message);
  }
}
