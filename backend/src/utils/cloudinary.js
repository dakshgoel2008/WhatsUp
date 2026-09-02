import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import streamifier from "streamifier";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUDNAME,
    api_key: process.env.CLOUDINARY_APIKEY,
    api_secret: process.env.CLOUDINARY_APISECRET,
});

const uploadOnCloudinary = (fileInput, options = {}) => {
    return new Promise((resolve, reject) => {
        // Mock Cloudinary if dummy credentials are provided, useful for local testing
        if (!process.env.CLOUDINARY_APIKEY || process.env.CLOUDINARY_APIKEY === "your_cloudinary_api_key") {
            console.log("Mock Cloudinary upload for local testing (dummy credentials detected)");
            return resolve({ secure_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` });
        }

        const isBuffer = Buffer.isBuffer(fileInput);

        const uploadOptions = {
            resource_type: "auto",
            ...options,
        };

        const handleUpload = (error, result) => {
            if (error) {
                console.error("Error uploading file to Cloudinary", error);
                if (!isBuffer && typeof fileInput === "string" && fs.existsSync(fileInput)) {
                    try {
                        fs.unlinkSync(fileInput);
                    } catch (e) {
                        console.error("Error deleting local file after failed upload:", e);
                    }
                }
                return reject({ error: error.message });
            }
            console.log("File uploaded successfully to Cloudinary:", result.secure_url);
            if (!isBuffer && typeof fileInput === "string" && fs.existsSync(fileInput)) {
                try {
                    fs.unlinkSync(fileInput);
                } catch (e) {
                    console.error("Error deleting local file after successful upload:", e);
                }
            }
            resolve(result);
        };

        if (isBuffer) {
            const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, handleUpload);
            streamifier.createReadStream(fileInput).pipe(uploadStream);
        } else if (typeof fileInput === "string") {
            cloudinary.uploader.upload(fileInput, uploadOptions, handleUpload);
        } else {
            console.error("Invalid input provided to uploadOnCloudinary:", fileInput);
            reject({ error: "Invalid file input for upload." });
        }
    });
};

// Helper function to determine resource type based on MIME type
export const getResourceType = (mimeType) => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "video"; // Cloudinary treats audio as video
    // For documents and other files
    return "raw";
};

// Enhanced upload function that automatically determines resource type
export const smartUploadOnCloudinary = async (filePath, mimeType, options = {}) => {
    const resourceType = getResourceType(mimeType);
    return await uploadOnCloudinary(filePath, {
        resource_type: resourceType,
        ...options,
    });
};

export const uploadDefaultGoogleImageOnCloudinary = async (imageUrl) => {
    try {
        const res = await cloudinary.uploader.upload(imageUrl, {
            resource_type: "image",
            public_id: "default_google_image",
            overwrite: true,
        });
        console.log("Google profile image uploaded:", res.secure_url);
        return res;
    } catch (err) {
        console.error("Error uploading default Google image to Cloudinary", err);
        return null;
    }
};

export default uploadOnCloudinary;
