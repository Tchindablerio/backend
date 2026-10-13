/**
 * Calcul de la distance entre deux coordonnées GPS (formule Haversine)
 * Retourne la distance en kilomètres
 */
const calculerDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceVolOiseau = R * c;
  // Coefficient de correction routière (les routes ne sont pas à vol d'oiseau)
  return Math.round(distanceVolOiseau * 1.35 * 100) / 100;
};

/**
 * Calcul du prix d'une livraison selon la grille tarifaire du CDC
 * Retourne { prix, distanceKm, dureeEstimee }
 */
const calculerPrix = (lat1, lng1, lat2, lng2, typeColis = 'petit_colis') => {
  const distanceKm = calculerDistanceKm(lat1, lng1, lat2, lng2);

  const PRIX_BASE = Number(process.env.PRIX_BASE) || 500;       // FCFA
  const PRIX_PAR_KM = Number(process.env.PRIX_PAR_KM) || 150;  // FCFA/km

  // Majoration selon le type de colis
  const majorationColis = {
    document:     1.0,
    petit_colis:  1.0,
    colis_moyen:  1.3,
    fragile:      1.5,
    autre:        1.2,
  };
  const coeff = majorationColis[typeColis] || 1.0;

  // Majoration heure de pointe (7h-9h et 17h-19h)
  const heure = new Date().getHours();
  const heureDePointe = (heure >= 7 && heure <= 9) || (heure >= 17 && heure <= 19);
  const coeffHeure = heureDePointe ? 1.2 : 1.0;

  const prixBrut = (PRIX_BASE + distanceKm * PRIX_PAR_KM) * coeff * coeffHeure;
  const prix = Math.round(prixBrut / 50) * 50; // Arrondi au 50 FCFA le plus proche

  // Durée estimée : vitesse moyenne moto en ville ~25 km/h + 5 min de préparation
  const dureeEstimee = Math.round((distanceKm / 25) * 60) + 5; // en minutes

  return { prix, distanceKm, dureeEstimee };
};

/**
 * Calcul de la commission et du gain coursier
 */
const calculerCommission = (prix) => {
  const tauxCommission = Number(process.env.COMMISSION_RATE) || 0.15;
  const commission = Math.round(prix * tauxCommission);
  const gainCoursier = prix - commission;
  return { commission, gainCoursier };
};

/**
 * Générer un numéro de facture unique
 */
const genererNumeroFacture = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 900000) + 100000;
  return `FAC-${year}-${random}`;
};

module.exports = {
  calculerDistanceKm,
  calculerPrix,
  calculerCommission,
  genererNumeroFacture,
};
