// Shared in-memory store for active lobby rooms.
// Imported by server.js (socket logic) and roomRoutes.js (REST API).
const lobbyRooms = {};

module.exports = { lobbyRooms };
