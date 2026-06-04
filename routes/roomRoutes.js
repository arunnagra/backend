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

        const { game = "tic-tac-toe" } = req.body;

        const roomId = generateRoomId();

        const room = await Room.create({

            roomId,

            players: [req.user.id],

            game,

            status: "waiting",
        });

        const populatedRoom = await Room.findById(room._id).populate("players");

        res.status(201).json({
            msg: "Room created",
            room: populatedRoom,
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

        const alreadyJoined = room.players.some(
            (playerId) => String(playerId) === String(req.user.id)
        );

        if (!alreadyJoined) {
            room.players.push(req.user.id);
        }

        room.status = "waiting";

        await room.save();

        const populatedRoom = await Room.findById(room._id).populate("players");

        res.json(populatedRoom);

    } catch (error) {

        res.status(500).json({
            msg: error.message
        });
    }
});

router.get("/available", authMiddleware, async (req, res) => {
    try {
        const rooms = await Room.find({
            status: "waiting",
            $or: [{ players: { $size: 0 } }, { players: { $size: 1 } }],
        })
            .populate("players", "username")
            .sort({ createdAt: -1 });

        res.json(rooms);
    } catch (error) {
        console.error("Available rooms error:", error.message);
        res.status(500).json({ msg: error.message });
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

router.post("/:roomId/start", authMiddleware, async (req, res) => {
    try {
        const room = await Room.findOne({
            roomId: req.params.roomId,
        });

        if (!room) {
            return res.status(404).json({
                msg: "Room not found",
            });
        }

        const isHost =
            room.players.length > 0 &&
            String(room.players[0]) === String(req.user.id);

        if (!isHost) {
            return res.status(403).json({
                msg: "Only the host can start the room",
            });
        }

        room.status = "playing";
        await room.save();

        const populatedRoom = await Room.findById(room._id).populate("players");

        res.json({
            msg: "Room started",
            room: populatedRoom,
        });
    } catch (error) {
        res.status(500).json({
            msg: error.message,
        });
    }
});

module.exports = router;