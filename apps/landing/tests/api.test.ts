import { beforeEach, describe, expect, it, vi } from 'vitest';
import { landingContent, LANDING_SCHEMA_VERSION } from '../src/data/landing';

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => http,
  },
}));

import { fetchLandingContent } from '../src/lib/api';

describe('fetchLandingContent', () => {
  beforeEach(() => {
    http.get.mockReset();
    http.post.mockReset();
  });

  it('falls back to canonical content for an unsupported future schema', async () => {
    http.get.mockResolvedValue({
      data: {
        data: {
          schemaVersion: LANDING_SCHEMA_VERSION + 1,
          navbar: { logo: 'FUTURE CONTENT' },
        },
      },
    });

    await expect(fetchLandingContent()).resolves.toEqual(landingContent);
    expect(http.get).toHaveBeenCalledWith('/api/landing');
  });

  it('falls back to canonical content when the request fails', async () => {
    http.get.mockRejectedValue(new Error('offline'));

    await expect(fetchLandingContent()).resolves.toEqual(landingContent);
  });
});
