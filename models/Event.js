const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  hostName: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  password: String,
  color: String,
  bannerColor: { type: String, default: "#ffffff" },
  titleColor: { type: String, default: "#000000" },
  linkColor: { type: String, default: "#0000ff" },
  participants: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      status: {
        type: String,
        enum: ["Pending", "Accepted", "Rejected", "Canceled"],
        default: "Pending",
      },
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
});

module.exports = mongoose.model("Event", eventSchema);
