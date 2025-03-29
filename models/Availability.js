const mongoose = require("mongoose");

const availabilitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  days: [
    {
      day: { type: String, required: true },
      unavailable: { type: Boolean, default: false },
      intervals: [
        {
          start: String,
          end: String,
        },
      ],
    },
  ],
});

module.exports = mongoose.model("Availability", availabilitySchema);
