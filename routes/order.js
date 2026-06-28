const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { uploadToCloudinary } = require('../config/cloudinary');

router.post('/', protect, authorize('user'), async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Cannot place an order.',
        error: 'Bad Request',
      });
    }

    if (!req.files || !req.files.screenshot) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a payment screenshot to place the order',
        error: 'Bad Request',
      });
    }

    const screenshotFile = req.files.screenshot;

    const subtractedProducts = [];
    let stockError = null;

    for (const item of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: item.product._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        stockError = `Insufficient stock for product: "${item.product.name}" (requested: ${item.quantity})`;
        break;
      }

      subtractedProducts.push({
        id: item.product._id,
        quantity: item.quantity,
      });
    }

    if (stockError) {
      for (const sub of subtractedProducts) {
        await Product.findByIdAndUpdate(sub.id, { $inc: { stock: sub.quantity } });
      }
      return res.status(400).json({
        success: false,
        message: stockError,
        error: 'Insufficient Stock',
      });
    }

    let screenshotUrl;
    try {
      const uploadRes = await uploadToCloudinary(
        screenshotFile.data,
        'online_shopping/payments'
      );
      screenshotUrl = uploadRes.secure_url;
    } catch (err) {
      for (const sub of subtractedProducts) {
        await Product.findByIdAndUpdate(sub.id, { $inc: { stock: sub.quantity } });
      }
      return res.status(500).json({
        success: false,
        message: 'Error uploading payment screenshot to Cloudinary',
        error: err.message,
      });
    }

    let totalAmount = 0;
    const orderItems = cart.items.map((item) => {
      const itemTotal = item.product.price * item.quantity;
      totalAmount += itemTotal;
      return {
        product: item.product._id,
        quantity: item.quantity,
        priceAtPurchase: item.product.price,
      };
    });

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      totalAmount,
      paymentScreenshot: screenshotUrl,
      status: 'pending',
    });

    cart.items = [];
    await cart.save();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order,
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error placing order',
      error: error.message,
    });
  }
});

router.get('/my-orders', protect, authorize('user'), async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully',
      data: orders,
    });
  } catch (error) {
    console.error('Get my orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving orders',
      error: error.message,
    });
  }
});

router.get('/vendor-orders', protect, authorize('vendor'), async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {};
    if (status) {
      const validStatuses = ['pending', 'inprocess', 'yet to deliver', 'delivered'];
      if (validStatuses.includes(status)) {
        filter.status = status;
      }
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email phoneNumber profilePic')
      .populate('items.product')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Vendor orders list retrieved successfully',
      data: orders,
    });
  } catch (error) {
    console.error('Get vendor orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving vendor order list',
      error: error.message,
    });
  }
});

router.put('/:id/status', protect, authorize('vendor'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide status to update',
        error: 'Bad Request',
      });
    }

    const validStatuses = ['pending', 'inprocess', 'yet to deliver', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        error: 'Bad Request',
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        error: 'Not Found',
      });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating order status',
      error: error.message,
    });
  }
});

module.exports = router;
