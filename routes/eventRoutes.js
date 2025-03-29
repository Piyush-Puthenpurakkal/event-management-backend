const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  createEvent,
  getEvents,
  updateEvent,
  deleteEvent,
  toggleEventActive,
} = require("../controllers/eventController");

router.post("/", protect, createEvent);
router.get("/", protect, getEvents);
router.put("/:id", protect, updateEvent);
router.delete("/:id", protect, deleteEvent);
router.patch("/:id/toggle", protect, toggleEventActive);

module.exports = router;
