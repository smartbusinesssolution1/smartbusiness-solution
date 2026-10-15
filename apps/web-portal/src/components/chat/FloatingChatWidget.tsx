import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, RotateCcw, ChevronDown, Check, ArrowRight, ShieldCheck, Printer } from 'lucide-react';
import { ChatMessage } from '../../types';
import { SmartBusinessLogo } from '../common/SmartBusinessLogo';

interface FloatingChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigatePricing: () => void;
}

export const FloatingChatWidget: React.FC<FloatingChatWidgetProps> = ({
  isOpen,
  onToggle,
  onNavigatePricing
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Hello! Welcome to SmartBusiness Solutions. How can I help you with high-volume check printing, bank compliance, or Clock In / Clock Out attendance today?',
      timestamp: 'Just now',
      suggestedActions: [
        'How does batch check printing & dispatch work?',
        'Tell me about Clock In Clock Out attendance',
        'Are checks compliant with Federal Reserve MICR standards?',
        'What are the pricing tiers for high volume?'
      ]
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsTyping(true);

    // Context-rich domain assistant response
    setTimeout(() => {
      let reply = '';
      const lower = text.toLowerCase();

      if (lower.includes('printing') || lower.includes('dispatch') || lower.includes('mail') || lower.includes('fedex')) {
        reply = 'SmartBusiness Solutions prints checks using high-resolution magnetic MICR toner on tamper-evident security check stock. We support automated batch printing with digital signatures and same-day FedEx or USPS dispatch directly to your vendors.';
      } else if (lower.includes('clock') || lower.includes('attendance') || lower.includes('time')) {
        reply = 'Our Clock In Clock Out core service provides real-time GPS-geofenced shift tracking, facial verification or PIN sign-in, automated attendance audit trails, and 1-click sync with your payroll software to eliminate missed punch logs.';
      } else if (lower.includes('micr') || lower.includes('compliance') || lower.includes('check 21') || lower.includes('security')) {
        reply = 'All checks adhere strictly to Check 21 and ANSI X9 Federal Reserve MICR specifications. Every transaction is guarded with 256-bit SSL encryption and full immutable audit trails.';
      } else if (lower.includes('pricing') || lower.includes('plan') || lower.includes('cost') || lower.includes('rate')) {
        reply = 'We provide flexible plans with volume discounts! Plans start at $19/mo for standard businesses up to custom enterprise tiers with dedicated printing mailkits and 99.99% uptime SLAs.';
      } else {
        reply = `Thank you for your inquiry about "${text}". Our live concierge team is standing by to assist with your check printing volumes and timecard requirements. Feel free to leave your contact details or call us directly!`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 700);
  };

  const handleReset = () => {
    setMessages([
      {
        id: 'msg-reset',
        sender: 'assistant',
        text: 'Conversation reset. How can SmartBusiness Solutions assist you today?',
        timestamp: 'Just now',
        suggestedActions: [
          'How does batch check printing work?',
          'Clock In Clock Out features',
          'Explore pricing tiers'
        ]
      }
    ]);
  };

  return (
    <aside aria-label="Customer Support Chat" className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Floating Chat Window (Aside Container) */}
      {isOpen && (
        <div className="mb-4 w-[92vw] sm:w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3.5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <SmartBusinessLogo iconOnly size="sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
              </div>
              <div>
                <h4 className="font-bold text-sm leading-tight text-white">SmartBusiness Assistant</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                  <span className="text-emerald-400">●</span>
                  <span>Live Concierge &bull; &lt; 2m reply</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReset}
                title="Reset conversation"
                className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onToggle}
                className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="bg-indigo-50/70 border-b border-indigo-100/50 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-indigo-900">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-indigo-600" />
              Federal Reserve Check 21 & MICR Certified
            </span>
            <button
              onClick={onNavigatePricing}
              className="font-bold text-indigo-600 hover:underline cursor-pointer"
            >
              Plans
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs'
                      : 'bg-white border border-slate-200/80 text-slate-800 shadow-2xs rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>

                {/* Suggested Action Chips (if present) */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[95%]">
                    {msg.suggestedActions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(action)}
                        className="text-left bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 px-2.5 py-1 rounded-full text-[11px] transition-colors shadow-2xs cursor-pointer"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 text-slate-400 p-2 bg-white rounded-xl border border-slate-100 w-20">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about check printing, clock in/out..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={onToggle}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 cursor-pointer"
        aria-label="Toggle SmartBusiness chat assistant"
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200" />
        ) : (
          <>
            <MessageSquare className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

    </aside>
  );
};
