const { verifierAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const { repondre401, repondre403 } = require('../utils/reponses');

/**
 * Middleware principal d'authentification
 * Vérifie le Bearer token dans l'en-tête Authorization
 */
const authentifier = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return repondre401(res, 'Token d\'authentification manquant');
    }

    const token = authHeader.split(' ')[1];
    const payload = verifierAccessToken(token);

    if (!payload) {
      return repondre401(res, 'Token invalide ou expiré');
    }

    // Vérifier que l'utilisateur existe toujours et n'est pas bloqué
    const user = await User.findById(payload.id).select('-passwordHash -refreshTokens -otp');
    if (!user) {
      return repondre401(res, 'Utilisateur introuvable');
    }
    if (user.statut === 'bloque' || user.statut === 'suspendu') {
      return repondre403(res, `Votre compte est ${user.statut}. Contactez le support.`);
    }
    if (user.statut === 'supprime') {
      return repondre401(res, 'Ce compte a été supprimé');
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    return repondre401(res, 'Erreur d\'authentification');
  }
};

/**
 * Middleware de vérification de rôle(s)
 * Usage : autoriser('admin') ou autoriser('admin', 'support')
 */
const autoriser = (...rolesRequis) => {
  return (req, res, next) => {
    if (!req.user) {
      return repondre401(res, 'Non authentifié');
    }
    const aLeRole = rolesRequis.some(role => req.user.rolesActifs.includes(role));
    if (!aLeRole) {
      return repondre403(res, `Accès réservé aux : ${rolesRequis.join(', ')}`);
    }
    next();
  };
};

/**
 * Middleware : vérifier que le profil coursier est validé
 */
const coursierValide = async (req, res, next) => {
  const ProfilCoursier = require('../models/ProfilCoursier');
  const profil = await ProfilCoursier.findOne({ userId: req.userId });
  if (!profil || profil.statutValidation !== 'valide') {
    return repondre403(res, 'Votre profil coursier n\'est pas encore validé');
  }
  req.profilCoursier = profil;
  next();
};

module.exports = { authentifier, autoriser, coursierValide };
