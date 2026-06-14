const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { Chess } = require("chess.js");

const Match = require("./models/Match");
const User = require("./models/User");
const Room = require("./models/Room");

const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "https://frontend-y5ln.onrender.com",
].filter(Boolean);

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;


const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});


const { lobbyRooms } = require("./roomState");
const gameRooms = {};
const chessRooms = {};
const quizRooms = {};
const snakeRooms = {};


io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);


    socket.on("create_room", ({ roomId, username, game }, callback) => {

        const resolvedRoomId = roomId || Math.random()
            .toString(36)
            .substring(2, 7)
            .toUpperCase();

        lobbyRooms[resolvedRoomId] = {
            roomId: resolvedRoomId,
            game: game,
            hostId: socket.id,
            players: [
                {
                    socketId: socket.id,
                    username,
                },
            ],
            gameStarted: false,
        };

        socket.join(resolvedRoomId);

        callback({
            roomId: resolvedRoomId,
            game,
            host: true,
            players: lobbyRooms[resolvedRoomId].players,
        });

        io.to(resolvedRoomId).emit(
            "room_update",
            lobbyRooms[resolvedRoomId]
        );
    });


    socket.on("join_room", ({ roomId, username }, callback) => {

        console.log("================================");
        console.log("JOIN ROOM REQUEST");
        console.log("Room ID:", roomId);
        console.log("Username:", username);

        const room = lobbyRooms[roomId];

        if (!room) {
            console.log("ROOM NOT FOUND");

            if (typeof callback === "function") {
                return callback({
                    error: "Room not found",
                });
            }

            return;
        }

        const existingBySocket = room.players.find(
            (player) => player.socketId === socket.id
        );

        const existingByUsername = room.players.find(
            (player) => player.username === username
        );

        if (room.gameStarted && room.game !== "chess" && !existingBySocket && !existingByUsername && room.players.length >= 2) {
            console.log("GAME ALREADY STARTED");

            if (typeof callback === "function") {
                return callback({
                    error: "Game already started",
                });
            }

            return;
        }

        if (existingByUsername && !existingBySocket) {
            existingByUsername.socketId = socket.id;
        }

        if (existingBySocket) {

        } else if (existingByUsername) {

            existingByUsername.socketId = socket.id;
        } else {

            room.players.push({
                socketId: socket.id,
                username,
            });
        }

        console.log("PLAYER JOINED:", username);
        console.log("TOTAL PLAYERS:", room.players.length);

        socket.join(roomId);

        // Game-specific join logic
        if (room.game === "chess") {
            const chessRoom = chessRooms[roomId];
            if (chessRoom) {
                const playerIndex = room.players.findIndex(p => p.username === username);
                const color = playerIndex === 0 ? "white" : playerIndex === 1 ? "black" : "spectator";
                if (typeof callback === "function") {
                    callback({ roomId, color, gameState: getChessGameState(chessRoom) });
                }
            }
        } else if (room.game === "memory-match" && gameRooms[roomId]?.cards) {
            const gr = gameRooms[roomId];
            // Ensure joining player is in gameRoom and scores
            const playerExists = gr.players.some(p => p.username === username);
            if (!playerExists) {
                gr.players.push({
                    socketId: socket.id,
                    username,
                });
            }
            if (gr.scores[username] === undefined) {
                gr.scores[username] = 0;
            }
            socket.emit("memory_game_start", {
                cards: gr.cards,
                players: gr.players,
                currentPlayer: gr.players[gr.currentTurn]?.username,
                scores: gr.scores,
                matched: gr.matched || [],
            });
            if (typeof callback === "function") {
                callback({ roomId, host: false, hostId: room.hostId, players: room.players, game: room.game });
            }
        } else if (room.game === "snake-ladder" && snakeRooms[roomId]) {
            const sr = snakeRooms[roomId];
            socket.emit("snake_game_start", {
                players: sr.players,
                positions: sr.positions,
                currentPlayer: sr.players[sr.currentTurn]?.username,
            });
            if (typeof callback === "function") {
                callback({ roomId, host: false, hostId: room.hostId, players: room.players, game: room.game });
            }
        } else if (room.game === "quiz-battle" && quizRooms[roomId]) {
            socket.emit("quiz_start", {
                players: quizRooms[roomId].players,
                scores: quizRooms[roomId].scores,
            });
            if (typeof callback === "function") {
                callback({ roomId, host: false, hostId: room.hostId, players: room.players, game: room.game });
            }
        } else if (room.game === "tic-tac-toe" && gameRooms[roomId]) {
            const playerIdx = room.players.findIndex(p => p.username === username);
            const symbol = playerIdx === 1 ? "O" : "X";
            socket.emit("roomData", gameRooms[roomId]);
            if (typeof callback === "function") {
                callback({ roomId, host: false, hostId: room.hostId, players: room.players, game: room.game, symbol });
            }
        } else {
            const playerIdx = room.players.findIndex(p => p.username === username);
            const symbol = playerIdx === 1 ? "O" : "X";
            if (typeof callback === "function") {
                callback({ roomId, host: false, hostId: room.hostId, players: room.players, game: room.game, symbol });
            }
        }

        io.to(roomId).emit("room_update", room);

        console.log("ROOM UPDATE SENT");
        console.log("================================");
    });


    socket.on("start_game", ({ roomId }, callback) => {

        console.log("========== START_GAME EVENT ==========");
        console.log("START_GAME received for room:", roomId);
        console.log("Available lobbies:", Object.keys(lobbyRooms));
        console.log("Available game rooms:", Object.keys(gameRooms));

        const room = lobbyRooms[roomId];

        if (!room) {
            console.log("❌ Room not found for start_game");
            if (callback) callback({ error: "Room not found" });
            return;
        }

        console.log("✅ Room found:", room.game);
        console.log("Players:", room.players);

        if (socket.id !== room.hostId) {
            console.log("❌ Only host can start game. Socket ID:", socket.id, "Host ID:", room.hostId);
            if (callback) callback({ error: "Only host can start game" });
            return;
        }

        console.log("✅ Host verified. Starting game...");

        room.gameStarted = true;

        switch (room.game) {

            case "tic-tac-toe":
                console.log("Initializing tic-tac-toe");
                gameRooms[roomId] = {
                    game: "tic-tac-toe",
                    players: room.players,
                    board: Array(9).fill(""),
                    turn: "X",
                    winner: "",
                    symbolToUser: {},
                };

                break;

            case "chess":

                console.log("Initializing chess game for room:", roomId);
                console.log("Players:", room.players);

                chessRooms[roomId] = {
                    game: "chess",
                    players: room.players,
                    gameState: {
                        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                        status: "active",
                        turn: "white",
                        white: room.players[0]?.username || null,
                        black: room.players[1]?.username || null,
                        moveHistory: [],
                        isCheck: false,
                        isCheckmate: false,
                        winner: null,
                        spectatorCount: 0,
                        drawOffer: null,
                    },
                };

                console.log("Chess game initialized:", chessRooms[roomId]);

                io.to(roomId).emit("game_start", {
                    white: room.players[0]?.username || null,
                    black: room.players[1]?.username || null,
                });

                console.log("game_start event emitted");

                break;

            case "memory-match":

                console.log("🎮 Initializing MEMORY MATCH for room:", roomId);
                const cardIcons = ["🎮", "🎯", "🚀", "⚽", "🏆", "🎲", "🧠", "🔥"];
                const gameCards = [...cardIcons, ...cardIcons]
                  .sort(() => Math.random() - 0.5)
                  .map((icon, idx) => ({ id: idx, icon }));

                console.log("Players for game:", room.players);

                gameRooms[roomId] = {
                    game: "memory-match",
                    players: room.players,
                    cards: gameCards,
                    scores: {},
                    matched: [],
                    flipped: [],
                    currentTurn: 0,
                    gameState: "active",
                    moves: 0,
                };

                room.players.forEach(p => {
                  gameRooms[roomId].scores[p.username] = 0;
                  console.log(`Score initialized for ${p.username}`);
                });

                console.log("Game room created:", gameRooms[roomId]);

                const memoryGameData = {
                    cards: gameCards,
                    players: room.players,
                    currentTurn: 0,
                    currentPlayer: room.players[0]?.username,
                    scores: gameRooms[roomId].scores,
                    matched: [],
                };

                console.log("Emitting memory_game_start:", memoryGameData);
                io.to(roomId).emit("memory_game_start", memoryGameData);
                console.log("✅ memory_game_start event emitted");

                break;

            case "quiz-battle":
                quizRooms[roomId] = {
                    players: room.players,
                    scores: {},
                    finished: {},
                };
                room.players.forEach(p => { quizRooms[roomId].scores[p.username] = 0; });
                gameRooms[roomId] = { game: "quiz-battle", players: room.players };
                io.to(roomId).emit("quiz_start", { players: room.players });
                break;

            case "snake-ladder":
                snakeRooms[roomId] = {
                    players: room.players,
                    positions: {},
                    currentTurn: 0,
                };
                room.players.forEach(p => { snakeRooms[roomId].positions[p.username] = 1; });
                gameRooms[roomId] = { game: "snake-ladder", players: room.players };
                io.to(roomId).emit("snake_game_start", {
                    players: room.players,
                    positions: snakeRooms[roomId].positions,
                    currentPlayer: room.players[0]?.username,
                });
                break;

            default:

                gameRooms[roomId] = {
                    game: "tic-tac-toe",
                    players: room.players,
                    board: Array(9).fill(""),
                    turn: "X",
                    winner: "",
                    symbolToUser: {},
                };
        }

        io.to(roomId).emit("game_started", {
            roomId,
            game: room.game,
        });

        if (callback) callback({ success: true });
    });


    socket.on("makeMove", async ({ roomId, index, symbol }) => {

        // The match may be started via the REST route (/api/rooms/:id/start),
        // which does NOT emit the socket "start_game" event, so the game
        // room may not exist yet. Lazily create it from the lobby room so
        // moves always register.
        let room = gameRooms[roomId];

        if (!room) {
            const lobby = lobbyRooms[roomId];
            room = gameRooms[roomId] = {
                game: lobby?.game || "tic-tac-toe",
                players: lobby?.players || [],
                board: Array(9).fill(""),
                turn: "X",
                winner: "",
                symbolToUser: {},
            };
        }

        // Keep the player list fresh from the lobby so both usernames are
        // available when the result is recorded.
        if (lobbyRooms[roomId]?.players?.length) {
            room.players = lobbyRooms[roomId].players;
        }

        if (room.winner) return;
        if (index < 0 || index > 8 || !Number.isInteger(index)) return;
        if (room.turn !== symbol) return;
        if (room.board[index] !== "") return;

        room.board[index] = symbol;
        room.turn = symbol === "X" ? "O" : "X";

        // Learn which username plays which symbol from the moves they
        // actually make. The server never assigns symbols, so this is the
        // only reliable source for attributing the win to the right player.
        // Resolving the username here (not the socket id) survives reconnects.
        if (!room.symbolToUser) room.symbolToUser = {};
        const mover = (room.players || []).find(
            (p) => p.socketId === socket.id
        );
        if (mover) {
            room.symbolToUser[symbol] = mover.username;
        }

        const winner = checkWinner(room.board);

        if (winner) {
            room.winner = winner;
        }

        if (!winner && !room.board.includes("")) {
            room.winner = "DRAW";
        }


        if ((room.winner === "DRAW" || room.winner) && !room.recorded) {
            try {
                // In-memory guard: record each finished game exactly once.
                room.recorded = true;

                const players = room.players || [];

                if (room.winner === "DRAW") {

                    const [p1, p2] = players;

                    if (p1 && p2) {
                        const player1 = await User.findOne({ username: p1.username });
                        const player2 = await User.findOne({ username: p2.username });

                        const match = new Match({
                            roomId,
                            players: [player1?._id, player2?._id].filter(Boolean),
                            // no winner field -> treated as a draw everywhere
                            gameType: room.game || "Unknown",
                        });

                        await match.save();

                        io.emit("match_recorded", {
                            roomId,
                            winner: null,
                            draw: true,
                        });
                    }

                } else {

                    // Map the winning/losing SYMBOL to a username via the
                    // moves played, with a positional fallback if a player
                    // somehow never moved.
                    const loserSymbol = room.winner === "X" ? "O" : "X";
                    const map = room.symbolToUser || {};

                    const winnerUsername =
                        map[room.winner] ||
                        players[room.winner === "X" ? 0 : 1]?.username;

                    const loserUsername =
                        map[loserSymbol] ||
                        players[loserSymbol === "X" ? 0 : 1]?.username;

                    if (winnerUsername && loserUsername) {
                        const winnerUser = await User.findOne({ username: winnerUsername });
                        const loserUser = await User.findOne({ username: loserUsername });

                        const match = new Match({
                            roomId,
                            players: [winnerUser?._id, loserUser?._id].filter(Boolean),
                            winner: winnerUser?._id || null,
                            gameType: room.game || "Unknown",
                        });

                        await match.save();

                        io.emit("match_recorded", {
                            roomId,
                            winner: winnerUser?.username || null,
                            draw: false,
                        });
                    }
                }
            } catch (err) {
                console.error("Error recording match result:", err.message || err);
            }
        }

        io.to(roomId).emit("roomData", room);
    });

    socket.on("match_recorded", (payload) => {
        io.emit("match_recorded", payload);
    });

    socket.on("replay_request", ({ roomId, username }) => {
        const room = gameRooms[roomId];
        if (!room) return;
        io.to(roomId).emit("replay_invite", { invitedBy: username });
    });

    socket.on("snake_replay_request", ({ roomId, username }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "snake-ladder") return;
        io.to(roomId).emit("snake_replay_invite", { invitedBy: username });
    });

    socket.on("memory_replay_request", ({ roomId, username }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "memory-match") return;
        io.to(roomId).emit("memory_replay_invite", { invitedBy: username });
    });

    socket.on("snake_replay_accept", ({ roomId }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "snake-ladder") return;
        snakeRooms[roomId] = {
            players: room.players,
            positions: {},
            currentTurn: 0,
        };
        room.players.forEach(p => { snakeRooms[roomId].positions[p.username] = 1; });
        io.to(roomId).emit("snake_game_start", {
            players: room.players,
            positions: snakeRooms[roomId].positions,
            currentPlayer: room.players[0]?.username,
        });
        io.to(roomId).emit("snake_replay_started", {
            roomId,
            started: true,
        });
    });

    socket.on("replay_accept", ({ roomId }) => {
        const room = gameRooms[roomId];
        if (!room) return;

        if (room.game === "memory-match") {
            const cardIcons = ["🎮", "🎯", "🚀", "⚽", "🏆", "🎲", "🧠", "🔥"];
            room.cards = [...cardIcons, ...cardIcons]
                .sort(() => Math.random() - 0.5)
                .map((icon, idx) => ({ id: idx, icon }));
            room.matched = [];
            room.flipped = [];
            room.currentTurn = 0;
            room.scores = {};
            room.players.forEach((p) => {
                room.scores[p.username] = 0;
            });
            room.gameState = "active";
            room.moves = 0;

            io.to(roomId).emit("memory_game_start", {
                cards: room.cards,
                players: room.players,
                currentPlayer: room.players[0]?.username,
                scores: room.scores,
                matched: [],
            });
            return;
        }

        if (room.game === "snake-ladder") {
            snakeRooms[roomId] = {
                players: room.players,
                positions: {},
                currentTurn: 0,
            };
            room.players.forEach(p => { snakeRooms[roomId].positions[p.username] = 1; });
            io.to(roomId).emit("snake_game_start", {
                players: room.players,
                positions: snakeRooms[roomId].positions,
                currentPlayer: room.players[0]?.username,
            });
            io.to(roomId).emit("snake_replay_started", { roomId, started: true });
            io.to(roomId).emit("replay_started", { roomId, started: true });
            return;
        }

        room.board = Array(9).fill("");
        room.turn = "X";
        room.winner = "";
        room.recorded = false;
        room.symbolToUser = {};
        io.to(roomId).emit("roomData", room);
    });

    socket.on("memory_replay_accept", ({ roomId }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "memory-match") return;

        const cardIcons = ["🎮", "🎯", "🚀", "⚽", "🏆", "🎲", "🧠", "🔥"];
        room.cards = [...cardIcons, ...cardIcons]
            .sort(() => Math.random() - 0.5)
            .map((icon, idx) => ({ id: idx, icon }));
        room.matched = [];
        room.flipped = [];
        room.currentTurn = 0;
        room.scores = {};
        room.players.forEach((p) => {
            room.scores[p.username] = 0;
        });
        room.gameState = "active";
        room.moves = 0;

        io.to(roomId).emit("memory_game_start", {
            cards: room.cards,
            players: room.players,
            currentPlayer: room.players[0]?.username,
            scores: room.scores,
            matched: [],
        });
    });


    socket.on("chess_move", ({ roomId, move }, callback) => {
        console.log("Chess move received:", { roomId, move });

        const chessRoom = chessRooms[roomId];
        if (!chessRoom) {
            console.log("Chess room not found:", roomId);
            if (callback) callback({ error: "Chess room not found" });
            return;
        }

        const gameState = chessRoom.gameState;
        if (!gameState || gameState.status !== "active") {
            console.log("Game not active:", { status: gameState?.status });
            if (callback) callback({ error: "Game not active" });
            return;
        }

        const chess = new Chess(gameState.fen);

        try {
            console.log("Attempting move:", move, "from FEN:", gameState.fen);
            const moveResult = chess.move(move);

            if (!moveResult) {
                console.log("Invalid move:", move);
                if (callback) callback({ error: "Invalid move" });
                return;
            }

            console.log("Move successful:", moveResult);

            gameState.fen = chess.fen();
            gameState.moveHistory.push(moveResult);
            gameState.turn = chess.turn() === "w" ? "white" : "black";
            gameState.isCheck = chess.isCheck();
            gameState.isCheckmate = chess.isCheckmate();

            if (chess.isCheckmate()) {
                gameState.winner = chess.turn() === "w" ? "black" : "white";
                gameState.status = "finished";
                console.log("Checkmate! Winner:", gameState.winner);
                io.to(roomId).emit("game_over", {
                    winner: gameState.winner,
                    reason: "checkmate",
                    gameState,
                });
            } else if (chess.isDraw()) {
                gameState.winner = "draw";
                gameState.status = "finished";
                console.log("Draw!");
                io.to(roomId).emit("game_over", {
                    winner: "draw",
                    reason: chess.isStalemate() ? "stalemate" : "draw",
                    gameState,
                });
            } else {
                console.log("Move processed, broadcasting to room:", roomId);
                io.to(roomId).emit("chess_move", { gameState });
            }

            if (callback) callback({ success: true });
        } catch (err) {
            console.error("Error processing move:", err);
            if (callback) callback({ error: err.message });
        }
    });

    socket.on("resign", ({ roomId }) => {
        const chessRoom = chessRooms[roomId];
        if (!chessRoom) return;

        const gameState = chessRoom.gameState;
        const playerIndex = chessRoom.players.findIndex(p => p.socketId === socket.id);
        const resigningColor = playerIndex === 0 ? "white" : "black";
        const winner = resigningColor === "white" ? "black" : "white";

        gameState.winner = winner;
        gameState.status = "finished";

        io.to(roomId).emit("game_over", {
            winner,
            reason: "resignation",
            gameState,
        });
    });

    socket.on("offer_draw", ({ roomId }) => {
        const chessRoom = chessRooms[roomId];
        if (!chessRoom) return;

        const playerIndex = chessRoom.players.findIndex(p => p.socketId === socket.id);
        const offeringColor = playerIndex === 0 ? "white" : "black";

        chessRoom.gameState.drawOffer = offeringColor;
        io.to(roomId).emit("draw_offered", { by: offeringColor });
    });

    socket.on("respond_draw", ({ roomId, accept }) => {
        const chessRoom = chessRooms[roomId];
        if (!chessRoom) return;

        if (accept) {
            chessRoom.gameState.winner = "draw";
            chessRoom.gameState.status = "finished";
            io.to(roomId).emit("game_over", {
                winner: "draw",
                reason: "draw_agreement",
                gameState: chessRoom.gameState,
            });
        } else {
            chessRoom.gameState.drawOffer = null;
            io.to(roomId).emit("draw_offer_declined");
        }
    });

    socket.on("request_rematch", ({ roomId }) => {
        const chessRoom = chessRooms[roomId];
        if (!chessRoom) return;

        const lobby = lobbyRooms[roomId];
        if (!lobby) return;

        // Create new game
        chessRoom.gameState = {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            status: "active",
            turn: "white",
            white: lobby.players[1]?.username || null,
            black: lobby.players[0]?.username || null,
            moveHistory: [],
            isCheck: false,
            isCheckmate: false,
            winner: null,
            spectatorCount: 0,
            drawOffer: null,
        };

        io.to(roomId).emit("rematch_started", {
            white: chessRoom.gameState.white,
            black: chessRoom.gameState.black,
            gameState: chessRoom.gameState,
        });
    });


    socket.on("memory_flip", ({ roomId, card, username }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "memory-match") return;

        console.log(`Memory flip from ${username} in room ${roomId}:`, card);

        // Only allow current player to flip
        const currentPlayer = room.players[room.currentTurn];
        if (currentPlayer?.username !== username) {
            console.log(`Not ${currentPlayer?.username}'s turn, ${username} tried to flip`);
            return;
        }

        if (room.flipped.length >= 2) return;

        // Add to flipped
        room.flipped.push(card.index);

        io.to(roomId).emit("memory_flip", {
            index: card.index,
            username,
            flippedCount: room.flipped.length,
        });

        // Check if two cards are flipped
        if (room.flipped.length === 2) {
            const [idx1, idx2] = room.flipped;
            const card1 = room.cards[idx1];
            const card2 = room.cards[idx2];
            const isMatch = card1.icon === card2.icon;

            setTimeout(() => {
                if (isMatch) {
                    // Match found - add to matched and score point
                    room.matched.push(idx1, idx2);
                    room.scores[username]++;

                    console.log(`Match found by ${username}! Score: ${room.scores[username]}`);

                    io.to(roomId).emit("memory_match_found", {
                        indices: [idx1, idx2],
                        username,
                        score: room.scores[username],
                    });

                    room.flipped = [];

                    // Check if game over
                    if (room.matched.length === room.cards.length) {
                        const scoreEntries = Object.entries(room.scores);
                        const maxScore = Math.max(...scoreEntries.map(([, sc]) => sc));
                        const winners = scoreEntries.filter(([, sc]) => sc === maxScore).map(([name]) => name);
                        const winnerValue = winners.length > 1 ? "DRAW" : winners[0];

                        io.to(roomId).emit("memory_game_over", {
                            winner: winnerValue,
                            scores: room.scores,
                        });

                        room.gameState = "finished";
                    } else {
                        // Same player gets another turn
                        io.to(roomId).emit("memory_turn_update", {
                            currentPlayer: username,
                            currentTurn: room.currentTurn,
                            scores: room.scores,
                        });
                    }
                } else {
                    // No match - switch turn
                    console.log(`No match. Switching turn.`);

                    room.flipped = [];
                    room.currentTurn = (room.currentTurn + 1) % room.players.length;
                    const nextPlayer = room.players[room.currentTurn];

                    io.to(roomId).emit("memory_no_match", {
                        indices: [idx1, idx2],
                        nextPlayer: nextPlayer?.username,
                        nextTurn: room.currentTurn,
                    });

                    io.to(roomId).emit("memory_turn_update", {
                        currentPlayer: nextPlayer?.username,
                        currentTurn: room.currentTurn,
                        scores: room.scores,
                    });
                }
            }, 1000);
        }
    });

    socket.on("memory_replay_request", ({ roomId, username }) => {
        const room = gameRooms[roomId];
        if (!room || room.game !== "memory-match") return;

        room.replayRequestBy = username;
        io.to(roomId).emit("memory_replay_invite", { invitedBy: username });
    });

    socket.on("memory_replay_accept", ({ roomId }) => {
        let room = gameRooms[roomId];
        if (!room || room.game !== "memory-match") return;

        // Reset game state
        const cardIcons = ["🎮", "🎯", "🚀", "⚽", "🏆", "🎲", "🧠", "🔥"];
        const gameCards = [...cardIcons, ...cardIcons]
            .sort(() => Math.random() - 0.5)
            .map((icon, idx) => ({ id: idx, icon }));

        room.cards = gameCards;
        room.matched = [];
        room.flipped = [];
        room.currentTurn = 0;
        room.gameState = "active";
        room.replayRequestBy = null;

        // Reset scores
        room.players.forEach(p => {
            room.scores[p.username] = 0;
        });

        const memoryGameData = {
            cards: gameCards,
            players: room.players,
            currentTurn: 0,
            currentPlayer: room.players[0]?.username,
            scores: room.scores,
            matched: [],
        };

        console.log("Emitting memory_game_start for replay:", memoryGameData);
        io.to(roomId).emit("memory_game_start", memoryGameData);
    });

    socket.on("quiz_answer", (payload) => {
        if (!payload || !payload.roomId) return;
        io.to(payload.roomId).emit("quiz_answer", payload);

        const qr = quizRooms[payload.roomId];
        if (!qr) return;
        if (payload.finalScore !== undefined) {
            qr.finished[payload.player] = payload.finalScore;
            qr.scores[payload.player] = payload.finalScore;
            if (Object.keys(qr.finished).length >= qr.players.length) {
                const entries = Object.entries(qr.finished);
                let winner = "draw";
                if (entries.length >= 2) {
                    const [p1, s1] = entries[0];
                    const [p2, s2] = entries[1];
                    if (s1 > s2) winner = p1;
                    else if (s2 > s1) winner = p2;
                } else if (entries.length === 1) {
                    winner = entries[0][0];
                }
                io.to(payload.roomId).emit("quiz_game_over", { scores: qr.finished, winner });
            }
        }
    });

    socket.on("quiz_replay_request", ({ roomId, username }) => {
        if (quizRooms[roomId]) {
            quizRooms[roomId].replayRequestBy = username;
        }
        // Relay unconditionally — don't gate on quizRooms existence
        io.to(roomId).emit("quiz_replay_invite", { invitedBy: username });
    });

    socket.on("quiz_replay_accept", ({ roomId }) => {
        let qr = quizRooms[roomId];
        if (!qr) {
            // Recover from in-memory loss (e.g. server hot-reload) using gameRooms
            const gr = gameRooms[roomId];
            if (!gr) return;
            quizRooms[roomId] = { players: gr.players, scores: {}, finished: {} };
            qr = quizRooms[roomId];
        }
        qr.scores = {};
        qr.finished = {};
        qr.replayRequestBy = null;
        qr.players.forEach(p => { qr.scores[p.username] = 0; });
        io.to(roomId).emit("quiz_start", { players: qr.players });
    });

    socket.on("snake_roll", (payload) => {
        if (!payload || !payload.roomId) return;
        const sr = snakeRooms[payload.roomId];
        if (!sr) {
            io.to(payload.roomId).emit("snake_roll", payload);
            return;
        }
        const currentPlayer = sr.players[sr.currentTurn];
        if (currentPlayer?.username !== payload.username) return;

        sr.positions[payload.username] = payload.position;
        sr.currentTurn = (sr.currentTurn + 1) % sr.players.length;
        const nextPlayer = sr.players[sr.currentTurn]?.username;

        io.to(payload.roomId).emit("snake_roll", {
            ...payload,
            positions: { ...sr.positions },
            currentPlayer: nextPlayer,
        });

        if (payload.position === 100) {
            io.to(payload.roomId).emit("snake_game_over", {
                winner: payload.username,
                positions: sr.positions,
            });
            delete snakeRooms[payload.roomId];
        }
    });


    socket.on("disconnect", () => {

        console.log("Disconnected:", socket.id);

        for (const roomId in lobbyRooms) {
            const room = lobbyRooms[roomId];
            const idx = room.players.findIndex(p => p.socketId === socket.id);
            if (idx === -1) continue;

            if (room.gameStarted) {
                // Keep the slot so the player can rejoin mid-game.
                room.players[idx].socketId = null;
                io.to(roomId).emit("room_update", room);
            } else {
                room.players.splice(idx, 1);
                if (room.players.length === 0) {
                    delete lobbyRooms[roomId];
                    delete gameRooms[roomId];
                    delete chessRooms[roomId];
                } else {
                    io.to(roomId).emit("room_update", room);
                }
            }
        }

        for (const roomId in gameRooms) {
            const gr = gameRooms[roomId];
            const idx = gr.players?.findIndex(p => p.socketId === socket.id);
            if (idx !== undefined && idx !== -1) {
                gr.players[idx].socketId = null;
            }
        }

        for (const roomId in chessRooms) {
            chessRooms[roomId].players =
                chessRooms[roomId].players?.filter(
                    (p) => p.socketId !== socket.id
                );

            if (chessRooms[roomId].players?.length === 0) {
                delete chessRooms[roomId];
            } else if (chessRooms[roomId].gameState?.status === "active") {
                io.to(roomId).emit("player_left", {
                    color: chessRooms[roomId].players[0]?.socketId === socket.id ? "white" : "black"
                });
            }
        }

    });

});


function checkWinner(board) {

    const patterns = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    for (let [a, b, c] of patterns) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

function getChessGameState(chessRoom) {
    return chessRoom.gameState;
}


server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    // Wipe all stale "waiting" rooms from the DB on every boot.
    // Active rooms are tracked purely in-memory (lobbyRooms), so any
    // DB room that survived a previous session is guaranteed to be dead.
    Room.deleteMany({ status: "waiting" })
        .then((r) => console.log(`Cleared ${r.deletedCount} stale room(s) from DB`))
        .catch((err) => console.error("Room cleanup error:", err.message));
});