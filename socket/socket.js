const rooms = {};

const socketHandler = (io) => {

  io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);

    
    
    
    socket.on("create_room", ({ username }, callback) => {

      const roomId = Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

      rooms[roomId] = {
        hostId: socket.id,
        players: [
          { socketId: socket.id, username }
        ],
        gameStarted: false,
        board: Array(9).fill(""),
        turn: "X",
        winner: ""
      };

      socket.join(roomId);

      callback({
        roomId,
        host: true,
        players: rooms[roomId].players
      });

      io.to(roomId).emit("room_update", rooms[roomId]);
    });

    
    
    
    socket.on("join_room", ({ roomId, username }, callback) => {

      const room = rooms[roomId];

      if (!room) {
        return callback({ error: "Room not found" });
      }

      const normalizedUsername = username?.trim().toLowerCase();
      const existingPlayerIndex = room.players.findIndex(
        (player) =>
          player.username?.trim().toLowerCase() ===
          normalizedUsername
      );

      if (room.gameStarted && existingPlayerIndex === -1) {
        return callback({ error: "Game already started" });
      }

      let playerSymbol = "O";
      if (existingPlayerIndex === -1) {
        room.players.push({
          socketId: socket.id,
          username: username.trim(),
        });
        playerSymbol = room.players.length === 1 ? "X" : "O";
      } else {
        room.players[existingPlayerIndex].socketId = socket.id;
        playerSymbol = existingPlayerIndex === 0 ? "X" : "O";
      }

      socket.join(roomId);

      callback({
        roomId,
        host: false,
        hostId: room.hostId,
        players: room.players,
        symbol: playerSymbol,
      });

      if (room.gameStarted) {
        socket.emit("roomData", room);
      } else {
        io.to(roomId).emit("room_update", room);
      }
    });

    
    
    
    socket.on("start_game", ({ roomId }) => {

      const room = rooms[roomId];
      if (!room) return;

      if (socket.id !== room.hostId) return;

      room.gameStarted = true;

      io.to(roomId).emit("game_started", {
        roomId,
      });

      io.to(roomId).emit("roomData", room);
    });

    
    
    
    socket.on("makeMove", ({ roomId, index, symbol }) => {

      const room = rooms[roomId];
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

      io.to(roomId).emit("roomData", room);
    });

    
    
    
    socket.on("disconnect", () => {

      console.log("Disconnected:", socket.id);

      for (const roomId in rooms) {

        rooms[roomId].players =
          rooms[roomId].players.filter(
            (p) => p.socketId !== socket.id
          );

        
        if (rooms[roomId].players.length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit(
            "room_update",
            rooms[roomId]
          );
        }
      }
    });

  });
};




function checkWinner(board) {

  const patterns = [
    [0,1,2],
    [3,4,5],
    [6,7,8],
    [0,3,6],
    [1,4,7],
    [2,5,8],
    [0,4,8],
    [2,4,6],
  ];

  for (let [a,b,c] of patterns) {
    if (
      board[a] &&
      board[a] === board[b] &&
      board[a] === board[c]
    ) {
      return board[a];
    }
  }

  return null;
}

module.exports = socketHandler;