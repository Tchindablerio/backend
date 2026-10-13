const mongoose = require('mongoose');

const factureSchema = new mongoose.Schema({
  commandeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', required: true, unique: true },
  clientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  numero:      { type: String, required: true, unique: true }, // ex: FAC-2026-000123
  montantHT:   { type: Number, required: true },
  tauxTVA:     { type: Number, default: 19.25 }, // taux Cameroun
  montantTVA:  { type: Number, required: true },
  montantTTC:  { type: Number, required: true },
  urlPdf:      { type: String, default: null },
  dateEmission:{ type: Date, default: Date.now },
}, {
  timestamps: true,
  versionKey: false,
});

factureSchema.index({ clientId: 1, createdAt: -1 });

module.exports = mongoose.model('Facture', factureSchema);
