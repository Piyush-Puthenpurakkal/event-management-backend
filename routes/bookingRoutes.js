const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  getBookings,
  createBooking,
  updateBooking,
  deleteBooking,
  updateBookingStatus,
} = require("../controllers/bookingController");

router.get("/", protect, getBookings);
router.post("/", protect, createBooking);
router.put("/:id", protect, updateBooking);
router.delete("/:id", protect, deleteBooking);
router.put("/:id/status", protect, updateBookingStatus);

module.exports = router;
