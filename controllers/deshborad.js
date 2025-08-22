const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");

module.exports.index = async (req, res) => {
    const userId = req.user._id;
    const listings = await Listing.find({ owner: userId });

    // Get booking requests and populate listing/user data
    let bookingRequests = await Booking.find({ owner: userId }).populate('listing user');

    // Filter out any booking requests that reference deleted listings (safety check)
    bookingRequests = bookingRequests.filter(booking => booking.listing && booking.user);

    // Clean up orphaned bookings (bookings without valid listings)
    const orphanedBookings = bookingRequests.filter(booking => !booking.listing);
    if (orphanedBookings.length > 0) {
        console.log(`Found ${orphanedBookings.length} orphaned bookings, cleaning up...`);
        await Booking.deleteMany({
            _id: { $in: orphanedBookings.map(b => b._id) }
        });
        // Re-fetch bookings after cleanup
        bookingRequests = await Booking.find({ owner: userId }).populate('listing user');
        bookingRequests = bookingRequests.filter(booking => booking.listing && booking.user);
    }

    // Enrich bookings with lock status (approved and before end time => locked)
    const now = new Date();
    bookingRequests = bookingRequests.map(b => {
        try {
            const end = new Date(b.returnDate);
            if (b.returnTime) {
                const [hh, mm] = String(b.returnTime).split(":");
                end.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
            } else {
                end.setHours(23, 59, 59, 999);
            }
            b._isApprovedLocked = (b.status === 'approved' && now < end);
            b._endAt = end.toISOString();
        } catch (e) {
            b._isApprovedLocked = false;
        }
        return b;
    });

    // Calculate total income from approved bookings only
    let totalIncome = 0;
    let approvedBookings = [];
    let totalBookings = bookingRequests.length;

    console.log(`Total bookings found: ${totalBookings}`);

    if (bookingRequests.length > 0) {
        // Only get approved bookings
        approvedBookings = bookingRequests.filter(booking =>
            booking.status === 'approved' && booking.listing && booking.listing.price
        );

        console.log(`Approved bookings found: ${approvedBookings.length}`);
        console.log('Sample approved booking data:', JSON.stringify(approvedBookings[0], null, 2));

        // Calculate income only from approved bookings
        approvedBookings.forEach(booking => {
            if (booking.listing && booking.listing.price) {
                console.log(`Processing booking ${booking._id}:`);
                console.log(`- Pickup Date: ${booking.pickupDate}`);
                console.log(`- Return Date: ${booking.returnDate}`);
                console.log(`- Pickup Time: ${booking.pickupTime}`);
                console.log(`- Return Time: ${booking.returnTime}`);
                console.log(`- Listing Price: ${booking.listing.price}`);

                // Compute start and end with times
                const start = new Date(booking.pickupDate);
                if (booking.pickupTime) {
                    const [sh, sm] = String(booking.pickupTime).split(":");
                    start.setHours(parseInt(sh || '0', 10), parseInt(sm || '0', 10), 0, 0);
                } else {
                    start.setHours(0, 0, 0, 0);
                }

                const end = new Date(booking.returnDate);
                if (booking.returnTime) {
                    const [eh, em] = String(booking.returnTime).split(":");
                    end.setHours(parseInt(eh || '0', 10), parseInt(em || '0', 10), 0, 0);
                } else {
                    end.setHours(23, 59, 59, 999);
                }

                // Half-day increment billing (round up to next 0.5 day) with robust fallback
                const diffMs = end.getTime() - start.getTime();
                let rentalDays;
                if (Number.isFinite(diffMs) && diffMs > 0) {
                    const durationHours = diffMs / (60 * 60 * 1000);
                    const halfDayUnits = Math.ceil(durationHours / 12); // 12 hours per half day
                    rentalDays = Math.max(0.5, halfDayUnits * 0.5);
                } else {
                    // Fallback: use date-only difference; minimum 1 day
                    const pd = new Date(booking.pickupDate);
                    const rd = new Date(booking.returnDate);
                    const dateDiffMs = rd.getTime() - pd.getTime();
                    if (Number.isFinite(dateDiffMs) && dateDiffMs > 0) {
                        const daysOnly = Math.ceil(dateDiffMs / (24 * 60 * 60 * 1000));
                        rentalDays = Math.max(1, daysOnly);
                    } else {
                        rentalDays = 1;
                    }
                }

                // Calculate total amount for this booking (including GST)
                const pricePerDayRaw = booking.listing.price;
                const pricePerDay = typeof pricePerDayRaw === 'number'
                    ? pricePerDayRaw
                    : Number(String(pricePerDayRaw).replace(/[^0-9.]/g, ''));
                if (!Number.isFinite(pricePerDay)) {
                    console.log(`- Skipping booking ${booking._id} due to non-numeric price`);
                    return;
                }
                const baseAmount = pricePerDay * rentalDays;
                if (!Number.isFinite(baseAmount)) {
                    console.log(`- Skipping booking ${booking._id} due to invalid base amount`);
                    return;
                }
                const gstAmount = Math.round(baseAmount * 0.18); // 18% GST (rounded to match My Bookings)
                const totalAmount = baseAmount + gstAmount;

                console.log(`- Rental days (half-day increments): ${rentalDays}`);
                console.log(`- Base amount: ₹${baseAmount}`);
                console.log(`- GST amount: ₹${gstAmount}`);
                console.log(`- Total amount: ₹${totalAmount}`);

                if (Number.isFinite(totalAmount)) {
                    totalIncome += totalAmount;
                } else {
                    console.log(`- Skipping booking ${booking._id} due to invalid total amount`);
                }
            } else {
                console.log(`Skipping booking ${booking._id} - missing listing or price`);
            }
        });

        console.log(`Total income calculated: ₹${totalIncome}`);
    }

    // Ensure all values are numbers and handle edge cases
    totalIncome = isNaN(totalIncome) ? 0 : totalIncome;
    totalBookings = isNaN(totalBookings) ? 0 : totalBookings;

    console.log(`Final values - Total Income: ₹${totalIncome}, Total Bookings: ${totalBookings}`);

    res.render("./users/dashboard.ejs", {
        listings: listings,
        bookingRequests,
        totalIncome: totalIncome.toFixed(2),
        totalBookings: totalBookings,
        approvedBookings: approvedBookings
    });
}

module.exports.updateBookingStatus = async (req, res) => {
    try {
        const { bookingId, status } = req.body;

        if (!bookingId || !status) {
            req.flash("error", "Missing required fields: bookingId and status");
            return res.status(400).json({
                success: false,
                message: "Missing required fields: bookingId and status"
            });
        }

        const userId = req.user._id;

        // Validate status value
        const validStatuses = ['pending', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            req.flash("error", "Invalid status value. Must be one of: pending, approved, rejected");
            return res.status(400).json({
                success: false,
                message: "Invalid status value. Must be one of: pending, approved, rejected"
            });
        }

        // Find the booking and verify ownership
        const booking = await Booking.findOne({ _id: bookingId, owner: userId });

        if (!booking) {
            req.flash("error", "Booking not found or unauthorized");
            return res.status(404).json({
                success: false,
                message: "Booking not found or unauthorized"
            });
        }

        // Compute booking end datetime (returnDate + returnTime)
        const now = new Date();
        const end = new Date(booking.returnDate);
        if (booking.returnTime) {
            const [hh, mm] = String(booking.returnTime).split(":");
            end.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
        } else {
            end.setHours(23, 59, 59, 999);
        }

        const isBeforeEnd = now < end;

        // Business rules:
        // - If current status is approved and owner tries to change to anything else, block with flash
        if (booking.status === 'approved' && status !== 'approved') {
            req.flash("error", "You can update status only one time.");
            return res.status(400).json({
                success: false,
                message: "You can update status only one time."
            });
        }

        // - If currently approved and booking period has not ended, also block any change attempts
        if (isBeforeEnd && booking.status === 'approved') {
            req.flash("error", "You can update status only one time.");
            return res.status(400).json({
                success: false,
                message: "You can update status only one time."
            });
        }

        if (status === 'pending') {
            return res.status(400).json({
                success: false,
                message: "Setting status back to pending is not allowed. Choose Approved or Rejected."
            });
        }

        // If no actual change
        if (booking.status === status) {
            return res.json({
                success: true,
                message: "Status unchanged.",
                newStatus: status
            });
        }

        // Update the status
        booking.status = status;
        await booking.save();

        // Set flash message for success
        req.flash("success", "Booking status updated successfully!");

        res.json({
            success: true,
            message: "Booking status updated successfully",
            newStatus: status
        });
    } catch (error) {
        console.error("Error updating booking status:", error);
        req.flash("error", "Error updating booking status. Please try again.");
        res.status(500).json({
            success: false,
            message: "Error updating booking status: " + error.message
        });
    }
}



