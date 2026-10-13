const User = require('../models/User');
const ProfilCoursier = require('../models/ProfilCoursier');
const Commande = require('../models/Commande');
const Litige = require('../models/Litige');
const { Wallet, WalletTransaction } = require('../models/Wallet');
const { notifs, envoyerNotification } = require('../utils/notifications');
const {
  repondreOk, repondre400, repondre404, repondre409,
} = require('../utils/reponses');

// ── GET /api/v1/admin/users ───────────────────────────────────────
exports.listerUtilisateurs = async (req, res, next) => {
  try {
    const { statut, role, q, page = 1, limit = 30 } = req.query;
    const filtre = {};
    if (statut) filtre.statut = statut;
    if (role) filtre.rolesActifs = role;
    if (q) filtre.$or = [
      { nom: { $regex: q, $options: 'i' } },
      { prenom: { $regex: q, $options: 'i' } },
      { telephone: { $regex: q, $options: 'i' } },
    ];

    const total = await User.countDocuments(filtre);
    const users = await User.find(filtre)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { users }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/admin/users/:id ───────────────────────────────────
exports.ficheUtilisateur = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return repondre404(res, 'Utilisateur introuvable');

    const profilCoursier = await ProfilCoursier.findOne({ userId: user._id });
    const wallet = await Wallet.findOne({ userId: user._id });
    const nbCommandes = await Commande.countDocuments({ clientId: user._id });

    return repondreOk(res, { user, profilCoursier, wallet, nbCommandes });
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/admin/users/:id/status ──────────────────────────
exports.changerStatutUtilisateur = async (req, res, next) => {
  try {
    const { statut, motif } = req.body;
    const statutsValides = ['actif', 'bloque', 'suspendu', 'supprime'];
    if (!statutsValides.includes(statut)) {
      return repondre400(res, `Statut invalide. Valeurs : ${statutsValides.join(', ')}`);
    }

    const user = await User.findById(req.params.id);
    if (!user) return repondre404(res, 'Utilisateur introuvable');

    user.statut = statut;
    await user.save();

    await envoyerNotification({
      userId: user._id,
      type: 'systeme',
      titre: `Votre compte a été ${statut}`,
      contenu: motif || `Votre compte est désormais en statut : ${statut}`,
      canal: 'interne',
    });

    return repondreOk(res, { user }, `Statut mis à jour : ${statut}`);
  } catch (err) { next(err); }
};

// ── GET /api/v1/admin/courier-verifications ───────────────────────
exports.fileValidationCoursiers = async (req, res, next) => {
  try {
    const { statut = 'en_attente', page = 1, limit = 20 } = req.query;
    const total = await ProfilCoursier.countDocuments({ statutValidation: statut });
    const profils = await ProfilCoursier.find({ statutValidation: statut })
      .populate('userId', 'nom prenom telephone email photoProfil createdAt')
      .sort({ createdAt: 1 }) // FIFO
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { profils }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/admin/courier-verifications/:id/decision ─────────
exports.deciderValidationCoursier = async (req, res, next) => {
  try {
    const { decision, motifRejet } = req.body; // decision: 'valide' | 'rejete'
    if (!['valide', 'rejete'].includes(decision)) {
      return repondre400(res, 'decision doit être "valide" ou "rejete"');
    }
    if (decision === 'rejete' && !motifRejet) {
      return repondre400(res, 'Un motif de rejet est obligatoire');
    }

    const profil = await ProfilCoursier.findById(req.params.id).populate('userId');
    if (!profil) return repondre404(res, 'Profil coursier introuvable');

    profil.statutValidation = decision;
    if (decision === 'rejete') {
      profil.documents = profil.documents.map(d => ({
        ...d.toObject(), statutVerification: 'rejete', motifRejet,
      }));
    } else {
      profil.documents = profil.documents.map(d => ({
        ...d.toObject(), statutVerification: 'valide',
      }));
      // Ajouter le rôle coursier à l'utilisateur
      await User.findByIdAndUpdate(profil.userId._id, {
        $addToSet: { rolesActifs: 'coursier' },
      });
    }
    await profil.save();

    const type = decision === 'valide' ? 'profil_coursier_valide' : 'profil_coursier_rejete';
    const contenu = decision === 'valide'
      ? 'Félicitations ! Votre profil coursier est validé. Vous pouvez maintenant accepter des courses.'
      : `Votre profil coursier a été rejeté. Motif : ${motifRejet}`;

    await envoyerNotification({
      userId: profil.userId._id,
      type,
      titre: decision === 'valide' ? 'Profil coursier validé ✅' : 'Profil coursier rejeté',
      contenu,
      canal: 'push',
    });

    return repondreOk(res, { profil }, `Profil ${decision} avec succès`);
  } catch (err) { next(err); }
};

// ── GET /api/v1/admin/orders ──────────────────────────────────────
exports.superviserCommandes = async (req, res, next) => {
  try {
    const { statut, page = 1, limit = 30 } = req.query;
    const filtre = {};
    if (statut) filtre.statut = statut;

    const total = await Commande.countDocuments(filtre);
    const commandes = await Commande.find(filtre)
      .populate('clientId', 'nom prenom telephone')
      .populate('coursierId', 'nom prenom telephone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { commandes }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── GET /api/v1/admin/disputes ────────────────────────────────────
exports.listerLitiges = async (req, res, next) => {
  try {
    const { statut = 'ouvert', page = 1, limit = 20 } = req.query;
    const total = await Litige.countDocuments({ statut });
    const litiges = await Litige.find({ statut })
      .populate('ouvertPar', 'nom prenom telephone')
      .populate('partieAdverse', 'nom prenom telephone')
      .populate('commandeId', 'prix statut')
      .sort({ createdAt: 1 }) // FIFO : traiter les plus anciens en premier
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { litiges }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/admin/disputes/:id/resolve ───────────────────────
exports.resoudreLitige = async (req, res, next) => {
  try {
    const { resolution, decisionMotivee, montantRembourse, sanctionAppliquee } = req.body;
    const resolutionsValides = ['favorable_client', 'favorable_coursier', 'partage', 'rejete'];
    if (!resolutionsValides.includes(resolution)) {
      return repondre400(res, `Resolution invalide. Valeurs : ${resolutionsValides.join(', ')}`);
    }
    if (!decisionMotivee) return repondre400(res, 'La décision motivée est obligatoire');

    const litige = await Litige.findById(req.params.id);
    if (!litige) return repondre404(res, 'Litige introuvable');
    if (litige.statut === 'resolu' || litige.statut === 'cloture') {
      return repondre409(res, 'Ce litige est déjà clôturé');
    }

    litige.resolution = resolution;
    litige.decisionMotivee = decisionMotivee;
    litige.montantRembourse = montantRembourse || 0;
    litige.sanctionAppliquee = sanctionAppliquee || null;
    litige.arbitreId = req.userId;
    litige.statut = 'resolu';
    litige.dateCloture = new Date();
    await litige.save();

    // Notifier les deux parties
    const msgDecision = `Litige résolu : ${resolution}. ${decisionMotivee}`;
    await envoyerNotification({
      userId: litige.ouvertPar, type: 'litige_resolu',
      titre: 'Décision rendue sur votre litige', contenu: msgDecision, canal: 'push',
    });
    await envoyerNotification({
      userId: litige.partieAdverse, type: 'litige_resolu',
      titre: 'Décision rendue sur le litige vous concernant', contenu: msgDecision, canal: 'push',
    });

    // Archiver la commande concernée
    await Commande.findByIdAndUpdate(litige.commandeId, {
      statut: montantRembourse > 0 ? 'remboursee' : 'archivee',
    });

    return repondreOk(res, { litige }, 'Litige résolu et parties notifiées');
  } catch (err) { next(err); }
};

// ── GET /api/v1/admin/analytics/dashboard ─────────────────────────
exports.tableauDeBord = async (req, res, next) => {
  try {
    const maintenant = new Date();
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);

    const [
      totalUsers, totalCoursiers, totalCommandes, commandesMois,
      commandesEnCours, litagesOuverts, revenuMois,
    ] = await Promise.all([
      User.countDocuments({ statut: 'actif' }),
      ProfilCoursier.countDocuments({ statutValidation: 'valide' }),
      Commande.countDocuments(),
      Commande.countDocuments({ createdAt: { $gte: debutMois } }),
      Commande.countDocuments({ statut: { $in: ['recherche_coursier', 'coursier_assigne', 'en_route_ramassage', 'colis_ramasse', 'en_livraison'] } }),
      Litige.countDocuments({ statut: { $in: ['ouvert', 'en_attente_reponse', 'en_cours_examen'] } }),
      Commande.aggregate([
        { $match: { statut: 'livree', createdAt: { $gte: debutMois } } },
        { $group: { _id: null, total: { $sum: '$commission' } } },
      ]),
    ]);

    return repondreOk(res, {
      utilisateurs: { total: totalUsers, coursiers: totalCoursiers },
      commandes: { total: totalCommandes, cemois: commandesMois, enCours: commandesEnCours },
      litiges: { ouverts: litagesOuverts },
      revenus: { commissionMois: revenuMois[0]?.total || 0 },
    });
  } catch (err) { next(err); }
};
