const express = require("express");
const {
  recordMatch,
  recordDraw,
} = require("../controllers/matchController");

const router = express.Router();

router.post("/record-match", recordMatch);
router.post("/record-draw", recordDraw);

module.exports = router;
