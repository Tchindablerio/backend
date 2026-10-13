const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  commandeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', required: true },
  evaluateurId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  evalueId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note:         { type: Number, required: true, min: 1, max: 5 },
  commentaire:  { type: String, default: '' },
  // Client note le coursier ou coursier note le client
  type:         { type: String, enum: ['client_vers_coursier', 'coursier_vers_client'], required: true },
}, {
  timestamps: true,
  versionKey: false,
});

// Une seule évaluation par direction par commande
evaluationSchema.index({ commandeId: 1, type: 1 }, { unique: true });
evaluationSchema.index({ evalueId: 1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);
