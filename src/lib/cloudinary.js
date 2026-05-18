import { v2 as cloudinary } from 'cloudinary';
import { getApiKey } from '@/lib/config';

cloudinary.config({
  cloud_name: getApiKey('CLOUDINARY_CLOUD_NAME'),
  api_key: getApiKey('CLOUDINARY_API_KEY'),
  api_secret: getApiKey('CLOUDINARY_API_SECRET'),
});

/**
 * Upload a file buffer to Cloudinary under the job-hunt-resumes folder.
 * @param {Buffer} buffer - File buffer
 * @param {string} publicId - Desired public ID (filename without extension)
 * @param {string} resourceType - 'raw' for PDFs/JSON, 'image' for images
 */
export async function uploadToCloudinary(buffer, publicId, resourceType = 'raw') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'job-hunt-resumes',
        public_id: publicId,
        resource_type: resourceType,
        overwrite: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
}

/**
 * Upload a JSON object as a raw file to Cloudinary
 */
export async function uploadJsonToCloudinary(jsonObj, publicId) {
  const buffer = Buffer.from(JSON.stringify(jsonObj, null, 2));
  return uploadToCloudinary(buffer, publicId, 'raw');
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(publicId, resourceType = 'raw') {
  return cloudinary.uploader.destroy(`job-hunt-resumes/${publicId}`, {
    resource_type: resourceType,
  });
}

/**
 * List all files in the job-hunt-resumes folder
 */
export async function listCloudinaryResumes() {
  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'job-hunt-resumes/',
    resource_type: 'raw',
    max_results: 100,
  });
  return result.resources;
}
