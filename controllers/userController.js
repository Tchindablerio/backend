const User = require('../models/User');
const Adresse = require('../models/Adresse');
const ProfilCoursier = require('../models/ProfilCoursier');
const { repondreOk, repondreCreé, repondre400, repondre403, repondre404 } = require('../utils/reponses');

// ── GET /api/v1/users/me ──────────────────────────────────────────
exports.monProfil = async (req, res, next) => {
  try {
    const user = req.user;
    // Récupérer le profil coursier si actif
    let profilCoursier = null;
    if (user.rolesActifs.includes('coursier')) {
      profilCoursier = await ProfilCoursier.findOne({ userId: user._id }).select('-documents.urlFichier');
    }
    return repondreOk(res, { user, profilCoursier });
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/users/me ────────────────────────────────────────
exports.modifierProfil = async (req, res, next) => {
  try {
    const { nom, prenom, email, langue, photoProfil } = req.body;
    const miseAJour = {};
    if (nom)         miseAJour.nom = nom.trim();
    if (prenom)      miseAJour.prenom = prenom.trim();
    if (email)       miseAJour.email = email.toLowerCase().trim();
    if (langue)      miseAJour.langue = langue;
    if (photoProfil) miseAJour.photoProfil = photoProfil;

    const user = await User.findByIdAndUpdate(req.userId, miseAJour, { new: true, runValidators: true });
    return repondreOk(res, { user }, 'Profil mis à jour');
  } catch (err) { next(err); }
};

// ── GET /api/v1/users/me/addresses ───────────────────────────────
exports.listerAdresses = async (req, res, next) => {
  try {
    const adresses = await Adresse.find({ userId: req.userId }).sort({ estFavorite: -1, createdAt: -1 });
    return repondreOk(res, { adresses });
  } catch (err) { next(err); }
};

// ── POST /api/v1/users/me/addresses ──────────────────────────────
exports.ajouterAdresse = async (req, res, next) => {
  try {
    const { libelle, latitude, longitude, adresseTexte, estFavorite } = req.body;
    if (!libelle || !latitude || !longitude || !adresseTexte) {
      return repondre400(res, 'libelle, latitude, longitude et adresseTexte sont requis');
    }
    const adresse = await Adresse.create({
      userId: req.userId, libelle, latitude, longitude, adresseTexte,
      estFavorite: estFavorite || false,
    });
    return repondreCreé(res, { adresse }, 'Adresse ajoutée');
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/users/me/addresses/:id ─────────────────────────
exports.modifierAdresse = async (req, res, next) => {
  try {
    const adresse = await Adresse.findOne({ _id: req.params.id, userId: req.userId });
    if (!adresse) return repondre404(res, 'Adresse introuvable');
    const { libelle, latitude, longitude, adresseTexte, estFavorite } = req.body;
    if (libelle)      adresse.libelle = libelle;
    if (latitude)     adresse.latitude = latitude;
    if (longitude)    adresse.longitude = longitude;
    if (adresseTexte) adresse.adresseTexte = adresseTexte;
    if (typeof estFavorite === 'boolean') adresse.estFavorite = estFavorite;
    await adresse.save();
    return repondreOk(res, { adresse }, 'Adresse mise à jour');
  } catch (err) { next(err); }
};

// ── DELETE /api/v1/users/me/addresses/:id ────────────────────────
exports.supprimerAdresse = async (req, res, next) => {
  try {
    const adresse = await Adresse.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!adresse) return repondre404(res, 'Adresse introuvable');
    return repondreOk(res, {}, 'Adresse supprimée');
  } catch (err) { next(err); }
};

// ── POST /api/v1/users/me/courier-activation ─────────────────────
exports.activerModeCoursier = async (req, res, next) => {
  try {
    const { typeVehicule, zonePreferee } = req.body;
    if (!typeVehicule) return repondre400(res, 'Le type de véhicule est requis');

    // Vérifier si un profil existe déjà
    let profil = await ProfilCoursier.findOne({ userId: req.userId });

    if (profil && profil.statutValidation === 'valide') {
      return repondreOk(res, { profil }, 'Votre profil coursier est déjà actif');
    }

    if (!profil) {
      profil = await ProfilCoursier.create({
        userId: req.userId,
        typeVehicule,
        zonePreferee: zonePreferee || null,
        statutValidation: 'incomplet', // en attente des documents
      });
    } else {
      profil.typeVehicule = typeVehicule;
      if (zonePreferee) profil.zonePreferee = zonePreferee;
      await profil.save();
    }

    return repondreCreé(res, { profil },
      'Profil coursier créé. Soumettez vos documents pour validation.');
  } catch (err) { next(err); }
};

// ── POST /api/v1/users/me/courier-documents ──────────────────────
exports.soumettreDocuments = async (req, res, next) => {
  try {
    const { typeDocument, urlFichier } = req.body;
    if (!typeDocument || !urlFichier) {
      return repondre400(res, 'typeDocument et urlFichier sont requis');
    }
    const profil = await ProfilCoursier.findOne({ userId: req.userId });
    if (!profil) return repondre404(res, 'Profil coursier introuvable. Activez d\'abord le mode coursier.');

    // Remplacer si le document existe déjà
    const idx = profil.documents.findIndex(d => d.typeDocument === typeDocument);
    if (idx >= 0) {
      profil.documents[idx] = { typeDocument, urlFichier, statutVerification: 'en_attente' };
    } else {
      profil.documents.push({ typeDocument, urlFichier, statutVerification: 'en_attente' });
    }

    // Si statut était incomplet, passer en attente
    if (profil.statutValidation === 'incomplet') {
      profil.statutValidation = 'en_attente';
    }
    await profil.save();

    return repondreOk(res, { profil }, 'Document soumis. En attente de validation.');
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/users/me/courier/disponibilite ─────────────────
exports.changerDisponibilite = async (req, res, next) => {
  try {
    const { disponible } = req.body;
    if (typeof disponible !== 'boolean') {
      return repondre400(res, 'Le champ "disponible" (boolean) est requis');
    }
    const profil = await ProfilCoursier.findOne({ userId: req.userId });
    if (!profil) return repondre404(res, 'Profil coursier introuvable');
    if (profil.statutValidation !== 'valide') {
      return repondre403(res, 'Votre profil coursier n\'est pas encore validé');
    }
    profil.disponible = disponible;
    await profil.save();
    return repondreOk(res, { disponible }, `Vous êtes maintenant ${disponible ? 'en ligne' : 'hors ligne'}`);
  } catch (err) { next(err); }
};

// ── PATCH /api/v1/users/me/courier/position ──────────────────────
exports.mettreAJourPosition = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (!lat || !lng) return repondre400(res, 'lat et lng sont requis');
    await ProfilCoursier.findOneAndUpdate(
      { userId: req.userId },
      { 'positionActuelle.lat': lat, 'positionActuelle.lng': lng, 'positionActuelle.miseAJourLe': new Date() }
    );
    return repondreOk(res, { lat, lng }, 'Position mise à jour');
  } catch (err) { next(err); }
};
