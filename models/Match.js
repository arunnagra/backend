const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
{
    roomId: {
        type: String,
        required: true,
    },

    players: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],

    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },

    gameType: {
        type: String,
        default: "TicTacToe",
    }
},
{
    timestamps: true,
}
);

module.exports = mongoose.model(
    "Match",
    matchSchema
);