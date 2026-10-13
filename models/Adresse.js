const mongoose = require('mongoose');

const adresseSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  libelle:      { type: String, required: true, trim: true }, // ex: "Domicile", "Bureau"
  latitude:     { type: Number, required: true },
  longitude:    { type: Number, required: true },
  adresseTexte: { type: String, required: true },
  estFavorite:  { type: Boolean, default: false },
}, {
  timestamps: true,
  versionKey: false,
});

adresseSchema.index({ userId: 1 });

module.exports = mongoose.model('Adresse', adresseSchema);
