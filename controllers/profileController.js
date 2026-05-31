const User = require("../models/User");
const Match = require("../models/Match");

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        msg: "User not found",
      });
    }

    // Include matches where the user is a listed player OR the recorded
    // winner. The winner check catches legacy records saved with an
    // empty/partial players array, keeping this in sync with the
    // leaderboard controller.
    const matches = await Match.find({
      $or: [{ players: userId }, { winner: userId }],
    })
      .populate("winner", "username")
      .sort({ createdAt: -1 })
      .lean();

    let wins = 0;
    let losses = 0;
    let draws = 0;

    matches.forEach((match) => {
      const winnerId = match.winner ? match.winner._id.toString() : null;

      if (!winnerId) {
        draws += 1; // no winner -> draw
      } else if (winnerId === userId) {
        wins += 1;
      } else {
        losses += 1;
      }
    });

    const matchesPlayed = matches.length; // wins + losses + draws

    res.json({
      ...user.toObject(),
      wins,
      losses,
      draws,
      matchesPlayed,
      matches,
    });
  } catch (error) {
    res.status(500).json({
      msg: error.message,
    });
  }
};

module.exports = {
  getProfile,
};