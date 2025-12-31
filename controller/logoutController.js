//=============================
// File: logoutController.js
// script che esegue il logout
//==========================

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const logoutController = (sql) => {
    // Rotta POST / (che sarà montata su /logout)
    router.post("/", async (req, res) => {
        console.log("[LOGOUT] Richiesta ricevuta");
        // DEBUG: Stampa l'origine e i cookie grezzi ricevuti
        console.log("[LOGOUT] Origin:", req.headers.origin);
        console.log("[LOGOUT] Raw Cookie Header:", req.headers.cookie);

        const token = req.cookies.token; // Recupera il token dal cookie
        
        if (!token) {
            console.log("[LOGOUT] Nessun token trovato nei cookie");
            return res.status(200).json({ message: "Logout effettuato (nessun token trovato)" });
        }

        try {
            // Verifica il token (sincrona per gestire meglio il flusso async/await)
            const user = jwt.verify(token, process.env.JWT_SECRET || "segreto_super_sicuro_da_cambiare");

            console.log(`[LOGOUT] Token valido per utente ID: ${user.id}`);

            // Aggiorna lo stato nel DB a 'U' (Unlogged)
            await sql`UPDATE utenti SET stato = 'U' WHERE id = ${user.id}`;
            console.log("[LOGOUT] Stato utente aggiornato nel DB");

            // Cancella il cookie HttpOnly
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
            });

            console.log("Logout effettuato con successo"); // Ora questo apparirà nella console!
            return res.json({ message: "Logout effettuato con successo" });

        } catch (error) {
            console.error("[LOGOUT] Errore o token scaduto:", error.message);
            // In caso di errore (es. token scaduto), puliamo comunque il cookie
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
            });
            return res.status(200).json({ message: "Logout effettuato (token non valido)" });
        }
    });

    return router;
};

module.exports = logoutController;
