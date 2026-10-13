const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'commande_creee', 'coursier_assigne', 'colis_ramasse', 'en_livraison',
      'commande_livree', 'commande_annulee',
      'paiement_confirme', 'paiement_echoue', 'remboursement_effectue',
      'gain_credite', 'retrait_traite',
      'litige_ouvert', 'litige_resolu', 'litige_complement_requis',
      'profil_coursier_valide', 'profil_coursier_rejete',
      'offre_course', 'connexion_nouvel_appareil',
      'promotion', 'rappel', 'systeme',
    ],
    required: true,
  },
  canal:    { type: String, enum: ['push', 'sms', 'email', 'whatsapp', 'interne'], default: 'interne' },
  titre:    { type: String, required: true },
  contenu:  { type: String, required: true },
  // Données contextuelles (lien vers commande, litige, etc.)
  meta:     { type: mongoose.Schema.Types.Mixed, default: {} },
  lu:       { type: Boolean, default: false },
  luLe:     { type: Date, default: null },
  // Statut d'envoi sur le canal externe
  envoye:   { type: Boolean, default: false },
  envoyeLe: { type: Date, default: null },
  erreurEnvoi: { type: String, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

notificationSchema.index({ userId: 1, lu: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
