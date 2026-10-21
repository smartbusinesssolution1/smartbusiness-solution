export interface SiteConfig {
  brandName: string;
  brandSubtitle: string;
  badge: {
    tag: string;
    text: string;
  };
  heroHeadlinePrefix: string;
  heroHeadlineHighlight: string;
  heroHeadlineSuffix: string;
  heroSubheadline: string;
  navLinks: Array<{ label: string; route: 'home' | 'services' | 'pricing' | 'faq' | 'contact' }>;
}

export const SITE_CONFIG: SiteConfig = {
  brandName: 'SmartBusiness',
  brandSubtitle: 'Solutions',
  badge: {
    tag: 'NEW RELEASE',
    text: 'Next-Gen Check Automation Platform',
  },
  heroHeadlinePrefix: 'One Platform to manage',
  heroHeadlineHighlight: 'all your checks',
  heroHeadlineSuffix: 'with precision.',
  heroSubheadline: 'Transform how your business prints, tracks, and reconciles checks. Direct bank integration, instant clearing compliance, and full ledger automation.',
  navLinks: [
    { label: 'Home', route: 'home' },
    { label: 'Services', route: 'services' },
    { label: 'Pricing', route: 'pricing' },
    { label: 'FAQ', route: 'faq' },
    { label: 'Contact us', route: 'contact' },
  ],
};
