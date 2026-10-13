const jwt = require('jsonwebtoken');

/**
 * Génère un Access Token JWT (courte durée : 15 min)
 */
const genererAccessToken = (userId, roles = []) => {
  return jwt.sign(
    { id: userId, roles },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

/**
 * Génère un Refresh Token JWT (longue durée : 30 jours)
 */
const genererRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

/**
 * Vérifie un Access Token — retourne le payload ou null
 */
const verifierAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch {
    return null;
  }
};

/**
 * Vérifie un Refresh Token — retourne le payload ou null
 */
const verifierRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
};

module.exports = {
  genererAccessToken,
  genererRefreshToken,
  verifierAccessToken,
  verifierRefreshToken,
};
