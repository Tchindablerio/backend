const mongoose = require('mongoose');

// Tous les statuts possibles selon le CDC section 5.2
const STATUTS = [
  'creee',           // devis généré, non payée
  'payee',           // paiement confirmé
  'recherche_coursier',
  'coursier_assigne',
  'en_route_ramassage',
  'colis_ramasse',
  'en_livraison',
  'livree',
  'archivee',
  'annulee',
  'en_litige',
  'remboursee',
];

const commandeSchema = new mongoose.Schema({
  clientId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coursierId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  profilCoursierId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProfilCoursier', default: null },

  // Localisation
  adresseDepart: {
    lat:          { type: Number, required: true },
    lng:          { type: Number, required: true },
    adresseTexte: { type: String, required: true },
  },
  adresseArrivee: {
    lat:          { type: Number, required: true },
    lng:          { type: Number, required: true },
    adresseTexte: { type: String, required: true },
  },

  // Colis
  typeColis:    { type: String, enum: ['document', 'petit_colis', 'colis_moyen', 'fragile', 'autre'], required: true },
  poidsKg:      { type: Number, default: 1 },
  instructions: { type: String, default: '' },

  // Tarification
  distanceKm:   { type: Number, required: true },
  dureeEstimee: { type: Number, default: 0 }, // en minutes
  prix:         { type: Number, required: true },
  commission:   { type: Number, default: 0 },
  gainCoursier: { type: Number, default: 0 },

  // Promotion appliquée
  promotionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Promotion', default: null },
  remise:       { type: Number, default: 0 },

  // Statut
  statut:       { type: String, enum: STATUTS, default: 'creee' },

  // Preuve de livraison
  preuveLivraison: {
    photoRamassageUrl:  { type: String, default: null },
    photoLivraisonUrl:  { type: String, default: null },
    signatureUrl:       { type: String, default: null },
    positionLivraison:  { lat: Number, lng: Number },
    dateLivraison:      { type: Date, default: null },
  },

  // Historique des statuts (piste d'audit)
  historiqueStatuts: [{
    statut:   String,
    date:     { type: Date, default: Date.now },
    par:      String, // 'client', 'coursier', 'systeme', 'admin'
    details:  String,
  }],

  // Motif d'annulation
  motifAnnulation: { type: String, default: null },
  annulePar:       { type: String, enum: ['client', 'coursier', 'systeme', 'admin'], default: null },

  // Délai d'archivage automatique
  archivageAutomatiqueDate: { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

commandeSchema.index({ clientId: 1, createdAt: -1 });
commandeSchema.index({ coursierId: 1, statut: 1 });
commandeSchema.index({ statut: 1, createdAt: -1 });

// Méthode utilitaire pour changer de statut avec audit trail
commandeSchema.methods.changerStatut = function (nouveauStatut, par = 'systeme', details = '') {
  this.statut = nouveauStatut;
  this.historiqueStatuts.push({ statut: nouveauStatut, par, details });
};

module.exports = mongoose.model('Commande', commandeSchema);
