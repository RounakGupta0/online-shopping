const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a product description'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please provide a product price'],
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      required: [true, 'Please provide product stock quantity'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    category: {
      type: String,
      required: [true, 'Please provide a product category'],
      trim: true,
      lowercase: true,
    },
    images: {
      type: [String],
      required: [true, 'Please provide product images'],
      validate: {
        validator: function (val) {
          return val && val.length >= 1 && val.length <= 5;
        },
        message: 'Product must have between 1 and 5 images.',
      },
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for default thumbnail
productSchema.virtual('thumbnail').get(function () {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
