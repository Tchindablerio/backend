const mongoose = require('mongoose');

const paiementSchema = new mongoose.Schema({
  commandeId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', required: true },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  montant:         { type: Number, required: true },
  methode:         { type: String, enum: ['mobile_money', 'carte', 'wallet', 'cash', 'differe'], required: true },
  fournisseur:     { type: String, default: null }, // ex: 'mtn_momo', 'orange_money', 'visa'
  statut:          { type: String, enum: ['en_attente', 'pre_autorise', 'capture', 'echoue', 'rembourse', 'annule'], default: 'en_attente' },
  transactionRef:  { type: String, default: null }, // référence opérateur externe
  webhookConfirme: { type: Boolean, default: false },
  dateCapture:     { type: Date, default: null },
  // En cas de remboursement
  montantRembourse: { type: Number, default: 0 },
  dateRemboursement:{ type: Date, default: null },
  motifRemboursement:{ type: String, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

paiementSchema.index({ commandeId: 1 });
paiementSchema.index({ userId: 1, createdAt: -1 });
paiementSchema.index({ statut: 1 });

module.exports = mongoose.model('Paiement', paiementSchema);
