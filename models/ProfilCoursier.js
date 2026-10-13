const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  typeDocument:       { type: String, enum: ['cni', 'passeport', 'permis', 'carte_grise', 'assurance', 'selfie'] },
  urlFichier:         { type: String },
  statutVerification: { type: String, enum: ['en_attente', 'valide', 'rejete'], default: 'en_attente' },
  motifRejet:         { type: String, default: null },
  verifieLe:          { type: Date, default: null },
}, { _id: false });

const profilCoursierSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  statutValidation:   { type: String, enum: ['en_attente', 'valide', 'rejete', 'incomplet'], default: 'en_attente' },
  typeVehicule:       { type: String, enum: ['pied', 'velo', 'moto', 'voiture'], default: 'moto' },
  zonePreferee:       { type: String, default: null },
  disponible:         { type: Boolean, default: false },
  // Position temps réel (mise à jour fréquente via Redis en prod, ici en base pour simplicité)
  positionActuelle:   {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    miseAJourLe: { type: Date, default: null },
  },
  noteCoursier:       { type: Number, default: 0, min: 0, max: 5 },
  nombreEvaluations:  { type: Number, default: 0 },
  totalCourses:       { type: Number, default: 0 },
  tauxAcceptation:    { type: Number, default: 100 }, // en %
  tauxAnnulation:     { type: Number, default: 0 },   // en %
  niveauReputation:   { type: String, enum: ['debutant', 'confirme', 'expert', 'elite'], default: 'debutant' },
  documents:          [documentSchema],
  // Pénalités actives
  penalites:          [{
    motif: String,
    montant: Number,
    date: { type: Date, default: Date.now },
  }],
  // Bonus accumulés
  bonusTotal:         { type: Number, default: 0 },
}, {
  timestamps: true,
  versionKey: false,
});

profilCoursierSchema.index({ userId: 1 });
profilCoursierSchema.index({ disponible: 1, statutValidation: 1 });
// Index géospatial pour le matching
profilCoursierSchema.index({ 'positionActuelle.lat': 1, 'positionActuelle.lng': 1 });

module.exports = mongoose.model('ProfilCoursier', profilCoursierSchema);
