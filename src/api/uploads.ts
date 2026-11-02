import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';

import { ApiError, apiRequest } from './client';
import { DEFAULT_FULFILLMENT } from './config';

/**
 * Customer photo upload for a Prodigi order — three steps:
 *   1. POST /v1/uploads         → a presigned S3 PUT + the durable `assetUrl`.
 *   2. PUT the bytes to S3       → app → S3 directly (never touches our API).
 *   3. POST /v1/uploads/confirm  → HEADs the object so a failed upload fails now.
 *
 * The `key` from step 1 is what the order carries as each item's `uploadKey`.
 * Both POSTs are behind the Prodigi fulfilment guard, so each sends
 * `fulfillmentType` in its body.
 */

/** Content types the API's S3 upload accepts (see the API's ALLOWED_CONTENT_TYPES). */
export type UploadContentType = 'image/jpeg' | 'image/png';

type UploadTarget = {
  key: string;
  /** Presigned S3 PUT — the app sends the bytes here directly. */
  uploadUrl: string;
  /** Durable public URL handed to Prodigi on the order. */
  assetUrl: string;
  expiresIn: number;
  contentType: string;
};

/** Step 1 — reserve an S3 key + presigned PUT for one photo. */
async function createUploadTarget(
  sku: string,
  contentType: UploadContentType,
): Promise<UploadTarget> {
  return apiRequest<UploadTarget>('/uploads', {
    method: 'POST',
    body: { fulfillmentType: DEFAULT_FULFILLMENT, sku, contentType },
  });
}

/** Step 3 — confirm the object actually landed in S3. */
async function confirmUpload(key: string): Promise<void> {
  await apiRequest('/uploads/confirm', {
    method: 'POST',
    body: { fulfillmentType: DEFAULT_FULFILLMENT, key },
  });
}

/**
 * Upload one local photo (`file://` URI) for a SKU and return its upload `key` —
 * the value the order sends as the item's `uploadKey`. Throws `ApiError` if any
 * step fails.
 */
export async function uploadPrintPhoto(
  uri: string,
  sku: string,
  contentType: UploadContentType = 'image/jpeg',
): Promise<string> {
  const target = await createUploadTarget(sku, contentType);

  // Step 2: the bytes go straight to S3 via the presigned PUT. BINARY_CONTENT
  // sends the raw file (not multipart), and the Content-Type must match what the
  // URL was signed for or S3 rejects it.
  const result = await uploadAsync(target.uploadUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      'UPLOAD_FAILED',
      'Your photo could not be uploaded. Please try again.',
      result.status,
    );
  }

  await confirmUpload(target.key);
  return target.key;
}
