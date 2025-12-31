const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");

/**
 * Crea e configura il router per la rotta di login.
 * @param {object} sql - L'istanza del client per il database (es. neon).
 * @returns {object} Il router di Express configurato.
 */
const loginController = (sql) => {
    // Rotta per verificare la sessione al caricamento della pagina
    // GET /login/verify
    router.get("/verify", (req, res) => {
        const token = req.cookies.token;

        if (!token) {
            return res.json({ user: null });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "segreto_super_sicuro_da_cambiare");
            res.json({ user: decoded });
        } catch (err) {
            res.json({ user: null });
        }
    });

    // Login utente
    // La rotta è POST / dato che il prefisso /login verrà usato in index.js
    router.post("/", async (req, res) => {
        console.log("[LOGIN] Richiesta ricevuta");
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res
                .status(400)
                .json({ error: "Username e password sono obbligatorie" });
        }

        try {
            // Cerca l'utente per username
            const result =
                await sql`SELECT id, username, pwd, stato, ruolo FROM utenti WHERE username = ${username}`;

            if (result.length === 0) {
                console.log("[LOGIN] Utente non trovato:", username);
                // Messaggio generico per non rivelare se l'utente esiste o meno
                return res.status(401).json({ error: "Credenziali non valide!!" });
            }

            const utente = result[0];

            // Confronta la password fornita con l'hash salvato nel DB
            const passwordMatch = await bcrypt.compare(password, utente.pwd);
            if (!passwordMatch) {
                console.log("[LOGIN] Password errata per:", username);
                return res.status(401).json({ error: "Credenziali non valide" });
            }

            await sql`update utenti set stato = 'L' where id= ${utente.id}`

            // Genera il Token JWT per la gestione della Session
            const token = jwt.sign(
                { id: utente.id, username: utente.username, ruolo: utente.ruolo },
                process.env.JWT_SECRET || "segreto_super_sicuro_da_cambiare",
                { expiresIn: "1h" }
            );
            console.log("[LOGIN] Token generato con successo");

            const isProduction = process.env.NODE_ENV === "production";
            console.log(`[LOGIN] Configurazione Cookie - Production: ${isProduction}, SameSite: ${isProduction ? "none" : "lax"}`);

            // Imposta il cookie HttpOnly
            res.cookie("token", token, {
                httpOnly: true, // Fondamentale: impedisce l'accesso via JS
                secure: isProduction, // Usa HTTPS in produzione
                maxAge: 3600000, // 1 ora in millisecondi
                sameSite: isProduction ? "none" : "lax" // "none" per cross-site (Vercel->Render), "lax" per localhost
            });
            console.log("[LOGIN] Cookie HttpOnly impostato nella risposta");

            // Login successo: restituisce un messaggio e i dati utente (senza password)
            return res.json({
                message: "Login effettuato con successo",
                user: {
                    id: utente.id,
                    username: utente.username,
                    stato: 'L',
                    ruolo: utente.ruolo
                },
            });
        } catch (err) {
            console.error("Errore durante il login:", err);
            return res.status(500).json({ error: "Errore interno del server" });
        }
    });

    return router;
};

module.exports = loginController;