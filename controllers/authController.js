const argon2 = require('argon2');
const User = require('../models/User');
const { Wallet } = require('../models/Wallet').Wallet;
const {
  genererAccessToken,
  genererRefreshToken,
  verifierRefreshToken,
} = require('../utils/jwt');
const {
  repondreOk, repondreCreé, repondre400, repondre401, repondre409,
} = require('../utils/reponses');

// ────────────────────────────────────────────────
// POST /api/v1/auth/register
// ────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { nom, prenom, telephone, email, password, roles } = req.body;

    if (!nom || !prenom || !telephone || !password) {
      return repondre400(res, 'Champs obligatoires manquants');
    }

    const existant = await User.findOne({ $or: [{ telephone }, { email }] });
    if (existant) return repondre409(res, 'Cet utilisateur existe déjà (Email ou Téléphone)');

    const passwordHash = await argon2.hash(password);

    const user = await User.create({
      nom: nom.trim(),
      prenom: prenom.trim(),
      telephone: telephone.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      passwordHash,
      rolesActifs: roles || ['client'],
    });

    await Wallet.create({ userId: user._id });

    const accessToken = genererAccessToken(user._id, user.rolesActifs);
    const refreshToken = genererRefreshToken(user._id);

    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    return repondreCreé(res, { accessToken, refreshToken, user }, 'Compte créé avec succès');
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────
// POST /api/v1/auth/login
// ────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, telephone, password } = req.body;
    const identifiant = email || telephone;

    if (!identifiant || !password) {
      return repondre400(res, 'Identifiant et mot de passe requis');
    }

    const user = await User.findOne({ 
      $or: [{ email: identifiant }, { telephone: identifiant }] 
    }).select('+passwordHash');

    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return repondre401(res, 'Identifiants incorrects');
    }

    const accessToken = genererAccessToken(user._id, user.rolesActifs);
    const refreshToken = genererRefreshToken(user._id);

    user.refreshTokens.push({ token: refreshToken });
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    return repondreOk(res, { accessToken, refreshToken, user }, 'Connexion réussie');
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// ────────────────────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return repondre400(res, 'Refresh token manquant');

    const payload = verifierRefreshToken(refreshToken);
    if (!payload) return repondre401(res, 'Refresh token invalide ou expiré');

    const user = await User.findById(payload.id);
    if (!user) return repondre401(res, 'Utilisateur introuvable');

    const tokenEnBase = user.refreshTokens.find(t => t.token === refreshToken);
    if (!tokenEnBase) {
      user.refreshTokens = [];
      await user.save();
      return repondre401(res, 'Refresh token révoqué');
    }

    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    const nouveauRefreshToken = genererRefreshToken(user._id);
    const nouvelAccessToken = genererAccessToken(user._id, user.rolesActifs);
    user.refreshTokens.push({ token: nouveauRefreshToken });
    await user.save();

    return repondreOk(res, { accessToken: nouvelAccessToken, refreshToken: nouveauRefreshToken }, 'Token rafraîchi');
  } catch (err) {
    next(err);
  }
};

// ────────────────────────────────────────────────
// POST /api/v1/auth/logout
// ────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const user = req.user;

    if (refreshToken && user) {
      const dbUser = await User.findById(user.id);
      if (dbUser) {
        dbUser.refreshTokens = dbUser.refreshTokens.filter(t => t.token !== refreshToken);
        await dbUser.save();
      }
    }

    return repondreOk(res, {}, 'Déconnexion réussie');
  } catch (err) {
    next(err);
  }
};
