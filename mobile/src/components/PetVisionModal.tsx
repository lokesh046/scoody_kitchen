import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  Camera,
  Image as ImageIcon,
  X,
  Check,
  Zap,
  ShieldAlert,
  Award,
  Heart,
  RefreshCw,
  Compass,
  AlertCircle,
  Flame,
  CheckCircle2,
  ShieldCheck,
  Globe2,
  Dna,
  Gauge,
  Download,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { COLORS } from '../theme/colors';
import { classifyPetPhoto, ClassificationResponse, BreedHeritage } from '../api/vision';
import PassportContent, { PassportFormat } from './PassportContent';

interface PetVisionModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyPetDetails?: (details: {
    species: string;
    breed: string;
    imageUrl?: string;
    careInsights?: any;
  }) => void;
}

export default function PetVisionModal({
  visible,
  onClose,
  onApplyPetDetails,
}: PetVisionModalProps) {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [result, setResult] = useState<ClassificationResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Shareable Pet Heritage Passport export (native parity with web's
  // PetHeritagePassport component — see frontend/src/components/PetHeritagePassport.tsx).
  const [exportFormat, setExportFormat] = useState<PassportFormat>('card');
  const [isExportingPassport, setIsExportingPassport] = useState(false);
  const passportRef = useRef<View>(null);

  // Animated laser line for scanning effect
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (isScanning) {
      scanAnim.setValue(0);
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1600,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1600,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      scanAnim.stopAnimation();
    }
    return () => {
      if (animLoop) animLoop.stop();
    };
  }, [isScanning, scanAnim]);

  const handleReset = () => {
    setSelectedImageUri(null);
    setResult(null);
    setScanError(null);
    setIsScanning(false);
  };

  const handlePickImage = async (useCamera: boolean) => {
    setScanError(null);
    try {
      let imageUri: string | undefined;

      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to scan your companion.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          imageUri = res.assets[0].uri;
        }
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.85,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          imageUri = res.assets[0].uri;
        }
      }

      if (imageUri) {
        setSelectedImageUri(imageUri);
        await runClassification(imageUri);
      }
    } catch (err: any) {
      console.warn('Image picker error:', err);
      setScanError(err.message || 'Could not load photo. Please try again.');
    }
  };

  const runClassification = async (imageUri: string) => {
    setIsScanning(true);
    setResult(null);
    setScanError(null);

    try {
      const data = await classifyPetPhoto(imageUri);
      setResult(data);
      if (!data.success || !data.is_pet) {
        setScanError(
          data.error_message ||
            'No companion detected in the photo. Please snap a clear photo showing your dog or cat.'
        );
      }
    } catch (err: any) {
      console.warn('Classification error:', err);
      setScanError(
        err.response?.data?.detail ||
          err.message ||
          'Failed to connect to Pet Vision AI. Ensure the service is running.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleApplyToRegistration = () => {
    if (!result || !result.is_pet) return;
    if (onApplyPetDetails) {
      onApplyPetDetails({
        species: result.species || 'Dog',
        breed: result.primary_breed || 'Mixed Breed',
        imageUrl: selectedImageUri || undefined,
        careInsights: result.care_insights,
      });
    }
    onClose();
  };

  const confidencePct = result?.confidence ? Math.round(result.confidence * 100) : 0;

  // Mirrors web's PetHeritagePassport passport-code generation exactly, so
  // the same breed produces a recognizably-shaped (if not byte-identical,
  // since Date.now()'s year is the only shared input) document number.
  const passportCode = result?.primary_breed
    ? `SK-PASSPORT-${Math.abs(
        result.primary_breed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 1000)
      )}-${new Date().getFullYear()}`
    : '';

  const handleExportPassport = async () => {
    if (!result?.heritage) return;
    setIsExportingPassport(true);
    try {
      // Let the off-screen passport view commit its layout (format toggle,
      // image decode) before rasterizing it — capturing on the same tick as
      // a state change can grab a stale frame.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const uri = await captureRef(passportRef, { format: 'png', quality: 1 });

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Photo library access is required to save the passport.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Pet Heritage Passport' });
      } else {
        Alert.alert('Saved', 'The passport has been saved to your photo library.');
      }
    } catch (err) {
      console.warn('Passport export error:', err);
      Alert.alert('Export Failed', 'Could not export the passport. Please try again.');
    } finally {
      setIsExportingPassport(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerIconCircle}>
              <Sparkles size={18} color={COLORS.brandGold} />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Pet Vision Scanner</Text>
              <Text style={styles.headerSub}>Instant Breed & Nutrition Blueprint</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close pet vision scanner"
          >
            <X size={22} color={COLORS.textCoffee} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Hero / Viewfinder Container */}
          <View style={styles.viewfinderContainer}>
            {selectedImageUri ? (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} contentFit="cover" />
                {isScanning && (
                  <>
                    <View style={styles.scanOverlayMask} />
                    <Animated.View
                      style={[
                        styles.laserLine,
                        {
                          transform: [
                            {
                              translateY: scanAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 230],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </>
                )}
              </View>
            ) : (
              <View style={styles.emptyViewfinder}>
                {/* Viewfinder corner markers */}
                <View style={[styles.cornerBracket, styles.bracketTL]} />
                <View style={[styles.cornerBracket, styles.bracketTR]} />
                <View style={[styles.cornerBracket, styles.bracketBL]} />
                <View style={[styles.cornerBracket, styles.bracketBR]} />

                <View style={styles.viewfinderCenter}>
                  <View style={styles.scanCenterBadge}>
                    <Compass size={36} color={COLORS.forestGreen} />
                  </View>
                  <Text style={styles.viewfinderInstruction}>
                    Snap or upload a photo of your companion
                  </Text>
                  <Text style={styles.viewfinderHint}>
                    Instant breed identification, superpower radar & custom meal plan
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Action Trigger Buttons (When no image or after scan) */}
          {!isScanning && (
            <View style={styles.actionButtonRow}>
              <TouchableOpacity
                style={[styles.cameraActionBtn, styles.primaryCameraBtn]}
                onPress={() => handlePickImage(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={selectedImageUri ? 'Retake photo' : 'Take photo'}
              >
                <Camera size={18} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.primaryCameraBtnText}>
                  {selectedImageUri ? 'Retake Photo' : 'Take Photo'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.cameraActionBtn, styles.secondaryCameraBtn]}
                onPress={() => handlePickImage(false)}
                accessibilityRole="button"
                accessibilityLabel="Choose photo from gallery"
                activeOpacity={0.85}
              >
                <ImageIcon size={18} color={COLORS.forestGreen} strokeWidth={2.2} />
                <Text style={styles.secondaryCameraBtnText}>Choose Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scanning Progress Banner */}
          {isScanning && (
            <View style={styles.scanningBanner}>
              <ActivityIndicator size="small" color={COLORS.forestGreen} />
              <View style={{ flex: 1 }}>
                <Text style={styles.scanningBannerTitle}>Analyzing Pet Markers...</Text>
                <Text style={styles.scanningBannerSub}>
                  Scanning coat texture, muzzle silhouette & breed characteristics
                </Text>
              </View>
            </View>
          )}

          {/* Error / Not Pet Banner */}
          {scanError && !isScanning && (
            <View style={styles.errorCard}>
              <AlertCircle size={24} color={COLORS.accentRed} />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorCardTitle}>Detection Notice</Text>
                <Text style={styles.errorCardText}>{scanError}</Text>
              </View>
            </View>
          )}

          {/* Successful Classification Result */}
          {result && result.success && result.is_pet && !isScanning && (
            <View style={styles.resultContainer}>
              {/* Primary Match Card */}
              <View style={styles.primaryMatchCard}>
                <View style={styles.matchHeaderRow}>
                  <View style={styles.speciesBadge}>
                    <Text style={styles.speciesBadgeText}>
                      {result.species?.toUpperCase() || 'COMPANION'}
                    </Text>
                  </View>
                  <View style={styles.confidencePill}>
                    <CheckCircle2 size={13} color="#FFFFFF" />
                    <Text style={styles.confidencePillText}>{confidencePct}% Match</Text>
                  </View>
                </View>

                <Text style={styles.breedName}>{result.primary_breed}</Text>

                {result.top_matches && result.top_matches.length > 1 && (
                  <View style={styles.topMatchesRow}>
                    <Text style={styles.otherMatchesLabel}>Other close matches:</Text>
                    <View style={styles.otherMatchesPills}>
                      {result.top_matches.slice(1, 3).map((match, idx) => (
                        <View key={idx} style={styles.otherMatchPill}>
                          <Text style={styles.otherMatchPillText}>
                            {match.breed} ({Math.round(match.confidence * 100)}%)
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Care & Nutritional Focus Blueprint */}
              {result.care_insights && (
                <View style={styles.blueprintCard}>
                  <View style={styles.sectionTitleRow}>
                    <Flame size={18} color={COLORS.brandGold} />
                    <Text style={styles.sectionTitle}>Nutrition & Care Blueprint</Text>
                  </View>

                  <View style={styles.blueprintGrid}>
                    <View style={styles.blueprintItem}>
                      <Text style={styles.blueprintItemLabel}>Adult Size</Text>
                      <Text style={styles.blueprintItemValue}>
                        {result.care_insights.adult_size_category}
                      </Text>
                    </View>
                    <View style={styles.blueprintItem}>
                      <Text style={styles.blueprintItemLabel}>Temperament</Text>
                      <Text style={styles.blueprintItemValue} numberOfLines={1}>
                        {result.care_insights.temperament}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.nutritionHighlight}>
                    <Text style={styles.nutritionFocusLabel}>Nutritional Focus</Text>
                    <Text style={styles.nutritionFocusValue}>
                      {result.care_insights.nutritional_focus}
                    </Text>
                  </View>

                  <View style={styles.recipeRecommendation}>
                    <Text style={styles.recipeRecLabel}>Recommended Scooby Kitchen Pouch:</Text>
                    <View style={styles.recipeRecBadge}>
                      <Award size={14} color={COLORS.forestGreen} />
                      <Text style={styles.recipeRecText}>
                        {result.care_insights.recommended_recipe}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Superpower Radar Skills */}
              {result.heritage?.superpowers && (
                <View style={styles.superpowersCard}>
                  <View style={styles.sectionTitleRow}>
                    <Zap size={18} color={COLORS.brandGold} />
                    <Text style={styles.sectionTitle}>Breed Superpower Radar</Text>
                  </View>

                  <View style={styles.skillRow}>
                    <View style={styles.skillLabelCol}>
                      <Text style={styles.skillLabel}>Scent Radar</Text>
                      <Text style={styles.skillScore}>
                        {result.heritage.superpowers.scent_radar}/10
                      </Text>
                    </View>
                    <View style={styles.skillBarBg}>
                      <View
                        style={[
                          styles.skillBarFill,
                          { width: `${(result.heritage.superpowers.scent_radar / 10) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.skillRow}>
                    <View style={styles.skillLabelCol}>
                      <Text style={styles.skillLabel}>Stamina & Speed</Text>
                      <Text style={styles.skillScore}>
                        {result.heritage.superpowers.stamina_speed}/10
                      </Text>
                    </View>
                    <View style={styles.skillBarBg}>
                      <View
                        style={[
                          styles.skillBarFill,
                          { width: `${(result.heritage.superpowers.stamina_speed / 10) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.skillRow}>
                    <View style={styles.skillLabelCol}>
                      <Text style={styles.skillLabel}>Cuddle & Affection Index</Text>
                      <Text style={styles.skillScore}>
                        {result.heritage.superpowers.cuddle_index}/10
                      </Text>
                    </View>
                    <View style={styles.skillBarBg}>
                      <View
                        style={[
                          styles.skillBarFill,
                          { width: `${(result.heritage.superpowers.cuddle_index / 10) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.skillRow}>
                    <View style={styles.skillLabelCol}>
                      <Text style={styles.skillLabel}>Watchdog Instinct</Text>
                      <Text style={styles.skillScore}>
                        {result.heritage.superpowers.watchdog_instinct}/10
                      </Text>
                    </View>
                    <View style={styles.skillBarBg}>
                      <View
                        style={[
                          styles.skillBarFill,
                          { width: `${(result.heritage.superpowers.watchdog_instinct / 10) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.skillRow}>
                    <View style={styles.skillLabelCol}>
                      <Text style={styles.skillLabel}>Swimming Affinity</Text>
                      <Text style={styles.skillScore}>
                        {result.heritage.superpowers.swimming_affinity}/10
                      </Text>
                    </View>
                    <View style={styles.skillBarBg}>
                      <View
                        style={[
                          styles.skillBarFill,
                          { width: `${(result.heritage.superpowers.swimming_affinity / 10) * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Heritage & Origin Story */}
              {result.heritage && (
                <View style={styles.heritageCard}>
                  <View style={styles.sectionTitleRow}>
                    <Award size={18} color={COLORS.forestGreen} />
                    <Text style={styles.sectionTitle}>
                      Heritage: {result.heritage.origin_country} {result.heritage.origin_flag}
                    </Text>
                  </View>
                  <Text style={styles.heritageSub}>
                    Origin Era: {result.heritage.origin_era} • {result.heritage.historical_homeland}
                  </Text>
                  {result.heritage.mutation_story ? (
                    <Text style={styles.heritageStory}>{result.heritage.mutation_story}</Text>
                  ) : null}
                </View>
              )}

              {/* Shareable Pet Heritage Passport Export */}
              {result.heritage && (
                <View style={styles.passportExportCard}>
                  <View style={styles.sectionTitleRow}>
                    <ShieldCheck size={18} color={COLORS.forestGreen} />
                    <Text style={styles.sectionTitle}>Export Heritage Passport</Text>
                  </View>
                  <Text style={styles.passportExportHint}>
                    Save a keepsake passport card to your photo library or share it.
                  </Text>

                  <View style={styles.formatToggleRow}>
                    <TouchableOpacity
                      style={[styles.formatToggleBtn, exportFormat === 'card' && styles.formatToggleBtnActive]}
                      onPress={() => setExportFormat('card')}
                      accessibilityRole="button"
                      accessibilityLabel="Card format"
                      accessibilityState={{ selected: exportFormat === 'card' }}
                    >
                      <Text style={[styles.formatToggleText, exportFormat === 'card' && styles.formatToggleTextActive]}>
                        Card
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.formatToggleBtn, exportFormat === 'story' && styles.formatToggleBtnActive]}
                      onPress={() => setExportFormat('story')}
                      accessibilityRole="button"
                      accessibilityLabel="Story format"
                      accessibilityState={{ selected: exportFormat === 'story' }}
                    >
                      <Text style={[styles.formatToggleText, exportFormat === 'story' && styles.formatToggleTextActive]}>
                        Story
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.exportPassportBtn, isExportingPassport && styles.exportPassportBtnDisabled]}
                    onPress={handleExportPassport}
                    disabled={isExportingPassport}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Export passport"
                    accessibilityState={{ disabled: isExportingPassport, busy: isExportingPassport }}
                  >
                    {isExportingPassport ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Download size={16} color="#FFFFFF" />
                    )}
                    <Text style={styles.exportPassportBtnText}>
                      {isExportingPassport ? 'Generating Passport...' : 'Export Passport'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Apply / Use for Companion CTA */}
              {onApplyPetDetails && (
                <TouchableOpacity
                  style={styles.applyBtn}
                  onPress={handleApplyToRegistration}
                  activeOpacity={0.88}
                  accessibilityRole="button"
                  accessibilityLabel={`Auto-fill ${result.primary_breed || 'pet'} profile`}
                >
                  <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.applyBtnText}>Auto-Fill {result.primary_breed} Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Feature Points when no results */}
          {!result && !isScanning && (
            <View style={styles.infoSection}>
              <Text style={styles.infoSectionHeading}>How Pet Vision AI Works</Text>
              <View style={styles.infoPoint}>
                <View style={styles.infoDot} />
                <Text style={styles.infoPointText}>
                  Sub-second in-memory ONNX + Gemini 3.1 Flash neural classification.
                </Text>
              </View>
              <View style={styles.infoPoint}>
                <View style={styles.infoDot} />
                <Text style={styles.infoPointText}>
                  Recognizes Indian native breeds (Indie, Mudhol Hound, Chippiparai) and all international breeds.
                </Text>
              </View>
              <View style={styles.infoPoint}>
                <View style={styles.infoDot} />
                <Text style={styles.infoPointText}>
                  Generates an immediate nutritional blueprint tailored to breed metabolism and coat health.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Off-screen render target for react-native-view-shot — mounted
            whenever heritage data exists so its image has already decoded
            by the time the user taps Export, but positioned far outside the
            viewport so it's never visible or scrollable into view. */}
        {result?.heritage && (
          <View style={styles.offscreenCaptureHost} pointerEvents="none">
            <PassportContent
              ref={passportRef}
              format={exportFormat}
              petName="Honored Companion"
              breedName={result.primary_breed || 'Mixed Breed'}
              species={result.species || 'Dog'}
              photoUri={selectedImageUri}
              heritage={result.heritage}
              passportCode={passportCode}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    backgroundColor: COLORS.card,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF4EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EFE3D3',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },

  /* Viewfinder */
  viewfinderContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  imageWrapper: {
    width: '100%',
    height: 240,
    position: 'relative',
    backgroundColor: '#000000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  scanOverlayMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(63, 94, 77, 0.25)',
  },
  laserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00E676',
    shadowColor: '#00E676',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyViewfinder: {
    height: 200,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F7F3ED',
  },
  cornerBracket: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: COLORS.forestGreen,
  },
  bracketTL: {
    top: 14,
    left: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  bracketTR: {
    top: 14,
    right: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  bracketBL: {
    bottom: 14,
    left: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  bracketBR: {
    bottom: 14,
    right: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  viewfinderCenter: {
    alignItems: 'center',
    gap: 8,
  },
  scanCenterBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EBE2D5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  viewfinderInstruction: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textCoffee,
    textAlign: 'center',
  },
  viewfinderHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 240,
  },

  /* Buttons */
  actionButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cameraActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryCameraBtn: {
    backgroundColor: COLORS.forestGreen,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  primaryCameraBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryCameraBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.forestGreen,
  },
  secondaryCameraBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },

  /* Scanning Status */
  scanningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF4EB',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EBDDC9',
  },
  scanningBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  scanningBannerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },

  /* Error Card */
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDEDEC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  errorCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accentRed,
  },
  errorCardText: {
    fontSize: 11,
    color: COLORS.textCoffee,
    marginTop: 2,
  },

  /* Results */
  resultContainer: {
    gap: 14,
  },
  primaryMatchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  matchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speciesBadge: {
    backgroundColor: '#EAE1D5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  speciesBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textCoffee,
    letterSpacing: 0.5,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  confidencePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  breedName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textCoffee,
  },
  topMatchesRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.kraftBorder,
    paddingTop: 8,
  },
  otherMatchesLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  otherMatchesPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  otherMatchPill: {
    backgroundColor: COLORS.canvas,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  otherMatchPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textCoffee,
  },

  /* Blueprint */
  blueprintCard: {
    backgroundColor: '#FAF4EB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8DCB9',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  blueprintGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  blueprintItem: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  blueprintItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  blueprintItemValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginTop: 2,
  },
  nutritionHighlight: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  nutritionFocusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandGold,
    textTransform: 'uppercase',
  },
  nutritionFocusValue: {
    fontSize: 12,
    color: COLORS.textCoffee,
    marginTop: 4,
    lineHeight: 18,
  },
  recipeRecommendation: {
    gap: 6,
  },
  recipeRecLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  recipeRecBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8EFE9',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C3D8C8',
  },
  recipeRecText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.forestGreen,
  },

  /* Superpowers */
  superpowersCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 10,
  },
  skillRow: {
    gap: 4,
  },
  skillLabelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textCoffee,
  },
  skillScore: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brandGold,
  },
  skillBarBg: {
    height: 7,
    backgroundColor: '#EFEBE4',
    borderRadius: 4,
    overflow: 'hidden',
  },
  skillBarFill: {
    height: '100%',
    backgroundColor: COLORS.brandGold,
    borderRadius: 4,
  },

  /* Heritage */
  heritageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 6,
  },
  heritageSub: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  heritageStory: {
    fontSize: 12,
    color: COLORS.textCoffee,
    lineHeight: 18,
    marginTop: 4,
  },

  /* Passport Export */
  passportExportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 12,
  },
  passportExportHint: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: -6,
  },
  formatToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.canvas,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  formatToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  formatToggleBtnActive: {
    backgroundColor: COLORS.forestGreen,
  },
  formatToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  formatToggleTextActive: {
    color: '#FFFFFF',
  },
  exportPassportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.brandGold,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exportPassportBtnDisabled: {
    opacity: 0.6,
  },
  exportPassportBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  offscreenCaptureHost: {
    position: 'absolute',
    top: -10000,
    left: 0,
  },

  /* Apply CTA */
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: COLORS.forestGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
    marginTop: 4,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  /* Info Section */
  infoSection: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    gap: 10,
    marginTop: 8,
  },
  infoSectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textCoffee,
    marginBottom: 4,
  },
  infoPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brandGold,
    marginTop: 5,
  },
  infoPointText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 17,
  },
});
