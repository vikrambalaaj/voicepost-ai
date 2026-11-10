/**
 * Pick a MediaRecorder container the current browser can actually record.
 * iOS Safari only supports audio/mp4 (not webm); Chrome/Firefox prefer webm/opus.
 * Returns undefined to let the browser choose its default.
 */
export function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function createRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = pickAudioMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
