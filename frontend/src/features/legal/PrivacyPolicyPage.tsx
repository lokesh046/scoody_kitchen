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

export const PrivacyPolicyPage: React.FC = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  useDocumentMetadata(
    'Privacy Policy',
    'How Hearth & One collects, uses, shares, and protects personal data across the website and mobile app.'
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
              Privacy Policy
            </h1>
            <p className="font-body text-sm text-ink opacity-70">
              How we collect, use, share, and protect personal data across the Hearth & One website and
              mobile app.
            </p>
          </header>

          <div className="flex items-start gap-3 border border-amber-300 bg-amber-50 rounded-sm p-4 mb-8">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="font-body text-xs text-amber-900 leading-relaxed">
              <strong>Draft — pending legal review.</strong> This page is a working draft published to the
              beta site for internal review. It is not yet approved by legal counsel and should not be
              treated as final. Placeholders (grievance officer name, registered address, effective date)
              are marked below.
            </p>
          </div>

          <div className="prose-blog font-body text-ink text-[15px] leading-relaxed">
            <H2>1. Introduction and Scope</H2>
            <P>
              This Privacy Policy explains how Hearth & One ("we," "us," "our," "the platform") collects,
              uses, shares, and protects personal data when you use our website, our mobile application
              (Android and iOS), or interact with our customer support, veterinary consultation, and AI
              nutrition assistant features. It applies to pet parents, the veterinarians and doctors who
              provide consultations through the platform, and visitors to our website.
            </P>
            <P>
              By creating an account, browsing the platform, or otherwise using our services, you agree to
              the collection and use of information as described here. If you do not agree, please do not
              use the platform. This policy should be read together with our Terms and Conditions and, where
              applicable, our Veterinary Telehealth & AI Consultation Disclaimer.
            </P>

            <H2>2. Definitions</H2>
            <H3>Personal Data</H3>
            <P>
              Any data about an individual who is identifiable by or in relation to that data — for example,
              your name, email address, phone number, delivery address, or device identifiers.
            </P>
            <H3>Sensitive Personal Data</H3>
            <P>
              A narrower category that includes, in our context: your pet's health records (symptoms,
              diagnosis, treatment, and medications), veterinary consultation notes and video sessions,
              payment and financial information, precise location data, and any health information you
              share with our AI nutrition assistant. We apply additional care to this category, as described
              throughout this policy.
            </P>
            <H3>Processing</H3>
            <P>Any operation performed on personal data — collection, storage, use, sharing, or deletion.</P>

            <H2>3. Information We Collect</H2>
            <H3>3.1 Information You Provide Directly</H3>
            <UL>
              <li><strong>Account & identity data:</strong> first name, last name, email address, phone number, and profile photo.</li>
              <li><strong>Authentication data:</strong> if you sign in with Google, we receive your name, email address, and profile photo from Google. We do not receive or store your Google password.</li>
              <li><strong>Pet profile data ("Pet Heritage Passport"):</strong> your pet's name, species, breed, gender, date of birth, weight, and any photos you upload.</li>
              <li><strong>Health records:</strong> if your pet has a veterinary consultation or clinical visit logged on the platform, we store the resulting medical record — symptoms, clinical findings, diagnosis, treatment, prescribed medications, a follow-up date where relevant, and any clinical notes. This is the most sensitive category of data we hold and is accessible only to you, the treating veterinarian, and authorized platform staff who need it to operate the service.</li>
              <li><strong>AI Pet Vision:</strong> if you use the pet photo scanner, the photo is analyzed to identify your pet's breed. Breed classification runs on our own model; the resulting breed label (not the raw photo) may be sent to our AI provider to generate plain-language breed care insights.</li>
              <li><strong>Meal planning data:</strong> if you use the meal planner, the recipe and portion choices you make, built from your pet's profile.</li>
              <li><strong>Delivery & order data:</strong> shipping address (including GPS coordinates when you use location-based address autofill), order history, cart contents, applied coupons, product/recipe reviews (which may include a photo you choose to attach), and — where you set up a recurring food delivery — your subscription plan, frequency, and next-delivery schedule.</li>
              <li><strong>Payment data:</strong> processed directly by our payment gateway, Razorpay. We store the resulting order and transaction reference, not your card, UPI, or bank account details.</li>
              <li><strong>Veterinary consultation data:</strong> appointment details, your stated reason for the visit, the video-consultation session (hosted on our video infrastructure, see Section 6), and doctor's notes.</li>
              <li>
                <strong>Doctor/veterinarian application data:</strong> if you apply to provide consultations on the platform, we collect a substantially more detailed set of professional and personal data to verify you:
                <ul className="list-[circle] pl-5 mt-1.5 space-y-1">
                  <li>Name, email, phone number, and nationality.</li>
                  <li>Specialization, qualification, medical license/registration number, and years of experience.</li>
                  <li>Education history, including institution and degree start/end years.</li>
                  <li>Clinic name, address, city, and state, and your proposed consultation fee.</li>
                  <li>A professional bio and profile photo, where provided.</li>
                </ul>
              </li>
              <li><strong>Support & communications:</strong> content of support tickets (optionally linked to a specific order or consultation), and newsletter subscription preferences.</li>
            </UL>

            <H3>3.2 Information Collected Automatically</H3>
            <UL>
              <li><strong>Device & usage data:</strong> IP address, device model and operating system, app version, crash and error logs, and general usage patterns, collected to keep the service reliable and secure.</li>
              <li><strong>Website analytics:</strong> on the website, we use Firebase Analytics (Google) to understand aggregate usage — pages visited, session length, and general engagement. This is usage analytics, not third-party advertising; see Section 11 for how it relates to cookies.</li>
              <li><strong>Location data:</strong> with your permission, we use precise device location (mobile) or browser geolocation (web) to auto-fill your delivery address, and we use Google's Places/geocoding services to find veterinary clinics near you and to resolve addresses. You can decline location access and enter your address or search location manually.</li>
              <li><strong>Session & authentication tokens:</strong> on the web app, sign-in sessions are maintained through secure, HTTP-only cookies that are not readable by scripts and are not used for cross-site advertising tracking.</li>
              <li><strong>Push notification tokens:</strong> if you enable notifications on mobile, we store a device push token (via Expo's push service) and your platform (iOS/Android) to deliver order updates, consultation reminders, and account notices.</li>
              <li><strong>Mobile crash reporting:</strong> our mobile app (not the website) uses Sentry to collect crash and error diagnostics, including device information and application state at the time of a crash.</li>
            </UL>

            <H3>3.3 Information We Receive From Third Parties</H3>
            <UL>
              <li><strong>Google:</strong> basic profile information when you use "Continue with Google."</li>
              <li><strong>WhatsApp / Meta Platforms:</strong> delivery-status confirmation for one-time passcodes we send to verify your phone number. Meta does not share the content of your WhatsApp account with us, and we do not share anything with Meta beyond the phone number needed to deliver that one message.</li>
              <li><strong>Firebase (Google):</strong> delivery-status confirmation for SMS one-time passcodes, used as a backup verification channel when WhatsApp delivery isn't available.</li>
              <li><strong>Razorpay:</strong> payment status and transaction identifiers once a payment is completed or refunded.</li>
              <li><strong>EasyPost and Shiprocket:</strong> shipment status and tracking updates once your order ships.</li>
            </UL>

            <H2>4. How We Use Your Information</H2>
            <UL>
              <li>To create and manage your account, and to verify your identity via email, WhatsApp, or SMS.</li>
              <li>To process and deliver your orders, including sharing your name, address, and phone number with our shipping partners (EasyPost, Shiprocket) solely for that delivery.</li>
              <li>To schedule and facilitate veterinary consultations, including hosting the video call, and to maintain the medical and prescription records generated from them.</li>
              <li>To personalize recipe recommendations, meal plans, and AI nutrition assistant responses based on your pet's profile.</li>
              <li>To generate AI Pet Vision breed identification and care insights from a photo you choose to submit.</li>
              <li>To verify veterinarians/doctors applying to the platform, using their submitted qualifications and license details.</li>
              <li>To send transactional communications: order confirmations, OTPs, appointment reminders, and account/security notices. These are not optional while your account is active, since they're how we fulfill the service you asked for.</li>
              <li>To send marketing communications (such as our newsletter) only where you've opted in, and always with an easy way to unsubscribe.</li>
              <li>To understand aggregate usage of the website through Firebase Analytics, so we can improve the product.</li>
              <li>To detect, investigate, and prevent fraud, abuse, and security incidents.</li>
              <li>To maintain, debug, and improve the platform, including through mobile crash and error reporting.</li>
              <li>To comply with applicable law, respond to lawful requests from authorities, and enforce our Terms and Conditions.</li>
            </UL>

            <H2>5. Legal Basis for Processing</H2>
            <P>
              Under the Digital Personal Data Protection Act, 2023, we process your personal data primarily
              on the basis of your <strong>consent</strong>, given when you create an account and agree to
              this policy. Some processing — for example, retaining transaction records for tax and
              accounting purposes, or responding to a lawful government request — is carried out to meet our
              <strong> legal obligations</strong> rather than on the basis of consent. You may withdraw
              consent at any time as described in Section 10, though this may limit or end our ability to
              provide certain services to you.
            </P>

            <H2>6. How We Share Your Information</H2>
            <P>
              We do not sell your personal data. We share it only with the following categories of
              recipients, and only to the extent needed for the purpose described:
            </P>
            <UL>
              <li><strong>Razorpay Software Private Limited</strong> — payment processing, PCI-DSS compliant card/UPI handling, and refunds.</li>
              <li><strong>EasyPost and Shiprocket</strong> — your name, address, and phone number, to fulfil and track an order.</li>
              <li><strong>Firebase / Google Cloud Platform</strong> — phone-number verification (SMS fallback), push-notification delivery support, website usage analytics (Firebase Analytics), and Google Places/geocoding for address and nearby-clinic lookups.</li>
              <li><strong>Meta Platforms (WhatsApp Cloud API)</strong> — delivery of one-time passcodes to your WhatsApp number.</li>
              <li><strong>Cloudinary Inc.</strong> — hosting for profile photos, pet photos, review photos, and consultation-related documents you upload.</li>
              <li><strong>Google (Gemini API), and secondary AI providers (OpenRouter and a Hostinger-hosted AI router) used only for reliability when the primary provider is unavailable</strong> — processing for the AI nutrition assistant and AI Pet Vision's care-insight generation.</li>
              <li><strong>8x8 / Jitsi video infrastructure</strong> — hosts the live video and audio for veterinary consultations.</li>
              <li><strong>Sentry</strong> — mobile app crash and error diagnostics only.</li>
              <li><strong>The veterinarian or doctor you book a consultation with</strong> — the information needed for that consultation.</li>
              <li><strong>Law enforcement or regulators</strong> — where required by Indian law or a valid legal process.</li>
              <li><strong>A successor entity</strong> — in the event of a merger, acquisition, or sale of assets, subject to the same protections described in this policy.</li>
            </UL>
            <P>
              Some of these providers operate infrastructure located outside India. See Section 13 for how
              we handle that.
            </P>

            <H2>7. AI Features and Automated Processing</H2>
            <P>
              Our AI nutrition and health assistant is built on Google's Gemini models, with OpenRouter and
              a Hostinger-hosted AI router available as fallback providers purely for reliability if Gemini
              is temporarily unavailable — your conversation is not intentionally routed to a different
              provider under normal operation. Your messages and your pet's profile context are processed to
              generate a reply and are not used to train the underlying model on your personal data. Our AI
              Pet Vision feature runs breed classification on our own locally hosted model from a photo you
              submit; only the resulting breed label — not the raw photo — is sent to Gemini to generate
              care-insight text. AI-generated guidance is informational only and does not replace advice
              from a licensed veterinarian — see our Veterinary Telehealth & AI Consultation Disclaimer for
              the full terms. We do not use AI to make any automated decision that has a legal or similarly
              significant effect on you (for example, denying service) without a human able to review it on
              request.
            </P>

            <H2>8. Data Retention</H2>
            <P>
              We retain personal data only for as long as reasonably necessary to provide the service,
              fulfil the purposes described in this policy, and meet our legal, tax, and accounting
              recordkeeping obligations. Pet health records, prescriptions, and consultation data are
              retained for the duration of your account's active use, plus any further period required by
              applicable law, after which they are deleted or anonymized. When you delete your account, we
              delete or anonymize your personal data within a reasonable period, except where we are required
              or permitted to retain it — for example, completed transaction records for tax purposes, or
              data relevant to an open fraud investigation or legal claim.
            </P>

            <H2>9. Data Security</H2>
            <P>
              We apply technical and organizational safeguards appropriate to the sensitivity of the data
              involved, including encrypted data transmission (HTTPS/TLS) across our website and app,
              password-less authentication (reducing the risk of credential reuse and password-based
              attacks), hashed and time-limited one-time passcodes rather than storable plaintext
              credentials, and access controls that restrict who inside our organization can view sensitive
              records such as health and payment data — in particular, health records are accessible only to
              the pet's owner, the treating veterinarian, and staff who need access to operate the service.
              No method of transmission or storage is completely secure; we cannot guarantee absolute
              security, but we will notify you and the Data Protection Board of India (or other applicable
              authority), where required under the DPDP Act, 2023, in the event of a personal data breach
              affecting your data.
            </P>

            <H2>10. Your Rights and Choices</H2>
            <UL>
              <li><strong>Access:</strong> you can view your profile, pet profiles, health records, and order history directly in the app or website at any time.</li>
              <li><strong>Correction:</strong> you can update your profile, pet details, and delivery addresses yourself, or ask us to correct them.</li>
              <li><strong>Consent withdrawal:</strong> you may withdraw consent for optional processing (for example, marketing emails, website analytics, or location access) at any time; this does not affect processing already carried out, or processing we're required to continue for legal reasons.</li>
              <li><strong>Erasure / account deletion:</strong> you can request deletion of your account and associated personal data. We will action this within the timeline required under applicable law, subject to the retention exceptions described in Section 8.</li>
              <li><strong>Grievance redressal:</strong> you can raise a complaint about how we've handled your data with our Grievance Officer (Section 16). We acknowledge grievances within 24 hours and aim to resolve them within 7 days, consistent with Indian intermediary-guideline timelines.</li>
            </UL>
            <P>
              To exercise any of these rights, contact us using the details in Section 16. We may need to
              verify your identity before actioning a request.
            </P>

            <H2>11. Cookies and Similar Technologies</H2>
            <P>
              Our website uses a small number of strictly necessary cookies to keep you signed in and to
              protect against cross-site request forgery. We also use Firebase Analytics (Google), which
              sets its own identifiers to measure aggregate website usage; this is not used for third-party
              advertising or cross-site tracking. You can decline non-essential analytics through your
              browser's cookie or privacy settings. Our mobile app does not use browser cookies; it uses a
              securely stored authentication token on your device instead, in the same role a cookie plays
              on the web.
            </P>

            <H2>12. Children's Privacy</H2>
            <P>
              Hearth & One is intended for use by adults who can enter into a contract under Indian law. We
              do not knowingly collect personal data from children. If you believe a child has provided us
              with personal data, please contact us using the details in Section 16 and we will take steps
              to delete it.
            </P>

            <H2>13. International Data Transfers</H2>
            <P>
              Several of our service providers operate infrastructure outside India, including
              Google/Firebase (authentication, analytics, Places/geocoding, Gemini AI), Meta (WhatsApp),
              Cloudinary, OpenRouter, Sentry, and our video-consultation infrastructure. Where your personal
              data is transferred outside India, we take steps to ensure it continues to be protected
              consistent with this policy and applicable Indian law, including through contractual
              obligations placed on these providers.
            </P>

            <H2>14. Third-Party Links and Services</H2>
            <P>
              Our platform may link to third-party websites or services that we do not control, including
              the individual privacy policies of Google, Meta/WhatsApp, and Razorpay. This Privacy Policy
              does not cover their practices. We encourage you to review their respective privacy policies.
            </P>

            <H2>15. Changes to This Policy</H2>
            <P>
              We may update this Privacy Policy from time to time, for example to reflect new features or
              changes in law. We will post the updated policy here with a revised effective date, and for
              material changes we will provide more prominent notice (such as an in-app notification or
              email) before the change takes effect.
            </P>

            <H2>16. Grievance Officer and Contact Information</H2>
            <P>
              Consistent with the Digital Personal Data Protection Act, 2023 and the Information Technology
              Act, 2000, we have appointed a Grievance Officer to address your questions, requests, and
              complaints about this policy and our handling of your personal data.
            </P>
            <div className="border border-cardboard rounded-sm overflow-hidden mb-6 not-prose">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-cardboard">
                    <td className="bg-ink text-paper font-bold px-4 py-2.5 w-1/3">Grievance Officer</td>
                    <td className="px-4 py-2.5 text-ink">[Name — to be filled in before publication]</td>
                  </tr>
                  <tr className="border-b border-cardboard">
                    <td className="bg-ink text-paper font-bold px-4 py-2.5">Email</td>
                    <td className="px-4 py-2.5 text-ink">
                      privacy@hearthandone.com <span className="italic opacity-70">(placeholder — confirm before publication)</span>
                    </td>
                  </tr>
                  <tr className="border-b border-cardboard">
                    <td className="bg-ink text-paper font-bold px-4 py-2.5">Registered Address</td>
                    <td className="px-4 py-2.5 text-ink">[Registered business address — to be filled in before publication]</td>
                  </tr>
                  <tr>
                    <td className="bg-ink text-paper font-bold px-4 py-2.5">Response Timeline</td>
                    <td className="px-4 py-2.5 text-ink">Acknowledgement within 24 hours; resolution within 7 days, where practicable</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
