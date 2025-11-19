const authService = require("../services/auth.service");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await authService.login(email, password);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err });
  }
};
const bcrypt = require("bcrypt");
const User = require("../models/User");

exports.register = async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      fullName,
      email,
      password: hashed,
      role
    });

    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
