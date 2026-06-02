const rooms = {};


const createRoom = (roomId) => {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      host: null,

      players: [],

      board: [
        "", "", "",
        "", "", "",
        "", "", "",
      ],

      currentTurn: "X",

      winner: null,

      gameStarted: false,
    };
  }
};


const addPlayer = (roomId, player) => {
  createRoom(roomId);

  const room = rooms[roomId];

  
  if (room.players.length >= 2) {
    return {
      success: false,
      msg: "Room is full",
    };
  }

  const symbol =
    room.players.length === 0
      ? "X"
      : "O";

  const newPlayer = {
    socketId: player.socketId,
    username: player.username,
    symbol,
  };

  room.players.push(newPlayer);

  
  if (!room.host) {
    room.host = player.socketId;
  }

  return {
    success: true,
    player: newPlayer,
  };
};


const startGame = (roomId) => {
  if (rooms[roomId]) {
    rooms[roomId].gameStarted = true;
  }
};


const getPlayers = (roomId) => {
  return rooms[roomId]
    ? rooms[roomId].players
    : [];
};


const getRoom = (roomId) => {
  return rooms[roomId] || null;
};

const updateBoard = (
  roomId,
  board
) => {
  if (rooms[roomId]) {
    rooms[roomId].board = board;
  }
};


const getBoard = (roomId) => {
  return rooms[roomId]
    ? rooms[roomId].board
    : [];
};


const updateTurn = (
  roomId,
  turn
) => {
  if (rooms[roomId]) {
    rooms[roomId].currentTurn =
      turn;
  }
};

const getCurrentTurn = (
  roomId
) => {
  return rooms[roomId]
    ? rooms[roomId].currentTurn
    : null;
};

const setWinner = (
  roomId,
  winner
) => {
  if (rooms[roomId]) {
    rooms[roomId].winner =
      winner;
  }
};

const getWinner = (
  roomId
) => {
  return rooms[roomId]
    ? rooms[roomId].winner
    : null;
};

const removePlayer = (
  socketId
) => {
  for (const roomId in rooms) {
    const room = rooms[roomId];

    room.players =
      room.players.filter(
        (player) =>
          player.socketId !==
          socketId
      );

    
    if (
      room.host === socketId &&
      room.players.length > 0
    ) {
      room.host =
        room.players[0].socketId;
    }

    
    if (
      room.players.length === 0
    ) {
      delete rooms[roomId];
    }
  }
};


const findPlayerRoom = (
  socketId
) => {
  for (const roomId in rooms) {
    const player =
      rooms[
        roomId
      ].players.find(
        (p) =>
          p.socketId ===
          socketId
      );

    if (player) {
      return roomId;
    }
  }

  return null;
};

module.exports = {
  rooms,
  createRoom,
  addPlayer,
  startGame,
  getPlayers,
  getRoom,
  updateBoard,
  getBoard,
  updateTurn,
  getCurrentTurn,
  setWinner,
  getWinner,
  removePlayer,
  findPlayerRoom,
};