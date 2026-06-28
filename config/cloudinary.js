const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer to Cloudinary using upload_stream.
 * @param {Buffer} fileBuffer - The file buffer from req.files.file.data
 * @param {string} folder - Destination folder on Cloudinary
 * @returns {Promise<object>} - Resolves with Cloudinary API response containing secure_url
 */
const uploadToCloudinary = (fileBuffer, folder = 'online_shopping') => {
  return new Promise((resolve, reject) => {
    // If credentials are not configured, log a warning and return mock data for testing
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name'
    ) {
      console.warn('WARNING: Cloudinary credentials not configured. Returning mock image URL.');
      return resolve({
        secure_url: 'https://cdn.pixabay.com/photo/2016/03/21/20/05/image-1271454_1280.png',
        public_id: 'mock_image_id',
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Deletes an image from Cloudinary using its secure URL.
 * Extracts the public ID from the URL and calls cloudinary.uploader.destroy.
 * @param {string} imageUrl - The secure URL of the image
 * @returns {Promise<object|null>} - Resolves with Cloudinary API response or null
 */
const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  // Avoid trying to delete default/placeholder image or non-cloudinary image
  if (
    imageUrl.includes('pixabay.com') ||
    !imageUrl.includes('cloudinary.com')
  ) {
    return null;
  }

  try {
    // Extract public_id from Cloudinary URL
    // Format: https://res.cloudinary.com/<cloud_name>/image/upload/<version_or_folder>/.../<public_id>.<ext>
    const parts = imageUrl.split('/upload/');
    if (parts.length < 2) return null;

    const pathAfterUpload = parts[1]; // e.g. "v1620000000/online_shopping/products/prod_abc123.jpg" or "online_shopping/products/prod_abc123.jpg"
    const pathParts = pathAfterUpload.split('/');
    
    // Remove version parameter if present (starts with 'v' followed by digits)
    if (pathParts[0] && /^v\d+$/.test(pathParts[0])) {
      pathParts.shift();
    }

    const publicIdWithExtension = pathParts.join('/'); // e.g. "online_shopping/products/prod_abc123.jpg"
    const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.')); // e.g. "online_shopping/products/prod_abc123"

    console.log(`Attempting to delete asset from Cloudinary: ${publicId}`);

    // If credentials are mock, don't make real network call
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.CLOUDINARY_CLOUD_NAME === 'your_cloud_name'
    ) {
      console.warn('Cloudinary credentials not set. Simulating deletion.');
      return { result: 'ok' };
    }

    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`Cloudinary deletion result for ${publicId}:`, result);
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};
