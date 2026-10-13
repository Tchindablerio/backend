const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  code:            { type: String, required: true, unique: true, uppercase: true, trim: true },
  type:            { type: String, enum: ['pourcentage', 'montant_fixe', 'livraison_gratuite'], required: true },
  valeur:          { type: Number, required: true },  // % ou FCFA
  description:     { type: String, default: '' },

  // Conditions d'application
  montantMinCommande: { type: Number, default: 0 },
  premierCommandeSeulement: { type: Boolean, default: false },
  zonesApplicables:  [{ type: String }], // vide = toutes zones

  // Validité
  dateDebut:       { type: Date, required: true },
  dateFin:         { type: Date, required: true },
  actif:           { type: Boolean, default: true },

  // Limitations d'usage
  utilisationsMax:     { type: Number, default: null },  // null = illimité
  utilisationsParUser: { type: Number, default: 1 },
  utilisationsActuelles:{ type: Number, default: 0 },

  // Tracking des utilisateurs ayant utilisé ce code
  utilisateurs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Créé par admin
  creeParId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true,
  versionKey: false,
});

promotionSchema.index({ code: 1 });
promotionSchema.index({ actif: 1, dateDebut: 1, dateFin: 1 });

// Méthode pour vérifier si le code est valide pour un utilisateur
promotionSchema.methods.estValide = function (userId, montantCommande) {
  const now = new Date();
  if (!this.actif) return { valide: false, raison: 'Code inactif' };
  if (now < this.dateDebut) return { valide: false, raison: 'Code pas encore actif' };
  if (now > this.dateFin) return { valide: false, raison: 'Code expiré' };
  if (this.utilisationsMax && this.utilisationsActuelles >= this.utilisationsMax) {
    return { valide: false, raison: 'Code épuisé' };
  }
  if (montantCommande < this.montantMinCommande) {
    return { valide: false, raison: `Montant minimum requis : ${this.montantMinCommande} XAF` };
  }
  const utilisationsUser = this.utilisateurs.filter(u => u.toString() === userId.toString()).length;
  if (utilisationsUser >= this.utilisationsParUser) {
    return { valide: false, raison: 'Vous avez déjà utilisé ce code' };
  }
  return { valide: true };
};

// Calcul de la remise
promotionSchema.methods.calculerRemise = function (prixBase) {
  switch (this.type) {
    case 'pourcentage':      return Math.round(prixBase * this.valeur / 100);
    case 'montant_fixe':     return Math.min(this.valeur, prixBase);
    case 'livraison_gratuite': return prixBase;
    default: return 0;
  }
};

module.exports = mongoose.model('Promotion', promotionSchema);
