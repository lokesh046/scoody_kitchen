import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { X, Compass, MapPin, Navigation, Locate, Phone, Clock } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, LEDGER_MONO } from '../../theme/typography';
import { BASE_URL } from '../../api/client';
import {
  fetchNearbyClinics,
  fetchClinicDetails,
  fetchDoctorDetail,
  buildDirectionsUrl,
  type NearbyClinicResult,
  type PlaceDetailsResponse,
} from '../../api/doctors';
import { lookupPincode } from '../../api/geo';
import { Doctor } from '../../types';

const RADIUS_PRESETS_KM = [2, 5, 10] as const;

// Same default center used by the web app's Checkout/Vets-Near-Me map
// pickers — just a starting viewport until a real location is picked.
const DEFAULT_MAP_COORDS = { lat: 13.0827, lng: 80.2707 };

interface NearbyVetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDoctor: (doctor: Doctor) => void;
  onBookOnlineInstead: () => void;
}

export function NearbyVetsModal({ isOpen, onClose, onSelectDoctor, onBookOnlineInstead }: NearbyVetsModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCoords, setMapCoords] = useState(DEFAULT_MAP_COORDS);
  const [radiusKm, setRadiusKm] = useState<2 | 5 | 10>(5);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pincode, setPincode] = useState('');
  // Shown immediately on open, matching the web app's Vets Near Me panel —
  // the map + search controls are the primary way in, not a hidden extra.
  const [showMapPicker, setShowMapPicker] = useState(true);
  const [results, setResults] = useState<NearbyClinicResult[]>([]);
  const [radiusUsed, setRadiusUsed] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState('');
  const [inspectingClinic, setInspectingClinic] = useState<NearbyClinicResult | null>(null);
  const [detailsCache, setDetailsCache] = useState<Record<string, PlaceDetailsResponse>>({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingDoctor, setIsLoadingDoctor] = useState<number | null>(null);

  const runSearch = async (lat: number, lng: number, radius: 2 | 5 | 10) => {
    setIsSearching(true);
    setError('');
    setInspectingClinic(null);
    try {
      const data = await fetchNearbyClinics(lat, lng, radius);
      setResults(data.results);
      setRadiusUsed(data.radius_km_used);
      setFallback(data.fallback_to_registered_only);
      if (data.results.length === 0) {
        setError('No clinics or specialists found within the specified radius.');
      }
    } catch (err: any) {
      console.error('Nearby search failed:', err);
      setError(err?.response?.data?.detail || 'Nearby search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Moves the map picker's pin and animates the camera there — used by
  // GPS locate, pincode search, and dragging/tapping the marker alike, so
  // there's exactly one place that keeps the map view and pin in sync.
  const updateMapPin = (lat: number, lng: number, animate = true) => {
    setMapCoords({ lat, lng });
    if (animate) {
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 800);
    }
  };

  // Same GPS-first pattern already established in CartScreen.tsx, minus the
  // third-party IP fallback chain — the map picker (drag/search) covers
  // "permission denied" here instead, per the plan's own fallback design.
  const handleGpsLocate = async () => {
    setIsLocating(true);
    setError('');
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('Location services are off. Pick a location on the map instead.');
        setShowMapPicker(true);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Pick a location on the map instead.');
        setShowMapPicker(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setCoords({ lat, lng });
      updateMapPin(lat, lng, false);
      await runSearch(lat, lng, radiusKm);
    } catch (err) {
      console.warn('GPS location failed:', err);
      setError('Could not detect your location. Pick a location on the map instead.');
      setShowMapPicker(true);
    } finally {
      setIsLocating(false);
    }
  };

  const handlePincodeSearch = async () => {
    if (!pincode.trim()) return;
    setIsLocating(true);
    setError('');
    try {
      const results = await lookupPincode(pincode.trim());
      if (results.length === 0) {
        setError('Could not find that pincode. Try dragging the pin instead.');
        return;
      }
      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      setCoords({ lat, lng });
      updateMapPin(lat, lng);
      await runSearch(lat, lng, radiusKm);
    } catch (err) {
      console.error('Pincode lookup failed:', err);
      setError('Pincode lookup failed. Please try again.');
    } finally {
      setIsLocating(false);
    }
  };

  // "Search this location" — runs the nearby search from wherever the map
  // pin currently sits (after a drag, a map tap, or a pincode search).
  const handleSearchThisLocation = async () => {
    setCoords(mapCoords);
    await runSearch(mapCoords.lat, mapCoords.lng, radiusKm);
  };

  const handleChangeRadius = (preset: 2 | 5 | 10) => {
    setRadiusKm(preset);
    if (coords) runSearch(coords.lat, coords.lng, preset);
  };

  const handleOpenDirections = (clinic: NearbyClinicResult) => {
    const url = buildDirectionsUrl(clinic);
    if (!url) return;
    Linking.openURL(url).catch((err) => console.error('Failed to open directions:', err));
  };

  // Opens the full-screen clinic detail view (same idea as the web app's
  // side drawer) — Google clinics need a lazy Details fetch for
  // phone/hours/photo, cached by place_id so reopening is instant.
  const handleOpenClinicDetail = async (clinic: NearbyClinicResult) => {
    setInspectingClinic(clinic);
    if (!clinic.place_id || detailsCache[clinic.place_id]) return;
    setIsLoadingDetails(true);
    try {
      const details = await fetchClinicDetails(clinic.place_id);
      setDetailsCache((prev) => ({ ...prev, [clinic.place_id!]: details }));
    } catch (err) {
      console.error('Failed to load clinic details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSelectRegistered = async (doctorId: number) => {
    setIsLoadingDoctor(doctorId);
    try {
      const doctor = await fetchDoctorDetail(doctorId);
      onClose();
      onSelectDoctor(doctor);
    } catch (err) {
      console.error('Failed to load doctor detail:', err);
      Alert.alert('Error', 'Could not load this vet’s profile. Please try again.');
    } finally {
      setIsLoadingDoctor(null);
    }
  };

  // Small reusable hours table — used both on the clinic detail screen and
  // (implicitly, via the same day/hours split logic) nowhere else, since the
  // card face only ever shows the first line as a teaser.
  const renderHoursTable = (hours: string[]) => (
    <View style={styles.hoursTable}>
      {hours.map((line, i) => {
        const separatorIndex = line.indexOf(':');
        const day = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
        const time = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trim();
        const jsToday = new Date().getDay();
        const isToday = i === (jsToday === 0 ? 6 : jsToday - 1);
        return (
          <View
            key={line}
            style={[styles.hoursRow, isToday && styles.hoursRowToday, i === hours.length - 1 && styles.hoursRowLast]}
          >
            <View style={styles.hoursDayWrap}>
              <Text style={[styles.hoursDay, isToday && styles.hoursDayToday]}>{day}</Text>
              {isToday && <Text style={styles.hoursTodayTag}>TODAY</Text>}
            </View>
            <Text style={[styles.hoursTime, time.toLowerCase() === 'closed' && styles.hoursTimeClosed]}>{time}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderItem = ({ item }: { item: NearbyClinicResult }) => {
    const isGoogle = item.source === 'google';

    return (
      <TouchableOpacity
        style={styles.resultCard}
        activeOpacity={0.8}
        onPress={() =>
          isGoogle
            ? handleOpenClinicDetail(item)
            : item.doctor_id && handleSelectRegistered(item.doctor_id)
        }
        disabled={!isGoogle && isLoadingDoctor === item.doctor_id}
      >
        <View style={styles.resultTitleRow}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name || item.clinic_name || 'Unnamed clinic'}
          </Text>
          <View style={[styles.sourceBadge, isGoogle ? styles.sourceBadgeGoogle : styles.sourceBadgeRegistered]}>
            <Text style={[styles.sourceBadgeText, isGoogle ? styles.sourceBadgeTextGoogle : styles.sourceBadgeTextRegistered]}>
              {isGoogle ? 'Google' : 'Registered'}
            </Text>
          </View>
        </View>

        <Text style={styles.resultSub} numberOfLines={2}>
          {item.address || item.specialization || ''}
        </Text>

        {item.phone && (
          <View style={styles.resultMetaRow}>
            <Phone size={11} color={COLORS.forestGreen} />
            <Text style={styles.resultMetaText} numberOfLines={1}>{item.phone}</Text>
          </View>
        )}

        {item.opening_hours && item.opening_hours.length > 0 && (
          <View style={styles.resultMetaRow}>
            <Clock size={11} color={COLORS.forestGreen} />
            <Text style={styles.resultMetaText} numberOfLines={1}>{item.opening_hours[0]}</Text>
          </View>
        )}

        <View style={styles.resultFooterRow}>
          {!isGoogle && isLoadingDoctor === item.doctor_id ? (
            <ActivityIndicator size="small" color={COLORS.forestGreen} />
          ) : (
            <Text style={styles.resultDistance}>{item.distance_km.toFixed(1)} km</Text>
          )}
          {isGoogle && <Text style={styles.viewDetailsText}>View details →</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const inspectingDetails = inspectingClinic?.place_id ? detailsCache[inspectingClinic.place_id] : undefined;
  const inspectingDirectionsUrl = inspectingClinic ? buildDirectionsUrl(inspectingClinic) : null;

  return (
    <>
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vets Near Me</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={COLORS.textCoffee} />
          </TouchableOpacity>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.gpsButton} onPress={handleGpsLocate} disabled={isLocating}>
            {isLocating ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Navigation size={16} color="#FFFFFF" />
                <Text style={styles.gpsButtonText}>Detect My Location</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowMapPicker((v) => !v)}>
            <Text style={styles.switchToPincodeLink}>
              {showMapPicker ? 'Hide map picker' : 'Search a different location'}
            </Text>
          </TouchableOpacity>

          {showMapPicker && (
            <View style={styles.mapPickerBox}>
              <View style={styles.pincodeRow}>
                <View style={styles.pincodeInputWrap}>
                  <MapPin size={14} color={COLORS.textMuted} />
                  <TextInput
                    style={styles.pincodeInput}
                    placeholder="Search pincode / zip code"
                    placeholderTextColor={COLORS.textMuted}
                    value={pincode}
                    onChangeText={setPincode}
                    keyboardType="number-pad"
                    returnKeyType="search"
                    onSubmitEditing={handlePincodeSearch}
                  />
                </View>
                <TouchableOpacity style={styles.pincodeSearchBtn} onPress={handlePincodeSearch} disabled={isLocating}>
                  {isLocating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.pincodeSearchBtnText}>Go</Text>}
                </TouchableOpacity>
              </View>

              <Text style={styles.mapHintText}>Drag the pin, tap the map, or use Locate Me</Text>

              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: mapCoords.lat,
                    longitude: mapCoords.lng,
                    latitudeDelta: 0.08,
                    longitudeDelta: 0.08,
                  }}
                  onPress={(e) => setMapCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
                >
                  <Marker
                    coordinate={{ latitude: mapCoords.lat, longitude: mapCoords.lng }}
                    draggable
                    onDragEnd={(e) => setMapCoords({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
                  >
                    <View style={styles.mapPin}>
                      <MapPin size={26} color={COLORS.brandGold} fill={COLORS.brandGold} fillOpacity={0.25} />
                    </View>
                  </Marker>
                </MapView>
                <TouchableOpacity style={styles.locateMeBtn} onPress={handleGpsLocate} disabled={isLocating}>
                  {isLocating ? (
                    <ActivityIndicator size="small" color={COLORS.forestGreen} />
                  ) : (
                    <Locate size={18} color={COLORS.forestGreen} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.radiusRow}>
                <Compass size={14} color={COLORS.textMuted} />
                {RADIUS_PRESETS_KM.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.radiusChip, radiusKm === preset && styles.radiusChipActive]}
                    onPress={() => setRadiusKm(preset)}
                  >
                    <Text style={[styles.radiusChipText, radiusKm === preset && styles.radiusChipTextActive]}>{preset} km</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.gpsButton} onPress={handleSearchThisLocation} disabled={isSearching}>
                {isSearching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.gpsButtonText}>Search This Location</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {coords && !showMapPicker && (
            <View style={styles.radiusRow}>
              <Compass size={14} color={COLORS.textMuted} />
              {RADIUS_PRESETS_KM.map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[styles.radiusChip, radiusKm === preset && styles.radiusChipActive]}
                  onPress={() => handleChangeRadius(preset)}
                >
                  <Text style={[styles.radiusChipText, radiusKm === preset && styles.radiusChipTextActive]}>{preset} km</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {error !== '' && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {isSearching ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={COLORS.forestGreen} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, idx) => (item.source === 'registered' ? `reg-${item.doctor_id}` : `google-${item.place_id}`) || String(idx)}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={styles.resultColumnWrapper}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              results.length > 0 ? (
                <View style={styles.listHeaderRow}>
                  <Text style={styles.listHeaderText}>
                    {results.length} found within {radiusUsed ?? radiusKm} km
                  </Text>
                  {results.some((r) => r.source === 'google') && <Text style={styles.attributionText}>Powered by Google</Text>}
                </View>
              ) : null
            }
            ListFooterComponent={
              fallback ? (
                <View style={styles.fallbackBox}>
                  <Text style={styles.fallbackText}>
                    No nearby clinics found. Consider booking an online consultation instead.
                  </Text>
                  <TouchableOpacity
                    style={styles.fallbackButton}
                    onPress={() => {
                      onClose();
                      onBookOnlineInstead();
                    }}
                  >
                    <Text style={styles.fallbackButtonText}>Book Online Consultation</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>

    {/* Clinic Detail — full-screen, same information the web app's side
        drawer shows for a Google-sourced result. */}
    <Modal visible={!!inspectingClinic} animationType="slide" onRequestClose={() => setInspectingClinic(null)}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>{inspectingClinic?.name || 'Clinic Detail'}</Text>
          <TouchableOpacity onPress={() => setInspectingClinic(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={COLORS.textCoffee} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailScroll}>
          <View style={styles.detailMetaRow}>
            <View style={[styles.sourceBadge, styles.sourceBadgeGoogle]}>
              <Text style={[styles.sourceBadgeText, styles.sourceBadgeTextGoogle]}>Google</Text>
            </View>
            {inspectingClinic && (
              <Text style={styles.detailDistanceText}>{inspectingClinic.distance_km.toFixed(1)} km away</Text>
            )}
          </View>

          {isLoadingDetails && !inspectingDetails ? (
            <View style={[styles.detailsPhoto, styles.centerFill]}>
              <ActivityIndicator size="large" color={COLORS.forestGreen} />
            </View>
          ) : inspectingDetails?.photo_url ? (
            <Image
              source={{ uri: `${BASE_URL}${inspectingDetails.photo_url}` }}
              style={styles.detailsPhoto}
              contentFit="cover"
            />
          ) : null}

          {inspectingClinic?.address && (
            <Text style={styles.detailAddressText}>{inspectingClinic.address}</Text>
          )}

          {!isLoadingDetails && inspectingDetails?.phone && (
            <View style={styles.detailsRow}>
              <Phone size={14} color={COLORS.forestGreen} />
              <Text style={styles.detailPhoneText}>{inspectingDetails.phone}</Text>
            </View>
          )}

          {!isLoadingDetails && inspectingDetails?.opening_hours && inspectingDetails.opening_hours.length > 0 && (
            <View style={styles.hoursSection}>
              <View style={styles.detailsRow}>
                <Clock size={12} color={COLORS.forestGreen} />
                <Text style={styles.hoursSectionLabel}>Opening Hours</Text>
              </View>
              {renderHoursTable(inspectingDetails.opening_hours)}
            </View>
          )}

          {!isLoadingDetails && inspectingDetails && !inspectingDetails.phone && !inspectingDetails.photo_url && !inspectingDetails.opening_hours?.length && (
            <Text style={[styles.detailsText, { color: COLORS.textMuted }]}>No further details available from Google for this clinic.</Text>
          )}

          {inspectingDirectionsUrl && (
            <TouchableOpacity
              style={styles.directionsButton}
              onPress={() => inspectingClinic && handleOpenDirections(inspectingClinic)}
            >
              <Navigation size={16} color={COLORS.textCoffee} />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.attributionTextRight}>Powered by Google</Text>
        </View>
      </SafeAreaView>
    </Modal>
    </>
  );
}

const styles = {
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
  },
  headerTitle: { fontSize: 18, fontFamily: FONT_DISPLAY, color: COLORS.textCoffee },
  controls: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, gap: 10 },
  gpsButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 12,
    borderRadius: 12,
  },
  gpsButtonText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  pincodeRow: { flexDirection: 'row' as const, gap: 8 },
  pincodeInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardAlt,
  },
  pincodeInput: { flex: 1, fontSize: 13, fontFamily: FONT_BODY, color: COLORS.textCoffee, paddingVertical: 10 },
  pincodeSearchBtn: {
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pincodeSearchBtnText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  mapPickerBox: { gap: 10 },
  mapHintText: { fontSize: 10, fontFamily: FONT_BODY, color: COLORS.textMuted },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  map: { width: '100%' as const, height: '100%' as const },
  mapPin: { alignItems: 'center' as const, justifyContent: 'center' as const },
  locateMeBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  detailsPhoto: { width: '100%' as const, aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: COLORS.kraftBorder },
  radiusRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  radiusChipActive: { backgroundColor: COLORS.brandGold, borderColor: COLORS.brandGold },
  radiusChipText: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted },
  radiusChipTextActive: { color: '#FFFFFF' },
  switchToPincodeLink: { fontSize: 11, fontFamily: FONT_BODY_BOLD, color: COLORS.sageIcon, textDecorationLine: 'underline' as const },
  errorText: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.ctaBrown },
  centerFill: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  resultColumnWrapper: { gap: 10 },
  listHeaderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 },
  listHeaderText: { fontSize: 11, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  attributionText: { fontSize: 9, fontFamily: FONT_BODY, color: COLORS.textMuted },
  attributionTextRight: { fontSize: 9, fontFamily: FONT_BODY, color: COLORS.textMuted, textAlign: 'right' as const, marginTop: 4 },
  resultCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 12,
    backgroundColor: COLORS.cardAlt,
    gap: 4,
  },
  resultTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, flexWrap: 'wrap' as const },
  resultName: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, flexShrink: 1 },
  resultSub: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textMuted },
  resultMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  resultMetaText: { fontSize: 10.5, fontFamily: FONT_BODY, color: COLORS.textCoffee, flexShrink: 1 },
  resultFooterRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, marginTop: 4 },
  resultDistance: { fontSize: 11, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  viewDetailsText: { fontSize: 9, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold, textTransform: 'uppercase' as const },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  sourceBadgeRegistered: { backgroundColor: 'rgba(63,94,77,0.12)' },
  sourceBadgeGoogle: { backgroundColor: 'rgba(44,24,16,0.08)' },
  sourceBadgeText: { fontSize: 8, fontFamily: FONT_BODY_BOLD, textTransform: 'uppercase' as const },
  sourceBadgeTextRegistered: { color: COLORS.forestGreen },
  sourceBadgeTextGoogle: { color: COLORS.textMuted },
  detailScroll: { flex: 1, padding: 20, gap: 12 },
  detailMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  detailDistanceText: { fontSize: 12, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  detailAddressText: { fontSize: 14, fontFamily: FONT_BODY, color: COLORS.textCoffee, lineHeight: 20 },
  detailPhoneText: { fontSize: 14, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  directionsButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: COLORS.brandGold,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  directionsButtonText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' as const },
  detailsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  detailsText: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  hoursSection: { gap: 6 },
  hoursSectionLabel: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  hoursTable: { borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 8, overflow: 'hidden' as const },
  hoursRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.kraftBorder,
    borderStyle: 'dashed' as const,
    backgroundColor: COLORS.cardAlt,
  },
  hoursRowLast: { borderBottomWidth: 0 },
  hoursRowToday: { backgroundColor: 'rgba(151,100,48,0.1)' },
  hoursDayWrap: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  hoursDay: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  hoursDayToday: { fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold },
  hoursTodayTag: { fontSize: 8, fontFamily: FONT_BODY_BOLD, color: COLORS.brandGold, letterSpacing: 0.5 },
  hoursTime: { fontSize: 12, fontFamily: LEDGER_MONO, color: COLORS.textCoffee },
  hoursTimeClosed: { color: COLORS.textMuted },
  fallbackBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(151,100,48,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(151,100,48,0.25)',
    gap: 10,
  },
  fallbackText: { fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textCoffee, lineHeight: 17 },
  fallbackButton: { backgroundColor: COLORS.forestGreen, borderRadius: 10, paddingVertical: 10, alignItems: 'center' as const },
  fallbackButtonText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
};
