const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { protect, authorize } = require('../middleware/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

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

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email is already registered',
        error: 'Conflict',
      });
    }

    const phoneExists = await User.findOne({ phoneNumber });
    if (phoneExists) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number is already registered',
        error: 'Conflict',
      });
    }

    const vendorEmail = process.env.VENDOR_EMAIL || 'rounak@gmail.com';
    const role = email.toLowerCase() === vendorEmail.toLowerCase() ? 'vendor' : 'user';

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

router.put('/profile', protect, async (req, res) => {
  try {
    const { name, phoneNumber, email } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'Not Found',
      });
    }

    if (name) user.name = name;

    if (email && String(email).toLowerCase().trim() !== String(user.email).toLowerCase().trim()) {
      const emailExists = await User.findOne({ email: String(email).toLowerCase().trim() });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email is already registered',
          error: 'Conflict',
        });
      }
      user.email = String(email).toLowerCase().trim();
    }

    if (phoneNumber && String(phoneNumber).trim() !== String(user.phoneNumber).trim()) {
      const phoneExists = await User.findOne({ phoneNumber: String(phoneNumber).trim() });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already registered by another user',
          error: 'Conflict',
        });
      }
      user.phoneNumber = String(phoneNumber).trim();
    }

    if (req.files && req.files.profilePic) {
      try {
        const oldProfilePic = user.profilePic;
        const uploadRes = await uploadToCloudinary(
          req.files.profilePic.data,
          'online_shopping/profiles'
        );
        user.profilePic = uploadRes.secure_url;

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

router.delete('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'Not Found',
      });
    }

    if (user.role === 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Vendor accounts cannot be deleted directly to preserve vendor listings',
        error: 'Bad Request',
      });
    }

    if (user.profilePic && !user.profilePic.includes('blank-profile-picture')) {
      try {
        await deleteFromCloudinary(user.profilePic);
      } catch (err) {
        console.error('Error deleting profile image from Cloudinary:', err);
      }
    }

    await Cart.deleteOne({ user: user._id });

    await user.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Your account and associated shopping cart have been deleted successfully',
      data: {},
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error deleting account',
      error: error.message,
    });
  }
});

module.exports = router;
