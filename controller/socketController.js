//==============================================================
// File: socketController.js
// Gestione eventi WebSocket per lobby e sfide
//==============================================================

/**
 * Gestisce tutta la logica WebSocket per la lista  e il gioco.
 * Mantiene in memoria la lista degli utenti connessi.
 * 
 * @param {object} io - L'istanza del server Socket.io
 */
const socketController = (io) => {
    // Mappa per tracciare gli utenti online: socket.id -> { username, ... }
    const onlineUsers = new Map();

    io.on("connection", (socket) => {
        console.log(`[SOCKET] Nuova connessione: ${socket.id}`);

        // 1. Registrazione utente nella lista
        // Quando il frontend si connette e invia "register_user"
        socket.on("register_user", (userData) => {
            // Gestisce sia se userData è una stringa (da App.jsx attuale) sia se è un oggetto
            const username = typeof userData === 'string' ? userData : userData?.username;

            // Salviamo anche il socketId per poterlo contattare privatamente
            const user = {
                username: username,
                socketId: socket.id,
                status: "online"
            };

            onlineUsers.set(socket.id, user);
            console.log(onlineUsers);

            // Notifica a TUTTI i client la nuova lista utenti aggiornata
            io.emit("users_list_update", Array.from(onlineUsers.values()));
        });

        // 2. Richiesta lista utenti (per chi entra dopo o ricarica la pagina)
        socket.on("get_users", () => {
            socket.emit("users_list_update", Array.from(onlineUsers.values()));
        });

        // 3. Gestione Sfida: Invio
        socket.on("send_challenge", ({ targetSocketId }) => {
            const challenger = onlineUsers.get(socket.id);

            if (challenger && onlineUsers.has(targetSocketId)) {
                // Invia l'evento SOLO all'utente sfidato
                io.to(targetSocketId).emit("challenge_received", {
                    username: challenger.username,
                    socketId: socket.id
                });
            }
        });

        // 4. Gestione Sfida: Accettazione
        socket.on("accept_challenge", ({ challengerId }) => {
            const accepter = onlineUsers.get(socket.id);
            const challenger = onlineUsers.get(challengerId);

            if (accepter && challenger) {
                // Notifica lo sfidante che la sfida è stata accettata
                io.to(challengerId).emit("challenge_accepted", {
                    opponent: accepter.username,
                    opponentSocketId: socket.id
                });

                // Notifica anche chi ha accettato (l'accepter)
                io.to(socket.id).emit("challenge_accepted", {
                    opponent: challenger.username,
                    opponentSocketId: challengerId
                });
            }
        });

        // 5. Disconnessione
        socket.on("disconnect", () => {
            if (onlineUsers.has(socket.id)) {
                onlineUsers.delete(socket.id);

                // Aggiorna la lista per tutti gli altri
                io.emit("users_list_update", Array.from(onlineUsers.values()));
            }
        });
    });
};

module.exports = socketController;