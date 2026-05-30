const Match = require("../models/Match");
const User = require("../models/User");

const recordMatch = async (req, res) => {
  try {
    const { roomId, winnerUsername, loserUsername, gameType } = req.body;

    if (!winnerUsername || !loserUsername) {
      return res.status(400).json({
        msg: "Winner and loser usernames required",
      });
    }

    
    const winner = await User.findOne({ username: winnerUsername });
    const loser = await User.findOne({ username: loserUsername });

    if (!winner || !loser) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    
    const match = new Match({
      roomId,
      players: [winner._id, loser._id],
      winner: winner._id,
      gameType: gameType || "Unknown",
    });

    await match.save();

    
    winner.wins += 1;
    winner.matchesPlayed += 1;
    await winner.save();

    
    loser.losses += 1;
    loser.matchesPlayed += 1;
    await loser.save();

    res.json({
      msg: "Match recorded",
      winner: {
        username: winner.username,
        wins: winner.wins,
        losses: winner.losses,
        matchesPlayed: winner.matchesPlayed,
      },
      loser: {
        username: loser.username,
        wins: loser.wins,
        losses: loser.losses,
        matchesPlayed: loser.matchesPlayed,
      },
      matchId: match._id,
    });
  } catch (error) {
    res.status(500).json({
      msg: error.message,
    });
  }
};

const recordDraw = async (req, res) => {
  try {
    const { roomId, player1Username, player2Username, gameType } = req.body;

    if (!player1Username || !player2Username) {
      return res.status(400).json({
        msg: "Both player usernames required for draw",
      });
    }

    
    const player1 = await User.findOne({ username: player1Username });
    const player2 = await User.findOne({ username: player2Username });

    if (!player1 || !player2) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    
    const match = new Match({
      roomId,
      players: [player1._id, player2._id],
      gameType: gameType || "Unknown",
    });

    await match.save();

    
    player1.matchesPlayed += 1;
    player2.matchesPlayed += 1;
    await player1.save();
    await player2.save();

    res.json({
      msg: "Draw recorded",
      player1: {
        username: player1.username,
        wins: player1.wins,
        losses: player1.losses,
        matchesPlayed: player1.matchesPlayed,
      },
      player2: {
        username: player2.username,
        wins: player2.wins,
        losses: player2.losses,
        matchesPlayed: player2.matchesPlayed,
      },
      matchId: match._id,
    });
  } catch (error) {
    res.status(500).json({
      msg: error.message,
    });
  }
};

module.exports = {
  recordMatch,
  recordDraw,
};
