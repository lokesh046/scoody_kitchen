import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Header } from '../../components/Header';
import { CartDrawer } from '../../components/CartDrawer';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="font-display font-bold text-xl text-ink mt-10 mb-3">{children}</h2>
);

const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="font-display font-bold text-base text-ink mt-6 mb-2">{children}</h3>
);

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-4">{children}</p>
);

const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>
);

export const TermsPage: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  useDocumentMetadata(
    'Terms and Conditions',
    'The terms that govern your use of the Hearth & One website and mobile app, including orders, payments, veterinary consultations, and our AI features.'
  );

  return (
    <div className="min-h-screen bg-paper flex flex-col font-body selection:bg-turmeric selection:text-paper w-full">
      <Header onCartToggle={() => setIsCartOpen(true)} />

      <div className="flex-grow max-w-3xl w-full mx-auto px-4 md:px-8 py-10">
        <article className="text-left">
          <header className="mb-6 space-y-3">
            <span className="font-mono text-[9px] uppercase tracking-wider text-herb font-bold">
              Legal
            </span>
            <h1 className="font-display font-black text-2xl md:text-4xl text-ink leading-tight">
              Terms and Conditions
            </h1>
            <p className="font-body text-sm text-ink opacity-70">
              The terms that govern your use of the Hearth & One website and mobile app.
            </p>
          </header>

          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 rounded-sm p-4 mb-8">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="font-body text-xs text-amber-900 leading-relaxed">
              <strong>Draft — pending legal review.</strong> This page is a working draft published to the
              beta site for internal review. It is not yet approved by legal counsel and should not be
              treated as final. Placeholders (legal entity name, registered address, governing-law city,
              effective date) are marked below.
            </p>
          </div>

          <div className="prose-blog font-body text-ink text-[15px] leading-relaxed">
            <H2>1. Acceptance of These Terms</H2>
            <P>
              These Terms and Conditions ("Terms") form a binding agreement between you and{' '}
              <em>[Legal entity name — to be filled in before publication]</em> ("Hearth & One," "we,"
              "us," "our," "the platform") and govern your access to and use of our website, our mobile
              application (Android and iOS), and the ordering, delivery, veterinary consultation, and AI
              assistant services available through them. By creating an account, browsing the platform, or
              placing an order, you agree to be bound by these Terms and by our{' '}
              <a href="/privacy" className="text-herb font-bold hover:underline">Privacy Policy</a>, which is
              incorporated into these Terms by reference. If you do not agree, please do not use the
              platform.
            </P>
            <P>
              Where you book a veterinary consultation or use our AI nutrition and health assistant, Section
              8 (Veterinary Telehealth and AI Features) applies in addition to the rest of these Terms and
              contains important limitations you should read carefully.
            </P>

            <H2>2. Eligibility and Your Account</H2>
            <UL>
              <li>You must be at least 18 years old and capable of entering into a binding contract under the Indian Contract Act, 1872 to create an account or place an order on your own behalf.</li>
              <li>The information you provide when registering — name, email, phone number — must be accurate and kept up to date. You are responsible for all activity under your account.</li>
              <li>If you sign in with Google, you authorize us to receive your name, email address, and profile photo from Google, as described in our Privacy Policy.</li>
              <li>You are responsible for keeping your sign-in access secure. Tell us immediately if you believe your account has been accessed without authorization.</li>
              <li>We may suspend or terminate an account that provides false information, is used fraudulently, or breaches these Terms, as described in Section 14.</li>
            </UL>

            <H2>3. Our Services</H2>
            <P>
              Hearth & One offers, subject to availability in your area and to these Terms:
            </P>
            <UL>
              <li><strong>Pet food ordering and delivery</strong> — small-batch, blast-frozen recipes sold through our online shop, including one-time and recurring ("subscription") orders.</li>
              <li><strong>An AI nutrition and health assistant</strong> — a conversational assistant that answers questions about your pet's diet and wellbeing, built on Google's Gemini models.</li>
              <li><strong>AI Pet Vision</strong> — a photo-based breed identification and care-insight tool.</li>
              <li><strong>Veterinary teleconsultations</strong> — video consultations with independent, licensed veterinarians who use our platform to offer their services, hosted on our video infrastructure.</li>
              <li><strong>Pet Heritage Passport and meal planning</strong> — tools to record your pet's profile and generate personalized recipe and portion recommendations from it.</li>
            </UL>
            <P>
              We may add, change, or discontinue any part of these services at any time. We'll try to give
              reasonable notice of a change that materially reduces a service you're actively subscribed to
              or have an open order for.
            </P>

            <H2>4. Orders, Pricing, and Payment</H2>
            <UL>
              <li><strong>Prices</strong> are listed in Indian Rupees (₹) and are subject to change without notice; the price charged is the one shown at the time you complete checkout.</li>
              <li><strong>Taxes:</strong> applicable taxes (including GST) are added at checkout and are your responsibility as the buyer.</li>
              <li><strong>Payment:</strong> payments are processed directly by our payment partner, Razorpay. We do not receive or store your card, UPI, or bank account details — see our Privacy Policy, Section 3.1.</li>
              <li><strong>Order confirmation:</strong> placing an order is an offer to buy; a contract is formed only once we confirm acceptance of your order (for example, by email, in-app notification, or order-status update). We may decline or cancel an order — including after payment — due to stock unavailability, a pricing or listing error, a suspected fraud or security concern, or an undeliverable address, in which case we will refund any amount already charged.</li>
              <li><strong>Subscriptions:</strong> if you set up a recurring delivery, you authorize us to place and charge for each scheduled order until you pause or cancel the subscription yourself in the app or website, or we are unable to process a payment or deliver to your address.</li>
            </UL>

            <H2>5. Shipping, Delivery, and Order Changes</H2>
            <P>
              We ship orders using third-party courier partners, currently EasyPost and Shiprocket. Delivery
              timelines shown at checkout or in your order tracking are estimates, not guarantees, and can be
              affected by your location, courier delays, or circumstances outside our control. Risk in the
              goods passes to you on delivery to the address you provided; please inspect your delivery on
              arrival and do not accept a package that appears tampered with or damaged — contact support
              instead (Section 15).
            </P>
            <P>
              You can cancel an order yourself from the app or website while it is still in a cancellable
              status — generally, before it has been packed or dispatched for delivery. Once an order has
              shipped, it can no longer be cancelled through self-service; contact support about a return
              instead.
            </P>

            <H2>6. Returns, Refunds, and Cancellations</H2>
            <P>
              Because our recipes are small-batch, perishable, blast-frozen food, we're only able to accept a
              return or offer a refund in specific situations: the order arrived damaged, materially
              different from what you ordered, or was cancelled before dispatch under Section 5. Where a
              refund is due, we issue it to your original payment method; processing time depends on your
              bank or payment provider and is outside our control. To start a return or refund request,
              contact support (Section 15) with your order number within a reasonable time of delivery.
            </P>

            <H2>7. User Conduct</H2>
            <P>You agree not to, on the platform or through our AI assistant:</P>
            <UL>
              <li>Provide false information about yourself, your pet, or a payment method.</li>
              <li>Use the platform for any unlawful purpose, or to harass, abuse, or impersonate another person (including a doctor or staff member).</li>
              <li>Attempt to copy, scrape, reverse-engineer, or create derivative works from the platform's software or content, other than as permitted by applicable law.</li>
              <li>Interfere with the platform's security, rate limits, or normal operation, including through automated tools (bots).</li>
              <li>Use the AI assistant or AI Pet Vision to attempt to extract another user's data, generate unlawful content, or probe the underlying model for purposes unrelated to pet care.</li>
            </UL>
            <P>
              We may suspend or terminate access for a breach of this section, as described in Section 14.
            </P>

            <H2>8. Veterinary Telehealth and AI Features — Important Limitations</H2>
            <P>
              <strong>This section is central to how you should use our health-related features; please read
              it carefully.</strong>
            </P>
            <H3>8.1 Veterinarians Are Independent Professionals</H3>
            <P>
              Veterinarians and doctors who offer consultations through the platform are independent,
              licensed professionals, not our employees. We provide the technology that connects you to
              them — booking, video hosting, and record-keeping — but we do not practice veterinary medicine
              and are not responsible for the clinical judgment, advice, diagnosis, or treatment a
              veterinarian provides during a consultation. Your relationship for that advice is with the
              treating veterinarian.
            </P>
            <H3>8.2 AI Guidance Is Informational Only</H3>
            <P>
              Our AI nutrition and health assistant and AI Pet Vision's care insights are generated by
              automated systems (Google's Gemini models, with OpenRouter and a Hostinger-hosted router as
              reliability fallbacks) based on information you provide and, for Pet Vision, a breed
              classification. This output is for general informational purposes only. It is{' '}
              <strong>not</strong> a veterinary diagnosis, is <strong>not</strong> a substitute for
              examination or advice from a licensed veterinarian, and should not be relied on as the sole
              basis for a decision about your pet's health, medication, or treatment. AI systems can be
              wrong or incomplete. Always consult a qualified veterinarian — through our platform or
              otherwise — for an actual health concern, and seek emergency veterinary care immediately for a
              symptom that could be serious or urgent, rather than waiting on an AI response or a scheduled
              consultation.
            </P>
            <H3>8.3 Not for Emergencies</H3>
            <P>
              Our platform is not an emergency service and video consultations are scheduled, not immediate.
              If your pet is experiencing a medical emergency, contact your nearest emergency veterinary
              clinic directly rather than using the app.
            </P>

            <H2>9. Intellectual Property</H2>
            <P>
              The Hearth & One name, logo, app, website design, and underlying software are owned by us or
              our licensors and are protected by applicable intellectual property law. We grant you a
              limited, non-exclusive, non-transferable license to use the platform for your own personal,
              non-commercial use of our services. You may not copy, modify, distribute, sell, or create
              derivative works from the platform's content or software, or use our branding, without our
              prior written permission. Content you submit (a pet photo, a product review, a support
              message) remains yours; by submitting it you grant us a license to use it to provide and
              improve the relevant service, consistent with our Privacy Policy.
            </P>

            <H2>10. Third-Party Links and Services</H2>
            <P>
              The platform relies on, and may link to, third-party services we don't control — including
              Razorpay, EasyPost, Shiprocket, Google (Gemini, Firebase, Places), Meta/WhatsApp, Cloudinary,
              and our video-consultation infrastructure. We are not responsible for the content, policies, or
              practices of these third parties. Your use of a third-party service is governed by that
              service's own terms.
            </P>

            <H2>11. Disclaimers</H2>
            <P>
              The platform and its services are provided "as is" and "as available." To the fullest extent
              permitted by applicable law, we disclaim warranties of any kind, whether express or implied,
              including merchantability, fitness for a particular purpose, and non-infringement. We do not
              guarantee that the platform will be uninterrupted, error-free, or completely secure, or that
              AI-generated content will always be accurate — see Section 8 for how that applies to health
              guidance specifically.
            </P>

            <H2>12. Limitation of Liability</H2>
            <P>
              To the fullest extent permitted by applicable law, Hearth & One and its officers, employees,
              and affiliates will not be liable for any indirect, incidental, special, or consequential
              damages arising from your use of the platform, including loss of data or loss of profits, even
              if we have been advised of the possibility of such damages. Nothing in these Terms excludes or
              limits a liability that cannot lawfully be excluded or limited under applicable Indian law
              (such as liability for fraud, or for death or injury caused by proven negligence).
            </P>

            <H2>13. Indemnification</H2>
            <P>
              You agree to indemnify and hold harmless Hearth & One, its officers, employees, and affiliates
              from any claim, loss, or demand, including reasonable legal fees, made by a third party due to
              or arising out of your breach of these Terms, your misuse of the platform, or your violation of
              any law or the rights of a third party.
            </P>

            <H2>14. Suspension and Termination</H2>
            <P>
              We may suspend or terminate your access to the platform, with or without notice, if we
              reasonably believe you have breached these Terms, engaged in fraudulent or unlawful activity,
              or created a risk or legal exposure for us or another user. You may stop using the platform and
              request deletion of your account at any time, as described in our Privacy Policy. Sections 8,
              9, 11, 12, 13, 16, and 17 survive termination of your account.
            </P>

            <H2>15. Grievance Officer and Contact Information</H2>
            <P>
              Consistent with the Information Technology Act, 2000 and its rules, we have appointed a
              Grievance Officer to address your questions and complaints about these Terms. For an order,
              delivery, or payment issue, please contact support through the app or website first — it's
              usually the fastest path to a resolution.
            </P>
            <div className="border border-cardboard rounded-sm overflow-hidden mb-6 not-prose">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-cardboard">
                    <td className="bg-ink text-paper font-bold px-4 py-2.5 w-1/3">Grievance Officer</td>
                    <td className="px-4 py-2.5 text-ink">Yeswanth S</td>
                  </tr>
                  <tr className="border-b border-cardboard">
                    <td className="bg-ink text-paper font-bold px-4 py-2.5">Email</td>
                    <td className="px-4 py-2.5 text-ink">support@hearthandone.com</td>
                  </tr>
                  <tr>
                    <td className="bg-ink text-paper font-bold px-4 py-2.5">Registered Address</td>
                    <td className="px-4 py-2.5 text-ink">[Registered business address — to be filled in before publication]</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <H2>16. Governing Law and Dispute Resolution</H2>
            <P>
              These Terms are governed by the laws of India. Subject to applicable consumer-protection law,
              any dispute arising from these Terms or your use of the platform will be subject to the
              exclusive jurisdiction of the courts of{' '}
              <em>[Governing-law city — to be filled in before publication]</em>, India.
            </P>

            <H2>17. Changes to These Terms</H2>
            <P>
              We may update these Terms from time to time, for example to reflect a new feature or a change
              in law. We will post the updated Terms here with a revised effective date, and for a material
              change we will provide more prominent notice (such as an in-app notification or email) before
              it takes effect. Continuing to use the platform after a change takes effect means you accept
              the updated Terms.
            </P>

            <H2>18. Entire Agreement and Severability</H2>
            <P>
              These Terms, together with our Privacy Policy, make up the entire agreement between you and
              Hearth & One regarding your use of the platform, superseding any prior agreement on the same
              subject. If any provision of these Terms is found unenforceable, the rest remain in full
              effect, and the unenforceable provision will be read to achieve its intent as closely as
              possible within the law.
            </P>
          </div>
        </article>
      </div>

      <footer className="mt-auto border-t border-cardboard py-8 text-center text-ink opacity-60 w-full">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink text-opacity-80">
          © {new Date().getFullYear()} Hearth & One. All rights reserved.
        </p>
      </footer>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
