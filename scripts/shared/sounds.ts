import { spawn } from "node:child_process";

/**
 * Play system completion sound
 *
 * @remarks
 * Uses macOS afplay to play system sound. Falls back to terminal bell on other platforms.
 *
 * @param success - Whether all scenarios succeeded
 *
 * @public
 */
export const playCompletionSound = async (success: boolean): Promise<void> => {
  try {
    if (process.platform === "darwin") {
      // macOS: Use afplay with system sounds
      const sound = success ? "Glass" : "Basso";
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("afplay", [`/System/Library/Sounds/${sound}.aiff`]);
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`afplay exited with code ${code}`));
        });
        proc.on("error", reject);
      });
    } else {
      // Other platforms: Terminal bell
      process.stdout.write("\x07");
    }
  } catch {
    // Ignore errors (sound is optional)
  }
};
