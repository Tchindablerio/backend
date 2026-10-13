const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const app = express();

// ══════════════════════════════════════════════════════════════════
//  1. CONFIGURATION (Clés en dur pour éviter les erreurs .env)
// ══════════════════════════════════════════════════════════════════
const PORT = 3000;
const SECRET_KEY = "ma_cle_secrete_ultra_securisee_2024";
const MONGODB_URI = "mongodb+srv://avicole_user:Avicole2026@cluster0.g8gn3ah.mongodb.net/livraison_express_db?retryWrites=true&w=majority";

app.use(cors());
app.use(bodyParser.json());

// Flutter appelle tout via /api/v1/<nom-français> (ex: /api/v1/portefeuille), mais certains
// alias /api/v1/... avaient été enregistrés en anglais (/api/v1/wallet, /api/v1/orders...).
// On réécrit systématiquement /api/v1/* vers /api/* pour que les routes françaises déjà
// enregistrées répondent toujours, quel que soit le préfixe appelé.
app.use('/api/v1', (req, res, next) => {
    req.url = '/api' + req.url;
    next();
});

// ══════════════════════════════════════════════════════════════════
//  2. MODÈLES DE DONNÉES (DÉFINIS AVANT LA CONNEXION)
// ══════════════════════════════════════════════════════════════════

const User = mongoose.model('User', new mongoose.Schema({
    id: String, nom: String, prenom: String, email: { type: String, unique: true },
    telephone: { type: String, unique: true }, passwordHash: String, photoProfil: String,
    statut: { type: String, default: 'actif' }, rolesActifs: [String], dateCreation: { type: Date, default: Date.now },
    telephoneVerifie: { type: Boolean, default: false },
    otp: { code: String, expiresAt: Date }
}));

const ProfilCoursier = mongoose.model('ProfilCoursier', new mongoose.Schema({
    id: String, utilisateurId: String, statutValidation: String, vehicleType: String,
    disponibilite: { type: Boolean, default: false }, positionActuelle: { lat: Number, lng: Number },
    noteCoursier: { type: Number, default: 5 }, totalCourses: { type: Number, default: 0 },
    niveauReputation: { type: String, default: 'debutant' },
    documentsIdentite: { type: [String], default: [] }
}));

const Commande = mongoose.model('Commande', new mongoose.Schema({
    id: String, clientId: String, coursierId: String, adresseDepart: { lat: Number, lng: Number },
    adresseArrivee: { lat: Number, lng: Number }, statut: { type: String, default: 'enAttente' },
    prix: Number, commission: Number, distanceKm: Number, dureeEstimee: { type: Number, default: 15 },
    typeColis: String, poidsKg: Number,
    dateCreation: { type: Date, default: Date.now }, dateLivraison: Date,
    preuvePhoto: String, signature: String,
    moyenPaiement: { type: String, default: 'especes' }, codePromo: String
}));

const Wallet = mongoose.model('Wallet', new mongoose.Schema({
    id: String, utilisateurId: String, soldeDisponible: { type: Number, default: 0 }, soldeEnAttente: { type: Number, default: 0 }, devise: { type: String, default: 'FCFA' }
}));

const Transaction = mongoose.model('Transaction', new mongoose.Schema({
    id: String, portefeuilleId: String, type: String, montant: Number, reference: String,
    statut: { type: String, default: 'reussi' }, referenceCamerPay: String,
    dateCreation: { type: Date, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
    id: String, utilisateurId: String, contenu: String, type: String, lu: { type: Boolean, default: false }, dateEnvoi: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    id: String, commandeId: String, expediteurId: String, contenu: String, pieceJointe: String, dateEnvoi: { type: Date, default: Date.now }
}));

const Litige = mongoose.model('Litige', new mongoose.Schema({
    id: String, commandeId: String, ouvertPar: String, description: String, statut: { type: String, default: 'ouvert' }, resolution: String, dateOuverture: { type: Date, default: Date.now }
}));

const Evaluation = mongoose.model('Evaluation', new mongoose.Schema({
    id: String, commandeId: String, evaluateurId: String, evalueId: String, note: Number, commentaire: String, dateCreation: { type: Date, default: Date.now }
}));

// ══════════════════════════════════════════════════════════════════
//  3. CONNEXION MONGODB + SEEDING (CRÉATION COMPTES TEST)
// ══════════════════════════════════════════════════════════════════
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ CONNECTÉ À MONGODB ATLAS (BASE RÉELLE)');

        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('🌱 Base vide. Création des comptes de test...');
            const passwordHash = await bcrypt.hash('password', 10);

            // 1. Client
            const client = await new User({
                id: 'client_123', nom: 'Dupont', prenom: 'Jean', email: 'client@test.com',
                telephone: '0600000001', passwordHash, rolesActifs: ['client'], telephoneVerifie: true
            }).save();
            await new Wallet({ id: uuidv4(), utilisateurId: client.id, soldeDisponible: 25000.0, devise: 'FCFA' }).save();

            // 2. Coursier
            const coursier = await new User({
                id: 'coursier_123', nom: 'Livreur', prenom: 'Marc', email: 'coursier@test.com',
                telephone: '0600000002', passwordHash, rolesActifs: ['coursier'], telephoneVerifie: true
            }).save();
            await new ProfilCoursier({
                id: uuidv4(), utilisateurId: coursier.id, statutValidation: 'valide',
                vehicleType: 'moto', disponibilite: true, noteCoursier: 4.8, totalCourses: 10, niveauReputation: 'intermediaire',
                documentsIdentite: []
            }).save();
            await new Wallet({ id: uuidv4(), utilisateurId: coursier.id, soldeDisponible: 5000.0, devise: 'FCFA' }).save();

            // 3. Admin
            await new User({
                id: 'admin_123', nom: 'Admin', prenom: 'System', email: 'admin@test.com',
                telephone: '0600000003', passwordHash, rolesActifs: ['admin'], telephoneVerifie: true
            }).save();

            console.log('✅ Comptes créés : client@test.com / coursier@test.com / admin@test.com (pass: password)');
        }
    })
    .catch(err => console.error('❌ ERREUR MONGODB:', err));

// ══════════════════════════════════════════════════════════════════
//  4. LOGIQUE MÉTIER
// ══════════════════════════════════════════════════════════════════

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Veuillez vous connecter" });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Session expirée" });
        req.user = user;
        next();
    });
};

const genererOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- AUTHENTIFICATION ---
app.post(['/api/auth/register', '/api/v1/auth/register'], async (req, res) => {
    console.log('🟢🟢🟢 REQUÊTE REGISTER REÇUE 🟢🟢🟢', req.body);
    try {
        const { nom, prenom, email, telephone, password, roles } = req.body;
        const telephoneNettoye = (telephone || '').trim();
        const emailNettoye = (email || '').trim().toLowerCase();

        if (!nom || !prenom || !telephoneNettoye || !password) {
            return res.status(400).json({ success: false, message: "Champs obligatoires manquants (nom, prenom, telephone, password)" });
        }

        const existant = await User.findOne({ $or: [{ telephone: telephoneNettoye }, { email: emailNettoye }] });
        if (existant) {
            console.log('🔍 [DEBUG] Doublon détecté avec:', {
                telephoneEnvoye: telephoneNettoye,
                emailEnvoye: emailNettoye,
                idExistant: existant.id,
                telephoneExistant: existant.telephone,
                emailExistant: existant.email,
                creeLe: existant.dateCreation,
            });
            return res.status(409).json({ success: false, message: "Ce numéro ou cet email est déjà utilisé" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const otpCode = genererOtp();

        const newUser = new User({
            id: userId, nom, prenom, email: emailNettoye, telephone: telephoneNettoye, passwordHash,
            rolesActifs: roles || ['client'],
            telephoneVerifie: false,
            otp: { code: otpCode, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
        });
        await newUser.save();
        await new Wallet({ id: uuidv4(), utilisateurId: userId, soldeDisponible: 0.0, devise: "FCFA" }).save();

        if ((roles || []).includes('coursier')) {
            await new ProfilCoursier({
                id: uuidv4(), utilisateurId: userId, statutValidation: 'enAttente', vehicleType: 'moto',
                disponibilite: false, noteCoursier: 5, totalCourses: 0, niveauReputation: 'debutant', documentsIdentite: []
            }).save();
        }

        console.log(`📲 [OTP SIMULÉ] Code pour ${telephoneNettoye} : ${otpCode} (valable 10 min)`);

        res.status(201).json({ success: true, message: "Compte créé, code de vérification envoyé", data: { telephone: telephoneNettoye } });
    } catch (e) {
        console.log('🔴 ERREUR REGISTER:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// --- VÉRIFICATION OTP ---
app.post(['/api/auth/verify-otp', '/api/v1/auth/verify-otp'], async (req, res) => {
    try {
        const { telephone, code } = req.body;
        if (!telephone || !code) {
            return res.status(400).json({ success: false, message: "Téléphone et code requis" });
        }

        const user = await User.findOne({ telephone });
        if (!user || !user.otp || !user.otp.code) {
            return res.status(400).json({ success: false, message: "Aucune vérification en attente pour ce numéro" });
        }
        if (user.otp.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: "Code expiré, veuillez en redemander un" });
        }
        if (user.otp.code !== code) {
            return res.status(401).json({ success: false, message: "Code incorrect" });
        }

        user.telephoneVerifie = true;
        user.otp = undefined;
        await user.save();

        const token = jwt.sign({ id: user.id, roles: user.rolesActifs }, SECRET_KEY, { expiresIn: '30d' });
        res.json({ success: true, message: "Numéro vérifié", token, user, data: { accessToken: token, user } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RENVOI DU CODE OTP ---
app.post(['/api/auth/resend-otp', '/api/v1/auth/resend-otp'], async (req, res) => {
    try {
        const { telephone } = req.body;
        const user = await User.findOne({ telephone });
        if (!user) return res.status(404).json({ success: false, message: "Utilisateur introuvable" });

        const otpCode = genererOtp();
        user.otp = { code: otpCode, expiresAt: new Date(Date.now() + 10 * 60 * 1000) };
        await user.save();

        console.log(`📲 [OTP SIMULÉ] Nouveau code pour ${telephone} : ${otpCode} (valable 10 min)`);
        res.json({ success: true, message: "Nouveau code envoyé" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/auth/login', '/api/v1/auth/login'], async (req, res) => {
    try {
        const identifiant = req.body.email || req.body.telephone;
        const user = await User.findOne({ $or: [{ email: identifiant }, { telephone: identifiant }] });
        if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.status(401).json({ message: "Identifiants incorrects" });
        const token = jwt.sign({ id: user.id, roles: user.rolesActifs }, SECRET_KEY, { expiresIn: '30d' });
        res.json({ success: true, token, user, data: { accessToken: token, user } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMMANDES ---
app.get(['/api/commandes', '/api/v1/orders'], authenticateToken, async (req, res) => {
    const filter = req.user.roles.includes('admin') ? {} : { $or: [{ clientId: req.user.id }, { coursierId: req.user.id }] };
    res.json(await Commande.find(filter).sort({ dateCreation: -1 }));
});

app.post(['/api/commandes', '/api/v1/orders'], authenticateToken, async (req, res) => {
    const cmd = new Commande({ ...req.body, id: uuidv4(), clientId: req.user.id, dateCreation: new Date() });
    await cmd.save();
    res.status(201).json(cmd);
});

app.put(['/api/commandes/:id/statut', '/api/v1/orders/:id/status'], authenticateToken, async (req, res) => {
    try {
        const { statut, preuvePhoto, signature } = req.body;

        if (statut === 'livree' && (!preuvePhoto || !signature)) {
            return res.status(400).json({ success: false, message: "Photo et signature obligatoires pour valider la livraison" });
        }

        const update = { statut };
        if (preuvePhoto) update.preuvePhoto = preuvePhoto;
        if (signature) update.signature = signature;
        if (statut === 'livree') update.dateLivraison = new Date();

        const cmd = await Commande.findOneAndUpdate({ id: req.params.id }, update, { new: true });
        if (!cmd) return res.status(404).json({ success: false, message: "Commande introuvable" });

        await new Notification({ id: uuidv4(), utilisateurId: cmd.clientId, contenu: `Commande #${cmd.id.substring(0, 8)} : ${cmd.statut}` }).save();
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- OFFRES DE COURSE (matching simplifié) ---
app.get(['/api/orders/offers', '/api/v1/orders/offers'], authenticateToken, async (req, res) => {
    try {
        const offres = await Commande.find({
            statut: 'enAttente',
            coursierId: null,
            clientId: { $ne: req.user.id },
        }).sort({ dateCreation: -1 }).limit(5);
        res.json(offres);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/orders/:id/accept', '/api/v1/orders/:id/accept'], authenticateToken, async (req, res) => {
    try {
        const cmd = await Commande.findOneAndUpdate(
            { id: req.params.id, statut: 'enAttente', coursierId: null },
            { coursierId: req.user.id, statut: 'acceptee' },
            { new: true }
        );
        if (!cmd) {
            return res.status(409).json({ success: false, message: "Cette course a déjà été acceptée par un autre coursier" });
        }
        await new Notification({
            id: uuidv4(), utilisateurId: cmd.clientId,
            contenu: `Un coursier a accepté votre commande #${cmd.id.substring(0, 8)}`,
        }).save();
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PROFIL COURSIER ---
app.get(['/api/coursier/profil', '/api/v1/coursier/profil'], authenticateToken, async (req, res) => {
    try {
        const profil = await ProfilCoursier.findOne({ utilisateurId: req.user.id });
        if (!profil) return res.status(404).json({ success: false, message: "Profil coursier introuvable" });
        res.json(profil);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(['/api/coursier/disponibilite', '/api/v1/coursier/disponibilite'], authenticateToken, async (req, res) => {
    try {
        const profil = await ProfilCoursier.findOneAndUpdate(
            { utilisateurId: req.user.id },
            { disponibilite: req.body.disponibilite },
            { new: true }
        );
        if (!profil) return res.status(404).json({ success: false, message: "Profil coursier introuvable" });
        res.json(profil);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/coursier/documents', '/api/v1/coursier/documents'], authenticateToken, async (req, res) => {
    try {
        const profil = await ProfilCoursier.findOneAndUpdate(
            { utilisateurId: req.user.id },
            { $push: { documentsIdentite: { $each: req.body.documents || [] } }, statutValidation: 'enAttente' },
            { new: true }
        );
        if (!profil) return res.status(404).json({ success: false, message: "Profil coursier introuvable" });
        res.json(profil);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put(['/api/coursier/position', '/api/v1/coursier/position'], authenticateToken, async (req, res) => {
    try {
        const { lat, lng } = req.body.position || {};
        const profil = await ProfilCoursier.findOneAndUpdate(
            { utilisateurId: req.user.id },
            { positionActuelle: { lat, lng } },
            { new: true }
        );
        if (!profil) return res.status(404).json({ success: false, message: "Profil coursier introuvable" });
        res.json(profil);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- POSITION EN DIRECT DU COURSIER SUR UNE COMMANDE (pour le suivi client) ---
app.get(['/api/commandes/:id/tracking', '/api/v1/orders/:id/tracking'], authenticateToken, async (req, res) => {
    try {
        const cmd = await Commande.findOne({ id: req.params.id });
        if (!cmd || !cmd.coursierId) return res.status(404).json({ success: false, message: "Coursier non assigné" });

        const profil = await ProfilCoursier.findOne({ utilisateurId: cmd.coursierId });
        if (!profil || !profil.positionActuelle || profil.positionActuelle.lat == null) {
            return res.status(404).json({ success: false, message: "Position du coursier indisponible" });
        }
        res.json({ lat: profil.positionActuelle.lat, lng: profil.positionActuelle.lng });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMMANDE UNIQUE + ANNULATION ---
app.get(['/api/commandes/:id', '/api/v1/orders/:id'], authenticateToken, async (req, res) => {
    try {
        const cmd = await Commande.findOne({ id: req.params.id });
        if (!cmd) return res.status(404).json({ success: false, message: "Commande introuvable" });
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/commandes/:id/annuler', '/api/v1/orders/:id/cancel'], authenticateToken, async (req, res) => {
    try {
        const cmd = await Commande.findOneAndUpdate(
            { id: req.params.id, statut: 'enAttente' },
            { statut: 'annulee' },
            { new: true }
        );
        if (!cmd) return res.status(400).json({ success: false, message: "Cette commande ne peut plus être annulée" });
        res.json(cmd);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ÉVALUATIONS ---
app.post(['/api/evaluations', '/api/v1/evaluations'], authenticateToken, async (req, res) => {
    try {
        const evaluation = new Evaluation({ ...req.body, id: uuidv4(), evaluateurId: req.user.id, dateCreation: new Date() });
        await evaluation.save();
        res.status(201).json(evaluation);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/api/evaluations', '/api/v1/evaluations'], authenticateToken, async (req, res) => {
    try {
        const filtre = req.query.userId ? { evalueId: req.query.userId } : {};
        res.json(await Evaluation.find(filtre).sort({ dateCreation: -1 }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PORTEFEUILLE ---
app.get(['/api/portefeuille', '/api/v1/wallet'], authenticateToken, async (req, res) => {
    res.json(await Wallet.findOne({ utilisateurId: req.user.id }));
});

app.post(['/api/portefeuille/crediter', '/api/v1/wallet/credit'], authenticateToken, async (req, res) => {
    const wallet = await Wallet.findOneAndUpdate({ utilisateurId: req.user.id }, { $inc: { soldeDisponible: req.body.montant } }, { new: true });
    await new Transaction({ id: uuidv4(), portefeuilleId: wallet.id, type: 'credit', montant: req.body.montant, reference: "DEPOT_" + Date.now() }).save();
    res.json(wallet);
});

app.post(['/api/portefeuille/debiter', '/api/v1/wallet/debit'], authenticateToken, async (req, res) => {
    try {
        const montant = req.body.montant;
        const wallet = await Wallet.findOne({ utilisateurId: req.user.id });
        if (!wallet || wallet.soldeDisponible < montant) {
            return res.status(400).json({ success: false, message: "Solde insuffisant" });
        }
        wallet.soldeDisponible -= montant;
        await wallet.save();
        await new Transaction({ id: uuidv4(), portefeuilleId: wallet.id, type: 'debit', montant, reference: "PAIEMENT_" + Date.now() }).save();
        res.json(wallet);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/portefeuille/retrait', '/api/v1/wallet/withdraw'], authenticateToken, async (req, res) => {
    try {
        const montant = req.body.montant;
        const wallet = await Wallet.findOne({ utilisateurId: req.user.id });
        if (!wallet || wallet.soldeDisponible < montant) {
            return res.status(400).json({ success: false, message: "Solde insuffisant pour ce retrait" });
        }
        wallet.soldeDisponible -= montant;
        wallet.soldeEnAttente = (wallet.soldeEnAttente || 0) + montant;
        await wallet.save();
        await new Transaction({ id: uuidv4(), portefeuilleId: wallet.id, type: 'retrait', montant, reference: "RETRAIT_" + Date.now() }).save();
        res.json(wallet);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- RECHARGE MOBILE MONEY (CamerPay) ---
// ⚠️ URL, token et noms de champs à VÉRIFIER avec ta vraie doc marchand CamerPay
// (celle de ton compte sur camerpay.biz, pas la doc marketing publique).
const CAMERPAY_API_URL = "https://camerpay.biz/api/v1/payments"; // à confirmer
const CAMERPAY_API_TOKEN = "TON_TOKEN_CAMERPAY"; // remplace par ta vraie clé

app.post(['/api/portefeuille/recharge-mobile-money', '/api/v1/portefeuille/recharge-mobile-money'], authenticateToken, async (req, res) => {
    try {
        const { montant, telephone, operateur } = req.body;
        if (!montant || !telephone || !operateur) {
            return res.status(400).json({ success: false, message: "Montant, téléphone et opérateur requis" });
        }

        const wallet = await Wallet.findOne({ utilisateurId: req.user.id });
        if (!wallet) return res.status(404).json({ success: false, message: "Portefeuille introuvable" });

        const referenceInterne = "RECHARGE_" + uuidv4();

        const camerpayResponse = await fetch(CAMERPAY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CAMERPAY_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: montant,
                currency: 'XAF',
                method: operateur,
                customer_phone: telephone,
                reference: referenceInterne,
                callback_url: `${req.protocol}://${req.get('host')}/api/portefeuille/webhook/camerpay`,
            }),
        });
        const camerpayData = await camerpayResponse.json();

        if (!camerpayResponse.ok) {
            return res.status(502).json({ success: false, message: "Échec de l'initialisation du paiement CamerPay", details: camerpayData });
        }

        await new Transaction({
            id: uuidv4(),
            portefeuilleId: wallet.id,
            type: 'recharge',
            montant,
            reference: referenceInterne,
            statut: 'en_attente',
            referenceCamerPay: camerpayData.transaction_uuid || camerpayData.id || null,
        }).save();

        res.status(201).json({ success: true, message: "Paiement initié, confirme sur ton téléphone", reference: referenceInterne });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/api/portefeuille/recharge-mobile-money/:reference/statut', '/api/v1/portefeuille/recharge-mobile-money/:reference/statut'], authenticateToken, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ reference: req.params.reference });
        if (!transaction) return res.status(404).json({ success: false, message: "Transaction introuvable" });
        res.json({ statut: transaction.statut, montant: transaction.montant });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post(['/api/portefeuille/webhook/camerpay', '/api/v1/portefeuille/webhook/camerpay'], async (req, res) => {
    try {
        const { reference, status } = req.body;

        const transaction = await Transaction.findOne({ reference });
        if (!transaction) return res.status(404).json({ success: false });

        if (status === 'success' || status === 'successful') {
            transaction.statut = 'reussi';
            await transaction.save();
            await Wallet.findOneAndUpdate({ id: transaction.portefeuilleId }, { $inc: { soldeDisponible: transaction.montant } });
        } else if (status === 'failed') {
            transaction.statut = 'echoue';
            await transaction.save();
        }

        res.status(200).json({ received: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get(['/api/portefeuille/transactions', '/api/v1/wallet/transactions'], authenticateToken, async (req, res) => {
    try {
        const wallet = await Wallet.findOne({ utilisateurId: req.user.id });
        if (!wallet) return res.json([]);
        const transactions = await Transaction.find({ portefeuilleId: wallet.id }).sort({ dateCreation: -1 });
        res.json(transactions);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MESSAGES & NOTIFICATIONS ---
app.get(['/api/messages/:commandeId', '/api/v1/messages/:commandeId'], authenticateToken, async (req, res) => {
    res.json(await Message.find({ commandeId: req.params.commandeId }));
});

app.post(['/api/messages', '/api/v1/messages'], authenticateToken, async (req, res) => {
    const msg = new Message({ ...req.body, id: uuidv4(), expediteurId: req.user.id });
    await msg.save();
    res.status(201).json(msg);
});

app.get(['/api/notifications', '/api/v1/notifications'], authenticateToken, async (req, res) => {
    res.json(await Notification.find({ utilisateurId: req.user.id }).sort({ dateEnvoi: -1 }));
});

// --- ADMIN ---
app.get(['/api/admin/users', '/api/v1/admin/users'], authenticateToken, async (req, res) => {
    if (!req.user.roles.includes('admin')) return res.sendStatus(403);
    res.json(await User.find({}));
});

// ══════════════════════════════════════════════════════════════════
//  5. DÉMARRAGE DU SERVEUR
// ══════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
    console.log(`\n🚀 SERVEUR RÉEL OPÉRATIONNEL SUR http://localhost:${PORT}`);
    console.log(`✅ MongoDB Atlas, Auth, Commandes, Wallet, Chat et GPS sont actifs.`);
});