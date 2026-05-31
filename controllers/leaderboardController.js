const User = require("../models/User");
const Match = require("../models/Match");

const getLeaderboard = async (req, res) => {
  try {
    // 1. Seed every known user with zeroed stats.
    const users = await User.find().select("username").lean();

    const statsByUser = {};
    users.forEach((user) => {
      statsByUser[user._id.toString()] = {
        wins: 0,
        losses: 0,
        draws: 0,
        matchesPlayed: 0,
      };
    });

    // 2. Walk every match exactly once and attribute results.
    const matches = await Match.find().select("players winner").lean();

    matches.forEach((match) => {
      const winnerId = match.winner ? match.winner.toString() : null;

      // Build the participant set. Always include the winner, even if a
      // legacy record saved an empty/partial players array, so a win can
      // never exist without a corresponding matchesPlayed.
      const participantIds = new Set(
        (match.players || []).map((p) => p.toString())
      );
      if (winnerId) participantIds.add(winnerId);

      const isDraw = !winnerId;

      participantIds.forEach((id) => {
        const stats = statsByUser[id];
        if (!stats) return; // skip ids whose user no longer exists

        stats.matchesPlayed += 1;

        if (isDraw) {
          stats.draws += 1;
        } else if (id === winnerId) {
          stats.wins += 1;
        } else {
          stats.losses += 1;
        }
      });
    });

    // 3. Shape and sort. Sort by wins, then win rate, then matches played.
    const leaderboard = users
      .map((user) => {
        const stats = statsByUser[user._id.toString()];
        return {
          _id: user._id,
          username: user.username,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          matchesPlayed: stats.matchesPlayed,
        };
      })
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const aRate = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
        const bRate = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
        if (bRate !== aRate) return bRate - aRate;
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