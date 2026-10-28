export type PageRoute = 'home' | 'services' | 'pricing' | 'faq' | 'contact' | 'signin' | 'account';

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  badge?: string;
  features: string[];
  ctaText: string;
  ctaVariant: 'primary' | 'secondary' | 'outline';
}

export interface FaqItem {
  id: string;
  category: 'general' | 'billing' | 'security' | 'integrations';
  question: string;
  answer: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  role: string;
  company: string;
  metrics: string;
  avatarUrl: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}
