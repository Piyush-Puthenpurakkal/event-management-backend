const Event = require("../models/Event");
const User = require("../models/User");
const Booking = require("../models/Booking");
const dayjs = require("dayjs");
const mongoose = require("mongoose");
const { generateMeetingLink } = require("../utils/meetingUtils"); // Utility for meeting link

async function hasConflict(userId, startTime, endTime, eventId = null) {
  const conflict = await Event.findOne({
    user: userId,
    ...(eventId && { _id: { $ne: eventId } }),
    $or: [{ startTime: { $lt: endTime }, endTime: { $gt: startTime } }],
  });
  return !!conflict;
}

// Create Event with Meeting Link and Banner
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
      bannerUrl, // New field for banner
    } = req.body;

    const start = dayjs(startTime).toDate();
    const end = dayjs(endTime).toDate();

    const conflict = await hasConflict(hostId, start, end);
    if (conflict) {
      return res.status(400).json({ message: "Time conflict detected" });
    }

    let invitees = Array.isArray(inviteeIds)
      ? inviteeIds.map((x) => x.toString().trim()).filter(Boolean)
      : [];

    invitees = invitees.filter((x) => x !== hostId.toString());

    let participants = invitees.map((id) => ({
      user: mongoose.Types.ObjectId.isValid(id) ? id : null,
      status: "Pending",
    }));

    participants.unshift({ user: hostId, status: "Accepted" });

    // Generate Meeting Link
    const meetingLink = generateMeetingLink();

    const newEvent = await Event.create({
      user: hostId,
      hostName,
      title,
      description,
      startTime: start,
      endTime: end,
      password,
      participants,
      bannerUrl, // Store banner URL
      meetingLink, // Store generated meeting link
    });

    await Booking.create({
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
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Event - Supports Banner and Meeting Link Update
exports.updateEvent = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const {
      title,
      description,
      startTime,
      endTime,
      password,
      hostName,
      bannerUrl,
    } = req.body;

    const event = await Event.findOne({ _id: id, user: hostId });
    if (!event)
      return res
        .status(404)
        .json({ message: "Event not found or not authorized" });

    if (startTime && endTime) {
      const start = dayjs(startTime).toDate();
      const end = dayjs(endTime).toDate();
      const conflict = await hasConflict(hostId, start, end, id);
      if (conflict)
        return res.status(400).json({ message: "Time conflict detected" });

      event.startTime = start;
      event.endTime = end;
    }

    if (title) event.title = title;
    if (description) event.description = description;
    if (password) event.password = password;
    if (hostName) event.hostName = hostName;
    if (bannerUrl) event.bannerUrl = bannerUrl; // Update banner URL

    await event.save();
    res.json(event);
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit User Profile
exports.editProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, avatar } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (avatar) user.avatar = avatar;

    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Edit profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Generate and Update Meeting Link
exports.updateMeetingLink = async (req, res) => {
  try {
    const { id } = req.params;
    const hostId = req.user._id;

    const event = await Event.findOne({ _id: id, user: hostId });
    if (!event) return res.status(404).json({ message: "Event not found" });

    event.meetingLink = generateMeetingLink(); // Generate new meeting link
    await event.save();

    res.json({
      message: "Meeting link updated",
      meetingLink: event.meetingLink,
    });
  } catch (error) {
    console.error("Update meeting link error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Events with Profile Data
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

// Toggle Event Active Status
exports.toggleEventActive = async (req, res) => {
  try {
    const hostId = req.user._id;
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, user: hostId });
    if (!event) return res.status(404).json({ message: "Event not found" });

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
