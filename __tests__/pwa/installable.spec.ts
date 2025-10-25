import { readFileSync } from "node:fs";
import { join } from "node:path";

const manifestPath = join(process.cwd(), "public", "manifest.json");
const serviceWorkerPath = join(process.cwd(), "public", "sw.js");

describe("PWA manifest", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("declares installable display mode and default locale start URL", () => {
    expect(manifest.display).toBe("standalone");
    expect(typeof manifest.start_url).toBe("string");
    expect(manifest.start_url).toContain("/pl");
  });

  it("exposes required metadata for theme and icons", () => {
    expect(manifest.theme_color).toBe("#0f172a");
    const iconSizes = manifest.icons?.map((icon: { sizes?: string }) => icon?.sizes ?? "") ?? [];
    expect(iconSizes.some((size: string) => size.includes("192"))).toBe(true);
    expect(iconSizes.some((size: string) => size.includes("512"))).toBe(true);
  });
});

describe("Service worker shell caching", () => {
  const swSource = readFileSync(serviceWorkerPath, "utf-8");

  const extractAppShellRoutes = () => {
    const match = swSource.match(/APP_SHELL_ROUTES\s*=\s*\[([^\]]+)\]/);
    if (!match) {
      return [];
    }

    return match[1]
      .split(",")
      .map((token) => token.trim().replace(/^["'`]|["'`]$/g, ""))
      .filter(Boolean);
  };

  it("pre-caches locale entry points for offline shell", () => {
    const routes = extractAppShellRoutes();
    expect(routes).toEqual(expect.arrayContaining(["/", "/pl", "/en"]));
  });

  it("registers a navigation fetch handler", () => {
    expect(swSource).toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(swSource).toMatch(/request\.mode === ["']navigate["']/);
  });
});
