// Firebase Storage helpers for case study logos
// Uses Admin SDK for server-side operations

import 'server-only';

import { getStorage } from "firebase-admin/storage";

// Import to ensure Firebase Admin is initialized
import './firestore-admin';

// Get the storage bucket - use explicit bucket name from env
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

function getBucket() {
  if (!storageBucket) {
    throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET environment variable is not set');
  }
  // Use the bucket name directly
  return getStorage().bucket(storageBucket);
}

/**
 * Upload a case study logo to Firebase Storage
 * @param caseStudyId - The ID of the case study
 * @param fileBuffer - The file content as a Buffer
 * @param mimeType - The MIME type of the file (e.g., 'image/svg+xml')
 * @returns The public URL of the uploaded file
 */
export async function uploadCaseStudyLogo(
  caseStudyId: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const bucket = getBucket();
  const extension = mimeType === 'image/svg+xml' ? 'svg' : 'png';
  const filePath = `case-study-logos/${caseStudyId}.${extension}`;

  const file = bucket.file(filePath);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    },
  });

  // Make the file publicly accessible
  await file.makePublic();

  // Return the public URL
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

/**
 * Delete a case study logo from Firebase Storage
 * @param caseStudyId - The ID of the case study
 */
export async function deleteCaseStudyLogo(caseStudyId: string): Promise<void> {
  const bucket = getBucket();
  // Try to delete both SVG and PNG versions
  const svgFile = bucket.file(`case-study-logos/${caseStudyId}.svg`);
  const pngFile = bucket.file(`case-study-logos/${caseStudyId}.png`);

  try {
    const [svgExists] = await svgFile.exists();
    if (svgExists) {
      await svgFile.delete();
    }
  } catch (error) {
    console.error(`Failed to delete SVG logo for ${caseStudyId}:`, error);
  }

  try {
    const [pngExists] = await pngFile.exists();
    if (pngExists) {
      await pngFile.delete();
    }
  } catch (error) {
    console.error(`Failed to delete PNG logo for ${caseStudyId}:`, error);
  }
}
