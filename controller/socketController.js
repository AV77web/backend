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
  const activeGames = new Map(); // gameId-> {palyer1: sockeId, player2: socketId, secret1: [], secret2: [] , guesse1: [] guessese2: []}

  // Funzione helper per calcolare il feedback (stessa logica del frontend)
  function calculateFeedback(secret, guess) {
    const secretCopy = [...secret];
    const guessCopy = [...guess];
    let black = 0;
    let white = 0;

    // Neri (posizione e colore corretti)
    secretCopy.forEach((val, i) => {
      if (val === guessCopy[i]) {
        black++;
        secretCopy[i] = guessCopy[i] = -1;
      }
    });

    // Bianchi (colore corretto ma posizione sbagliata)
    secretCopy.forEach((val) => {
      if (val !== -1) {
        const idx = guessCopy.indexOf(val);
        if (idx !== -1) {
          white++;
          guessCopy[idx] = -1;
        }
      }
    });

    return [...Array(black).fill("black"), ...Array(white).fill("white")];
  }

  io.on("connection", (socket) => {
    console.log(`[SOCKET] Nuova connessione: ${socket.id}`);

    // 1. Registrazione utente nella lista
    // Quando il frontend si connette e invia "register_user"
    socket.on("register_user", (userData) => {
      // Gestisce sia se userData è una stringa (da App.jsx attuale) sia se è un oggetto
      const username =
        typeof userData === "string" ? userData : userData?.username;

      // Salviamo anche il socketId per poterlo contattare privatamente
      const user = {
        username: username,
        socketId: socket.id,
        status: "online",
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
          socketId: socket.id,
        });
      }
    });

    // 4. Gestione Sfida: Accettazione
    socket.on("accept_challenge", ({ challengerId }) => {
      const accepter = onlineUsers.get(socket.id);
      const challenger = onlineUsers.get(challengerId);

      if (accepter && challenger) {
        // Crea un gameId univoco per questa partita
        const gameId = `${challengerId}_${socket.id}_${Date.now()}`;

        // Inizializza la partita
        activeGames.set(gameId, {
          player1: challengerId,
          player2: socket.id,
          secret1: null, // codice segreto del giocatore 1
          secret2: null, // codice segreto del giocatore 2
          guesses1: [], // tentativi del giocatore 1 verso il codice del giocatore 2
          guesses2: [], // tentativi del giocatore 2 verso il codice del giocatore 1
          bothCodesSet: false,
        });

        // Notifica lo sfidante che la sfida è stata accettata
        io.to(challengerId).emit("challenge_accepted", {
          opponent: accepter.username,
          opponentSocketId: socket.id,
          gameId: gameId,
          role: "player1", // chi ha sfidato è player 1
        });

        // Notifica anche chi ha accettato (l'accepter)
        io.to(socket.id).emit("challenge_accepted", {
          opponent: challenger.username,
          opponentSocketId: challengerId,
          gameId: gameId,
          role: "player2", // chi ha accettato è player2
        });
      }
    });

    // 5. Invio codice segreto
    socket.on("set_secret_code", ({ gameId, secretCode }) => {
      const game = activeGames.get(gameId);
      if (!game) {
        console.log(`[SOCKET] Game ${gameId} non trovato`);
        return;
      }

      const isPlayer1 = game.player1 === socket.id;
      const isPlayer2 = game.player2 === socket.id;

      if (!isPlayer1 && !isPlayer2) {
        console.log(
          `[SOCKET] Socket ${socket.id} non è parte del game ${gameId}`
        );
        return;
      }

      // Salva il codice segreto del giocatore
      if (isPlayer1) {
        game.secret1 = secretCode;
        console.log(
          `[SOCKET] Player1 ha impostato il codice per game ${gameId}`
        );
      } else if (isPlayer2) {
        game.secret2 = secretCode;
        console.log(
          `[SOCKET] Player2 ha impostato il codice per game ${gameId}`
        );
      }

      // Controlla se entrambi hanno impostato il codice
      if (game.secret1 && game.secret2) {
        game.bothCodesSet = true;
        console.log(`[SOCKET] Entrambi i codici impostati per game ${gameId}`);

        // Notifica entrambi i giocatori che possono iniziare a giocare
        io.to(game.player1).emit("both_codes_set", { gameId });
        io.to(game.player2).emit("both_codes_set", { gameId });
      } else {
        // Notifica l'avversario che l'altro ha impostato il codice (ma non il codice stesso!)
        const opponentSocketId = isPlayer1 ? game.player2 : game.player1;
        io.to(opponentSocketId).emit("opponent_code_set", { gameId });
        console.log(
          `[SOCKET] Avversario notificato che il codice è stato impostato per game ${gameId}`
        );
      }
    });

    // 6. Invio tentativo
    socket.on("submit_guess", ({ gameId, guess }) => {
      const game = activeGames.get(gameId);

      if (!game) {
        console.log(`[SOCKET] Game ${gameId} non trovato per submit_guess`);
        return;
      }

      if (!game.bothCodesSet) {
        console.log(
          `[SOCKET] Tentativo rifiutato: codici non ancora entrambi impostati per game ${gameId}`
        );
        socket.emit("guess_error", {
          gameId,
          error: "I codici segreti non sono ancora stati entrambi impostati",
        });
        return;
      }

      const isPlayer1 = game.player1 === socket.id;
      const isPlayer2 = game.player2 === socket.id;

      if (!isPlayer1 && !isPlayer2) {
        console.log(
          `[SOCKET] Socket ${socket.id} non è parte del game ${gameId}`
        );
        return;
      }

      // Determina quale codice segreto indovinare
      const targetSecret = isPlayer1 ? game.secret2 : game.secret1;
      const guessesArray = isPlayer1 ? game.guesses1 : game.guesses2;

      // Verifica che non abbia già vinto o perso
      if (guessesArray.length >= 10) {
        socket.emit("guess_error", {
          gameId,
          error: "Hai già esaurito tutti i tentativi",
        });
        return;
      }

      // Calcola il feedback
      const feedback = calculateFeedback(targetSecret, guess);
      const guessData = { guess, feedback };

      guessesArray.push(guessData);

      // Controlla vittoria
      const isWin = guess.every((val, idx) => val === targetSecret[idx]);
      const gameOver = guessesArray.length >= 10 || isWin;

      console.log(
        `[SOCKET] Tentativo ricevuto da ${
          isPlayer1 ? "Player1" : "Player2"
        } per game ${gameId}. Win: ${isWin}, GameOver: ${gameOver}`
      );

      // Invia il feedback al giocatore che ha fatto il tentativo
      socket.emit("guess_feedback", {
        gameId,
        guessData,
        isWin,
        gameOver,
      });

      // Notifica anche l'avversario del tentativo (per mostrare nella sua UI)
      const opponentSocketId = isPlayer1 ? game.player2 : game.player1;
      io.to(opponentSocketId).emit("opponent_guess", {
        gameId,
        guessData,
      });

      // Se ha vinto o perso, notifica anche l'avversario dello stato finale
      if (gameOver) {
        io.to(opponentSocketId).emit("opponent_game_status", {
          gameId,
          opponentWon: isWin,
          opponentLost: !isWin && guessesArray.length >= 10,
        });
      }
    });

    // 7. Disconnessione
    socket.on("disconnect", () => {
      // Rimuovi l'utente dalla lista
      if (onlineUsers.has(socket.id)) {
        onlineUsers.delete(socket.id);
        // Aggiorna la lista per tutti gli altri
        io.emit("users_list_update", Array.from(onlineUsers.values()));
      }

      // Rimuovi tutte le partite attive di questo giocatore
      for (const [gameId, game] of activeGames.entries()) {
        if (game.player1 === socket.id || game.player2 === socket.id) {
          const opponentSocketId =
            game.player1 === socket.id ? game.player2 : game.player1;

          // Notifica l'avversario della disconnessione
          if (opponentSocketId && onlineUsers.has(opponentSocketId)) {
            io.to(opponentSocketId).emit("opponent_disconnected", { gameId });
          }

          // Rimuovi la partita
          activeGames.delete(gameId);
          console.log(
            `[SOCKET] Partita ${gameId} rimossa per disconnessione di ${socket.id}`
          );
        }
      }
    });
  });
};

module.exports = socketController;
