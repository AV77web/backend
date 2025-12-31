const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    // Recupera il token dai cookie della richiesta (grazie a cookie-parser)
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ error: "Accesso negato: Autenticazione richiesta" });
    }

    try {
        // Verifica il token usando la stessa chiave segreta definita in loginController
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "segreto_super_sicuro_da_cambiare"
        );
        req.user = decoded; // Aggiunge i dati dell'utente decodificati all'oggetto req
        next(); // Passa il controllo alla rotta successiva
    } catch (err) {
        return res.status(403).json({ error: "Token non valido o scaduto" });
    }
};

module.exports = authMiddleware;
