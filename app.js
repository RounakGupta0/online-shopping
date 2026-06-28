const express = require('express');
const fileUpload = require('express-fileupload');
const dotenv = require('dotenv');

dotenv.config();

const userRouter = require('./routes/user');
const productRouter = require('./routes/product');
const cartRouter = require('./routes/cart');
const orderRouter = require('./routes/order');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 },
    abortOnLimit: true,
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    data: { uptime: process.uptime() },
  });
});

app.use('/user', userRouter);
app.use('/product', productRouter);
app.use('/cart', cartRouter);
app.use('/order', orderRouter);

app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.originalUrl}`,
    error: 'Not Found',
  });
});

app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err);

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected error occurred on the server',
    error: err.name || 'InternalServerError',
  });
});

module.exports = app;
