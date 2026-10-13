/**
 * Middleware de gestion globale des erreurs Express
 * Doit être déclaré en dernier dans server.js (après toutes les routes)
 */
const gererErreur = (err, req, res, next) => {
  console.error('❌ Erreur non gérée :', err);

  // Erreur de validation Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(422).json({
      success: false,
      error: { message: 'Données invalides', details: messages },
    });
  }

  // Doublon (index unique violé)
  if (err.code === 11000) {
    const champ = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: { message: `Ce ${champ} est déjà utilisé` },
    });
  }

  // Erreur de cast Mongoose (ObjectId invalide)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: { message: 'Identifiant invalide' },
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Token invalide ou expiré' },
    });
  }

  // Erreur générique
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Une erreur interne est survenue'
    : err.message;

  return res.status(statusCode).json({
    success: false,
    error: { message },
  });
};

/**
 * Handler 404 pour les routes inconnues
 */
const handler404 = (req, res) => {
  return res.status(404).json({
    success: false,
    error: { message: `Route introuvable : ${req.method} ${req.originalUrl}` },
  });
};

module.exports = { gererErreur, handler404 };
