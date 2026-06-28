const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (fileBuffer, folder = 'online_shopping') => {
  return new Promise((resolve, reject) => {
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

const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') return null;

  if (
    imageUrl.includes('pixabay.com') ||
    !imageUrl.includes('cloudinary.com')
  ) {
    return null;
  }

  try {
    const parts = imageUrl.split('/upload/');
    if (parts.length < 2) return null;

    const pathAfterUpload = parts[1];
    const pathParts = pathAfterUpload.split('/');

    if (pathParts[0] && /^v\d+$/.test(pathParts[0])) {
      pathParts.shift();
    }

    const publicIdWithExtension = pathParts.join('/');
    const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.'));

    console.log(`Attempting to delete asset from Cloudinary: ${publicId}`);

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
