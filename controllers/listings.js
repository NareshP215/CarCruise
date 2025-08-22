const Listing = require("../models/listing");
const axios = require("axios");
const mongoose = require("mongoose")
const Booking = require("../models/booking.js");

module.exports.index = async (req, res) => {
    try {
        const searchTerm = req.body.searchQuery || req.query.search; // POST or GET
        const tagFilter = req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) : [];
        let allListings = [];

        const filterQuery = {};
        if (searchTerm) {
            filterQuery.$or = [
                { title: { $regex: searchTerm, $options: "i" } },
                { location: { $regex: searchTerm, $options: "i" } },
                { country: { $regex: searchTerm, $options: "i" } }
            ];
        }
        if (tagFilter.length > 0) {
            filterQuery.tags = { $all: tagFilter };
        }

        allListings = await Listing.find(filterQuery);

        if (allListings.length === 0) {
            // Only flash when user applied search/tags; silent empty state on plain refresh
            const isFiltered = Boolean(searchTerm || (tagFilter && tagFilter.length > 0));
            if (isFiltered) {
                req.flash("error", "No listings found.");
            }
        }
        res.render("listings/index", { allListings, query: req.query || {} });
    } catch (error) {
        console.error("Error in index controller:", error);
        res.status(500).send("Internal Server Error");
    }
}
module.exports.renderNewForm = (req, res) => {
    res.render("./listings/new.ejs");
}

module.exports.showListing = async (req, res) => {
    let { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    const listing = await Listing.findById(id)
        .populate({ path: "reviews", populate: { path: "author" } })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    // Determine user's booking state for this listing
    let userBooking = null;
    let canRebook = false;
    if (req.user) {
        const bookings = await Booking.find({ listing: id, user: req.user._id }).sort({ createdAt: -1 });
        const now = new Date();

        const getEndDateTime = (booking) => {
            const end = new Date(booking.returnDate);
            if (booking.returnTime) {
                const [hh, mm] = booking.returnTime.split(":");
                end.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
            } else {
                end.setHours(23, 59, 59, 999);
            }
            return end;
        };

        const pendingBooking = bookings.find(b => b.status === 'pending');
        const approvedOngoing = bookings.find(b => b.status === 'approved' && now < getEndDateTime(b));
        const hasApprovedCompleted = bookings.some(b => b.status === 'approved' && now >= getEndDateTime(b));
        const latestRejected = bookings.find(b => b.status === 'rejected');

        // Decide what to show in UI as current userBooking (blocking state)
        if (pendingBooking) {
            userBooking = pendingBooking;
        } else if (approvedOngoing) {
            userBooking = approvedOngoing;
        } else if (latestRejected && !hasApprovedCompleted) {
            // Only show rejected block if user has no completed approved booking enabling rebook
            userBooking = latestRejected;
        } else {
            userBooking = null;
        }

        // Can rebook if there exists a completed approved booking and no active pending/ongoing block
        canRebook = Boolean(hasApprovedCompleted && !pendingBooking && !approvedOngoing);
    }

    console.log(listing);
    res.render("./listings/show.ejs", { listing, userBooking, canRebook });
}

module.exports.createListing = async (req, res, next) => {

    try {
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        // Check if file was uploaded
        if (!req.file) {
            req.flash("error", "Please upload an image!");
            return res.redirect("/listings/new");
        }

        let url = req.file.path;
        let filename = req.file.filename;
        console.log('File uploaded:', { url, filename });

        const { location, country, latitude, longitude } = req.body.listing;
        console.log('Location:', location);
        console.log('Country:', country);
        console.log('Coordinates:', latitude, longitude);

        let lat, lon;

        // Check if coordinates are provided from the map
        if (latitude && longitude) {
            lat = parseFloat(latitude);
            lon = parseFloat(longitude);
            console.log("Using provided coordinates - LAT:", lat, "LON:", lon);
        } else {
            // Fallback to geocoding location and country
            let query = '';
            if (location && country) {
                query = `${location}, ${country}`;
            } else if (location) {
                query = location;
            } else if (country) {
                query = country;
            } else {
                req.flash("error", "Please provide location or country!");
                return res.redirect("/listings/new");
            }

            console.log("Geocoding Query : ", query);

            const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
            const geoRes = await axios.get(geocodeUrl);
            const geoData = geoRes.data;

            if (!geoData.length) {
                req.flash("error", "Location not found!");
                return res.redirect("/listings/new");
            }

            lat = parseFloat(geoData[0].lat);
            lon = parseFloat(geoData[0].lon);
            console.log("Geocoded coordinates - LAT:", lat, "LON:", lon);
        }

        const newListing = new Listing(req.body.listing);
        // Enforce max 4 tags server-side
        if (Array.isArray(newListing.tags) && newListing.tags.length > 4) {
            newListing.tags = newListing.tags.slice(0, 4);
        }
        newListing.owner = req.user._id;
        newListing.image = { url, filename };
        newListing.geometry = {
            type: "Point",
            coordinates: [lon, lat]
        };
        await newListing.save();
        console.log('Listing saved successfully');

        req.flash("success", "New Listing Created!");
        res.redirect("/listings");

    } catch (err) {
        console.error('Error in createListing:', err);
        req.flash("error", "Failed to create listing. Please try again.");
        res.redirect("/listings/new");
    }

}

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing you requested for does not exist!");
        return res.redirect("/listings");
    }

    let orginalImageUrl = listing.image.url;
    orginalImageUrl = orginalImageUrl.replace("/upload", "/upload/w_250");
    console.log(orginalImageUrl);
    res.render("./listings/edit.ejs", { listing: listing, orginalImageUrl });
}

module.exports.updateListing = async (req, res) => {
    let { id } = req.params;
    let updateData = { ...req.body.listing };
    // Enforce max 4 tags server-side on update
    if (Array.isArray(updateData.tags) && updateData.tags.length > 4) {
        updateData.tags = updateData.tags.slice(0, 4);
    }
    let listing = await Listing.findByIdAndUpdate(id, updateData);

    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        listing.image = { url, filename };
        await listing.save();
    }

    // Handle geometry update
    const { latitude, longitude, location, country } = req.body.listing;
    let lat, lon;

    // Check if coordinates are provided from the map
    if (latitude && longitude) {
        lat = parseFloat(latitude);
        lon = parseFloat(longitude);
        console.log("Using provided coordinates for update - LAT:", lat, "LON:", lon);
    } else {
        // Fallback to geocoding location and country
        let query = '';
        if (location && country) {
            query = `${location}, ${country}`;
        } else if (location) {
            query = location;
        } else if (country) {
            query = country;
        } else {
            console.log("No location or country provided for geocoding");
        }

        if (query) {
            console.log("Geocoding Query for update: ", query);

            try {
                const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
                const geoRes = await axios.get(geocodeUrl);
                const geoData = geoRes.data;

                if (geoData.length > 0) {
                    lat = parseFloat(geoData[0].lat);
                    lon = parseFloat(geoData[0].lon);
                    console.log("Geocoded coordinates for update - LAT:", lat, "LON:", lon);
                } else {
                    console.log("No geocoding results found for update");
                }
            } catch (error) {
                console.error("Geocoding error during update:", error);
            }
        }
    }

    // Update geometry if coordinates are available
    if (lat && lon) {
        listing.geometry = {
            type: "Point",
            coordinates: [lon, lat]
        };
        await listing.save();
    }

    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
}

module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;

    try {
        // Count bookings before deletion for logging
        const bookingCount = await Booking.countDocuments({ listing: id });
        console.log(`Found ${bookingCount} bookings for listing ${id}`);

        // Delete all bookings related to this listing first
        await Booking.deleteMany({ listing: id });
        console.log(`Deleted all bookings for listing ${id}`);

        // Then delete the listing
        let deletedListing = await Listing.findOneAndDelete({ _id: id });
        console.log(`Deleted listing: ${deletedListing ? deletedListing.title : 'Unknown'}`);

        req.flash("success", `Listing deleted successfully! ${bookingCount > 0 ? `Also removed ${bookingCount} related booking(s).` : ''}`);
        res.redirect('/listings');
    } catch (error) {
        console.error("Error deleting listing:", error);
        req.flash("error", "Error deleting listing. Please try again.");
        res.redirect('/listings');
    }
}

// Booking handler
module.exports.bookListing = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'You must be logged in to book.' });
    }

    const { id } = req.params;
    const { fullName, pickupDate, returnDate, pickupTime, returnTime, mobileNumber } = req.body;

    // Validate required fields
    if (!fullName || !pickupDate || !returnDate || !pickupTime || !returnTime || !mobileNumber) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // Validate dates
    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (pickup < today) {
        return res.status(400).json({ error: 'Pickup date cannot be in the past.' });
    }

    if (returnD <= pickup) {
        return res.status(400).json({ error: 'Return date must be after pickup date.' });
    }

    const listing = await Listing.findById(id).populate('owner');
    if (!listing) {
        return res.status(404).json({ error: 'This listing no longer exists or has been deleted.' });
    }

    if (listing.owner && listing.owner._id.equals(req.user._id)) {
        return res.status(400).json({ error: 'You cannot book your own listing.' });
    }

    // Enforce rebooking policy: allow if last approved booking has completed; block if pending or currently active approved
    const userBookings = await Booking.find({ listing: id, user: req.user._id }).sort({ createdAt: -1 });
    if (userBookings.length > 0) {
        const now = new Date();
        const getEndDateTime = (booking) => {
            const end = new Date(booking.returnDate);
            if (booking.returnTime) {
                const [hh, mm] = booking.returnTime.split(":");
                end.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
            } else {
                end.setHours(23, 59, 59, 999);
            }
            return end;
        };

        const hasPending = userBookings.some(b => b.status === 'pending');
        const hasApprovedOngoing = userBookings.some(b => b.status === 'approved' && now < getEndDateTime(b));
        const hasApprovedCompleted = userBookings.some(b => b.status === 'approved' && now >= getEndDateTime(b));

        if (hasPending) {
            return res.status(400).json({ error: 'You already have a pending request for this listing.' });
        }
        if (hasApprovedOngoing) {
            return res.status(400).json({ error: 'You already have an active approved booking for this listing.' });
        }
        if (!hasApprovedCompleted && userBookings.some(b => b.status === 'rejected')) {
            return res.status(400).json({ error: 'Your previous booking request for this listing was rejected. You cannot book it again.' });
        }
        // If we reach here and hasApprovedCompleted is true, we allow re-booking
    }

    // Create booking request
    await Booking.create({
        listing: id,
        user: req.user._id,
        owner: listing.owner._id,
        fullName,
        pickupDate: pickup,
        returnDate: returnD,
        pickupTime,
        returnTime,
        mobileNumber,
        status: 'pending',
    });

    return res.json({ success: true, message: 'Booking request sent to the owner.' });
}
