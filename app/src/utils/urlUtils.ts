const videoUrlRegex = /\.(mp4|mov|webm|ogg)(\?|$)/i;

export function isVideoUrl(url: string): boolean {
  return videoUrlRegex.test(url);
}
