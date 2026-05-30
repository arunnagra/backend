const express = require("express");

const router = express.Router();

const Room = require("../models/Room");

const authMiddleware = require("../middleware/authMiddleware");

const generateRoomId = () => {

    return Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase();
};

router.post("/create", authMiddleware, async (req, res) => {

    try {

        const roomId = generateRoomId();

        const room = await Room.create({

            roomId,

            players: [req.user.id],

            status: "waiting",
        });

        res.status(201).json({
            msg: "Room created",
            room,
        });

    } catch (error) {

        res.status(500).json({
            msg: error.message
        });
    }
});

router.post("/join", authMiddleware, async (req, res) => {

    try {

        const { roomId } = req.body;

        const room = await Room.findOne({ roomId });

        if (!room) {

            return res.status(404).json({
                msg: "Room not found"
            });
        }

        if (room.players.length >= 2) {

            return res.status(400).json({
                msg: "Room full"
            });
        }

        room.players.push(req.user.id);

        room.status = "playing";

        await room.save();

        res.json(room);

    } catch (error) {

        res.status(500).json({
            msg: error.message
        });
    }
});

router.get("/:roomId", authMiddleware, async (req, res) => {

    try {

        const room = await Room.findOne({
            roomId: req.params.roomId
        }).populate("players");

        res.json(room);

    } catch (error) {

        res.status(500).json({
            msg: error.message
        });
    }
});

module.exports = router;