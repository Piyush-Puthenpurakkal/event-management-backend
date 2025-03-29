const Event = require("../models/Event");
const User = require("../models/User");
const Booking = require("../models/Booking");
const dayjs = require("dayjs");
const mongoose = require("mongoose");

async function hasConflict(userId, startTime, endTime, eventId = null) {
  const conflict = await Event.findOne({
    user: userId,
    ...(eventId && { _id: { $ne: eventId } }),
    $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
  });
  return !!conflict;
}

exports.createEvent = async (req, res) => {
  try {
    const hostId = req.user._id;
    const {
      title,
      description,
      startTime,
      endTime,
      password,
      inviteeIds,
      hostName,
    } = req.body;

    const start = dayjs(startTime).toDate();
    const end = dayjs(endTime).toDate();

    const conflict = await hasConflict(hostId, start, end);
    if (conflict) {
      return res.status(400).json({ message: "Time conflict detected" });
    }

    let invitees = [];
    if (typeof inviteeIds === "string") {
      invitees = inviteeIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    } else if (Array.isArray(inviteeIds)) {
      invitees = inviteeIds.map((x) => x.toString().trim()).filter(Boolean);
    }
    invitees = invitees.filter((x) => {
      if (x === hostId.toString()) return false;
      if (req.user.email && x.toLowerCase() === req.user.email.toLowerCase())
        return false;
      return true;
    });

    invitees = Array.from(new Set(invitees));
    invitees.unshift(hostId.toString());

    let participants = [];
    for (const idOrEmail of invitees) {
      if (mongoose.Types.ObjectId.isValid(idOrEmail)) {
        participants.push({ user: idOrEmail, status: "Pending" });
      } else {
        const invitedUser = await User.findOne({ email: idOrEmail });
        if (invitedUser) {
          participants.push({ user: invitedUser._id, status: "Pending" });
        } else {
          console.warn(`No user found for email: ${idOrEmail}`);
        }
      }
    }
    participants = participants.map((p) => {
      if (p.user.toString() === hostId.toString()) {
        return { user: hostId, status: "Accepted" };
      }
      return p;
    });

    const newEvent = await Event.create({
      user: hostId,
      hostName,
      title,
      description,
      startTime: start,
      endTime: end,
      password,
      participants,
    });

    const bookingData = {
      user: hostId,
      eventId: newEvent._id,
      hostName,
      title,
      details: description,
      dateLabel: dayjs(start).format("YYYY-MM-DD"),
      timeLabel: dayjs(start).format("HH:mm"),
      startTime: start,
      endTime: end,
      status: "Pending",
      participants: participants.map((p) => ({
        user: p.user,
        status: p.status,
      })),
    };

    await Booking.create(bookingData);

    res.status(201).json(newEvent);
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const hostId = req.user._id;
    const events = await Event.find({
      $or: [{ user: hostId }, { "participants.user": hostId }],
    }).populate("participants.user", "firstName lastName email avatar");
    res.json(events);
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, user: hostId });
    if (!event) {
      return res
        .status(404)
        .json({ message: "Event not found or not authorized" });
    }
    const {
      title,
      description,
      startTime,
      endTime,
      password,
      hostName,
      inviteeIds,
    } = req.body;
    const start = startTime ? dayjs(startTime).toDate() : null;
    const end = endTime ? dayjs(endTime).toDate() : null;

    if (start && end) {
      const conflict = await hasConflict(hostId, start, end, id);
      if (conflict) {
        return res.status(400).json({ message: "Time conflict detected" });
      }
    }

    if (title) event.title = title;
    if (description) event.description = description;
    if (start) event.startTime = start;
    if (end) event.endTime = end;
    if (password) event.password = password;
    if (hostName) event.hostName = hostName;

    if (inviteeIds) {
      let invitees = [];
      if (typeof inviteeIds === "string") {
        invitees = inviteeIds
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      } else if (Array.isArray(inviteeIds)) {
        invitees = inviteeIds.map((x) => x.toString().trim()).filter(Boolean);
      }
      invitees = invitees.filter((x) => {
        if (x === hostId.toString()) return false;
        if (req.user.email && x.toLowerCase() === req.user.email.toLowerCase())
          return false;
        return true;
      });
      invitees = Array.from(new Set(invitees));
      invitees.unshift(hostId.toString());

      let participants = [];
      for (const idOrEmail of invitees) {
        if (mongoose.Types.ObjectId.isValid(idOrEmail)) {
          participants.push({ user: idOrEmail, status: "Pending" });
        } else {
          const invitedUser = await User.findOne({ email: idOrEmail });
          if (invitedUser) {
            participants.push({ user: invitedUser._id, status: "Pending" });
          } else {
            console.warn(`No user found for email: ${idOrEmail}`);
          }
        }
      }
      participants = participants.map((p) => {
        if (p.user.toString() === hostId.toString()) {
          return { user: hostId, status: "Accepted" };
        }
        return p;
      });

      event.participants = participants;
    }

    await event.save();
    res.json(event);
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const deletedEvent = await Event.findOneAndDelete({
      _id: id,
      user: hostId,
    });
    if (!deletedEvent) {
      return res
        .status(404)
        .json({ message: "Event not found or not authorized" });
    }
    await Booking.findOneAndUpdate(
      { eventId: id },
      { status: "Canceled" },
      { new: true }
    );
    res.json({
      message: "Event deleted and associated bookings updated to Canceled",
    });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.toggleEventActive = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, user: hostId });
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    event.isActive = !event.isActive;
    await event.save();
    res.json({
      message: `Event is now ${event.isActive ? "Active" : "Inactive"}`,
    });
  } catch (error) {
    console.error("Toggle event active error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
