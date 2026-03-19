import type { MediaAsset } from "./types";

/**
 * Interleaves videos and images so that they alternate:
 * video, image, video, image, ...
 * When one type runs out, the remaining items from the other type are appended.
 */
export function interleaveMedia(assets: MediaAsset[]): MediaAsset[] {
  const videos = assets.filter((a) => a.type === "video");
  const images = assets.filter((a) => a.type === "image");

  if (videos.length === 0 || images.length === 0) return assets;

  const result: MediaAsset[] = [];
  const maxLen = Math.max(videos.length, images.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < videos.length) result.push(videos[i]);
    if (i < images.length) result.push(images[i]);
  }

  return result;
}
