import multer from "multer";

// MIME type mappings
const validFileTypes = {
    image: ["image/jpeg", "image/png", "image/gif", "image/jpg", "image/webp", "image/svg+xml"],
    video: ["video/mp4", "video/webm", "video/ogg", "video/avi", "video/mov", "video/quicktime"],
    audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp3", "audio/mp4", "audio/x-m4a"],
    file: [
        "application/pdf",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
};

const storage = multer.memoryStorage();

// ✅ FIXED: Better file type detection
const fileFilter = (req, file, cb) => {
    console.log(`\n=== Multer File Filter ===`);
    console.log(`Field name: ${file.fieldname}`);
    console.log(`MIME type: ${file.mimetype}`);
    console.log(`Original name: ${file.originalname}`);

    const mimetype = file.mimetype.toLowerCase();

    // Check if it's an image
    if (validFileTypes.image.includes(mimetype)) {
        console.log(`✅ Detected as IMAGE`);
        return cb(null, true);
    }

    // Check if it's a video
    if (validFileTypes.video.includes(mimetype)) {
        console.log(`✅ Detected as VIDEO`);
        file.fieldname = "video";
        return cb(null, true);
    }

    // Check if it's audio
    if (validFileTypes.audio.includes(mimetype)) {
        console.log(`✅ Detected as AUDIO`);
        file.fieldname = "audio";
        return cb(null, true);
    }

    // Check if it's a document
    if (validFileTypes.file.includes(mimetype)) {
        console.log(`✅ Detected as FILE/DOCUMENT`);
        file.fieldname = "file";
        return cb(null, true);
    }

    // If no match, reject
    console.log(`❌ File rejected: Unknown type ${mimetype}`);
    return cb(
        new Error(`Invalid file type: ${mimetype}. Only images, videos, audio, and documents are allowed.`),
        false
    );
};

// ✅ FIXED: Single file upload with dynamic field name
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export default upload;
