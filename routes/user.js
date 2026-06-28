const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @route   POST /api/user/register
// @desc    Register a user or vendor
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and phone number',
        error: 'Bad Request',
      });
    }

    // Check duplicate email
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email is already registered',
        error: 'Conflict',
      });
    }

    // Check duplicate phone number
    const phoneExists = await User.findOne({ phoneNumber });
    if (phoneExists) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number is already registered',
        error: 'Conflict',
      });
    }

    // Check if email matches vendor email
    const vendorEmail = process.env.VENDOR_EMAIL || 'rounak@gmail.com';
    const role = email.toLowerCase() === vendorEmail.toLowerCase() ? 'vendor' : 'user';

    // File Upload handling (Profile Picture)
    let profilePic;
    if (req.files && req.files.profilePic) {
      try {
        const uploadRes = await uploadToCloudinary(
          req.files.profilePic.data,
          'online_shopping/profiles'
        );
        profilePic = uploadRes.secure_url;
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading profile picture',
          error: err.message,
        });
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      phoneNumber,
      profilePic,
      role,
    });

    return res.status(201).json({
      success: true,
      message: `${role === 'vendor' ? 'Vendor' : 'User'} registered successfully`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePic: user.profilePic,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
});

// @route   POST /api/user/login
// @desc    Authenticate user/vendor & get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
        error: 'Bad Request',
      });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePic: user.profilePic,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
});

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: user,
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving profile',
      error: error.message,
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile (name, phone, profile pic)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'Not Found',
      });
    }

    if (name) user.name = name;

    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered by another user',
          error: 'Conflict',
        });
      }
      user.phoneNumber = phoneNumber;
    }

    if (req.files && req.files.profilePic) {
      try {
        const oldProfilePic = user.profilePic;
        const uploadRes = await uploadToCloudinary(
          req.files.profilePic.data,
          'online_shopping/profiles'
        );
        user.profilePic = uploadRes.secure_url;
        
        // Delete old profile picture from Cloudinary if it exists
        if (oldProfilePic) {
          await deleteFromCloudinary(oldProfilePic);
        }
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: 'Error uploading profile picture',
          error: err.message,
        });
      }
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profilePic: user.profilePic,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error updating profile',
      error: error.message,
    });
  }
});

// @route   POST /api/user/favorites/:productId
// @desc    Add product to user's favorites
// @access  Private (User only)
router.post('/favorites/:productId', protect, authorize('user'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
        error: 'Not Found',
      });
    }

    const user = await User.findById(req.user._id);

    // Check if already favorited
    if (user.favorites.includes(product._id)) {
      return res.status(400).json({
        success: false,
        message: 'Product is already in favorites',
        error: 'Bad Request',
      });
    }

    user.favorites.push(product._id);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Product added to favorites successfully',
      data: { favorites: user.favorites },
    });
  } catch (error) {
    console.error('Favorites add error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error adding favorite',
      error: error.message,
    });
  }
});

// @route   DELETE /api/user/favorites/:productId
// @desc    Remove product from user's favorites
// @access  Private (User only)
router.delete('/favorites/:productId', protect, authorize('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.favorites.includes(req.params.productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product is not in favorites',
        error: 'Bad Request',
      });
    }

    user.favorites = user.favorites.filter(
      (favId) => favId.toString() !== req.params.productId
    );
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Product removed from favorites successfully',
      data: { favorites: user.favorites },
    });
  } catch (error) {
    console.error('Favorites remove error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error removing favorite',
      error: error.message,
    });
  }
});

// @route   GET /api/user/favorites
// @desc    Get user's favorites list
// @access  Private (User only)
router.get('/favorites', protect, authorize('user'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    return res.status(200).json({
      success: true,
      message: 'Favorites retrieved successfully',
      data: user.favorites,
    });
  } catch (error) {
    console.error('Favorites list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving favorites list',
      error: error.message,
    });
  }
});

module.exports = router;
