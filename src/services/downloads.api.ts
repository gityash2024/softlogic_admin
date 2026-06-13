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
  downloadGroups?: Array<{
    title: string;
    badge?: string;
    description?: string;
    artifacts: Array<{
      format: string;
      label: string;
      href: string;
      description?: string;
    }>;
  }>;
}

export type DownloadEnvironmentKey = 'staging' | 'production';

export interface DownloadEnvironment {
  label?: string;
  currentVersion: string;
  releases: DownloadRelease[];
  softlogicAdmin?: {
    url?: string;
    label?: string;
    description?: string;
  };
  api?: {
    apiBaseUrl?: string;
    backendBaseUrl?: string;
  };
}

export interface CurrentDownloadRelease {
  environment: DownloadEnvironmentKey;
  environmentLabel: string;
  release: DownloadRelease;
}

interface SoftlogicReleaseManifest {
  currentVersion: string;
  releases: DownloadRelease[];
  environments?: Partial<Record<DownloadEnvironmentKey, DownloadEnvironment>>;
}

declare global {
  interface Window {
    SOFTLOGIC_RELEASE_MANIFEST?: SoftlogicReleaseManifest;
  }
}

const DEFAULT_MANIFEST_URL =
  'https://softlogicdownloadpage.vercel.app/release-manifest.js';

let manifestPromise: Promise<SoftlogicReleaseManifest> | null = null;
let loadedManifestUrl: string | null = null;

function releaseEnvironment(): DownloadEnvironmentKey {
  const explicit = (
    import.meta.env.VITE_DOWNLOAD_ENV ??
    import.meta.env.VITE_RELEASE_ENV ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase();
  if (explicit === 'production' || explicit === 'staging') {
    return explicit;
  }

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').toString();
  return apiBaseUrl.includes('api.softeractive.com') ? 'production' : 'staging';
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-softlogic-release-manifest="true"]`,
    );
    if (existing) {
      if (window.SOFTLOGIC_RELEASE_MANIFEST && loadedManifestUrl === src) {
        resolve();
      } else {
        existing.remove();
        window.SOFTLOGIC_RELEASE_MANIFEST = undefined;
      }
    }

    const current = document.querySelector<HTMLScriptElement>(
      `script[data-softlogic-release-manifest="true"]`,
    );
    if (current) {
      if (window.SOFTLOGIC_RELEASE_MANIFEST) {
        resolve();
      } else {
        current.addEventListener('load', () => resolve(), { once: true });
        current.addEventListener('error', () => reject(new Error('Unable to load release manifest')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.softlogicReleaseManifest = 'true';
    script.onload = () => {
      loadedManifestUrl = src;
      resolve();
    };
    script.onerror = () => reject(new Error('Unable to load release manifest'));
    document.head.appendChild(script);
  });
}

export const downloadsApi = {
  currentRelease: async (): Promise<CurrentDownloadRelease> => {
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
    const environment = releaseEnvironment();
    const environmentManifest = manifest.environments?.[environment];
    const releases = environmentManifest?.releases ?? manifest.releases;
    const currentVersion = environmentManifest?.currentVersion ?? manifest.currentVersion;
    const release =
      releases.find((item) => item.version === currentVersion) ??
      releases.find((item) => item.version === 'v1.0.19') ??
      releases[0];
    if (!release) {
      throw new Error('No SoftLogic release is available');
    }
    return {
      environment,
      environmentLabel:
        environmentManifest?.label ?? (environment === 'production' ? 'Production' : 'Staging'),
      release,
    };
  },
};
