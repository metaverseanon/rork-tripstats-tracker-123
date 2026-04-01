import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = 'user-images';

function isRemoteUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

function isLocalFileUri(uri: string): boolean {
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

export async function uploadImage(
  localUri: string,
  userId: string,
  type: 'profile' | 'car',
  carId?: string,
): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('[IMAGE_UPLOAD] Supabase not configured, skipping upload');
    return null;
  }

  if (isRemoteUrl(localUri)) {
    console.log('[IMAGE_UPLOAD] Already a remote URL, skipping upload:', localUri.substring(0, 60));
    return localUri;
  }

  if (!isLocalFileUri(localUri)) {
    console.log('[IMAGE_UPLOAD] Not a valid local URI, skipping:', localUri.substring(0, 60));
    return null;
  }

  try {
    const timestamp = Date.now();
    const ext = 'jpg';
    const fileName = type === 'car' && carId
      ? `${userId}/cars/${carId}_${timestamp}.${ext}`
      : `${userId}/${type}_${timestamp}.${ext}`;

    console.log('[IMAGE_UPLOAD] Uploading', type, 'image for user', userId);

    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;
    let uploadResponse: Response;

    if (Platform.OS === 'web') {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const contentType = blob.type || 'image/jpeg';
      uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: blob,
      });
    } else {
      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: `${type}_${timestamp}.${ext}`,
        type: 'image/jpeg',
      } as any);
      uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'x-upsert': 'true',
        },
        body: formData,
      });
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[IMAGE_UPLOAD] Upload failed:', uploadResponse.status, errorText);
      return null;
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
    console.log('[IMAGE_UPLOAD] Upload successful:', publicUrl.substring(0, 80));
    return publicUrl;
  } catch (error) {
    console.error('[IMAGE_UPLOAD] Error uploading image:', error);
    return null;
  }
}

export async function uploadProfilePicture(localUri: string, userId: string): Promise<string | null> {
  return uploadImage(localUri, userId, 'profile');
}

export async function uploadCarPicture(localUri: string, userId: string, carId: string): Promise<string | null> {
  return uploadImage(localUri, userId, 'car', carId);
}

export async function uploadPostImage(localUri: string, userId: string, postId: string): Promise<string | null> {
  console.log('[POST_UPLOAD] === START uploadPostImage ===');
  console.log('[POST_UPLOAD] SUPABASE_URL set:', !!SUPABASE_URL, 'length:', SUPABASE_URL.length);
  console.log('[POST_UPLOAD] SUPABASE_ANON_KEY set:', !!SUPABASE_ANON_KEY, 'length:', SUPABASE_ANON_KEY.length);
  console.log('[POST_UPLOAD] localUri:', localUri?.substring(0, 100));
  console.log('[POST_UPLOAD] userId:', userId, 'postId:', postId);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[POST_UPLOAD] ABORT: Supabase not configured. URL:', SUPABASE_URL, 'KEY length:', SUPABASE_ANON_KEY.length);
    return null;
  }

  if (isRemoteUrl(localUri)) {
    console.log('[POST_UPLOAD] Already remote URL, returning as-is');
    return localUri;
  }

  if (!isLocalFileUri(localUri)) {
    console.error('[POST_UPLOAD] ABORT: Not a valid local URI. Got:', localUri?.substring(0, 100));
    return null;
  }

  try {
    const timestamp = Date.now();
    const fileName = `${userId}/posts/${postId}_${timestamp}.jpg`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;

    console.log('[POST_UPLOAD] Upload URL:', uploadUrl);
    console.log('[POST_UPLOAD] Platform:', Platform.OS);

    let uploadResponse: Response;

    if (Platform.OS === 'web') {
      console.log('[POST_UPLOAD] Web path: fetching local blob...');
      const response = await fetch(localUri);
      const blob = await response.blob();
      console.log('[POST_UPLOAD] Blob size:', blob.size, 'type:', blob.type);
      const contentType = blob.type || 'image/jpeg';
      uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body: blob,
      });
    } else {
      console.log('[POST_UPLOAD] Native path: building FormData...');
      const filePayload = {
        uri: localUri,
        name: `post_${postId}_${timestamp}.jpg`,
        type: 'image/jpeg',
      };
      console.log('[POST_UPLOAD] File payload:', JSON.stringify(filePayload));
      const formData = new FormData();
      formData.append('file', filePayload as any);
      uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'x-upsert': 'true',
        },
        body: formData,
      });
    }

    console.log('[POST_UPLOAD] Response status:', uploadResponse.status);
    console.log('[POST_UPLOAD] Response statusText:', uploadResponse.statusText);
    console.log('[POST_UPLOAD] Response headers:', JSON.stringify(Object.fromEntries(uploadResponse.headers.entries())));

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[POST_UPLOAD] UPLOAD FAILED');
      console.error('[POST_UPLOAD] Status:', uploadResponse.status);
      console.error('[POST_UPLOAD] Error body:', errorText);
      return null;
    }

    const responseBody = await uploadResponse.text();
    console.log('[POST_UPLOAD] Success response body:', responseBody);

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
    console.log('[POST_UPLOAD] Public URL:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    console.error('[POST_UPLOAD] EXCEPTION during upload');
    console.error('[POST_UPLOAD] Error name:', error?.name);
    console.error('[POST_UPLOAD] Error message:', error?.message);
    console.error('[POST_UPLOAD] Error stack:', error?.stack);
    return null;
  }
}
