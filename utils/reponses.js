/**
 * Enveloppe standardisée pour toutes les réponses API
 * Format : { success, data, error, meta }
 */

const repondreOk = (res, data = {}, message = 'Succès', statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta,
  });
};

const repondreCreé = (res, data = {}, message = 'Ressource créée') => {
  return repondreOk(res, data, message, 201);
};

const repondreErreur = (res, message = 'Une erreur est survenue', statusCode = 500, details = null) => {
  const body = { success: false, error: { message } };
  if (details && process.env.NODE_ENV === 'development') {
    body.error.details = details;
  }
  return res.status(statusCode).json(body);
};

const repondre400 = (res, message = 'Requête invalide') =>
  repondreErreur(res, message, 400);

const repondre401 = (res, message = 'Non authentifié') =>
  repondreErreur(res, message, 401);

const repondre403 = (res, message = 'Accès refusé') =>
  repondreErreur(res, message, 403);

const repondre404 = (res, message = 'Ressource introuvable') =>
  repondreErreur(res, message, 404);

const repondre409 = (res, message = 'Conflit') =>
  repondreErreur(res, message, 409);

const repondre422 = (res, message = 'Données invalides') =>
  repondreErreur(res, message, 422);

module.exports = {
  repondreOk,
  repondreCreé,
  repondreErreur,
  repondre400,
  repondre401,
  repondre403,
  repondre404,
  repondre409,
  repondre422,
};
