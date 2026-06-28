# Online Shopping API

A robust backend REST API for an online shopping platform, built with Node.js, Express.js, MongoDB (Mongoose), and Cloudinary. The system implements user authentication (JWT-based) with role-based access control (RBAC) supporting **Users** (customers) and **Vendors** (sellers).

---

## 🚀 Features

- **Authentication & Authorization**:
  - JWT token verification and role-based permissions (`user` and `vendor`).
  - Automated role assignment: Users with the `VENDOR_EMAIL` configured in the `.env` automatically register with the `vendor` role; others register as standard `user`s.
  - Password encryption using `bcryptjs`.
  - Profile image uploads via Cloudinary.
- **Product Management**:
  - Full CRUD operations for products (restricted to vendors).
  - Multi-image uploads (1 to 5 images) uploaded directly to Cloudinary.
  - Category, name, and description searching.
  - Stock tracking (e.g., auto-updates stock on order creation, stock warnings/alerts).
- **Cart Management**:
  - Add, update, and remove products in the shopping cart.
  - Validates requested quantity against current product stock.
- **Order Processing**:
  - Place orders with payment confirmation uploads (payment screenshot required).
  - Transaction-safe inventory subtraction (checks and reserves stock, rolls back stock if screenshot upload fails).
  - Order history tracking for customers and global order status tracking for vendors.
  - Update order status (`pending` -> `inprocess` -> `yet to deliver` -> `delivered`).
- **Favorites / Wishlist**:
  - Customers can mark products as favorites, list favorites, and remove favorites.

---

## 🛠️ Architecture & Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose ODM)
- **File Upload Service**: Cloudinary (via `express-fileupload`)
- **Security**: JWT & BcryptJS

---

## 📁 Project Directory Structure

```text
online-shopping/
├── config/                  # Database & external service configurations
│   ├── db.js                # MongoDB connection helper
│   └── cloudinary.js        # Cloudinary setup & upload/delete helper functions
├── middleware/              # Express middlewares
│   └── auth.js              # Protect route & role check middlewares
├── models/                  # Mongoose schemas & models
│   ├── User.js              # User schema, password hashing & validation
│   ├── Product.js           # Product schema & virtual fields
│   ├── Cart.js              # Shopping Cart schema
│   └── Order.js             # Order schema & tracking
├── routes/                  # Express controllers & routing definitions
│   ├── user.js              # Auth & profile routes
│   ├── product.js           # Product CRUD & stock alert routes
│   ├── cart.js              # Add to cart & view cart routes
│   └── order.js             # Order placing & status update routes
├── app.js                   # Middleware mounting & express setup
├── server.js                # Server entry point
├── .env                     # Environment variables configuration (ignored by git)
└── package.json             # NPM dependencies & scripts
```

---

## ⚙️ Setup & Installation

### 1. Clone the repository and navigate to the project directory:
```bash
git clone <repository_url>
cd online-shopping
```

### 2. Install dependencies:
```bash
npm install
```

### 3. Setup Environment Variables:
Create a `.env` file in the root directory and define the following variables:

```ini
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
JWT_SECRET=your_jwt_secret_key_here
VENDOR_EMAIL=vendor@example.com

# Cloudinary Credentials (For image uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```
> **Note**: If Cloudinary credentials are not configured or are set to placeholder values, the API will output a fallback warning and use placeholder image URLs automatically.

### 4. Running the application:
- **Development mode** (runs with nodemon):
  ```bash
  npm run start
  ```
- **Production/Normal mode**:
  ```bash
  npm run dev
  ```

---

## 📡 API Reference

### Health Check
- **GET** `/health` - Service health status.

### Authentication & Profiles (`/user`)
| Method | Endpoint | Auth Required | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/user/register` | No | Any | Register a new user. Registers as a `vendor` if email matches `VENDOR_EMAIL` |
| **POST** | `/user/login` | No | Any | Authenticate user and return a JWT |
| **GET** | `/user/profile` | Yes | Any | Retrieve authenticated user profile |
| **PUT** | `/user/profile` | Yes | Any | Update name, email, or phone number (checks for duplicate conflicts) |
| **GET** | `/user/favorites` | Yes | `user` | List current user's favorited products |
| **POST** | `/user/favorites/:productId` | Yes | `user` | Add a product to favorites |
| **DELETE** | `/user/favorites/:productId` | Yes | `user` | Remove a product from favorites |

### Products (`/product`)
| Method | Endpoint | Auth Required | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/product` | No | Any | List all products (supports `?search=query` search parameter) |
| **GET** | `/product/:id` | No | Any | Get details of a single product |
| **GET** | `/product/stock-alerts` | Yes | `vendor` | Get products with stock issues (`?type=out-of-stock` or `?type=low-stock`) |
| **POST** | `/product` | Yes | `vendor` | Create a new product (expects form-data with files in `images`) |
| **PUT** | `/product/:id` | Yes | `vendor` | Update product details (name, price, stock, category, images) |
| **PATCH** | `/product/:id/images` | Yes | `vendor` | Update product image list (delete specific images or add new ones) |
| **DELETE** | `/product/:id` | Yes | `vendor` | Delete product (clears from wishlists, active carts, and deletes images from Cloudinary) |

### Shopping Cart (`/cart`)
| Method | Endpoint | Auth Required | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **GET** | `/cart` | Yes | `user` | Retrieve active cart details |
| **POST** | `/cart` | Yes | `user` | Add/update item quantity (body: `productId`, `quantity`) |
| **DELETE** | `/cart/:productId` | Yes | `user` | Delete product item from cart |
| **DELETE** | `/cart` | Yes | `user` | Clear all items from the cart |

### Orders (`/order`)
| Method | Endpoint | Auth Required | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/order` | Yes | `user` | Place order (expects form-data containing payment `screenshot` file) |
| **GET** | `/order/my-orders` | Yes | `user` | Retrieve history of orders placed by current user |
| **GET** | `/order/vendor-orders` | Yes | `vendor` | View orders list as a vendor (supports `?status=pending` filter) |
| **PUT** | `/order/:id/status` | Yes | `vendor` | Update order delivery status (body: `status`) |
