const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nom:          { type: String, required: true, trim: true },
  prenom:       { type: String, required: true, trim: true },
  telephone:    { type: String, required: true, unique: true, trim: true },
  email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  photoProfil:  { type: String, default: null },
  note:         { type: Number, default: 0, min: 0, max: 5 },
  nombreEvaluations: { type: Number, default: 0 },
  statut:       { type: String, enum: ['actif', 'bloque', 'suspendu', 'supprime'], default: 'actif' },
  rolesActifs:  [{ type: String, enum: ['client', 'coursier', 'admin'] }],
  // Refresh tokens stockés pour invalidation (rotation)
  refreshTokens: [{ token: String, createdAt: { type: Date, default: Date.now } }],
  // OTP pour vérification téléphone
  otp:          { code: String, expiresAt: Date },
  langue:       { type: String, default: 'fr' },
}, {
  timestamps: true,
  versionKey: false,
});

// Index pour les recherches fréquentes
userSchema.index({ telephone: 1 });
userSchema.index({ email: 1 });
userSchema.index({ statut: 1 });

// Ne jamais exposer le hash en réponse JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.refreshTokens;
  delete obj.otp;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
