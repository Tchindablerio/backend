const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  commandeId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Commande', required: true },
  expediteurId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contenu:     { type: String, default: '' },
  typeContenu: {
    type: String,
    enum: ['texte', 'photo', 'position', 'audio', 'systeme'],
    default: 'texte',
  },
  // Pour les messages de type photo/audio/position
  pieceJointe: { type: String, default: null }, // URL Cloudinary
  position:    { lat: Number, lng: Number },    // pour type=position
  lu:          { type: Boolean, default: false },
  luLe:        { type: Date, default: null },
}, {
  timestamps: true,
  versionKey: false,
});

messageSchema.index({ commandeId: 1, createdAt: 1 });
messageSchema.index({ expediteurId: 1 });

module.exports = mongoose.model('Message', messageSchema);
