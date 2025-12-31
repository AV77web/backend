//=======================================
// File: rankingController.js
// script che richiama la classifica
// @author: "catalin.groppo@allievi.itsdigitalacademy.com"
//           mattia.zara@allievi.itsdigitalacademy.com"
//           sandu.batrincea@allievi.itsdigitalacademy.com"
//           andrea.villari@allievi.itsdigitalacademy.com"
// @version: "1.0.0.0 2025-30-12"
//=======================================

const express = require("express");
const router = express.Router();

/**
 * Crea e configura il router per la rotta del ranking (classifica).
 * @param {object} sql - L'istanza del client per il database.
 * @returns {object} Il router di Express configurato.
 */
const rankingController = (sql) => {
    // GET /ranking
    router.get("/", async (req, res) => {
        console.log("[RANKING] Richiesta classifica ricevuta");

        try {
            // Seleziona username e punti, ordinati per punti decrescenti
            const classifica = await sql`
                SELECT username, punti 
                FROM utenti 
                ORDER BY punti DESC 
                LIMIT 50
            `;
            res.json(classifica);
        } catch (err) {
            console.error("[RANKING] Errore query:", err);
            return res.status(500).json({ error: "Errore interno del server" });
        }
    });

    return router;
};

module.exports = rankingController;
