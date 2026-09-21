import {
  DEFAULT_LANDING_CONTENT,
  LANDING_ICON_NAMES,
  LANDING_SCHEMA_VERSION,
  isLandingSchemaSupported,
  landingSchemaVersionOf,
  normalizeLandingContent,
} from '../../../shared/landing-content';
import type { LandingContent, LandingIconName } from '../../../shared/landing-content';

export {
  DEFAULT_LANDING_CONTENT,
  LANDING_ICON_NAMES,
  LANDING_SCHEMA_VERSION,
  isLandingSchemaSupported,
  landingSchemaVersionOf,
  normalizeLandingContent,
};
export type { LandingContent, LandingIconName };

export class UnsupportedLandingSchemaError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(
      `Landing kontenti v${schemaVersion} sxemada. Bu admin faqat v${LANDING_SCHEMA_VERSION} gacha bo'lgan sxemani tahrirlay oladi.`,
    );
    this.name = 'UnsupportedLandingSchemaError';
    this.schemaVersion = schemaVersion;
  }
}

/**
 * Admin faqat o'zi tushunadigan sxemani tahrirlaydi. Eski/versionless JSON
 * shared normalizer orqali o'qiladi, har bir keyingi save esa kanonik v2 bo'ladi.
 */
export function normalizeEditableLandingContent(value: unknown): LandingContent {
  const schemaVersion = landingSchemaVersionOf(value);
  if (!isLandingSchemaSupported(value)) {
    throw new UnsupportedLandingSchemaError(schemaVersion);
  }

  return {
    ...normalizeLandingContent(value),
    schemaVersion: LANDING_SCHEMA_VERSION,
  };
}

export function createDefaultLandingContent(): LandingContent {
  return normalizeEditableLandingContent(DEFAULT_LANDING_CONTENT);
}
