const Notification = require('../models/Notification');

/**
 * Crée une notification en base de données
 * En production, on appellerait ici FCM / SMS / WhatsApp selon le canal
 */
const envoyerNotification = async ({ userId, type, titre, contenu, canal = 'interne', meta = {} }) => {
  try {
    const notif = await Notification.create({ userId, type, titre, contenu, canal, meta });

    // TODO en production : envoyer via FCM si canal === 'push'
    // TODO en production : envoyer via passerelle SMS si canal === 'sms'
    // TODO en production : envoyer via WhatsApp Business API si canal === 'whatsapp'

    return notif;
  } catch (err) {
    // Les erreurs de notification ne doivent pas bloquer le flux principal
    console.error('Erreur notification:', err.message);
    return null;
  }
};

/**
 * Templates de notifications courantes
 */
const notifs = {
  coursierAssigne: (clientId, coursierNom) => envoyerNotification({
    userId: clientId,
    type: 'coursier_assigne',
    titre: 'Coursier assigné !',
    contenu: `${coursierNom} a accepté votre commande et est en route.`,
    canal: 'push',
  }),

  colisRamasse: (clientId) => envoyerNotification({
    userId: clientId,
    type: 'colis_ramasse',
    titre: 'Colis pris en charge',
    contenu: 'Votre colis a été récupéré et est en cours de livraison.',
    canal: 'push',
  }),

  commandeLivree: (clientId, commandeId) => envoyerNotification({
    userId: clientId,
    type: 'commande_livree',
    titre: 'Livraison confirmée ✅',
    contenu: 'Votre colis a été livré. Merci de noter votre coursier !',
    canal: 'push',
    meta: { commandeId },
  }),

  gainCredite: (coursierId, montant) => envoyerNotification({
    userId: coursierId,
    type: 'gain_credite',
    titre: 'Gain crédité 💰',
    contenu: `${montant} XAF ont été crédités sur votre portefeuille.`,
    canal: 'interne',
  }),

  offreCourse: (coursierId, commandeId, gain) => envoyerNotification({
    userId: coursierId,
    type: 'offre_course',
    titre: 'Nouvelle course disponible !',
    contenu: `Gain estimé : ${gain} XAF. Répondez vite !`,
    canal: 'push',
    meta: { commandeId },
  }),

  litigeOuvert: (userId, litigeId) => envoyerNotification({
    userId,
    type: 'litige_ouvert',
    titre: 'Un litige a été ouvert',
    contenu: 'Un litige vous concerne. Veuillez soumettre votre réponse.',
    canal: 'push',
    meta: { litigeId },
  }),

  commandeAnnulee: (userId, motif) => envoyerNotification({
    userId,
    type: 'commande_annulee',
    titre: 'Commande annulée',
    contenu: `Votre commande a été annulée. Motif : ${motif}`,
    canal: 'push',
  }),
};

module.exports = { envoyerNotification, notifs };
