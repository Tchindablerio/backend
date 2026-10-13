const { Wallet, WalletTransaction } = require('../models/Wallet');
const { repondreOk, repondre400, repondre404, repondre422 } = require('../utils/reponses');

// ── GET /api/v1/wallet ────────────────────────────────────────────
exports.monWallet = async (req, res, next) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.userId });
    if (!wallet) wallet = await Wallet.create({ userId: req.userId });
    return repondreOk(res, { wallet });
  } catch (err) { next(err); }
};

// ── GET /api/v1/wallet/transactions ──────────────────────────────
exports.historiqueTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const wallet = await Wallet.findOne({ userId: req.userId });
    if (!wallet) return repondre404(res, 'Portefeuille introuvable');

    const total = await WalletTransaction.countDocuments({ walletId: wallet._id });
    const transactions = await WalletTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return repondreOk(res, { transactions, wallet }, 'OK', 200, {
      total, page: Number(page), totalPages: Math.ceil(total / limit),
    });
  } catch (err) { next(err); }
};

// ── POST /api/v1/wallet/withdraw ─────────────────────────────────
exports.demanderRetrait = async (req, res, next) => {
  try {
    const { montant, numeroMobileMoney, operateur } = req.body;

    if (!montant || !numeroMobileMoney || !operateur) {
      return repondre400(res, 'montant, numeroMobileMoney et operateur sont requis');
    }
    const MONTANT_MIN = 500;
    if (montant < MONTANT_MIN) {
      return repondre400(res, `Montant minimum de retrait : ${MONTANT_MIN} XAF`);
    }

    const wallet = await Wallet.findOne({ userId: req.userId });
    if (!wallet) return repondre404(res, 'Portefeuille introuvable');
    if (wallet.soldeDisponible < montant) {
      return repondre422(res, `Solde insuffisant. Disponible : ${wallet.soldeDisponible} XAF`);
    }

    const soldeAvant = wallet.soldeDisponible;
    wallet.soldeDisponible -= montant;

    const transaction = await WalletTransaction.create({
      walletId: wallet._id,
      userId: req.userId,
      type: 'retrait',
      montant,
      soldeAvant,
      soldeApres: wallet.soldeDisponible,
      numeroMobileMoney,
      operateur,
      statut: 'en_attente',
      description: `Retrait vers ${operateur} - ${numeroMobileMoney}`,
    });

    await wallet.save();
    // TODO en production : appeler l'API Mobile Money pour le virement

    return repondreOk(res, { transaction, wallet }, 'Demande de retrait soumise. Traitement en cours.');
  } catch (err) { next(err); }
};
