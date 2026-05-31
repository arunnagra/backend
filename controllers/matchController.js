const Match = require("../models/Match");
const User = require("../models/User");

// Match is the single source of truth for stats. Profile and leaderboard
// both recompute from it, so we count from there here too — that keeps every
// endpoint in agreement and makes wins + losses + draws === matchesPlayed.
async function computeStats(userId) {
  const matches = await Match.find({
    $or: [{ players: userId }, { winner: userId }],
  })
    .select("players winner")
    .lean();

  const id = userId.toString();
  let wins = 0;
  let losses = 0;
  let draws = 0;

  matches.forEach((m) => {
    const winnerId = m.winner ? m.winner.toString() : null;
    if (!winnerId) draws += 1;
    else if (winnerId === id) wins += 1;
    else losses += 1;
  });

  return { wins, losses, draws, matchesPlayed: matches.length };
}

const recordMatch = async (req, res) => {
  try {
    const { roomId, winnerUsername, loserUsername, gameType } = req.body;

    if (!roomId) {
      return res.status(400).json({ msg: "roomId is required" });
    }
    if (!winnerUsername || !loserUsername) {
      return res.status(400).json({
        msg: "Winner and loser usernames required",
      });
    }

    const winner = await User.findOne({ username: winnerUsername });
    const loser = await User.findOne({ username: loserUsername });

    if (!winner || !loser) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Idempotency: the same finished game can be reported by both the
    // socket handler and this route. Record it only once per room.
    let match = await Match.findOne({ roomId });
    const alreadyRecorded = Boolean(match);

    if (!match) {
      match = await Match.create({
        roomId,
        players: [winner._id, loser._id],
        winner: winner._id,
        gameType: gameType || "Unknown",
      });
    }

    const [winnerStats, loserStats] = await Promise.all([
      computeStats(winner._id),
      computeStats(loser._id),
    ]);

    res.json({
      msg: alreadyRecorded ? "Match already recorded" : "Match recorded",
      winner: { username: winner.username, ...winnerStats },
      loser: { username: loser.username, ...loserStats },
      matchId: match._id,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const recordDraw = async (req, res) => {
  try {
    const { roomId, player1Username, player2Username, gameType } = req.body;

    if (!roomId) {
      return res.status(400).json({ msg: "roomId is required" });
    }
    if (!player1Username || !player2Username) {
      return res.status(400).json({
        msg: "Both player usernames required for draw",
      });
    }

    const player1 = await User.findOne({ username: player1Username });
    const player2 = await User.findOne({ username: player2Username });

    if (!player1 || !player2) {
      return res.status(404).json({ msg: "User not found" });
    }

    let match = await Match.findOne({ roomId });
    const alreadyRecorded = Boolean(match);

    if (!match) {
      match = await Match.create({
        roomId,
        players: [player1._id, player2._id],
        // no winner field -> treated as a draw everywhere
        gameType: gameType || "Unknown",
      });
    }

    const [p1Stats, p2Stats] = await Promise.all([
      computeStats(player1._id),
      computeStats(player2._id),
    ]);

    res.json({
      msg: alreadyRecorded ? "Draw already recorded" : "Draw recorded",
      player1: { username: player1.username, ...p1Stats },
      player2: { username: player2.username, ...p2Stats },
      matchId: match._id,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  recordMatch,
  recordDraw,
};