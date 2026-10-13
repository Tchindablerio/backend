const mongoose = require('mongoose');

// ===== WALLET =====
const walletSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  soldeDisponible:  { type: Number, default: 0 },   // montant retirable immédiatement
  soldeEnAttente:   { type: Number, default: 0 },   // gains en cours de sécurisation
  devise:           { type: String, default: 'XAF' }, // Franc CFA
}, {
  timestamps: true,
  versionKey: false,
});

walletSchema.index({ userId: 1 });

// ===== TRANSACTION WALLET =====
const walletTransactionSchema = new mongoose.Schema({
  walletId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['credit', 'debit', 'retrait', 'commission', 'bonus', 'remboursement'], required: true },
  montant:     { type: Number, required: true },
  soldeAvant:  { type: Number, required: true },
  soldeApres:  { type: Number, required: true },
  reference:   { type: String, default: null }, // ref Mobile Money ou commande
  description: { type: String, default: '' },
  statut:      { type: String, enum: ['en_attente', 'complete', 'echoue'], default: 'complete' },
  // Pour les retraits
  numeroMobileMoney: { type: String, default: null },
  operateur:         { type: String, default: null }, // 'mtn', 'orange'
}, {
  timestamps: true,
  versionKey: false,
});

walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, createdAt: -1 });

const Wallet = mongoose.model('Wallet', walletSchema);
const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

module.exports = { Wallet, WalletTransaction };
