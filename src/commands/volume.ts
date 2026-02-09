import { Command } from "commander";
import { loadConfig } from "../lib/config";
import { ensureTidalWithCDP } from "../services/launcher";
import { evaluate } from "../services/cdp";

export function registerVolumeCommand(program: Command): void {
  program
    .command("volume [level]")
    .description("Get or set volume (0-100)")
    .action(async (level?: string) => {
      const config = loadConfig();
      await ensureTidalWithCDP(config);

      if (level === undefined) {
        // Get current volume from the volume slider
        const vol = await evaluate(
          config,
          `(() => {
            const slider = document.querySelector('input[type="range"][aria-label*="olume"], input[type="range"][data-test*="olume"]');
            if (slider) return slider.value;
            // Fallback: check aria-valuenow on volume-related elements
            const el = document.querySelector('[aria-label*="olume"][role="slider"]');
            if (el) return el.getAttribute('aria-valuenow');
            return null;
          })()`
        );
        if (vol !== null && vol !== undefined) {
          console.log(`🔊 Volume: ${vol}%`);
        } else {
          console.log("⚠ Could not read volume level");
        }
        return;
      }

      const num = parseInt(level, 10);
      if (isNaN(num) || num < 0 || num > 100) {
        console.error("Volume must be 0-100");
        process.exitCode = 1;
        return;
      }

      // Set volume by manipulating the volume slider
      const result = await evaluate(
        config,
        `(() => {
          const slider = document.querySelector('input[type="range"][aria-label*="olume"], input[type="range"][data-test*="olume"]');
          if (!slider) {
            // Try clicking Volume button first to reveal slider
            const volBtn = document.querySelector('button[aria-label="Volume"]');
            if (volBtn) volBtn.click();
            return 'clicked_volume_btn';
          }
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(slider, ${num});
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
            return 'set';
          }
          return 'no_setter';
        })()`
      );

      if (result === "set") {
        console.log(`🔊 Volume: ${num}%`);
      } else {
        console.log(`⚠ Volume control not fully accessible (${result})`);
      }
    });
}
