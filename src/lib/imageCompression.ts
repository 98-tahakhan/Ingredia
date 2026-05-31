/**
 * Image compression utility for OCR uploads.
 *
 * Compresses and resizes images on the frontend BEFORE upload to:
 * - Reduce upload size below 1MB (OCR.Space free tier limit)
 * - Maintain OCR readability
 * - Optimize for mobile-first low-latency uploads
 */

const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.7;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Compress an image file for OCR upload.
 * - Resizes to max 1280px width (preserves aspect ratio)
 * - Converts to JPEG at 0.7 quality
 * - Ensures output is below 1MB
 *
 * @param file - Original image file from camera/input
 * @returns Compressed File ready for upload
 */
export async function compressImageForOCR(file: File): Promise<File> {
    // If already small enough and is JPEG, skip compression
    if (file.size <= MAX_FILE_SIZE && file.type === "image/jpeg") {
        return file;
    }

    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Calculate new dimensions (max width 1280, preserve aspect ratio)
    let newWidth = width;
    let newHeight = height;
    if (width > MAX_WIDTH) {
        const ratio = MAX_WIDTH / width;
        newWidth = MAX_WIDTH;
        newHeight = Math.round(height * ratio);
    }

    // Draw to canvas
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Failed to create canvas context for image compression");
    }
    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    // Convert to JPEG blob with target quality
    let quality = JPEG_QUALITY;
    let blob = await canvas.convertToBlob({ type: "image/jpeg", quality });

    // If still too large, reduce quality iteratively
    while (blob.size > MAX_FILE_SIZE && quality > 0.3) {
        quality -= 0.1;
        blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    }

    // Return as File object (preserves FormData compatibility)
    const compressedFile = new File([blob], "ingredient-label.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
    });

    return compressedFile;
}
