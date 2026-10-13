const mongoose = require('mongoose');

const preuveSchema = new mongoose.Schema({
  typeFichier: { type: String, enum: ['photo', 'video', 'document'] },
  urlFichier:  { type: String, required: true },
  ajoutePar:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ajouteLe:    { type: Date, default: Date.now },
}, { _id: false });

const litigeSchema = new mongoose.Schema({
  commandeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', required: true, unique: true },
  ouvertPar:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  partieAdverse:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  motif: {
    type: String,
    enum: ['colis_endommage', 'colis_non_livre', 'retard_excessif', 'comportement_inapproprie',
           'adresse_erronee', 'paiement_conteste', 'autre'],
    required: true,
  },
  description:  { type: String, required: true },

  // Preuves des deux parties
  preuvesDemandeur: [preuveSchema],
  preuvesDefendeur: [preuveSchema],

  statut: {
    type: String,
    enum: ['ouvert', 'en_attente_reponse', 'en_cours_examen', 'resolu', 'rejete', 'cloture'],
    default: 'ouvert',
  },
  resolution: {
    type: String,
    enum: ['favorable_client', 'favorable_coursier', 'partage', 'rejete', null],
    default: null,
  },

  // Décision de l'arbitre
  arbitreId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  decisionMotivee:   { type: String, default: null },
  montantRembourse:  { type: Number, default: 0 },
  sanctionAppliquee: { type: String, default: null },
  dateCloture:       { type: Date, default: null },

  // Délai de réponse de la partie adverse
  delaiReponseExpire:{ type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

litigeSchema.index({ commandeId: 1 });
litigeSchema.index({ statut: 1, createdAt: 1 });
litigeSchema.index({ ouvertPar: 1 });

module.exports = mongoose.model('Litige', litigeSchema);
