const Availability = require("../models/Availability");

exports.getUserAvailability = async (req, res) => {
  try {
    const availability = await Availability.findOne({ user: req.user._id });
    if (!availability) {
      const days = [
        { day: "Sun", unavailable: false, intervals: [] },
        { day: "Mon", unavailable: false, intervals: [] },
        { day: "Tue", unavailable: false, intervals: [] },
        { day: "Wed", unavailable: false, intervals: [] },
        { day: "Thu", unavailable: false, intervals: [] },
        { day: "Fri", unavailable: false, intervals: [] },
        { day: "Sat", unavailable: false, intervals: [] },
      ];
      const newAvailability = await Availability.create({
        user: req.user._id,
        days,
      });
      return res.json(newAvailability);
    }
    res.json(availability);
  } catch (error) {
    console.error("getUserAvailability error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUserAvailability = async (req, res) => {
  try {
    const { days } = req.body;
    let availability = await Availability.findOne({ user: req.user._id });
    if (!availability) {
      availability = await Availability.create({
        user: req.user._id,
        days: days || [],
      });
    } else {
      availability.days = days;
      await availability.save();
    }
    res.json(availability);
  } catch (error) {
    console.error("updateUserAvailability error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
