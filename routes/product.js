const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const getUploadedFiles = (files, fieldName) => {
  if (!files || !files[fieldName]) return [];
  return Array.isArray(files[fieldName]) ? files[fieldName] : [files[fieldName]];
};

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    const formatProduct = (p) => ({
      _id: p._id,
      name: p.name,
      price: p.price,
      thumbnail: p.thumbnail,
    });

    if (search) {
      const queryRegex = new RegExp(search, 'i');
      const matchedProducts = await Product.find({
        $or: [
          { name: queryRegex },
          { description: queryRegex },
          { category: queryRegex },
        ],
      }).select('name price images category');

      const matchedCategories = [
        ...new Set(matchedProducts.map((p) => p.category)),
      ];

      let relatedProducts = [];
      if (matchedCategories.length > 0) {
        const matchedIds = matchedProducts.map((p) => p._id);
        relatedProducts = await Product.find({
          category: { $in: matchedCategories },
          _id: { $nin: matchedIds },
        }).select('name price images');
      }

      return res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: {
          products: matchedProducts.map(formatProduct),
          related: relatedProducts.map(formatProduct),
        },
      });
    }

    const allProducts = await Product.find({}).select('name price images');
    return res.status(200).json({
      success: true,
      message: 'All products retrieved successfully',
      data: {
        products: allProducts.map(formatProduct),
        related: [],
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving products',
      error: error.message,
    });
  }
});

router.get('/stock-alerts', protect, authorize('vendor'), async (req, res) => {
  try {
    const { type } = req.query;

    let filter = {};
    if (type === 'out-of-stock') {
      filter = { stock: 0 };
    } else if (type === 'low-stock') {
      filter = { stock: { $gt: 0, $lt: 10 } };
    } else {
      filter = { stock: { $lt: 10 } };
    }

    const products = await Product.find(filter);

    return res.status(200).json({
      success: true,
      message: 'Stock alert products retrieved successfully',
      data: products,
    });
  } catch (error) {
    console.error('Stock alerts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving stock alerts',
      error: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  } catch (error) {
    console.error('Get product by id error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving product detail',
      error: error.message,
    });
  }
});


router.post('/', protect, authorize('vendor'), async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;

    if (!name || !description || !price || stock === undefined || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, description, price, stock, and category',
        error: 'Bad Request',
      });
    }

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a positive number',
        error: 'Bad Request',
      });
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        success: false,
        message: 'Stock must be a non-negative number',
        error: 'Bad Request',
      });
    }

    const imageFiles = getUploadedFiles(req.files, 'images');

    if (imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least 1 image for the product',
        error: 'Bad Request',
      });
    }

    if (imageFiles.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'You can upload a maximum of 5 images',
        error: 'Bad Request',
      });
    }

    const imageUrls = [];
    for (const file of imageFiles) {
      try {
        const uploadRes = await uploadToCloudinary(file.data, 'online_shopping/products');
        imageUrls.push(uploadRes.secure_url);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading product images',
          error: err.message,
        });
      }
    }

    const product = await Product.create({
      name,
      description,
      price: parsedPrice,
      stock: parsedStock,
      category: category.toLowerCase().trim(),
      images: imageUrls,
      vendor: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating product',
      error: error.message,
    });
  }
});

router.put('/:id', protect, authorize('vendor'), async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }
    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this product',
        error: 'Forbidden',
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (category) updateData.category = category.toLowerCase().trim();

    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a positive number',
          error: 'Bad Request',
        });
      }
      updateData.price = parsedPrice;
    }

    if (stock !== undefined) {
      const parsedStock = Number(stock);
      if (isNaN(parsedStock) || parsedStock < 0) {
        return res.status(400).json({
          success: false,
          message: 'Stock must be a non-negative number',
          error: 'Bad Request',
        });
      }
      updateData.stock = parsedStock;
    }

    const newImageFiles = getUploadedFiles(req.files, 'images');
    if (newImageFiles.length > 0) {
      if (newImageFiles.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'You can upload a maximum of 5 images',
          error: 'Bad Request',
        });
      }

      const imageUrls = [];
      for (const file of newImageFiles) {
        try {
          const uploadRes = await uploadToCloudinary(file.data, 'online_shopping/products');
          imageUrls.push(uploadRes.secure_url);
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: 'Error uploading product images',
            error: err.message,
          });
        }
      }
      updateData.images = imageUrls;
    }

    product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: error.message,
    });
  }
});

router.patch('/:id/images', protect, authorize('vendor'), async (req, res) => {
  try {
    const { imagesToDelete } = req.body;
    let product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }

    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this product',
        error: 'Forbidden',
      });
    }

    let urlsToDelete = [];
    if (imagesToDelete) {
      if (Array.isArray(imagesToDelete)) {
        urlsToDelete = imagesToDelete;
      } else if (typeof imagesToDelete === 'string') {
        try {
          const parsed = JSON.parse(imagesToDelete);
          urlsToDelete = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
          urlsToDelete = imagesToDelete.split(',').map(url => url.trim());
        }
      }
    }

    urlsToDelete = urlsToDelete.filter(url => url && product.images.includes(url));

    const newImageFiles = getUploadedFiles(req.files, 'images');

    const newCount = product.images.length - urlsToDelete.length + newImageFiles.length;
    if (newCount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Product must have at least 1 image.',
        error: 'Bad Request',
      });
    }
    if (newCount > 5) {
      return res.status(400).json({
        success: false,
        message: 'Product can have a maximum of 5 images.',
        error: 'Bad Request',
      });
    }

    if (urlsToDelete.length > 0) {
      await Promise.all(urlsToDelete.map(url => deleteFromCloudinary(url)));
      product.images = product.images.filter(img => !urlsToDelete.includes(img));
    }

    if (newImageFiles.length > 0) {
      const uploadedUrls = [];
      for (const file of newImageFiles) {
        try {
          const uploadRes = await uploadToCloudinary(file.data, 'online_shopping/products');
          uploadedUrls.push(uploadRes.secure_url);
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: 'Error uploading product images',
            error: err.message,
          });
        }
      }
      product.images.push(...uploadedUrls);
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'Product images updated successfully',
      data: product,
    });
  } catch (error) {
    console.error('Patch product images error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating product images',
      error: error.message,
    });
  }
});

router.delete('/:id', protect, authorize('vendor'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }

    if (product.vendor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this product',
        error: 'Forbidden',
      });
    }

    await product.deleteOne();

    if (product.images && product.images.length > 0) {
      Promise.all(product.images.map(imgUrl => deleteFromCloudinary(imgUrl))).catch(err => {
        console.error('Error deleting product images from Cloudinary:', err);
      });
    }

    await Cart.updateMany(
      { 'items.product': product._id },
      { $pull: { items: { product: product._id } } }
    );

    await User.updateMany(
      { favorites: product._id },
      { $pull: { favorites: product._id } }
    );

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: {},
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting product',
      error: error.message,
    });
  }
});

module.exports = router;
