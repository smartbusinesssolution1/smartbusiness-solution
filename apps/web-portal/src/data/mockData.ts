import { PricingPlan, FaqItem, Testimonial } from '../types';

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter Business',
    tagline: 'Ideal for local businesses, solo proprietors, and small clinics.',
    monthlyPrice: 19,
    annualPrice: 15,
    features: [
      'Up to 100 printed & mailed checks / mo',
      'High-resolution magnetic MICR encoding',
      'Tamper-evident security check paper',
      'Direct bank account verification',
      'Standard USPS First-Class dispatch',
      'Basic employee clock in / clock out (up to 5 staff)'
    ],
    ctaText: 'Get Started Free',
    ctaVariant: 'outline'
  },
  {
    id: 'pro',
    name: 'Professional Scaled',
    tagline: 'Engineered for growing businesses, accounting firms, and regional teams.',
    monthlyPrice: 49,
    annualPrice: 39,
    popular: true,
    badge: 'Most Popular',
    features: [
      'Up to 1,000 printed checks / mo',
      'Batch check printing & automated digital e-signatures',
      'Same-day FedEx & USPS expedited mailing dispatch',
      'Geofenced Clock In Clock Out shifts for unlimited staff',
      'Instant payroll sync (QuickBooks, Gusto, ADP)',
      'Check 21 & Federal Reserve clearing compliance',
      'Priority 24/7 dedicated telephone & chat help',
      'Complete audit trail & encrypted PDF exports'
    ],
    ctaText: 'Start 30-Day Free Trial',
    ctaVariant: 'primary'
  },
  {
    id: 'enterprise',
    name: 'Enterprise Corporate',
    tagline: 'Custom high-volume check disbursements, multi-entity payroll, and governance.',
    monthlyPrice: 149,
    annualPrice: 119,
    features: [
      'Unlimited checks & custom bulk rate discounts',
      'Dedicated high-speed secure printing mailkit queues',
      'Multi-entity bank account routing & sub-ledgers',
      'Custom watermark & corporate check stock branding',
      'Enterprise SSO (SAML 2.0, Okta, Azure AD)',
      'Dedicated Checks Concierge Architect',
      'Custom invoice billing & master service contract',
      '99.99% clearing SLA guarantee'
    ],
    ctaText: 'Talk to Checks Consultant',
    ctaVariant: 'secondary'
  }
];

export const COMPARISON_FEATURES = [
  {
    category: 'Check Fulfillment & MICR Standards',
    items: [
      { name: 'Monthly Check Allowance', starter: '100 Checks', pro: '1,000 Checks', enterprise: 'Unlimited Custom' },
      { name: 'Federal Reserve MICR Magnetic Ink', starter: true, pro: true, enterprise: true },
      { name: 'Tamper-Proof Holographic Check Paper', starter: true, pro: true, enterprise: true },
      { name: 'Batch Check Printing & E-Signatures', starter: false, pro: true, enterprise: true },
      { name: 'Same-Day FedEx Dispatch Directly to Vendors', starter: false, pro: true, enterprise: true }
    ]
  },
  {
    category: 'Time Tracking & Payroll Integration',
    items: [
      { name: 'Clock In Clock Out Digital Attendance', starter: 'Up to 5 staff', pro: 'Unlimited staff', enterprise: 'Unlimited staff' },
      { name: 'Geofenced GPS Shift Auditing', starter: false, pro: true, enterprise: true },
      { name: '1-Click Payroll Sync (Gusto, QuickBooks, ADP)', starter: false, pro: true, enterprise: true },
      { name: 'Overtime & Automated Shift Alerts', starter: false, pro: true, enterprise: true }
    ]
  },
  {
    category: 'Security, Compliance & Support',
    items: [
      { name: 'Check 21 Federal Reserve Standards', starter: true, pro: true, enterprise: true },
      { name: '256-Bit SSL Bank-Grade Encryption', starter: true, pro: true, enterprise: true },
      { name: 'Encrypted PDF Archive & Certified Logs', starter: '30 Days', pro: '3 Years', enterprise: 'Perpetual Archive' },
      { name: '24/7 Dedicated Checks Concierge', starter: 'Email Support', pro: 'Priority Live Chat', enterprise: 'Dedicated Account Manager' },
      { name: 'Single Sign-On (SAML / Okta)', starter: false, pro: false, enterprise: true }
    ]
  }
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'general',
    question: 'What is SmartBusiness Solutions and how does check printing work?',
    answer: 'SmartBusiness Solutions is an all-in-one check automation and employee attendance platform. You can design, authorize, and batch print bank-compliant checks with magnetic MICR encoding, and have them automatically sealed and mailed same-day via FedEx or USPS directly to your payees.'
  },
  {
    id: 'faq-2',
    category: 'general',
    question: 'How does the Clock In Clock Out core service work?',
    answer: 'Our Clock In Clock Out attendance solution allows your employees to log shifts using mobile GPS geofencing or dedicated tablet kiosks. It automatically detects late check-ins, tracks breaks, and exports certified timecard data straight into your payroll provider.'
  },
  {
    id: 'faq-3',
    category: 'billing',
    question: 'Can I change or cancel my plan at any time?',
    answer: 'Yes! You can upgrade, downgrade, or cancel your plan at any time from your account dashboard. Unused pre-purchased check credits roll over to the next month on annual subscriptions.'
  },
  {
    id: 'faq-4',
    category: 'billing',
    question: 'Are there hidden postage or dispatch fees?',
    answer: 'None! All postage, envelope stuffing, and standard USPS mailing costs are transparently detailed before you authorize printing. Expedited FedEx overnight options are calculated at live discounted commercial rates.'
  },
  {
    id: 'faq-5',
    category: 'security',
    question: 'Are printed checks compliant with Federal Reserve and Check 21 rules?',
    answer: 'Yes, 100%. Every single check printed meets strict ANSI X9 Federal Reserve specifications and Check 21 guidelines, using magnetic MICR ink toner and tamper-resistant security check paper with artificial watermarks, microprint lines, and erasure protection.'
  },
  {
    id: 'faq-6',
    category: 'security',
    question: 'How do you protect sensitive banking credentials and routing numbers?',
    answer: 'SmartBusiness Solutions uses bank-grade 256-bit SSL encryption and tokenized bank linkages. We do not store raw account passwords, and all check records include cryptographic signatures and immutable audit trails.'
  },
  {
    id: 'faq-7',
    category: 'integrations',
    question: 'Which accounting software can SmartBusiness sync with?',
    answer: 'We provide direct one-click integrations with QuickBooks Online & Desktop, Xero, Gusto, ADP, NetSuite, Sage, and Excel/CSV batch import/export.'
  },
  {
    id: 'faq-8',
    category: 'integrations',
    question: 'Can we upload custom digital signatures and company logos?',
    answer: 'Yes, our check designer supports high-resolution monochrome and color logos, dual authorized digital signature lines, custom memo fields, and invoice pay-stub attachments.'
  }
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    quote: 'SmartBusiness Solutions transformed our vendor disbursements. We batch print 400+ checks every Friday and they are mailed same-day without our accounting team touching an envelope.',
    author: 'David Vance',
    role: 'Controller',
    company: 'Apex Supply Chain Group',
    metrics: 'Saved $4,200/yr in check postage',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 't-2',
    quote: 'The combination of check printing and Clock In Clock Out attendance means our bi-weekly payroll runs take 15 minutes instead of two full days.',
    author: 'Sarah Lin',
    role: 'Operations Director',
    company: 'Metropolitan Medical Clinics',
    metrics: '99.9% Attendance Accuracy',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 't-3',
    quote: 'Check 21 and Federal Reserve MICR compliance gave our bank zero clearing issues. The 24/7 dedicated support team is unmatched.',
    author: 'Elena Rostova',
    role: 'Chief Financial Officer',
    company: 'Harbor Commercial Trust',
    metrics: '100% On-time vendor settlements',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'
  }
];
