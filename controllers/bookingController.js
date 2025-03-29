const Booking = require("../models/Booking");

async function hasBookingConflict(
  userId,
  startTime,
  endTime,
  bookingId = null
) {
  const conflict = await Booking.findOne({
    user: userId,
    ...(bookingId && { _id: { $ne: bookingId } }),
    $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
  });
  return !!conflict;
}

exports.getBookings = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {
      $or: [{ user: req.user._id }, { "participants.user": req.user._id }],
    };
    if (status) {
      filter = { $and: [filter, { status }] };
    }
    const bookings = await Booking.find(filter)
      .sort({ startTime: 1 })
      .populate("participants.user", "firstName lastName email avatar");
    res.json(bookings);
  } catch (error) {
    console.error("getBookings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createBooking = async (req, res) => {
  try {
    const hostId = req.user._id.toString();
    const {
      title,
      details,
      dateLabel,
      timeLabel,
      startTime,
      endTime,
      inviteeIds,
    } = req.body;

    const conflict = await hasBookingConflict(hostId, startTime, endTime);
    if (conflict) {
      return res.status(400).json({ message: "Time conflict detected" });
    }

    let invitees = [];
    if (typeof inviteeIds === "string") {
      invitees = inviteeIds
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x);
    } else if (Array.isArray(inviteeIds)) {
      invitees = inviteeIds.map((x) => x.toString().trim()).filter((x) => x);
    }
    // Remove any occurrence of the host from invitees
    invitees = invitees.filter((id) => id !== hostId);
    // Add the host once and deduplicate
    invitees.unshift(hostId);
    invitees = Array.from(new Set(invitees));

    const participants = invitees.map((id) => ({
      user: id,
      status: id === hostId ? "Accepted" : "Pending",
    }));

    const newBooking = await Booking.create({
      user: hostId,
      title,
      details,
      dateLabel,
      timeLabel,
      startTime,
      endTime,
      status: "Pending",
      participants,
    });

    res.status(201).json(newBooking);
  } catch (error) {
    console.error("createBooking error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateBooking = async (req, res) => {
  try {
    const hostId = req.user._id.toString();
    const { id } = req.params;
    const {
      title,
      details,
      dateLabel,
      timeLabel,
      startTime,
      endTime,
      status,
      inviteeIds,
    } = req.body;

    const booking = await Booking.findOne({ _id: id, user: hostId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (startTime && endTime) {
      const conflict = await hasBookingConflict(hostId, startTime, endTime, id);
      if (conflict) {
        return res.status(400).json({ message: "Time conflict detected" });
      }
    }

    if (title) booking.title = title;
    if (details) booking.details = details;
    if (dateLabel) booking.dateLabel = dateLabel;
    if (timeLabel) booking.timeLabel = timeLabel;
    if (startTime) booking.startTime = startTime;
    if (endTime) booking.endTime = endTime;
    if (status) booking.status = status;
    if (inviteeIds) {
      let invitees = [];
      if (typeof inviteeIds === "string") {
        invitees = inviteeIds
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x);
      } else if (Array.isArray(inviteeIds)) {
        invitees = inviteeIds.map((x) => x.toString().trim()).filter((x) => x);
      }
      invitees = invitees.filter((id) => id !== hostId);
      invitees.unshift(hostId);
      invitees = Array.from(new Set(invitees));
      booking.participants = invitees.map((id) => ({
        user: id,
        status: id === hostId ? "Accepted" : "Pending",
      }));
    }

    await booking.save();
    res.json(booking);
  } catch (error) {
    console.error("updateBooking error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteBooking = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const booking = await Booking.findOneAndDelete({ _id: id, user: hostId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json({ message: "Booking deleted" });
  } catch (error) {
    console.error("deleteBooking error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const { status } = req.body;

    if (!["Accepted", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const isHost = booking.user.toString() === hostId.toString();
    const isParticipant = booking.participants.some((p) => {
      const pid =
        typeof p.user === "object" && p.user._id
          ? p.user._id.toString()
          : p.user.toString();
      return pid === hostId.toString();
    });

    if (!isHost && !isParticipant) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (isHost) {
      booking.status = status;
      booking.participants = booking.participants.map((p) => {
        const pid =
          typeof p.user === "object" && p.user._id
            ? p.user._id.toString()
            : p.user.toString();
        if (pid === hostId.toString()) {
          return { ...p.toObject(), status };
        }
        return p;
      });
    } else {
      booking.participants = booking.participants.map((p) => {
        const pid =
          typeof p.user === "object" && p.user._id
            ? p.user._id.toString()
            : p.user.toString();
        if (pid === hostId.toString()) {
          return { ...p.toObject(), status };
        }
        return p;
      });
    }

    await booking.save();
    res.json(booking);
  } catch (error) {
    console.error("updateBookingStatus error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
