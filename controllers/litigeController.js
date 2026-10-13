const Litige = require('../models/Litige');
const Evaluation = require('../models/Evaluation');
const Commande = require('../models/Commande');
const User = require('../models/User');
const ProfilCoursier = require('../models/ProfilCoursier');
const { notifs } = require('../utils/notifications');
const {
  repondreOk, repondreCreé, repondre400, repondre403, repondre404, repondre409,
} = require('../utils/reponses');

// ── POST /api/v1/disputes ─────────────────────────────────────────
exports.ouvrirLitige = async (req, res, next) => {
  try {
    const { commandeId, motif, description } = req.body;
    if (!commandeId || !motif || !description) {
      return repondre400(res, 'commandeId, motif et description sont requis');
    }

    const commande = await Commande.findById(commandeId);
    if (!commande) return repondre404(res, 'Commande introuvable');

    // Seul le client ou le coursier concerné peut ouvrir un litige
    const estClient  = commande.clientId.toString() === req.userId.toString();
    const estCoursier = commande.coursierId && commande.coursierId.toString() === req.userId.toString();
    if (!estClient && !estCoursier) return repondre403(res, 'Vous n\'êtes pas concerné par cette commande');

    // Vérifier que la commande est dans un statut permettant un litige
    const statutsEligibles = ['livree', 'archivee'];
    if (!statutsEligibles.includes(commande.statut)) {
      return repondre409(res, `Litige impossible sur une commande en statut : ${commande.statut}`);
    }

    // Vérifier qu'il n'y a pas déjà un litige
    const litigeExistant = await Litige.findOne({ commandeId });
    if (litigeExistant) return repondre409(res, 'Un litige existe déjà pour cette commande');

    const partieAdverse = estClient ? commande.coursierId : commande.clientId;
    const delaiReponse = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    const litige = await Litige.create({
      commandeId,
      ouvertPar: req.userId,
      partieAdverse,
      motif,
      description,
      statut: 'ouvert',
      delaiReponseExpire: delaiReponse,
    });

    // Passer la commande en litige
    commande.changerStatut('en_litige', 'client', `Litige ouvert : ${motif}`);
    await commande.save();

    // Notifier la partie adverse
    await notifs.litigeOuvert(partieAdverse, litige._id);

    return repondreCreé(res, { litige }, 'Litige ouvert. La partie adverse a 48h pour répondre.');
  } catch (err) { next(err); }
};

// ── GET /api/v1/disputes/:id ──────────────────────────────────────
exports.detailLitige = async (req, res, next) => {
  try {
    const litige = await Litige.findById(req.params.id)
      .populate('ouvertPar', 'nom prenom')
      .populate('partieAdverse', 'nom prenom')
      .populate('commandeId');

    if (!litige) return repondre404(res, 'Litige introuvable');

    const estConcerne = [
      litige.ouvertPar._id.toString(),
      litige.partieAdverse._id.toString(),
    ].includes(req.userId.toString());

    if (!estConcerne && !req.user.rolesActifs.includes('admin')) {
      return repondre403(res, 'Accès refusé');
    }

    return repondreOk(res, { litige });
  } catch (err) { next(err); }
};

// ── POST /api/v1/disputes/:id/evidence ───────────────────────────
exports.ajouterPreuve = async (req, res, next) => {
  try {
    const { typeFichier, urlFichier } = req.body;
    if (!typeFichier || !urlFichier) return repondre400(res, 'typeFichier et urlFichier requis');

    const litige = await Litige.findById(req.params.id);
    if (!litige) return repondre404(res, 'Litige introuvable');

    const preuve = { typeFichier, urlFichier, ajoutePar: req.userId };

    if (litige.ouvertPar.toString() === req.userId.toString()) {
      litige.preuvesDemandeur.push(preuve);
    } else if (litige.partieAdverse.toString() === req.userId.toString()) {
      litige.preuvesDefendeur.push(preuve);
      if (litige.statut === 'ouvert' || litige.statut === 'en_attente_reponse') {
        litige.statut = 'en_cours_examen';
      }
    } else {
      return repondre403(res, 'Vous n\'êtes pas concerné par ce litige');
    }

    await litige.save();
    return repondreOk(res, { litige }, 'Preuve ajoutée');
  } catch (err) { next(err); }
};

// ── GET /api/v1/disputes (mes litiges) ───────────────────────────
exports.mesLitiges = async (req, res, next) => {
  try {
    const litiges = await Litige.find({
      $or: [{ ouvertPar: req.userId }, { partieAdverse: req.userId }],
    })
      .populate('commandeId', 'adresseDepart adresseArrivee prix statut')
      .sort({ createdAt: -1 });
    return repondreOk(res, { litiges });
  } catch (err) { next(err); }
};

// ── POST /api/v1/ratings ──────────────────────────────────────────
exports.soumettreEvaluation = async (req, res, next) => {
  try {
    const { commandeId, note, commentaire } = req.body;
    if (!commandeId || !note) return repondre400(res, 'commandeId et note requis');
    if (note < 1 || note > 5) return repondre400(res, 'La note doit être entre 1 et 5');

    const commande = await Commande.findById(commandeId);
    if (!commande) return repondre404(res, 'Commande introuvable');
    if (commande.statut !== 'livree' && commande.statut !== 'archivee') {
      return repondre409(res, 'Évaluation disponible uniquement après livraison');
    }

    const estClient  = commande.clientId.toString() === req.userId.toString();
    const estCoursier = commande.coursierId && commande.coursierId.toString() === req.userId.toString();

    if (!estClient && !estCoursier) return repondre403(res, 'Non concerné par cette commande');

    const type = estClient ? 'client_vers_coursier' : 'coursier_vers_client';
    const evalueId = estClient ? commande.coursierId : commande.clientId;

    const evaluation = await Evaluation.create({
      commandeId, evaluateurId: req.userId, evalueId, note,
      commentaire: commentaire || '', type,
    });

    // Recalculer la note moyenne de l'évalué
    await recalculerNote(evalueId, type);

    return repondreCreé(res, { evaluation }, 'Évaluation soumise. Merci !');
  } catch (err) { next(err); }
};

// Recalcule la note moyenne d'un utilisateur
async function recalculerNote(userId, type) {
  const evaluations = await Evaluation.find({ evalueId: userId });
  if (!evaluations.length) return;
  const moyenne = evaluations.reduce((sum, e) => sum + e.note, 0) / evaluations.length;
  await User.findByIdAndUpdate(userId, {
    note: Math.round(moyenne * 10) / 10,
    nombreEvaluations: evaluations.length,
  });
  // Mettre à jour aussi la note du profil coursier si applicable
  if (type === 'client_vers_coursier') {
    const evsCoursier = evaluations.filter(e => e.type === 'client_vers_coursier');
    if (evsCoursier.length) {
      const moyenneC = evsCoursier.reduce((s, e) => s + e.note, 0) / evsCoursier.length;
      await ProfilCoursier.findOneAndUpdate({ userId }, {
        noteCoursier: Math.round(moyenneC * 10) / 10,
        nombreEvaluations: evsCoursier.length,
      });
    }
  }
}
