const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();

const SALT_ROUNDS = 10; // Numero di cicli per l'hashing. 10 è un buon punto di partenza.

/**
 * Crea e configura il router per la rotta di registrazione.
 * @param {object} sql - L'istanza del client per il database (es. neon).
 * @returns {object} Il router di Express configurato.
 */
const registrationController = (sql) => {
    router.post("/", async (req, res) => {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res
                .status(400)
                .json({ error: "Username e password sono obbligatorie" });
        }

        try {
            // 1. Controlla se l'utente esiste già
            const existingUser =
                await sql`SELECT id FROM utenti WHERE username = ${username}`;

            if (existingUser.length > 0) {
                return res.status(409).json({ error: "Username già in uso" });
            }

            // 2. Esegui l'hashing della password
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

            // 3. Inserisci il nuovo utente nel database
            const result =
                await sql`INSERT INTO utenti (username, pwd, stato, ruolo) VALUES (${username}, ${hashedPassword}, 'U', 'user') RETURNING id, username, stato, ruolo`; // status default U, ci penserà a gestirlo il websocket

            const utente = result[0];

            // Genera il Token JWT (lo stesso meccanismo del Login)
            const token = jwt.sign(
                { id: utente.id, username: utente.username, ruolo: utente.ruolo },
                process.env.JWT_SECRET || "segreto_super_sicuro_da_cambiare",
                { expiresIn: "1h" }
            );

            // Imposta il cookie HttpOnly
            res.cookie("token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 3600000,
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
            });

            // 4. Restituisci una risposta di successo
            return res.status(201).json({
                message: "Utente registrato con successo",
                user: utente,
            });
        } catch (err) {
            console.error("Errore durante la registrazione:", err);
            return res.status(500).json({ error: "Errore interno del server" });
        }
    });

    return router;
};

module.exports = registrationController;