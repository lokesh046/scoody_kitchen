import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { X, ShieldCheck, Sparkles, Info } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useResponsive } from '../hooks/useResponsive';

interface RazorpayModalProps {
  visible: boolean;
  description: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  onSuccess: (paymentData: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure: (errorMessage?: string, isDismissed?: boolean) => void;
  onClose: () => void;
}

export default function RazorpayModal({
  visible,
  description,
  razorpayOrderId,
  razorpayKeyId,
  amount,
  userName,
  userEmail,
  userPhone,
  onSuccess,
  onFailure,
  onClose,
}: RazorpayModalProps) {
  const { isTablet } = useResponsive();
  if (!visible || !razorpayOrderId || !razorpayKeyId) return null;

  const amountInPaise = Math.round(amount * 100);
  const cleanPhone = (userPhone || '').replace(/\D/g, '').slice(-10) || '9876543210';
  const safeDescription = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const handleDismiss = () => {
    onFailure('Payment checkout was dismissed before completing.', true);
  };

  const checkoutHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #F9F6F0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 90vh;
            color: #2C1810;
            text-align: center;
          }
          .title {
            font-size: 18px;
            font-weight: 800;
            margin-bottom: 8px;
            color: #2C1810;
          }
          .sub {
            font-size: 13px;
            color: #6E6259;
          }
        </style>
      </head>
      <body>
        <div class="title">Scooby's Kitchen</div>
        <div class="sub">Launching secure Razorpay checkout sheet...</div>

        <script>
          window.onload = function() {
            try {
              var options = {
                key: "${razorpayKeyId}",
                amount: "${amountInPaise}",
                currency: "INR",
                name: "Scooby's Kitchen",
                description: "${safeDescription}",
                order_id: "${razorpayOrderId}",
                prefill: {
                  name: "${userName || 'Pet Parent'}",
                  email: "${userEmail || 'petparent@gmail.com'}",
                  contact: "${cleanPhone}"
                },
                theme: {
                  color: "#3F5E4D"
                },
                handler: function(response) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: "SUCCESS",
                    payload: {
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_signature: response.razorpay_signature
                    }
                  }));
                },
                modal: {
                  ondismiss: function() {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: "CANCELLED"
                    }));
                  }
                }
              };

              var rzp = new Razorpay(options);
              rzp.on("payment.failed", function(response) {
                // Keep modal open so customer can select another method or retry with test card!
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: "ATTEMPT_FAILED",
                  error: response.error ? response.error.description : "Payment method declined"
                }));
              });

              rzp.open();
            } catch (err) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: "FAILED",
                error: err.message
              }));
            }
          };
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SUCCESS') {
        onSuccess(data.payload);
      } else if (data.type === 'FAILED') {
        onFailure(data.error || 'Payment failed at gateway.', false);
      } else if (data.type === 'ATTEMPT_FAILED') {
        // Individual attempt failed inside sheet; keep sheet open for retry
        console.log('[Razorpay] Payment attempt note:', data.error);
      } else if (data.type === 'CANCELLED') {
        onFailure('Payment checkout sheet was closed before completing.', true);
      }
    } catch (e) {
      console.log('Error parsing WebView message:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={isTablet} onRequestClose={handleDismiss}>
      <View style={isTablet ? styles.tabletBackdrop : styles.container}>
        {isTablet && (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        )}
        <View style={isTablet ? styles.tabletCard : styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <ShieldCheck size={18} color={COLORS.forestGreen} />
              <Text style={styles.headerTitle}>Razorpay Secure Checkout</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
            <X size={20} color={COLORS.textCoffee} />
          </TouchableOpacity>
        </View>

        {/* Test Mode Guidance Banner */}
        <View style={styles.testBanner}>
          <View style={styles.testBannerHeader}>
            <Sparkles size={14} color={COLORS.brandGold} />
            <Text style={styles.testBannerTitle}>RAZORPAY TEST MODE TIPS</Text>
          </View>
          <Text style={styles.testBannerItem}>
            🌟 <Text style={styles.bold}>Fastest (Netbanking):</Text> Select <Text style={styles.bold}>Netbanking</Text> &rarr; Pick <Text style={styles.bold}>HDFC/SBI</Text> &rarr; Tap <Text style={styles.successTag}>Success</Text>
          </Text>
          <Text style={styles.testBannerItem}>
            💳 <Text style={styles.bold}>Domestic Card:</Text> <Text style={styles.bold}>4718 6091 0820 4366</Text> | Exp: Future | CVV: 123 (Tap <Text style={styles.successTag}>Success</Text>)
          </Text>
          <Text style={styles.testBannerNote}>
            ⚠️ Do not use 4111 1111... (international cards are disabled on this test account). Do not tap GPay in emulator.
          </Text>
        </View>

        {/* WebView */}
        <WebView
          originWhitelist={['*']}
          source={{ html: checkoutHtml, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          onShouldStartLoadWithRequest={(request) => {
            if (
              request.url.startsWith('http://') ||
              request.url.startsWith('https://') ||
              request.url.startsWith('about:blank') ||
              request.url.startsWith('data:')
            ) {
              return true;
            }
            // For external schemes like upi:// or intent://
            Linking.canOpenURL(request.url)
              .then((supported) => {
                if (supported) {
                  Linking.openURL(request.url);
                } else {
                  Alert.alert(
                    'UPI App Not Found',
                    'No UPI app (Google Pay / PhonePe) is installed on this Android emulator. Please use Card (4111 1111 1111 1111) or Netbanking.',
                  );
                }
              })
              .catch(() => {});
            return false;
          }}
          renderLoading={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.forestGreen} />
              <Text style={styles.loaderText}>Connecting to Razorpay gateway...</Text>
            </View>
          )}
          style={styles.webView}
        />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tabletBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 35, 61, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tabletCard: {
    width: '100%',
    maxWidth: 580,
    height: '85%',
    maxHeight: 800,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.canvas,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  container: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textCoffee },
  closeBtn: { padding: 4 },
  testBanner: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E6DCB8',
    gap: 4,
  },
  testBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  testBannerTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#8A6A1C',
  },
  testBannerItem: {
    fontSize: 11.5,
    color: COLORS.textCoffee,
    lineHeight: 16,
  },
  testBannerNote: {
    fontSize: 10.5,
    color: '#8A5A1C',
    lineHeight: 14,
    marginTop: 2,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  successTag: {
    fontWeight: '800',
    color: COLORS.forestGreen,
  },
  webView: { flex: 1 },
  loaderContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
});
