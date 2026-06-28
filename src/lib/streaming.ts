/** Target live camera stream rate (JPEG relay + detection UI polling). */
export const FRAME_RELAY_FPS = 10;

export const FRAME_RELAY_INTERVAL_MS = Math.round(1000 / FRAME_RELAY_FPS);
