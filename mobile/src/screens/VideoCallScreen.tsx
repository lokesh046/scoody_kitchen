import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Platform,
  PermissionsAndroid,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { X, Video, AlertCircle, FileText, Stethoscope, Clock } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { leaveConsultation } from '../api/consultations';
import { fetchPetHealthRecords, HealthRecord } from '../api/pets';

interface VideoCallRouteParams {
  consultationId?: number;
  roomUrl?: string;
  allowedHost?: string;
  petId?: number;
  petName?: string;
}

export default function VideoCallScreen({ navigation, route }: any) {
  const { consultationId, roomUrl, allowedHost, petId, petName }: VideoCallRouteParams =
    route?.params || {};
  const hasSentLeaveTelemetry = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(Platform.OS !== 'android');
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<HealthRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleOpenHistory = useCallback(async () => {
    setShowHistory(true);
    if (historyLoaded || !petId) return;
    setLoadingHistory(true);
    try {
      const res = await fetchPetHealthRecords(petId);
      setHistoryRecords(res.records || []);
      setHistoryLoaded(true);
    } catch {
      // Leave the panel showing its empty state; not worth interrupting the call for this
    } finally {
      setLoadingHistory(false);
    }
  }, [petId, historyLoaded]);

  // Android requires the app to hold CAMERA/RECORD_AUDIO at the OS level before
  // the WebView's own media-capture grant can do anything useful.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      } catch {
        // Fall through and let the WebView surface a clear "camera unavailable" state itself
      } finally {
        setPermissionsReady(true);
      }
    })();
  }, []);

  const handleLeave = useCallback(() => {
    if (!hasSentLeaveTelemetry.current && consultationId) {
      hasSentLeaveTelemetry.current = true;
      leaveConsultation(consultationId).catch(() => {
        // Best-effort telemetry only; never block the user from leaving the call
      });
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation?.navigate('MainTabs', { screen: 'Consult' });
    }
  }, [navigation, consultationId]);

  // Hardware back button on Android should leave the call cleanly, not exit the app
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleLeave();
      return true;
    });
    return () => subscription.remove();
  }, [handleLeave]);

  // Domain lock-in: the WebView may only ever navigate within our own Jitsi server.
  // Anything else (a redirect, an injected link, a compromised script) is blocked outright.
  const handleShouldStartLoad = useCallback(
    (request: WebViewNavigation) => {
      const url = request.url || '';
      if (url.startsWith('about:blank') || url.startsWith('data:')) return true;
      if (!allowedHost) return false;
      return url.startsWith(`https://${allowedHost}/`) || url === `https://${allowedHost}`;
    },
    [allowedHost]
  );

  if (!roomUrl || !allowedHost) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <AlertCircle size={32} color="#F87171" />
          <Text style={styles.errorTitle}>Meeting Link Unavailable</Text>
          <Text style={styles.errorSub}>
            This consultation's video link could not be loaded. Please go back and try joining again.
          </Text>
          <TouchableOpacity style={styles.errorBackBtn} onPress={handleLeave} activeOpacity={0.85}>
            <Text style={styles.errorBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleLeave}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleRow}>
            <Video size={15} color="#A7F3D0" />
            <Text style={styles.headerTitle}>Video Consultation</Text>
          </View>
          {petId ? (
            <TouchableOpacity
              onPress={handleOpenHistory}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <FileText size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>
      </SafeAreaView>

      {loadError ? (
        <View style={styles.errorContainer}>
          <AlertCircle size={32} color="#F87171" />
          <Text style={styles.errorTitle}>Connection Problem</Text>
          <Text style={styles.errorSub}>
            Could not connect to the video consultation. Please check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.errorBackBtn}
            onPress={() => setLoadError(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.errorBackBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !permissionsReady ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.forestGreen} />
          <Text style={styles.loaderText}>Requesting camera & microphone access...</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: roomUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElseDeny"
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          onError={() => setLoadError(true)}
          onHttpError={() => setLoadError(true)}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.forestGreen} />
              <Text style={styles.loaderText}>Connecting to your veterinary consultation...</Text>
            </View>
          )}
        />
      )}

      {/* Pet Health History Panel — an overlay, not a separate screen, so the call stays connected underneath */}
      {showHistory && (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <View style={styles.historyHeaderTitleRow}>
              <Stethoscope size={16} color={COLORS.forestGreen} />
              <Text style={styles.historyHeaderTitle}>
                {petName ? `${petName}'s Health History` : 'Pet Health History'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowHistory(false)}
              style={styles.historyCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.historyScroll}
            contentContainerStyle={styles.historyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loadingHistory ? (
              <View style={styles.historyLoadingBox}>
                <ActivityIndicator size="small" color={COLORS.forestGreen} />
                <Text style={styles.historyLoadingText}>Loading past records...</Text>
              </View>
            ) : historyRecords.length === 0 ? (
              <View style={styles.historyEmptyBox}>
                <FileText size={28} color={COLORS.textLight} />
                <Text style={styles.historyEmptyText}>
                  No previous health records for this companion yet.
                </Text>
              </View>
            ) : (
              historyRecords.map((record) => (
                <View key={record.id} style={styles.historyRecordCard}>
                  <View style={styles.historyRecordHeaderRow}>
                    <Text style={styles.historyRecordTitle}>{record.title}</Text>
                    <View style={styles.historyRecordDateRow}>
                      <Clock size={11} color={COLORS.textLight} />
                      <Text style={styles.historyRecordDate}>
                        {new Date(record.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  {record.diagnosis && (
                    <Text style={styles.historyRecordLine}>
                      <Text style={styles.historyRecordLabel}>Diagnosis: </Text>
                      {record.diagnosis}
                    </Text>
                  )}
                  {record.treatment && (
                    <Text style={styles.historyRecordLine}>
                      <Text style={styles.historyRecordLabel}>Treatment: </Text>
                      {record.treatment}
                    </Text>
                  )}
                  {record.medications && (
                    <Text style={styles.historyRecordLine}>
                      <Text style={styles.historyRecordLabel}>Medications: </Text>
                      {record.medications}
                    </Text>
                  )}
                  {record.notes && (
                    <Text style={styles.historyRecordLine}>
                      <Text style={styles.historyRecordLabel}>Notes: </Text>
                      {record.notes}
                    </Text>
                  )}
                </View>
              ))
            )}

            <View style={styles.historyFooterNote}>
              <Text style={styles.historyFooterNoteText}>
                Any diagnosis or prescription the doctor adds for this consultation will appear
                here and in {petName || "your pet's"} Health Diary after your call.
              </Text>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#17233D' },
  headerSafeArea: { backgroundColor: '#17233D' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: { width: 36 },
  webview: { flex: 1, backgroundColor: '#17233D' },
  loaderContainer: {
    flex: 1,
    backgroundColor: '#17233D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4E2D8',
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  errorSub: {
    fontSize: 13,
    color: '#D4E2D8',
    textAlign: 'center',
    lineHeight: 19,
  },
  errorBackBtn: {
    marginTop: 8,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBackBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  historyPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '72%',
    backgroundColor: COLORS.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  historyHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  historyHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  historyCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyScroll: { flex: 1 },
  historyScrollContent: { padding: 18, gap: 12, paddingBottom: 28 },
  historyLoadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  historyLoadingText: { fontSize: 12, color: COLORS.textMuted },
  historyEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  historyEmptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  historyRecordCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    padding: 14,
    gap: 5,
    marginBottom: 12,
  },
  historyRecordHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  historyRecordTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    flexShrink: 1,
    marginRight: 8,
  },
  historyRecordDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  historyRecordDate: { fontSize: 10, color: COLORS.textLight },
  historyRecordLine: {
    fontSize: 12.5,
    color: COLORS.textCoffee,
    lineHeight: 18,
  },
  historyRecordLabel: {
    fontWeight: '700',
    color: COLORS.forestGreen,
  },
  historyFooterNote: {
    backgroundColor: '#FAF5EE',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  historyFooterNoteText: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
});
