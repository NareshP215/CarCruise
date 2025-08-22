const Joi = require('joi');

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min(0),
        image: Joi.string().allow("", null),
        tags: Joi.array().items(Joi.string().valid('Premium','Luxurious','Budget','Family','SUV','Sedan','Hatchback','Electric','Manual','Automatic')).max(4).default([]),
        latitude: Joi.alternatives().try(Joi.number(), Joi.string().pattern(/^\d*\.?\d+$/)).optional(),
        longitude: Joi.alternatives().try(Joi.number(), Joi.string().pattern(/^\d*\.?\d+$/)).optional()
    }).required()
});

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().required().min(1).max(5),
        comment: Joi.string().required(),
    }).required()
})