const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");

const Match = require("./models/Match");
const User = require("./models/User");

const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    /^https:\/\/.*\.vercel\.app$/,
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


const lobbyRooms = {};   
const gameRooms = {};    
const chessRooms = {};   


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

        if (room.gameStarted) {
            console.log("GAME ALREADY STARTED");

            if (typeof callback === "function") {
                return callback({
                    error: "Game already started",
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

        if (existingBySocket) {
            
        } else if (existingByUsername) {
            
            existingByUsername.socketId = socket.id;
        } else {
            
            room.players.push({
                socketId: socket.id,
                username,
            });
        }

        console.log(
            "PLAYER JOINED:",
            username
        );

        console.log(
            "TOTAL PLAYERS:",
            room.players.length
        );

        socket.join(roomId);

        if (typeof callback === "function") {
            callback({
                roomId,
                host: false,
                hostId: room.hostId,
                players: room.players,
                game: room.game,
            });
        }

        io.to(roomId).emit(
            "room_update",
            room
        );

        console.log("ROOM UPDATE SENT");
        console.log("================================");
    });

    
    
    
    socket.on("start_game", ({ roomId }) => {

        const room = lobbyRooms[roomId];

        if (!room) return;

        if (socket.id !== room.hostId) return;

        room.gameStarted = true;

        switch (room.game) {

            case "tic-tac-toe":

                gameRooms[roomId] = {
                    game: "tic-tac-toe",
                    players: room.players,
                    board: Array(9).fill(""),
                    turn: "X",
                    winner: "",
                };

                break;

            case "chess":

                chessRooms[roomId] = {
                    game: "chess",
                    players: room.players,
                };

                break;

            case "memory-match":

                gameRooms[roomId] = {
                    game: "memory-match",
                    players: room.players,
                    cards: [],
                    scores: {},
                    turn: 0,
                };

                break;

            case "quiz-battle":

                gameRooms[roomId] = {
                    game: "quiz-battle",
                    players: room.players,
                    currentQuestion: 0,
                    scores: {},
                };

                break;

            case "snake-ladder":

                gameRooms[roomId] = {
                    game: "snake-ladder",
                    players: room.players,
                    positions: {},
                    turn: 0,
                };

                break;

            default:

                gameRooms[roomId] = {
                    game: "tic-tac-toe",
                    players: room.players,
                    board: Array(9).fill(""),
                    turn: "X",
                    winner: "",
                };
        }

        io.to(roomId).emit("game_started", {
            roomId,
            game: room.game,
        });
    });

    
    
    
    socket.on("makeMove", async ({ roomId, index, symbol }) => {

        const room = gameRooms[roomId];
        if (!room) return;

        if (room.turn !== symbol) return;
        if (room.board[index] !== "") return;

        room.board[index] = symbol;
        room.turn = symbol === "X" ? "O" : "X";

        const winner = checkWinner(room.board);

        if (winner) {
            room.winner = winner;
        }

        if (!winner && !room.board.includes("")) {
            room.winner = "DRAW";
        }

        
        if ((room.winner === "DRAW" || room.winner) && !room.recorded) {
            try {
                
                room.recorded = true;

                if (room.winner === "DRAW") {
                    const [p1, p2] = room.players || [];
                    if (p1 && p2) {
                        
                        const match = new Match({
                            roomId,
                            players: [],
                            gameType: room.game || "Unknown",
                        });
                        
                        const player1 = await User.findOne({ username: p1.username });
                        const player2 = await User.findOne({ username: p2.username });

                        if (player1) {
                            player1.matchesPlayed = (player1.matchesPlayed || 0) + 1;
                            await player1.save();
                        }
                        if (player2) {
                            player2.matchesPlayed = (player2.matchesPlayed || 0) + 1;
                            await player2.save();
                        }

                        
                        match.players = [player1?._id, player2?._id].filter(Boolean);
                        await match.save();
                        
                        io.emit("match_recorded", {
                            roomId,
                            winner: null,
                            draw: true,
                        });
                    }
                } else {
                    
                    const players = room.players || [];
                    const playerX = players[0];
                    const playerO = players[1];

                    const winnerPlayer = room.winner === "X" ? playerX : playerO;
                    const loserPlayer = room.winner === "X" ? playerO : playerX;

                    if (winnerPlayer && loserPlayer) {
                        const winnerUser = await User.findOne({ username: winnerPlayer.username });
                        const loserUser = await User.findOne({ username: loserPlayer.username });

                        const match = new Match({
                            roomId,
                            players: [winnerUser?._id, loserUser?._id].filter(Boolean),
                            winner: winnerUser?._id || null,
                            gameType: room.game || "Unknown",
                        });

                        if (winnerUser) {
                            winnerUser.wins = (winnerUser.wins || 0) + 1;
                            winnerUser.matchesPlayed = (winnerUser.matchesPlayed || 0) + 1;
                            await winnerUser.save();
                        }

                        if (loserUser) {
                            loserUser.losses = (loserUser.losses || 0) + 1;
                            loserUser.matchesPlayed = (loserUser.matchesPlayed || 0) + 1;
                            await loserUser.save();
                        }

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

    
    
    
    socket.on("chess_move", ({ roomId, move }) => {
        socket.to(roomId).emit("chess_move", move);
    });

    
    socket.on("memory_flip", ({ roomId, card }) => {
        io.to(roomId).emit("memory_flip", card);
    });

    
    socket.on("quiz_answer", (payload) => {
        // forward the full payload so clients receive finalScore and player info
        if (!payload || !payload.roomId) return;
        io.to(payload.roomId).emit("quiz_answer", payload);
    });

    
    socket.on("snake_roll", (payload) => {
        // payload can include { roomId, dice, position, username }
        if (!payload || !payload.roomId) return;
        io.to(payload.roomId).emit("snake_roll", payload);
    });

    
    
    
    socket.on("disconnect", () => {

        console.log("Disconnected:", socket.id);

        
        for (const roomId in lobbyRooms) {

            lobbyRooms[roomId].players =
                lobbyRooms[roomId].players.filter(
                    (p) => p.socketId !== socket.id
                );

            if (lobbyRooms[roomId].players.length === 0) {
                delete lobbyRooms[roomId];
            } else {
                io.to(roomId).emit("room_update", lobbyRooms[roomId]);
            }
        }

        
        for (const roomId in gameRooms) {
            gameRooms[roomId].players =
                gameRooms[roomId].players?.filter(
                    (p) => p.socketId !== socket.id
                );
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


server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});