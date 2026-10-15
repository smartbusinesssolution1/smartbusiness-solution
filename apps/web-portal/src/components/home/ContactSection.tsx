import React, { useState } from 'react';
import { Mail, Lock, CheckCircle2, Phone, User, MessageSquare } from 'lucide-react';
import { useToast } from '../ui/Toast';

export const ContactSection: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    describe: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email) {
      showToast('Please fill in required fields (Full Name and Email)', 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      showToast('Message transmitted securely to our checks specialist!', 'success');
      setFormData({ fullName: '', email: '', phone: '', describe: '' });
      setTimeout(() => setIsSuccess(false), 5000);
    }, 800);
  };

  return (
    <section id="contact-section" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase text-blue-600 bg-blue-50 mb-3.5">
            DEDICATED SUPPORT
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Let's work together
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            All expertise & quality with no hidden charges. Talk directly to a checks consultant.
          </p>
        </div>

        {/* 2-Column Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Image & Official Email Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            
            {/* Consultant Image with badge overlay */}
            <div className="relative rounded-2xl overflow-hidden shadow-xs border border-slate-100 bg-slate-100 h-80 sm:h-96">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80"
                alt="Checks Concierge Consultant"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />

              {/* Bottom pill badge overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-slate-900/90 backdrop-blur-md text-white text-[11px] font-medium px-3.5 py-2 rounded-xl flex items-center gap-2 border border-slate-700/50 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="font-bold text-emerald-300">LIVE CONCIERGE</span>
                  <span className="text-slate-400">|</span>
                  <span className="truncate">Average response time: &lt; 2 minutes during business hours</span>
                </div>
              </div>
            </div>

            {/* Official Email White Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center gap-4 shadow-xs">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  OFFICIAL EMAIL
                </div>
                <a
                  href="mailto:company@gmail.com"
                  className="text-sm sm:text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                >
                  company@gmail.com
                </a>
              </div>
            </div>

          </div>

          {/* Right Column: Contact Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-50/70 border border-slate-100/90 rounded-3xl p-6 sm:p-10 shadow-xs">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">
              Send a message
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-8 leading-relaxed">
              Fill in under 60 seconds if you need to quickly ask about all features, or check out how our platform operates for the best rates.
            </p>

            {isSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Thank you! Your inquiry was received. An executive checks specialist will reach out shortly.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* 3 Fields Row (Full Name, Email, Phone Number) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="company@gmail.com"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 234 567 890"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>

              </div>

              {/* Describe Textarea */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Describe
                </label>
                <textarea
                  rows={4}
                  value={formData.describe}
                  onChange={(e) => setFormData({ ...formData, describe: e.target.value })}
                  placeholder="Tell us about your check printing volume and business requirements..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all resize-none"
                />
              </div>

              {/* Form Footer */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>256-bit SSL encrypted</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-7 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Sending...' : 'Send message'}
                </button>
              </div>

            </form>

          </div>

        </div>

      </div>
    </section>
  );
};
