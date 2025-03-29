const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  details: { type: String },
  dateLabel: { type: String },
  timeLabel: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: { type: String, default: "Pending" },
  participants: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      status: { type: String, default: "Pending" },
    },
  ],
});

// Pre-save hook: remove duplicate participants based on their user ID (as a string)
BookingSchema.pre("save", function (next) {
  const unique = new Map();
  this.participants.forEach((p) => {
    const key = p.user.toString();
    if (!unique.has(key)) {
      unique.set(key, p);
    }
  });
  this.participants = Array.from(unique.values());
  next();
});

module.exports = mongoose.model("Booking", BookingSchema);
