import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import { Header } from '../../components/Header';
import { SiteFooter } from '../../components/SiteFooter';
import { CartDrawer } from '../../components/CartDrawer';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { sendContactInquiry, type ContactReason } from '../../api/contact';

const REASONS: { id: ContactReason; label: string; hint: string }[] = [
  { id: 'general', label: 'General query', hint: 'A question about Hearth & One' },
  { id: 'sales', label: 'Sales', hint: 'Bulk or business orders' },
  { id: 'promotion', label: 'Promotion', hint: 'Collaborations and campaigns' },
  { id: 'investment', label: 'Investment', hint: 'Investor enquiries' },
  { id: 'partnership', label: 'Partnership', hint: 'Vets, clinics and brands' },
  { id: 'other', label: 'Other', hint: 'Anything else' },
];

const NOTES_MAX = 2000;
const NOTES_MIN = 10;
const FIELD = 'mt-1.5 w-full min-w-0 h-11 px-3 border border-cardboard rounded-[12px] bg-white text-base text-ink focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15';

export function ContactPage() {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [reason, setReason] = useState<ContactReason>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  useDocumentMetadata('Get in touch', 'Send a message to the Hearth & One team: general questions, sales, promotions, investment or partnerships.');

  const notesOk = notes.trim().length >= NOTES_MIN;
  const canSend = name.trim().length >= 2 && email.trim() !== '' && notesOk && status !== 'sending';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setStatus('sending');
    setError('');
    try {
      await sendContactInquiry({ reason, name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, notes: notes.trim(), website });
      setStatus('sent');
    } catch (err: any) {
      setStatus('idle');
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 429) setError('You have sent a few messages already. Please try again in a little while.');
      else if (Array.isArray(detail) && detail[0]?.msg) setError(String(detail[0].msg).replace(/^Value error, /, ''));
      else setError(typeof detail === 'string' ? detail : 'We could not send your message. Please try again.');
    }
  };

  const reset = () => {
    setReason('general'); setName(''); setEmail(''); setPhone(''); setNotes(''); setStatus('idle'); setError('');
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header onCartToggle={() => setIsCartOpen(true)} />

      <main className="flex-grow w-full px-4 sm:px-6 md:px-8 py-10 md:py-14">
        <div className="max-w-3xl mx-auto text-left">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-turmeric font-bold">Get in touch</p>
          <h1 className="mt-3 font-script font-normal text-4xl sm:text-5xl text-ink tracking-normal leading-snug">We'd love to hear from you</h1>
          <p className="mt-4 max-w-xl font-body text-base sm:text-lg text-ink/80 leading-relaxed">
            Tell us what your message is about and how to reach you. We read every message and reply by email.
          </p>

          {status === 'sent' ? (
            <div className="mt-10 border border-cardboard/70 rounded-2xl bg-white p-8 sm:p-10 text-center" role="status">
              <CheckCircle2 className="w-10 h-10 text-herb mx-auto" aria-hidden="true" />
              <h2 className="mt-4 font-display font-bold text-xl text-ink">Thank you, your message is on its way</h2>
              <p className="mt-2 font-body text-sm sm:text-base text-ink/80 leading-relaxed">
                We'll reply to <strong>{email.trim()}</strong> as soon as we can.
              </p>
              <button type="button" onClick={reset}
                className="mt-6 min-h-11 px-5 font-body text-sm font-semibold rounded-[12px] border border-cardboard bg-white hover:bg-paperLight text-ink cursor-pointer transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-10 border border-cardboard/70 rounded-2xl bg-white p-5 sm:p-8 space-y-7" noValidate>
              <fieldset>
                <legend className="font-body text-sm font-semibold text-ink">What is this about? *</legend>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REASONS.map((r) => (
                    <label key={r.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-[12px] border p-3.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-paprika ${
                        reason === r.id ? 'border-paprika bg-paprika/5' : 'border-cardboard hover:bg-paperLight'}`}>
                      <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="mt-1 accent-paprika" />
                      <span className="min-w-0">
                        <span className="block font-body text-sm font-semibold text-ink">{r.label}</span>
                        <span className="block font-body text-xs text-ink/70">{r.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="font-body text-sm text-ink sm:col-span-2">Your name *
                  <input type="text" required maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
                </label>
                <label className="font-body text-sm text-ink">Email *
                  <input type="email" required maxLength={255} autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD} placeholder="you@example.com" />
                </label>
                <label className="font-body text-sm text-ink">Phone number
                  <input type="tel" maxLength={30} autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={FIELD} placeholder="+91 98765 43210" />
                </label>
              </div>

              <label className="font-body text-sm text-ink block">Notes *
                <textarea required rows={6} maxLength={NOTES_MAX} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tell us a little about what you need"
                  className="mt-1.5 w-full px-3 py-2.5 border border-cardboard rounded-[12px] bg-white text-base text-ink focus:outline-none focus:border-paprika focus:ring-2 focus:ring-paprika/15" />
                <span className={`mt-1 flex justify-between text-xs ${notes !== '' && !notesOk ? 'text-paprika' : 'text-ink/60'}`}>
                  <span>{notes !== '' && !notesOk ? `Please write at least ${NOTES_MIN} characters.` : ''}</span>
                  <span>{notes.length}/{NOTES_MAX}</span>
                </span>
              </label>

              {/* Honeypot: hidden from people and keyboards, bots fill it in. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
              </div>

              {error && <div className="text-paprika text-sm" role="alert">{error}</div>}

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <p className="font-body text-xs text-ink/70 leading-relaxed">
                  Need help with an order or your account? <Link to="/support" className="underline text-paprika">Open a support ticket</Link> instead.
                </p>
                <button type="submit" disabled={!canSend}
                  className="min-h-11 px-6 font-body text-sm font-semibold rounded-[12px] bg-paprika text-white hover:bg-paprika/90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors flex items-center justify-center gap-2 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paprika">
                  {status === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                  Send message
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}

export default ContactPage;
