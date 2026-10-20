import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { StackHeader } from '../components/ScreenHeader';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD } from '../theme/typography';

interface TermsScreenProps {
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

export default function TermsScreen({ navigation }: TermsScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StackHeader title="Terms and Conditions" eyebrow="LEGAL" onBack={() => navigation?.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          The terms that govern your use of the Hearth & One website and mobile app.
        </Text>

        <View style={styles.draftBanner}>
          <AlertTriangle size={16} color="#92400E" style={{ marginTop: 1 }} />
          <Text style={styles.draftBannerText}>
            <Text style={styles.draftBannerBold}>Draft — pending legal review. </Text>
            This page is a working draft published for internal review. It is not yet approved by legal
            counsel and should not be treated as final.
          </Text>
        </View>

        <H2>1. Acceptance of These Terms</H2>
        <P>
          These Terms and Conditions ("Terms") form a binding agreement between you and{' '}
          <Text style={styles.italic}>[Legal entity name — to be filled in before publication]</Text>{' '}
          ("Hearth & One," "we," "us," "our," "the platform") and govern your access to and use of our
          website, our mobile application, and the ordering, delivery, veterinary consultation, and AI
          assistant services available through them. By creating an account, browsing the platform, or
          placing an order, you agree to be bound by these Terms and by our Privacy Policy, which is
          incorporated into these Terms by reference. If you do not agree, please do not use the platform.
        </P>
        <P>
          Where you book a veterinary consultation or use our AI nutrition and health assistant, Section 8
          (Veterinary Telehealth and AI Features) applies in addition to the rest of these Terms and
          contains important limitations you should read carefully.
        </P>

        <H2>2. Eligibility and Your Account</H2>
        <Bullet>You must be at least 18 years old and capable of entering into a binding contract under the Indian Contract Act, 1872 to create an account or place an order on your own behalf.</Bullet>
        <Bullet>The information you provide when registering must be accurate and kept up to date. You are responsible for all activity under your account.</Bullet>
        <Bullet>If you sign in with Google, you authorize us to receive your name, email address, and profile photo from Google, as described in our Privacy Policy.</Bullet>
        <Bullet>You are responsible for keeping your sign-in access secure. Tell us immediately if you believe your account has been accessed without authorization.</Bullet>
        <Bullet>We may suspend or terminate an account that provides false information, is used fraudulently, or breaches these Terms, as described in Section 14.</Bullet>

        <H2>3. Our Services</H2>
        <P>Hearth & One offers, subject to availability in your area and to these Terms:</P>
        <Bullet><Text style={styles.bulletBold}>Pet food ordering and delivery — </Text>small-batch, blast-frozen recipes sold through our shop, including one-time and recurring ("subscription") orders.</Bullet>
        <Bullet><Text style={styles.bulletBold}>An AI nutrition and health assistant — </Text>a conversational assistant built on Google's Gemini models.</Bullet>
        <Bullet><Text style={styles.bulletBold}>AI Pet Vision — </Text>a photo-based breed identification and care-insight tool.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Veterinary teleconsultations — </Text>video consultations with independent, licensed veterinarians who use our platform to offer their services.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Pet Heritage Passport and meal planning — </Text>tools to record your pet's profile and generate personalized recipe and portion recommendations from it.</Bullet>
        <P>
          We may add, change, or discontinue any part of these services at any time. We'll try to give
          reasonable notice of a change that materially reduces a service you're actively subscribed to or
          have an open order for.
        </P>

        <H2>4. Orders, Pricing, and Payment</H2>
        <Bullet><Text style={styles.bulletBold}>Prices </Text>are listed in Indian Rupees (₹) and are subject to change without notice; the price charged is the one shown at checkout.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Taxes: </Text>applicable taxes (including GST) are added at checkout and are your responsibility as the buyer.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Payment: </Text>processed directly by Razorpay. We do not receive or store your card, UPI, or bank account details.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Order confirmation: </Text>a contract is formed only once we confirm acceptance of your order. We may decline or cancel an order — including after payment — due to stock unavailability, a pricing error, a suspected fraud concern, or an undeliverable address, with a refund of any amount already charged.</Bullet>
        <Bullet><Text style={styles.bulletBold}>Subscriptions: </Text>a recurring delivery authorizes us to place and charge for each scheduled order until you pause or cancel it, or we are unable to process a payment or deliver to your address.</Bullet>

        <H2>5. Shipping, Delivery, and Order Changes</H2>
        <P>
          We ship using third-party courier partners, currently EasyPost and Shiprocket. Delivery timelines
          are estimates, not guarantees. Please inspect your delivery on arrival and do not accept a package
          that appears tampered with or damaged — contact support instead.
        </P>
        <P>
          You can cancel an order yourself from the app while it is still in a cancellable status —
          generally, before it has been packed or dispatched. Once an order has shipped, it can no longer be
          cancelled through self-service; contact support about a return instead.
        </P>

        <H2>6. Returns, Refunds, and Cancellations</H2>
        <P>
          Because our recipes are small-batch, perishable, blast-frozen food, we're only able to accept a
          return or refund in specific situations: the order arrived damaged, materially different from what
          you ordered, or was cancelled before dispatch under Section 5. Where a refund is due, we issue it
          to your original payment method; processing time depends on your bank or payment provider. To
          start a return or refund request, contact support with your order number within a reasonable time
          of delivery.
        </P>

        <H2>7. User Conduct</H2>
        <P>You agree not to, on the platform or through our AI assistant:</P>
        <Bullet>Provide false information about yourself, your pet, or a payment method.</Bullet>
        <Bullet>Use the platform for any unlawful purpose, or to harass, abuse, or impersonate another person.</Bullet>
        <Bullet>Attempt to copy, scrape, reverse-engineer, or create derivative works from the platform's software or content.</Bullet>
        <Bullet>Interfere with the platform's security, rate limits, or normal operation, including through automated tools (bots).</Bullet>
        <Bullet>Use the AI assistant or AI Pet Vision to extract another user's data, generate unlawful content, or probe the model for purposes unrelated to pet care.</Bullet>

        <H2>8. Veterinary Telehealth and AI Features — Important Limitations</H2>
        <P><Text style={styles.bulletBold}>This section is central to how you should use our health-related features; please read it carefully.</Text></P>
        <H3>8.1 Veterinarians Are Independent Professionals</H3>
        <P>
          Veterinarians who offer consultations through the platform are independent, licensed
          professionals, not our employees. We provide the technology that connects you to them — we do not
          practice veterinary medicine and are not responsible for the clinical judgment, advice, diagnosis,
          or treatment a veterinarian provides. Your relationship for that advice is with the treating
          veterinarian.
        </P>
        <H3>8.2 AI Guidance Is Informational Only</H3>
        <P>
          Our AI nutrition and health assistant and AI Pet Vision's care insights are generated by automated
          systems based on information you provide. This output is for general informational purposes only.
          It is <Text style={styles.bulletBold}>not</Text> a veterinary diagnosis, is{' '}
          <Text style={styles.bulletBold}>not</Text> a substitute for examination or advice from a licensed
          veterinarian, and should not be relied on as the sole basis for a decision about your pet's
          health, medication, or treatment. Always consult a qualified veterinarian for an actual health
          concern, and seek emergency veterinary care immediately for a symptom that could be serious or
          urgent, rather than waiting on an AI response or a scheduled consultation.
        </P>
        <H3>8.3 Not for Emergencies</H3>
        <P>
          Our platform is not an emergency service and video consultations are scheduled, not immediate. If
          your pet is experiencing a medical emergency, contact your nearest emergency veterinary clinic
          directly rather than using the app.
        </P>

        <H2>9. Intellectual Property</H2>
        <P>
          The Hearth & One name, logo, app, and underlying software are owned by us or our licensors. We
          grant you a limited, non-exclusive, non-transferable license to use the platform for your own
          personal, non-commercial use. You may not copy, modify, distribute, or create derivative works
          from the platform's content or software, or use our branding, without our prior written
          permission. Content you submit remains yours; by submitting it you grant us a license to use it to
          provide and improve the relevant service, consistent with our Privacy Policy.
        </P>

        <H2>10. Third-Party Links and Services</H2>
        <P>
          The platform relies on third-party services we don't control, including Razorpay, EasyPost,
          Shiprocket, Google, Meta/WhatsApp, Cloudinary, and our video-consultation infrastructure. We are
          not responsible for their content, policies, or practices.
        </P>

        <H2>11. Disclaimers</H2>
        <P>
          The platform is provided "as is" and "as available." To the fullest extent permitted by law, we
          disclaim warranties of any kind, express or implied, including merchantability, fitness for a
          particular purpose, and non-infringement. We do not guarantee the platform will be uninterrupted,
          error-free, or completely secure, or that AI-generated content will always be accurate — see
          Section 8 for how that applies to health guidance specifically.
        </P>

        <H2>12. Limitation of Liability</H2>
        <P>
          To the fullest extent permitted by law, Hearth & One and its officers, employees, and affiliates
          will not be liable for any indirect, incidental, special, or consequential damages arising from
          your use of the platform. Nothing in these Terms excludes or limits a liability that cannot
          lawfully be excluded or limited under applicable Indian law.
        </P>

        <H2>13. Indemnification</H2>
        <P>
          You agree to indemnify and hold harmless Hearth & One, its officers, employees, and affiliates
          from any claim, loss, or demand made by a third party due to or arising out of your breach of
          these Terms, your misuse of the platform, or your violation of any law or the rights of a third
          party.
        </P>

        <H2>14. Suspension and Termination</H2>
        <P>
          We may suspend or terminate your access, with or without notice, if we reasonably believe you have
          breached these Terms, engaged in fraudulent or unlawful activity, or created a risk for us or
          another user. You may stop using the platform and request account deletion at any time. Sections
          8, 9, 11, 12, 13, 16, and 17 survive termination of your account.
        </P>

        <H2>15. Grievance Officer and Contact Information</H2>
        <P>
          Consistent with the Information Technology Act, 2000 and its rules, we have appointed a Grievance
          Officer to address your questions and complaints about these Terms. For an order, delivery, or
          payment issue, please contact support through the app first.
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
            <Text style={styles.contactLabel}>Registered Address</Text>
            <Text style={styles.contactValue}>[To be filled in before publication]</Text>
          </View>
        </View>

        <H2>16. Governing Law and Dispute Resolution</H2>
        <P>
          These Terms are governed by the laws of India. Subject to applicable consumer-protection law, any
          dispute arising from these Terms or your use of the platform will be subject to the exclusive
          jurisdiction of the courts of{' '}
          <Text style={styles.italic}>[Governing-law city — to be filled in before publication]</Text>,
          India.
        </P>

        <H2>17. Changes to These Terms</H2>
        <P>
          We may update these Terms from time to time. We will post the updated Terms here with a revised
          effective date, and for a material change we will provide more prominent notice before it takes
          effect. Continuing to use the platform after a change takes effect means you accept the updated
          Terms.
        </P>

        <H2>18. Entire Agreement and Severability</H2>
        <P>
          These Terms, together with our Privacy Policy, make up the entire agreement between you and
          Hearth & One regarding your use of the platform. If any provision is found unenforceable, the rest
          remain in full effect.
        </P>

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
  draftBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  draftBannerText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#92400E',
    fontFamily: FONT_BODY,
  },
  draftBannerBold: {
    fontFamily: FONT_BODY_BOLD,
  },
  italic: {
    fontStyle: 'italic',
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
