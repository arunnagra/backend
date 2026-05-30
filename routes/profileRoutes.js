const express = require("express");

const {
    getProfile,
} = require("../controllers/profileController");

const authMiddleware = require(
    "../middleware/authMiddleware"
);

const router = express.Router();

router.get(
    "/",
    authMiddleware,
    getProfile
);

module.exports = router;