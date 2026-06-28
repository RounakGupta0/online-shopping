const express = require('express');
const router = express.Router();
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

// Helper to get or create cart
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

// @route   GET /api/cart
// @desc    Get current user's cart
// @access  Private (User only)
router.get('/', protect, authorize('user'), async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    await cart.populate('items.product');
    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving cart',
      error: error.message,
    });
  }
});

// @route   POST /api/cart
// @desc    Add product to cart or update its quantity
// @access  Private (User only)
router.post('/', protect, authorize('user'), async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide productId and quantity',
        error: 'Bad Request',
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number',
        error: 'Bad Request',
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }

    const cart = await getOrCreateCart(req.user._id);
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === productId
    );

    if (qty <= 0) {
      // If quantity is <= 0, remove the product from the cart list
      if (itemIndex > -1) {
        cart.items.splice(itemIndex, 1);
        await cart.save();
      }
      await cart.populate('items.product');
      return res.status(200).json({
        success: true,
        message: 'Product removed from cart since quantity was set to 0 or less',
        data: cart,
      });
    }

    // Check if quantity exceeds available stock (optional validation before adding to cart)
    if (product.stock < qty) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items left in stock`,
        error: 'Bad Request',
      });
    }

    if (itemIndex > -1) {
      // Update quantity
      cart.items[itemIndex].quantity = qty;
    } else {
      // Add new item
      cart.items.push({ product: productId, quantity: qty });
    }

    await cart.save();
    await cart.populate('items.product');

    return res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Update cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating cart',
      error: error.message,
    });
  }
});

// @route   DELETE /api/cart/:productId
// @desc    Remove an item from cart
// @access  Private (User only)
router.delete('/:productId', protect, authorize('user'), async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const itemIndex = cart.items.findIndex(
      (item) => item.product.toString() === req.params.productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Product not found in cart',
        error: 'Not Found',
      });
    }

    cart.items.splice(itemIndex, 1);
    await cart.save();
    await cart.populate('items.product');

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Remove item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error removing item from cart',
      error: error.message,
    });
  }
});

// @route   DELETE /api/cart
// @desc    Clear entire cart
// @access  Private (User only)
router.delete('/', protect, authorize('user'), async (req, res) => {
  try {
    const cart = await getOrCreateCart(req.user._id);
    cart.items = [];
    await cart.save();

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart,
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error clearing cart',
      error: error.message,
    });
  }
});

module.exports = router;
