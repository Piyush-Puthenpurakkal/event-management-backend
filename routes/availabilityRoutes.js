const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getUserAvailability,
  updateUserAvailability,
} = require("../controllers/availabilityController");

router.get("/", protect, getUserAvailability);
router.put("/", protect, updateUserAvailability);

module.exports = router;
