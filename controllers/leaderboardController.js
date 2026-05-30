const User = require("../models/User");
const Match = require("../models/Match");

const getLeaderboard = async (
  req,
  res
) => {
  try {
    const users = await User.find()
      .select("username")
      .lean();

    const statsByUser = {};
    users.forEach((user) => {
      statsByUser[user._id.toString()] = {
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
      };
    });

    const matches = await Match.find()
      .select("players winner")
      .lean();

    matches.forEach((match) => {
      const winnerId = match.winner
        ? match.winner.toString()
        : null;

      const playersList = match.players || [];
      if (playersList.length > 0) {
        playersList.forEach((playerId) => {
          const id = playerId.toString();
          if (!statsByUser[id]) return;
          statsByUser[id].matchesPlayed += 1;
        });
      } else if (winnerId) {
        
        
        if (statsByUser[winnerId]) {
          statsByUser[winnerId].matchesPlayed += 1;
        }
      }

      if (winnerId) {
        if (statsByUser[winnerId]) {
          statsByUser[winnerId].wins += 1;
        }

        (match.players || []).forEach((playerId) => {
          const id = playerId.toString();
          if (id !== winnerId && statsByUser[id]) {
            statsByUser[id].losses += 1;
          }
        });
      }
    });

    const leaderboard = users
      .map((user) => {
        const stats = statsByUser[user._id.toString()] || {};
        return {
          _id: user._id,
          username: user.username,
          wins: stats.wins || 0,
          losses: stats.losses || 0,
          matchesPlayed: stats.matchesPlayed || 0,
        };
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.matchesPlayed - a.matchesPlayed;
      });

    res.json(leaderboard);

  } catch (error) {

    res.status(500).json({
      msg: error.message,
    });

  }
};

module.exports = {
  getLeaderboard,
};