const express = require("express");
const router = express.Router();

/**
 * Crea e configura il router per le rotte relative agli utenti.
 * @param {object} sql - L'istanza del client per il database (es. neon).
 * @returns {object} Il router di Express configurato.
 */
const userController = (sql) => {
    // Leggere tutti gli utenti (con campi sicuri e ordinati)
    router.get("/", async (req, res) => {
        try {
            // Seleziona solo i campi sicuri e utili, ordinandoli per stato.
            const utenti =
                await sql`SELECT id, username, punti, stato FROM utenti ORDER BY stato, punti DESC`;
            res.json(utenti);
        } catch (err) {
            console.error("Errore query utenti:", err);
            res.status(500).json({ error: "Errore nel leggere la tabella utenti" });
        }
    });

    return router;
};

module.exports = userController;