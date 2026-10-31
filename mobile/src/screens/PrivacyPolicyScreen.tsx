import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import SafeAreaView from '../components/FeatureSafeArea';
import { COLORS } from '../theme/colors';
import { StackHeader } from '../components/ScreenHeader';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from '../theme/typography';

interface PrivacyPolicyScreenProps {
  navigation?: any;
}

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.h2}>{children}</Text>
);
const H3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.h3}>{children}</Text>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text style={styles.p}>{children}</Text>
);
const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletDot}>{'•'}</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);
const SubBullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.subBulletRow}>
    <Text style={styles.subBulletDot}>{'◦'}</Text>
    <Text style={styles.subBulletText}>{children}</Text>
  </View>
);

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Privacy Policy" onBack={() => navigation?.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          How we collect, use, share, and protect personal data across the Hearth & One website and mobile app.
        </Text>

        <H2>1. Introduction and Scope</H2>
        <P>
          This Privacy Policy explains how Hearth & One ("we," "us," "our," "the platform") collects, uses,
          shares, and protects personal data when you use our website, our mobile application (Android and
          iOS), or interact with our customer support, veterinary consultation, and AI nutrition assistant
          features. It applies to pet parents, the veterinarians and doctors who provide consultations
          through the platform, and visitors to our website.
        </P>
        <P>
          By creating an account, browsing the platform, or otherwise using our services, you agree to the
          collection and use of information as described here. If you do not agree, please do not use the
          platform.
        </P>

        <H2>2. Definitions</H2>
        <H3>Personal Data</H3>
        <P>
          Any data about an individual who is identifiable by or in relation to that data — for example,
          your name, email address, phone number, delivery address, or device identifiers.
        </P>
        <H3>Sensitive Personal Data</H3>
        <P>
          A narrower category that includes, in our context: your pet's health records (symptoms, diagnosis,
          treatment, and medications), veterinary consultation notes and video sessions, payment and
          financial information, precise location data, and any health information you share with our AI
          nutrition assistant.
        </P>

        <H2>3. Information We Collect</H2>
        <H3>3.1 Information You Provide Directly</H3>
        <Bullet><Text style={styles.bulletBold}>Account & identity data: </Text>first name, last name, email address, phone number, and profile photo.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Authentication data: </Text>if you sign in with Google, we receive your name, email address, and profile photo from Google. We do not receive or store your Google password.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Pet profile data ("Pet Heritage Passport"): </Text>your pet's name, species, breed, gender, date of birth, weight, microchip number (optional), and any photos you upload.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Health records: </Text>if your pet has a veterinary consultation or clinical visit logged on the platform, we store the resulting medical record — symptoms, clinical findings, diagnosis, treatment, prescribed medications, a follow-up date where relevant, and any clinical notes. This is accessible only to you, the treating veterinarian, and authorized staff who need it to operate the service.</Bullet>
        <Bullet><Text style={styles.bulletBold}>AI Pet Vision: </Text>if you use the pet photo scanner, the photo is analyzed to identify your pet's breed. Breed classification runs on our own model; only the resulting breed label (not the raw photo) may be sent to our AI provider to generate care insights.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Meal planning data: </Text>if you use the meal planner, the recipe and portion choices you make, built from your pet's profile.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Delivery & order data: </Text>shipping address (including GPS coordinates when you use location-based address autofill), order history, cart contents, applied coupons, reviews (which may include a photo you attach), and recurring food delivery/subscription details.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Payment data: </Text>processed directly by our payment gateway, Razorpay. We store the order/transaction reference, not your card, UPI, or bank account details.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Veterinary consultation data: </Text>appointment details, your stated reason for the visit, the video-consultation session (hosted on our video infrastructure, see Section 6), and doctor's notes.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Doctor/veterinarian application data: </Text>if you apply to provide consultations, we collect your name, email, phone, nationality, specialization, qualification, medical license number, experience, education history, clinic name/address/city/state, consultation fee, and bio.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Support & communications: </Text>content of support tickets, and newsletter subscription preferences.</Bullet>

        <H3>3.2 Information Collected Automatically</H3>
        <Bullet><Text style={styles.bulletBold}>Device & usage data: </Text>IP address, device model and OS, app version, and crash/error logs, collected to keep the service reliable and secure.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Location data: </Text>with your permission, we use precise device location to auto-fill your delivery address, and Google's Places/geocoding services to find nearby veterinary clinics. You can decline and enter addresses manually.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Push notification tokens: </Text>if you enable notifications, we store a device push token (via Expo's push service) and your platform (iOS/Android) to deliver order updates and reminders.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Crash reporting: </Text>this app uses Sentry to collect crash and error diagnostics, including device information and app state at the time of a crash.</Bullet>

        <H3>3.3 Information We Receive From Third Parties</H3>
        <Bullet><Text style={styles.bulletBold}>Google: </Text>basic profile information when you use "Continue with Google."</Bullet>
        <Bullet><Text style={styles.bulletBold}>WhatsApp / Meta Platforms: </Text>delivery-status confirmation for one-time passcodes used to verify your phone number.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Firebase (Google): </Text>delivery-status confirmation for SMS one-time passcodes, used as a backup verification channel.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Razorpay: </Text>payment status and transaction identifiers once a payment is completed or refunded.</Bullet>
        <Bullet><Text style={styles.bulletBold}>EasyPost and Shiprocket: </Text>shipment status and tracking updates once your order ships.</Bullet>

        <H2>4. How We Use Your Information</H2>
        <Bullet>To create and manage your account, and verify your identity via email, WhatsApp, or SMS.</Bullet>
        <Bullet>To process and deliver your orders, sharing your name, address, and phone with our shipping partners (EasyPost, Shiprocket) solely for that delivery.</Bullet>
        <Bullet>To schedule and facilitate veterinary consultations, including hosting the video call, and to maintain the medical records generated from them.</Bullet>
        <Bullet>To personalize recipe recommendations, meal plans, and AI assistant responses based on your pet's profile.</Bullet>
        <Bullet>To generate AI Pet Vision breed identification and care insights from a photo you submit.</Bullet>
        <Bullet>To verify veterinarians/doctors applying to the platform.</Bullet>
        <Bullet>To send transactional communications (order confirmations, OTPs, appointment reminders, account notices) — not optional while your account is active.</Bullet>
        <Bullet>To send marketing communications only where you've opted in, with an easy way to unsubscribe.</Bullet>
        <Bullet>To detect, investigate, and prevent fraud, abuse, and security incidents.</Bullet>
        <Bullet>To maintain, debug, and improve the platform, including through crash and error reporting.</Bullet>
        <Bullet>To comply with applicable law and enforce our Terms and Conditions.</Bullet>

        <H2>5. Legal Basis for Processing</H2>
        <P>
          Under the Digital Personal Data Protection Act, 2023, we process your personal data primarily on
          the basis of your consent, given when you create an account and agree to this policy. Some
          processing — for example, retaining transaction records for tax purposes, or responding to a
          lawful government request — is carried out to meet our legal obligations. You may withdraw
          consent at any time as described in Section 10, though this may limit our ability to provide
          certain services to you.
        </P>

        <H2>6. How We Share Your Information</H2>
        <P>We do not sell your personal data. We share it only with:</P>
        <Bullet><Text style={styles.bulletBold}>Razorpay Software Private Limited </Text>— payment processing and refunds.</Bullet>
        <Bullet><Text style={styles.bulletBold}>EasyPost and Shiprocket </Text>— your name, address, and phone, to fulfil and track an order.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Firebase / Google Cloud Platform </Text>— phone verification, push notifications, and Google Places/geocoding.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Meta Platforms (WhatsApp Cloud API) </Text>— delivery of one-time passcodes.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Cloudinary Inc. </Text>— hosting for photos and uploaded documents.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Google (Gemini API), with OpenRouter and a Hostinger-hosted AI router as reliability fallbacks </Text>— AI nutrition assistant and AI Pet Vision care-insight generation.</Bullet>
        <Bullet><Text style={styles.bulletBold}>8x8 / Jitsi video infrastructure </Text>— hosts live video and audio for veterinary consultations.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Sentry </Text>— crash and error diagnostics only.</Bullet>
        <Bullet><Text style={styles.bulletBold}>The veterinarian or doctor you book with </Text>— the information needed for that consultation.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Law enforcement or regulators </Text>— where required by Indian law.</Bullet>

        <H2>7. AI Features and Automated Processing</H2>
        <P>
          Our AI nutrition assistant is built on Google's Gemini models, with OpenRouter and a
          Hostinger-hosted AI router available purely as fallback providers for reliability. Your messages
          and pet-profile context are processed to generate a reply and are not used to train the underlying
          model on your personal data. AI Pet Vision runs breed classification on our own locally hosted
          model; only the resulting breed label — not the raw photo — is sent to Gemini for care-insight
          text. AI-generated guidance is informational only and does not replace advice from a licensed
          veterinarian. We do not use AI to make any automated decision with a legal or similarly significant
          effect on you without a human able to review it on request.
        </P>

        <H2>8. Data Retention</H2>
        <P>
          We retain personal data only as long as reasonably necessary to provide the service and meet
          legal, tax, and accounting obligations. Pet health records and consultation data are retained for
          the duration of your account's active use, plus any further period required by law. When you delete your account, you are signed out everywhere and, for 15 days, nothing is deleted: signing in again cancels the deletion. After 15 days we permanently delete your profile, pets, health records, reviews, support history and uploaded photos. Records of completed orders and payments are kept without your name, phone or address, because tax law requires it, as is data relevant to an open fraud investigation or legal claim. For up to 30 days after deletion an encrypted copy of the deleted data is kept so that a mistaken deletion can be recovered; it is then destroyed, and routine backups are overwritten within about 30 days.
        </P>

        <H2>9. Data Security</H2>
        <P>
          We apply safeguards appropriate to the sensitivity of the data involved: encrypted transmission
          (HTTPS/TLS), password-less authentication, hashed and time-limited one-time passcodes, and access
          controls restricting who can view health and payment data. Health records are accessible only to
          the pet's owner, the treating veterinarian, and staff who need access to operate the service. We
          will notify you and the Data Protection Board of India, where required under the DPDP Act, 2023,
          in the event of a breach affecting your data.
        </P>

        <H2>10. Your Rights and Choices</H2>
        <Bullet><Text style={styles.bulletBold}>Access: </Text>view your profile, pet profiles, health records, and order history directly in the app at any time.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Correction: </Text>update your profile, pet details, and delivery addresses yourself, or ask us to correct them.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Consent withdrawal: </Text>withdraw consent for optional processing (marketing, location access) at any time.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Erasure / account deletion: </Text>request deletion of your account and associated data, subject to the retention exceptions in Section 8.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Grievance redressal: </Text>raise a complaint with our Grievance Officer (Section 16); acknowledged within 24 hours, resolved within 7 days where practicable.</Bullet>

        <H2>11. Cookies and Similar Technologies</H2>
        <P>
          Our mobile app does not use browser cookies; it uses a securely stored authentication token on
          your device instead. Our website uses strictly necessary cookies plus Firebase Analytics for
          aggregate usage measurement — not third-party advertising or cross-site tracking.
        </P>

        <H2>12. Children's Privacy</H2>
        <P>
          Hearth & One is intended for use by adults who can enter into a contract under Indian law. We do
          not knowingly collect personal data from children. If you believe a child has provided us with
          personal data, contact us using the details in Section 16 and we will take steps to delete it.
        </P>

        <H2>13. International Data Transfers</H2>
        <P>
          Several of our service providers operate infrastructure outside India, including Google/Firebase,
          Meta (WhatsApp), Cloudinary, OpenRouter, Sentry, and our video-consultation infrastructure. Where
          your data is transferred outside India, we take steps to keep it protected consistent with this
          policy and applicable Indian law.
        </P>

        <H2>14. Third-Party Links and Services</H2>
        <P>
          Our platform may link to third-party services we do not control, including Google, Meta/WhatsApp,
          and Razorpay. This Privacy Policy does not cover their practices.
        </P>

        <H2>15. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time. We will post the updated policy here with a
          revised effective date, and for material changes we will provide more prominent notice before the
          change takes effect.
        </P>

        <H2>16. Grievance Officer and Contact Information</H2>
        <P>
          Consistent with the Digital Personal Data Protection Act, 2023 and the IT Act, 2000, we have
          appointed a Grievance Officer to address your questions, requests, and complaints.
        </P>
        <View style={styles.contactTable}>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Grievance Officer</Text>
            <Text style={styles.contactValue}>Yeswanth S</Text>
          </View>
          <View style={styles.contactRow}>
            <Text style={styles.contactLabel}>Email</Text>
            <Text style={styles.contactValue}>support@hearthandone.com</Text>
          </View>
          <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.contactLabel}>Response Timeline</Text>
            <Text style={styles.contactValue}>Ack. within 24 hours; resolved within 7 days</Text>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  scrollBody: { padding: 20, paddingBottom: 12 },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONT_BODY,
    lineHeight: 19,
    marginBottom: 14,
  },
  h2: {
    fontSize: 17,
    fontFamily: FONT_DISPLAY,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginTop: 20,
    marginBottom: 6,
  },
  h3: {
    fontSize: 14,
    fontFamily: FONT_DISPLAY,
    fontWeight: '700',
    color: COLORS.textCoffee,
    marginTop: 10,
    marginBottom: 4,
  },
  p: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    fontFamily: FONT_BODY,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingRight: 2,
  },
  bulletDot: {
    fontSize: 13,
    color: COLORS.brandGold,
    marginRight: 7,
    lineHeight: 19,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
    fontFamily: FONT_BODY,
  },
  bulletBold: {
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textCoffee,
  },
  subBulletRow: {
    flexDirection: 'row',
    marginLeft: 14,
    marginBottom: 4,
  },
  subBulletDot: {
    fontSize: 11,
    color: COLORS.textLight,
    marginRight: 6,
    lineHeight: 18,
  },
  subBulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT_BODY,
  },
  contactTable: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  contactRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
  },
  contactLabel: {
    fontSize: 10,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.brandGold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contactValue: {
    fontSize: 12.5,
    fontFamily: FONT_BODY,
    color: COLORS.textCoffee,
  },
});
