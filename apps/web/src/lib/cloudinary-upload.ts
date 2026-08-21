import { type UploadSignature } from "@repo/contracts";

/**
 * One signed browser upload to Cloudinary.
 *
 * Extracted because there are now three call sites — the CV portrait, the portfolio gallery, and the
 * Portfolio Pro video reel — and two of them had `image/upload` hard-coded in the URL. That was fine
 * while everything was an image and silently wrong the moment video arrived: posting a video to the image
 * endpoint fails with a message that never mentions the resource type.
 *
 * `sig.resourceType` decides the endpoint, and the **server** decides `sig`. A client that picked its own
 * path could write anywhere in the account, which is the one thing the signing flow exists to prevent.
 *
 * ## XHR, not fetch
 *
 * `fetch` still cannot report upload progress in any shipping browser — `ReadableStream` request bodies
 * are Chrome-only and require HTTP/2. A 100MB showreel with no progress bar is indistinguishable from a
 * hung page, so this uses `XMLHttpRequest`, which has had `upload.onprogress` for fifteen years.
 */
export interface CloudinaryUploaded {
  url: string;
  width?: number;
  height?: number;
  /** Videos only. Cloudinary returns it as a float; rounded here. */
  durationSeconds?: number;
}

export function uploadToCloudinary(
  file: File,
  sig: UploadSignature,
  /** Called with 0–1. Fires only while the request is `lengthComputable`. */
  onProgress?: (fraction: number) => void,
): Promise<CloudinaryUploaded> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("folder", sig.folder);
    form.append("signature", sig.signature);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Cloudinary refused the upload (${String(xhr.status)})`));
        return;
      }

      let body: { secure_url?: string; width?: number; height?: number; duration?: number };
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        reject(new Error("Cloudinary returned a response that was not JSON"));
        return;
      }

      // `secure_url`, not `url`: the http variant is mixed content on an https page and gets blocked.
      if (!body.secure_url) {
        reject(new Error("Cloudinary returned no secure_url"));
        return;
      }

      resolve({
        url: body.secure_url,
        ...(body.width ? { width: body.width } : {}),
        ...(body.height ? { height: body.height } : {}),
        ...(body.duration ? { durationSeconds: Math.round(body.duration) } : {}),
      });
    };

    xhr.onerror = () => reject(new Error("The upload could not reach Cloudinary"));
    xhr.onabort = () => reject(new Error("The upload was cancelled"));

    xhr.send(form);
  });
}

/**
 * Fetches a signature through our own proxy.
 *
 * Always through the proxy: the bearer token is in an httpOnly cookie script cannot read, so the
 * authenticated call has to originate server-side.
 */
export async function fetchUploadSignature(
  kind: "image" | "video" = "image",
): Promise<UploadSignature> {
  const response = await fetch(`/api/uploads/signature?kind=${kind}`);
  if (!response.ok) throw new Error(`The signature request failed (${String(response.status)})`);
  return (await response.json()) as UploadSignature;
}
