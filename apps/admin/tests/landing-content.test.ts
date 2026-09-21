import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANDING_CONTENT,
  LANDING_SCHEMA_VERSION,
  isLandingSchemaSupported,
  normalizeLandingContent,
} from '../../shared/landing-content';

describe('normalizeLandingContent', () => {
  it('upgrades V22 card and course fields without losing their text', () => {
    const content = normalizeLandingContent({
      features: [{ title: 'Legacy feature', description: '' }],
      courseInfo: [{ title: 'Legacy course info', description: '' }],
      courses: [{ flag: 'GB', title: 'Legacy course', students: '12', rating: 9 }],
    });

    expect(content.schemaVersion).toBe(LANDING_SCHEMA_VERSION);
    expect(content.features[0]).toMatchObject({
      icon: DEFAULT_LANDING_CONTENT.features[0].icon,
      text: 'Legacy feature',
    });
    expect(content.courseInfo[0].text).toBe('Legacy course info');
    expect(content.courses[0]).toMatchObject({
      id: DEFAULT_LANDING_CONTENT.courses[0].id,
      name: 'Legacy course',
      students: 12,
      rating: 5,
    });
  });

  it('deep-fills partial nested content from defaults', () => {
    const content = normalizeLandingContent({
      navbar: { logo: 'CUSTOM' },
      footer: { company: 'Custom Company' },
    });

    expect(content.navbar.logo).toBe('CUSTOM');
    expect(content.navbar.links).toEqual(DEFAULT_LANDING_CONTENT.navbar.links);
    expect(content.navbar.menuLabel).toBe(DEFAULT_LANDING_CONTENT.navbar.menuLabel);
    expect(content.footer.company).toBe('Custom Company');
    expect(content.footer.contactTitle).toBe(DEFAULT_LANDING_CONTENT.footer.contactTitle);
    expect(content.leadForm.optionalLabel).toBe(DEFAULT_LANDING_CONTENT.leadForm.optionalLabel);
  });

  it('preserves explicitly empty collections', () => {
    const content = normalizeLandingContent({
      features: [],
      courseInfo: [],
      goals: [],
      testimonials: [],
      courses: [],
      bonusBooks: [],
    });

    expect(content.features).toEqual([]);
    expect(content.courseInfo).toEqual([]);
    expect(content.goals).toEqual([]);
    expect(content.testimonials).toEqual([]);
    expect(content.courses).toEqual([]);
    expect(content.bonusBooks).toEqual([]);
  });

  it('rejects future schema versions while accepting legacy content', () => {
    expect(isLandingSchemaSupported({ schemaVersion: LANDING_SCHEMA_VERSION + 1 })).toBe(false);
    expect(isLandingSchemaSupported({})).toBe(true);
  });

  it('drops unsafe executable URLs', () => {
    const content = normalizeLandingContent({
      navbar: { links: [{ label: 'Unsafe', href: 'javascript:alert(1)' }] },
      testimonials: [{ id: 1, name: 'Unsafe', course: 'Test', videoUrl: 'javascript:alert(1)' }],
      courses: [{ id: 'unsafe', name: 'Unsafe', buyUrl: 'javascript:alert(1)' }],
      contacts: {
        telegram: 'javascript:alert(1)',
        instagram: 'javascript:alert(1)',
        youtube: 'javascript:alert(1)',
      },
    });

    expect(content.navbar.links[0].href).toBe(DEFAULT_LANDING_CONTENT.navbar.links[0].href);
    expect(content.testimonials[0].videoUrl).toBeUndefined();
    expect(content.courses[0].buyUrl).toBeUndefined();
    expect(content.contacts).toEqual(DEFAULT_LANDING_CONTENT.contacts);
  });
});
