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
      bannerColor,
      titleColor,
      linkColor,
      bannerName, // ✅ NEW: Get banner name
      meetingLink, // ✅ NEW: Get meeting link
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
      bannerColor,
      titleColor,
      linkColor,
      bannerName, // ✅ NEW: Save banner name
      meetingLink, // ✅ NEW: Save meeting link
      participants,
    });

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
      bannerColor,
      titleColor,
      linkColor,
      bannerName, // ✅ NEW: Update banner name
      meetingLink, // ✅ NEW: Update meeting link
    } = req.body;

    if (title) event.title = title;
    if (description) event.description = description;
    if (startTime) event.startTime = dayjs(startTime).toDate();
    if (endTime) event.endTime = dayjs(endTime).toDate();
    if (password) event.password = password;
    if (hostName) event.hostName = hostName;
    if (bannerColor) event.bannerColor = bannerColor;
    if (titleColor) event.titleColor = titleColor;
    if (linkColor) event.linkColor = linkColor;
    if (bannerName) event.bannerName = bannerName; // ✅ NEW
    if (meetingLink) event.meetingLink = meetingLink; // ✅ NEW

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
