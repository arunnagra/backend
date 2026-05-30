const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({

    roomId: {
        type: String,
        required: true,
        unique: true,
    },

    players: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    ],

    status: {
        type: String,
        default: "waiting",
    }

});

module.exports = mongoose.model("Room", roomSchema);