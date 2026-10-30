import React, { useState } from 'react';
import { FAQ_ITEMS } from '../../data/mockData';
import { Search, ChevronDown, MessageSquare, HelpCircle, ArrowRight } from 'lucide-react';

interface FaqSectionProps {
  onOpenChat: () => void;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ onOpenChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>('faq-1');

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'general', label: 'General & Architecture' },
    { id: 'billing', label: 'Billing & Plans' },
    { id: 'security', label: 'Security & Compliance' },
    { id: 'integrations', label: 'API & Integrations' }
  ];

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesQuery =
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const toggleAccordion = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-slate-50 via-white to-slate-50 min-h-[70vh]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Help & Knowledge Base
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight text-balance">
            Frequently Asked Questions
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Everything you need to know about setting up, deploying, and scaling your automated workflows with NovaFlow.
          </p>

          {/* Search Bar */}
           <div className="pt-4 max-w-xl mx-auto">
            <div className="relative flex items-center">
              <div className="absolute left-3.5 flex items-center justify-center pointer-events-none text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions by topic or keyword (e.g. trial, SOC2, webhook)..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all flex items-center"
              />
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3.5 pt-4">
          {filteredFaqs.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-base font-semibold text-slate-900">No matching questions found</h3>
              <p className="text-sm text-slate-500">
                Try searching for different terms or chat directly with our AI support engineer.
              </p>
              <button
                onClick={onOpenChat}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ask our Assistant</span>
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                    isExpanded
                      ? 'bg-white border-indigo-200 shadow-sm'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full py-4.5 px-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-base font-semibold text-slate-900 leading-snug">
                      {faq.question}
                    </span>
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'bg-indigo-50 text-indigo-600 rotate-180' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 text-sm text-slate-600 leading-relaxed border-t border-slate-100 animate-in fade-in duration-150">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Still Have Questions Card */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-indigo-900 shadow-lg">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-white">Still have technical or licensing questions?</h3>
            <p className="text-xs sm:text-sm text-indigo-200">
              Our engineering architecture team is available 24/7 to review your infrastructure requirements.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenChat}
              className="px-4.5 py-2.5 text-xs font-semibold text-indigo-950 bg-white hover:bg-slate-100 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>Open Live Assistant</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
