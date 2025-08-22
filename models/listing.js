const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js")

const listingSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        url: String,
        filename: String,
    },
    price: Number,
    location: String,
    country: String,
    // Category tags for filtering (max 4 selected in UI)
    tags: {
        type: [String],
        enum: [
            'Premium',
            'Luxurious',
            'Budget',
            'Family',
            'SUV',
            'Sedan',
            'Hatchback',
            'Electric',
            'Manual',
            'Automatic'
        ],
        default: []
    },
    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        }
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    geometry: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number],
            required: true
        }
    }
});

// listingSchema.post("findOneAndDelete", async (listing) => {
//     if (listing) {
//         await Review.deleteMany({ _id: { $in: listing.reviews } });
//     }
// });

listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        try {
            // Delete related reviews
            const reviewResult = await Review.deleteMany({ _id: { $in: listing.reviews } });
            console.log(`Deleted ${reviewResult.deletedCount} reviews for listing ${listing._id}`);
            
            // Delete related bookings
            const Booking = require("./booking.js");
            const bookingResult = await Booking.deleteMany({ listing: listing._id });
            console.log(`Deleted ${bookingResult.deletedCount} bookings for listing ${listing._id}`);
        } catch (error) {
            console.error(`Error in post-delete hook for listing ${listing._id}:`, error);
        }
    }
});


const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;