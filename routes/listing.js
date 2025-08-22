const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const Listing = require("../models/listing.js");
const { isLoggedIn, isOwner, validateListing, checkListingExists } = require("../middleware.js");
const listingContollers = require("../controllers/listings.js");
const multer = require('multer');
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });

// New Route - must come before :id route
router.get("/new", isLoggedIn, listingContollers.renderNewForm);

// Edit Route - must come before :id route
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingContollers.renderEditForm));

// Index and Create routes
router
    .route("/")
    .get(wrapAsync(listingContollers.index)) // Index Route
    .post(isLoggedIn, upload.single('listing[image]'), validateListing, wrapAsync(listingContollers.createListing)) // Create Route

// Booking route
router.post('/:id/book', checkListingExists, wrapAsync(listingContollers.bookListing));

// Show, Update, Delete routes
router
    .route("/:id")
    .get(wrapAsync(listingContollers.showListing)) // Show Route
    .put(isLoggedIn, isOwner, upload.single('listing[image]'), validateListing, wrapAsync(listingContollers.updateListing)) // Update Route
    .delete(isLoggedIn, isOwner, wrapAsync(listingContollers.destroyListing)) // Delete Route


router.post("/search", wrapAsync(listingContollers.index));
module.exports = router;