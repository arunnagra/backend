const User = require("../models/User");
const Match = require("../models/Match");

const getProfile = async (req, res) => {

    try {

        const user =
            await User.findById(req.user.id)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                msg: "User not found",
            });
        }

        const matches =
            await Match.find({
                players: req.user.id,
            })
            .populate("winner", "username")
            .sort({ createdAt: -1 })
            .lean();

        const wins = matches.filter(
            (match) =>
                match.winner &&
                match.winner._id.toString() === req.user.id
        ).length;

        const losses = matches.filter(
            (match) =>
                match.winner &&
                match.winner._id.toString() !== req.user.id
        ).length;

        const matchesPlayed = matches.length;

        
        res.json({
            ...user.toObject(),
            wins,
            losses,
            matchesPlayed,
            matches: matches || [],
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