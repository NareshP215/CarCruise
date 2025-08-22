const express = require("express");
const { index, updateBookingStatus } = require("../controllers/deshborad");
const router = express.Router();
const { isLoggedIn } = require("../middleware.js");


// Dashboard route: show all listings created by current user
router.get("/", isLoggedIn, index);

// Update booking status route
router.post("/update-booking-status", isLoggedIn, updateBookingStatus);



module.exports = router;