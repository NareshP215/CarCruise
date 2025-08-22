const User = require("../models/user");

module.exports.renderSignupForm = (req, res) => {
    res.render("users/signup.ejs");
}

module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        const newUser = new User({ email, username });

        const registeredUser = await User.register(newUser, password);
        console.log(registeredUser);
        req.login(registeredUser, (err) => {
            if (err) {
                return next(err);
            }
            req.flash("success", "Welcome to CarCruise!");
            res.redirect("/listings");
        });
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/signup");
    }
}

module.exports.renderLoginForm = (req, res) => {
    res.render("users/login.ejs");
}


module.exports.login = async (req, res) => {
    req.flash("success", "Welcome back to CarCruise!");
    let redirectUrl = res.locals.redirectUrl || "/listings"
    res.redirect(redirectUrl);
}

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "you are logged out!");
        res.redirect("/listings");
    })
}

module.exports.renderMyBookings = async (req, res) => {
    try {
        const Booking = require("../models/booking.js");
        const Listing = require("../models/listing.js");

        const allowedStatuses = ["all", "pending", "approved", "rejected", "completed"];
        const selectedStatusRaw = (req.query.status || "all").toString().toLowerCase();
        const selectedStatus = allowedStatuses.includes(selectedStatusRaw) ? selectedStatusRaw : "all";

        let bookings = await Booking.find({ user: req.user._id })
            .populate('listing')
            .populate('owner')
            .sort({ createdAt: -1 });

        // Clean up orphaned bookings (bookings without valid listings)
        const orphanedBookings = bookings.filter(booking => !booking.listing);
        if (orphanedBookings.length > 0) {
            console.log(`Found ${orphanedBookings.length} orphaned bookings for user ${req.user._id}, cleaning up...`);
            await Booking.deleteMany({
                _id: { $in: orphanedBookings.map(b => b._id) }
            });
            // Re-fetch bookings after cleanup
            bookings = await Booking.find({ user: req.user._id })
                .populate('listing')
                .populate('owner')
                .sort({ createdAt: -1 });
        }

        // Compute display status and derived price totals
        const now = new Date();
        bookings = bookings.map(b => {
            try {
                // Determine end date/time and completed status
                const end = new Date(b.returnDate);
                if (b.returnTime) {
                    const [hh, mm] = String(b.returnTime).split(":");
                    end.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
                } else {
                    end.setHours(23, 59, 59, 999);
                }
                const isCompleted = b.status === 'approved' && !isNaN(end.getTime()) && now >= end;
                b.displayStatus = isCompleted ? 'completed' : b.status;

                // Calculate totals if listing and price exist
                if (b.listing && typeof b.listing.price === 'number' && !isNaN(b.listing.price)) {
                    const start = new Date(b.pickupDate);
                    if (b.pickupTime) {
                        const [sh, sm] = String(b.pickupTime).split(":");
                        start.setHours(parseInt(sh || '0', 10), parseInt(sm || '0', 10), 0, 0);
                    } else {
                        start.setHours(0, 0, 0, 0);
                    }

                    const endForCalc = new Date(b.returnDate);
                    if (b.returnTime) {
                        const [eh, em] = String(b.returnTime).split(":");
                        endForCalc.setHours(parseInt(eh || '0', 10), parseInt(em || '0', 10), 0, 0);
                    } else {
                        endForCalc.setHours(23, 59, 59, 999);
                    }

                    // Charge in half-day increments (round up to next half day)
                    const durationHours = Math.max(0, (endForCalc.getTime() - start.getTime()) / (60 * 60 * 1000));
                    const halfDayUnits = Math.ceil(durationHours / 12); // 12 hours = 0.5 day
                    const rentalDays = Math.max(0.5, halfDayUnits * 0.5);

                    const pricePerDayRaw = b.listing.price;
                    const pricePerDay = typeof pricePerDayRaw === 'number'
                        ? pricePerDayRaw
                        : Number(String(pricePerDayRaw).replace(/[^0-9.]/g, ''));
                    const subtotal = pricePerDay * rentalDays;
                    const gstAmount = Math.round(subtotal * 0.18);
                    const totalAmount = subtotal + gstAmount;

                    b.calculated = { rentalDays, pricePerDay, subtotal, gstAmount, totalAmount };
                }
            } catch (e) {
                b.displayStatus = b.status;
            }
            return b;
        });

        // Build counts by displayStatus for filter badges
        const statusCounts = bookings.reduce((acc, b) => {
            const key = b.displayStatus || b.status;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        statusCounts.all = bookings.length;

        // Apply selected status filter (using displayStatus so 'completed' works)
        const filteredBookings = selectedStatus === 'all'
            ? bookings
            : bookings.filter(b => (b.displayStatus || b.status) === selectedStatus);

        res.render("users/my-bookings.ejs", { bookings: filteredBookings, selectedStatus, statusCounts });
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        req.flash("error", "Error fetching your bookings.");
        res.redirect("/listings");
    }
}

module.exports.cancelBooking = async (req, res) => {
    try {
        const Booking = require("../models/booking.js");
        const { id } = req.params;

        const booking = await Booking.findById(id);
        if (!booking) {
            req.flash("error", "Booking not found or already cancelled.");
            const redirectTo = req.get('Referer') || "/my-bookings";
            return res.redirect(redirectTo);
        }

        if (!booking.user.equals(req.user._id)) {
            req.flash("error", "You are not authorized to cancel this booking.");
            const redirectTo = req.get('Referer') || "/my-bookings";
            return res.redirect(redirectTo);
        }

        if (booking.status !== 'pending') {
            req.flash("error", "Only pending bookings can be cancelled.");
            const redirectTo = req.get('Referer') || "/my-bookings";
            return res.redirect(redirectTo);
        }

        await booking.deleteOne();
        req.flash("success", "Booking request cancelled.");
        const redirectTo = req.get('Referer') || "/my-bookings";
        return res.redirect(redirectTo);
    } catch (error) {
        console.error("Error cancelling booking:", error);
        req.flash("error", "Error cancelling booking. Please try again.");
        const redirectTo = req.get('Referer') || "/my-bookings";
        return res.redirect(redirectTo);
    }
}