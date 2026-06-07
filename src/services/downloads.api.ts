export interface DownloadArtifact {
  platform: string;
  format: string;
  label: string;
  href: string;
  description: string;
}

export interface DownloadRelease {
  version: string;
  appVersion?: string;
  build?: string;
  status?: string;
  releaseType?: string;
  releaseDate?: string;
  title?: string;
  summary?: string;
  artifacts: DownloadArtifact[];
}

interface SoftlogicReleaseManifest {
  currentVersion: string;
  releases: DownloadRelease[];
}

declare global {
  interface Window {
    SOFTLOGIC_RELEASE_MANIFEST?: SoftlogicReleaseManifest;
  }
}

const DEFAULT_MANIFEST_URL =
  'https://softlogicdownloadpage.vercel.app/release-manifest.js';

let manifestPromise: Promise<SoftlogicReleaseManifest> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-softlogic-release-manifest="true"]`,
    );
    if (existing) {
      if (window.SOFTLOGIC_RELEASE_MANIFEST) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Unable to load release manifest')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.softlogicReleaseManifest = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load release manifest'));
    document.head.appendChild(script);
  });
}

export const downloadsApi = {
  currentRelease: async () => {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        const manifestUrl =
          import.meta.env.VITE_DOWNLOAD_MANIFEST_URL ?? DEFAULT_MANIFEST_URL;
        await loadScript(manifestUrl);
        const manifest = window.SOFTLOGIC_RELEASE_MANIFEST;
        if (!manifest) {
          throw new Error('Release manifest did not initialize');
        }
        return manifest;
      })();
    }

    const manifest = await manifestPromise;
    const release =
      manifest.releases.find((item) => item.version === manifest.currentVersion) ??
      manifest.releases.find((item) => item.version === 'v1.0.17') ??
      manifest.releases[0];
    if (!release) {
      throw new Error('No SoftLogic release is available');
    }
    return release;
  },
};
