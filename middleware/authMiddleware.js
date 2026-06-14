const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function (req, res, next) {
    let token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({
            msg: "No token, authorization denied",
        });
    }

    if (token.startsWith("Bearer ")) {
        token = token.slice(7).trim();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || !user.currentToken) {
            return res.status(401).json({
                msg: "Token is not valid",
            });
        }

        if (user.currentToken !== token) {
            return res.status(401).json({
                msg: "Session invalid or user logged in from another screen",
            });
        }

        req.user = decoded;

        next();
    } catch (error) {
        res.status(401).json({
            msg: "Token is not valid",
        });
    }
};