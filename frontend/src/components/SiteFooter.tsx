import { Link, useNavigate } from 'react-router-dom';
import { useFeatureFlag } from '../hooks/useFeatureFlag';

export function SiteFooter({ className = 'bg-midnight' }: { className?: string }) {
  const navigate = useNavigate();
  const isKnowYourPetEnabled = useFeatureFlag('pets_know_your_pet', true);
  const isConsultationsEnabled = useFeatureFlag('consultations_booking', true);
  const isMealPlannerEnabled = useFeatureFlag('shop_meal_planner', true);
  const isChatbotEnabled = useFeatureFlag('ai_chatbot', true);

  const goToHomeSection = (id: string) => {
    const section = document.getElementById(id);
    if (window.location.pathname === '/' && section) {
      section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } else {
      navigate(`/#${id}`);
    }
  };

  return (
    <footer className={`text-paper px-4 sm:px-6 md:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto pt-16 pb-10 border-b border-paper border-opacity-10">
        <div className="flex flex-col items-center text-center space-y-4 mb-14">
          <div className="w-16 h-16 sm:w-20 sm:h-20 logo-medallion flex items-center justify-center p-1 overflow-hidden shadow-lg">
            <img
              src="/scooby-logo-256.png"
              alt="Hearth & One Logo"
              width={80}
              height={80}
              className="w-full h-full object-contain select-none"
            />
          </div>
          <p className="font-display font-black text-2xl text-paper tracking-tight">Hearth & One</p>
          <p className="font-body text-xs max-w-md leading-relaxed text-paper opacity-65">
            Transparent small-batch pet wellness, human-grade meal formulations, and clinical telemedicine.
          </p>
        </div>
    
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 sm:gap-6 text-left">
          <div className="space-y-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-turmeric font-bold">Explore</p>
            <ul className="space-y-2.5 font-body text-sm text-paper opacity-80">
              {isKnowYourPetEnabled && (
                <li><button onClick={() => navigate('/pets')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Know Your Pet</button></li>
              )}
              {isConsultationsEnabled && (
                <li><button onClick={() => navigate('/consultations')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Locate Your Vet</button></li>
              )}
              {isMealPlannerEnabled && (
                <li><button onClick={() => goToHomeSection('fit-calculator')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Recipe Calculator</button></li>
              )}
              <li><button onClick={() => navigate('/blog')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Journal &amp; Resources</button></li>
            </ul>
          </div>
    
          <div className="space-y-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-turmeric font-bold">The Brand</p>
            <ul className="space-y-2.5 font-body text-sm text-paper opacity-80">
              <li><button onClick={() => navigate('/')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Our Story</button></li>
              <li><button onClick={() => goToHomeSection('hearth-hound')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Hearth &amp; Hound · Coming Soon</button></li>
              <li><button onClick={() => goToHomeSection('faq')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">FAQs</button></li>
              <li><button onClick={() => navigate('/support')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">Contact Us</button></li>
            </ul>
          </div>
    
          <div className="space-y-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-turmeric font-bold">Get In Touch</p>
            <ul className="space-y-2.5 font-body text-sm text-paper opacity-80">
              <li><a href="mailto:support@hearthandone.com" className="break-words hover:text-turmeric hover:opacity-100 transition-colors">support@hearthandone.com</a></li>
              <li><a href="https://www.instagram.com/hearth__and__hound/" target="_blank" rel="noopener noreferrer" className="hover:text-turmeric hover:opacity-100 transition-colors">Instagram</a></li>
              {isChatbotEnabled && (
                <li><button onClick={() => navigate('/assistant')} className="hover:text-turmeric hover:opacity-100 transition-colors cursor-pointer">AI Assistant</button></li>
              )}
            </ul>
          </div>
    
          <div className="space-y-3.5">
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-turmeric font-bold">Legal</p>
            <ul className="space-y-2.5 font-body text-sm text-paper opacity-80">
              <li><Link to="/privacy" className="hover:text-turmeric hover:opacity-100 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-turmeric hover:opacity-100 transition-colors">Terms of Use</Link></li>
              <li><Link to="/terms" className="hover:text-turmeric hover:opacity-100 transition-colors">Veterinary Disclaimer</Link></li>
            </ul>
          </div>
        </div>
      </div>
    
      <div className="max-w-7xl mx-auto py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-paper opacity-50 text-center sm:text-left">
          © {new Date().getFullYear()} Hearth & One. Crafted with care for pet parents everywhere.
        </p>
        <a
          href="https://www.instagram.com/hearth__and__hound/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Hearth & One on Instagram"
          className="flex items-center justify-center w-9 h-9 rounded-full border border-paper border-opacity-15 text-paper opacity-70 hover:opacity-100 hover:text-turmeric hover:border-turmeric transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
