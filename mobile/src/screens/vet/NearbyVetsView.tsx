import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Easing,
  Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { Compass, MapPin, Navigation, Locate, Phone, Clock, Stethoscope, PillBottle, X, ShieldCheck, ChevronRight, ChevronUp, ChevronDown, Star } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { FONT_DISPLAY, FONT_BODY, FONT_BODY_BOLD, FONT_HEADING_SCRIPT, LEDGER_MONO } from '../../theme/typography';
import { BASE_URL } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import {
  fetchNearbyClinics,
  fetchClinicDetails,
  fetchDoctorDetail,
  buildDirectionsUrl,
  buildClinicPhotoUrl,
  type NearbyClinicResult,
  type NearbyClinicCategory,
} from '../../api/doctors';
import { lookupPincode } from '../../api/geo';
import { Doctor } from '../../types';
import { FeaturePrivacyNote } from '../../components/FeaturePrivacyNote';
import { useNearbyVetsStore, isSnapshotFresh } from '../../store/nearbyVetsStore';

const RADIUS_PRESETS_KM = [5, 15, 25] as const;

// Same default center used by the web app's Checkout/Vets-Near-Me map
// pickers — just a starting viewport until a real location is picked.
const DEFAULT_MAP_COORDS = { lat: 13.0827, lng: 80.2707 };

interface NearbyVetsViewProps {
  onSelectDoctor: (doctor: Doctor) => void;
  onSwitchToConsult: () => void;
  compact: boolean;
  chromeProgress: Animated.Value;
  onCompactChange: (compact: boolean) => void;
}

export function NearbyVetsView({ onSelectDoctor, onSwitchToConsult, compact, chromeProgress, onCompactChange }: NearbyVetsViewProps) {
  const navigation = useNavigation();
  const scrollAnchor = useRef(0);
  const scrollTravel = useRef(0);
  const scrollingByTouch = useRef(false);
  const chromeLockedUntil = useRef(0);
  const [locationSummaryHeight, setLocationSummaryHeight] = useState(74);
  const handleResultsScroll = (event: any) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = y - scrollAnchor.current;
    scrollAnchor.current = y;
    if (!scrollingByTouch.current || Date.now() < chromeLockedUntil.current) return;
    // Accumulate intentional motion in one direction, ignoring layout shifts
    // during the transition and small finger movements.
    scrollTravel.current = Math.sign(delta) === Math.sign(scrollTravel.current)
      ? scrollTravel.current + delta : delta;
    if (Math.abs(scrollTravel.current) < 28 && y > 4) return;
    const nextCompact = y > 4 && scrollTravel.current > 0;
    if (nextCompact === compact) return;
    scrollTravel.current = 0;
    chromeLockedUntil.current = Date.now() + 340;
    onCompactChange(nextCompact);
    if (nextCompact) collapseControls();
  };
  const accessToken = useAuthStore((state) => state.accessToken);
  const mapRef = useRef<MapView | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCoords, setMapCoords] = useState(DEFAULT_MAP_COORDS);
  const [category, setCategory] = useState<NearbyClinicCategory>('clinic');
  const [radiusKm, setRadiusKm] = useState<5 | 15 | 25>(5);
  const [showDistanceOptions, setShowDistanceOptions] = useState(false);
  const distanceProgress = useRef(new Animated.Value(0)).current;
  const [distanceHeight, setDistanceHeight] = useState(44);
  useEffect(() => {
    const animation = Animated.timing(distanceProgress, {
      toValue: showDistanceOptions ? 1 : 0,
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [showDistanceOptions, distanceProgress]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [pincode, setPincode] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [results, setResults] = useState<NearbyClinicResult[]>([]);
  const [radiusUsed, setRadiusUsed] = useState<number | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState('');
  const [inspectingClinic, setInspectingClinic] = useState<NearbyClinicResult | null>(null);
  // Session-lifetime, survives this screen unmounting/remounting (tab
  // switches, back navigation) -- see nearbyVetsStore.ts for why that
  // matters here specifically.
  const detailsCache = useNearbyVetsStore((state) => state.detailsCache);
  const cacheDetails = useNearbyVetsStore((state) => state.cacheDetails);
  const setLastSearch = useNearbyVetsStore((state) => state.setLastSearch);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  // Tracks a failed fetch (rate-limited, network error) separately from
  // "Google genuinely has nothing to show" -- both used to render as the
  // same silent-looking state, which made a rate limit look identical to
  // a missing-data clinic instead of a retriable failure.
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isLoadingDoctor, setIsLoadingDoctor] = useState<number | null>(null);

  // Collapsible controls panel: the location/search controls above the
  // results list eat most of the screen on a phone, especially once the
  // map picker is open. Swipe the drag handle up to fold everything down
  // to just the Clinic/Pharmacy toggle; swipe down (or tap the handle) to
  // bring the rest back. expandAnim drives both the animated height and
  // opacity of the collapsible part; 1 = fully expanded, 0 = folded.
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [collapsibleHeight, setCollapsibleHeight] = useState(0);
  const expandAnim = useRef(new Animated.Value(1)).current;
  const expandValueRef = useRef(1);
  const dragStartValueRef = useRef(1);

  useEffect(() => {
    const id = expandAnim.addListener(({ value }) => {
      expandValueRef.current = value;
    });
    return () => expandAnim.removeListener(id);
  }, [expandAnim]);

  // A spring with an animated height tends to overshoot and wobble instead
  // of settling cleanly, which reads as "janky" -- a fixed-duration eased
  // timing animation gives a controlled, consistent fold/unfold instead.
  const animateExpand = (toValue: 0 | 1) => {
    expandAnim.stopAnimation();
    Animated.timing(expandAnim, {
      toValue,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  // Scrolling the results list is a clear "let me browse" signal, so fold
  // the controls away automatically the moment a scroll starts -- same
  // animation as a manual swipe-up. Tapping or dragging the handle (below)
  // still brings it back out regardless of scroll position.
  const collapseControls = () => {
    if (!isControlsExpanded) return;
    setIsControlsExpanded(false);
    animateExpand(0);
  };

  const controlsPanResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Loose enough that ordinary finger jitter during a tap doesn't get
      // captured as the start of a drag -- a tap that moves a few px
      // should still land as a tap, not a tiny accidental drag.
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 8,
      onPanResponderGrant: () => {
        dragStartValueRef.current = expandValueRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        if (collapsibleHeight <= 0) return;
        const next = Math.min(1, Math.max(0, dragStartValueRef.current - gestureState.dy / collapsibleHeight));
        expandAnim.setValue(next);
      },
      onPanResponderRelease: (_, gestureState) => {
        const moved = Math.abs(gestureState.dy) > 10 || Math.abs(gestureState.dx) > 10;
        let shouldExpand: boolean;
        if (!moved) {
          // A tap (negligible movement) on the handle just toggles it.
          shouldExpand = !isControlsExpanded;
        } else if (gestureState.vy < -0.5) {
          shouldExpand = false; // fast upward swipe -> fold up
        } else if (gestureState.vy > 0.5) {
          shouldExpand = true; // fast downward swipe -> expand
        } else {
          shouldExpand = expandValueRef.current > 0.5;
        }
        setIsControlsExpanded(shouldExpand);
        animateExpand(shouldExpand ? 1 : 0);
      },
    }), [isControlsExpanded, collapsibleHeight]);

  const runSearch = async (lat: number, lng: number, radius: 5 | 15 | 25, cat: NearbyClinicCategory) => {
    setIsSearching(true);
    setError('');
    setInspectingClinic(null);
    try {
      const data = await fetchNearbyClinics(lat, lng, radius, cat);
      setResults(data.results);
      if (data.results.length > 0) {
        setShowMapPicker(false);
        collapseControls();
      }
      setRadiusUsed(data.radius_km_used);
      setFallback(data.fallback_to_registered_only);
      setLastSearch({
        coords: { lat, lng },
        category: cat,
        radiusKm: radius,
        results: data.results,
        radiusUsed: data.radius_km_used,
        fallback: data.fallback_to_registered_only,
        fetchedAt: Date.now(),
      });
      if (data.results.length === 0) {
        setError(cat === 'pharmacy' ? 'No pharmacies found within the specified radius.' : 'No clinics or specialists found within the specified radius.');
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
      await runSearch(lat, lng, radiusKm, category);
    } catch (err) {
      console.warn('GPS location failed:', err);
      setError('Could not detect your location. Pick a location on the map instead.');
      setShowMapPicker(true);
    } finally {
      setIsLocating(false);
    }
  };

  // Auto-detect location and search the moment this screen appears —
  // "Consult Vet" should land straight on nearby results, not wait for a
  // button tap. But this screen remounts on every visit (tab switch, back
  // navigation), so without this check it re-did a full GPS fix + network
  // search every single time, even seconds after the last one. Reuse a
  // recent-enough prior search instead of repeating it from scratch.
  useEffect(() => {
    const cached = useNearbyVetsStore.getState().lastSearch;
    if (isSnapshotFresh(cached)) {
      setCoords(cached.coords);
      updateMapPin(cached.coords.lat, cached.coords.lng, false);
      setCategory(cached.category);
      setRadiusKm(cached.radiusKm);
      setResults(cached.results);
      setRadiusUsed(cached.radiusUsed);
      setFallback(cached.fallback);
      if (cached.results.length === 0) {
        setError(cached.category === 'pharmacy' ? 'No pharmacies found within the specified radius.' : 'No clinics or specialists found within the specified radius.');
      }
      return;
    }
    handleGpsLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await runSearch(lat, lng, radiusKm, category);
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
    await runSearch(mapCoords.lat, mapCoords.lng, radiusKm, category);
  };

  const handleChangeRadius = (preset: 5 | 15 | 25) => {
    setRadiusKm(preset);
    if (coords) runSearch(coords.lat, coords.lng, preset, category);
  };

  const handleChangeCategory = (cat: NearbyClinicCategory) => {
    setCategory(cat);
    if (coords) runSearch(coords.lat, coords.lng, radiusKm, cat);
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
    setDetailsError(null);
    if (!clinic.place_id || detailsCache[clinic.place_id]) return;
    setIsLoadingDetails(true);
    try {
      const details = await fetchClinicDetails(clinic.place_id);
      cacheDetails(clinic.place_id, details);
    } catch (err: any) {
      console.error('Failed to load clinic details:', err);
      setDetailsError(
        err?.response?.status === 429
          ? "You've opened a lot of details in a short time — please wait a moment and try again."
          : "Couldn't load this clinic's details. Please try again."
      );
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleSelectRegistered = async (doctorId: number) => {
    setIsLoadingDoctor(doctorId);
    try {
      const doctor = await fetchDoctorDetail(doctorId);
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
    const imageSource = isGoogle
      ? item.place_id
        ? { uri: buildClinicPhotoUrl(item.place_id), headers: { Authorization: `Bearer ${accessToken}` } }
        : null
      : item.profile_image_url
      ? { uri: item.profile_image_url }
      : null;

    const name = item.name || item.clinic_name || 'Unnamed clinic';
    const phone = item.phone || (item.place_id ? detailsCache[item.place_id]?.phone : null);
    const directionsUrl = buildDirectionsUrl(item);
    const busy = !isGoogle && isLoadingDoctor === item.doctor_id;
    const openDetails = () => isGoogle ? handleOpenClinicDetail(item) : item.doctor_id && handleSelectRegistered(item.doctor_id);

    return (
      <View style={styles.resultCard}>
        <TouchableOpacity style={styles.cardSummary} activeOpacity={0.8} onPress={openDetails} disabled={busy} accessibilityRole="button" accessibilityLabel={`View ${name}`}>
          {imageSource ? (
            <Image source={imageSource} style={styles.resultImg} contentFit="cover" />
          ) : (
            <View style={styles.resultImgFallback}>
              {category === 'pharmacy' ? <PillBottle size={26} color={COLORS.brandGold} /> : <Stethoscope size={26} color={COLORS.brandGold} />}
            </View>
          )}
          <View style={styles.resultBody}>
            <Text style={styles.resultName} numberOfLines={2}>{name}</Text>
            <View style={styles.resultMetaWrapRow}>
              <Text style={styles.resultDistancePill}>{item.distance_km.toFixed(1)} km away</Text>
              {item.average_rating != null && item.average_rating > 0 && (
                <View style={styles.resultMetaRow}>
                  <Star size={12} color={COLORS.brandGold} />
                  <Text style={styles.resultMetaText}>{item.average_rating.toFixed(1)}{item.review_count ? ` (${item.review_count})` : ''}</Text>
                </View>
              )}
            </View>
            <Text style={styles.resultSub} numberOfLines={2}>{item.address || item.specialization || 'View clinic details'}</Text>
            <Text style={styles.sourceLabel}>{isGoogle ? 'Google Places' : 'Registered veterinarian'}</Text>
          </View>
          <ChevronRight size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
        <View style={styles.cardActions}>
          {phone && (
            <TouchableOpacity style={styles.cardAction} accessibilityRole="button" accessibilityLabel={`Call ${name}`} onPress={() => Linking.openURL(`tel:${phone}`).catch(() => Alert.alert('Unable to open phone', 'Please try calling from your phone app.'))}>
              <Phone size={15} color={COLORS.textCoffee} /><Text style={styles.cardActionText}>Call</Text>
            </TouchableOpacity>
          )}
          {directionsUrl && (
            <TouchableOpacity style={styles.cardAction} accessibilityRole="button" accessibilityLabel={`Directions to ${name}`} onPress={() => handleOpenDirections(item)}>
              <Navigation size={15} color={COLORS.textCoffee} /><Text style={styles.cardActionText}>Directions</Text>
            </TouchableOpacity>
          )}
          {!isGoogle && (
            <TouchableOpacity style={[styles.cardAction, styles.bookAction]} onPress={openDetails} disabled={busy} accessibilityRole="button" accessibilityLabel={`Book with ${name}`}>
              {busy ? <ActivityIndicator size="small" color="#FAF4E8" /> : <Text style={[styles.cardActionText, { color: '#FAF4E8' }]}>Book</Text>}
            </TouchableOpacity>
          )}
          {!phone && !directionsUrl && isGoogle && (
            <TouchableOpacity style={styles.cardAction} onPress={openDetails} accessibilityRole="button"><Text style={styles.cardActionText}>View details</Text></TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const inspectingDetails = inspectingClinic?.place_id ? detailsCache[inspectingClinic.place_id] : undefined;
  const inspectingDirectionsUrl = inspectingClinic ? buildDirectionsUrl(inspectingClinic) : null;

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.safeArea}>
          <View style={styles.controls}>
            <View style={styles.categoryRow}>
              <TouchableOpacity
                style={[styles.categoryChip, category === 'clinic' && styles.categoryChipActive]}
                onPress={() => handleChangeCategory('clinic')}
              >
                <RNImage source={require('../../../assets/toolkit/vet-consults.webp')} style={styles.categoryChipIcon} resizeMode="contain" />
                <Text style={[styles.categoryChipText, category === 'clinic' && styles.categoryChipTextActive]}>Clinic</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.categoryChip, category === 'pharmacy' && styles.categoryChipActive]}
                onPress={() => handleChangeCategory('pharmacy')}
              >
                <PillBottle size={14} color={category === 'pharmacy' ? '#FFFFFF' : COLORS.textMuted} />
                <Text style={[styles.categoryChipText, category === 'pharmacy' && styles.categoryChipTextActive]}>Pharmacy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={styles.compactDistance}
                  accessibilityRole="button"
                  accessibilityLabel={`Search distance ${radiusKm} kilometres. Tap to change location or distance`}
                  accessibilityState={{ expanded: showDistanceOptions }}
                  onPress={() => {
                    setShowDistanceOptions((visible) => !visible);
                    if (!showDistanceOptions) {
                      onCompactChange(false);
                      setIsControlsExpanded(true);
                      animateExpand(1);
                    }
                    scrollTravel.current = 0;
                    chromeLockedUntil.current = Date.now() + 340;
                  }}
                >
                  <Text style={styles.categoryChipText}>{radiusKm} km</Text>
                  {showDistanceOptions ? <ChevronUp size={12} color={COLORS.textCoffee} /> : <ChevronDown size={12} color={COLORS.textCoffee} />}
                </TouchableOpacity>
            </View>

            <Animated.View
              pointerEvents={showDistanceOptions ? 'auto' : 'none'}
              accessibilityElementsHidden={!showDistanceOptions}
              importantForAccessibility={showDistanceOptions ? 'auto' : 'no-hide-descendants'}
              style={{ height: distanceProgress.interpolate({ inputRange: [0, 1], outputRange: [0, distanceHeight] }), opacity: distanceProgress, overflow: 'hidden' }}
            >
                  <View onLayout={(event) => setDistanceHeight(event.nativeEvent.layout.height)} style={[styles.radiusRow, { flexShrink: 0, paddingBottom: 4 }]}>
                    <Compass size={14} color={COLORS.textMuted} />
                    {RADIUS_PRESETS_KM.map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.radiusChip, radiusKm === preset && styles.radiusChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: radiusKm === preset }}
                        onPress={() => {
                          setShowDistanceOptions(false);
                          if (showMapPicker) setRadiusKm(preset);
                          else handleChangeRadius(preset);
                        }}
                      >
                        <Text style={[styles.radiusChipText, radiusKm === preset && styles.radiusChipTextActive]}>{preset} km</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
            </Animated.View>

            <Animated.View
              pointerEvents={compact ? 'none' : 'auto'}
              accessibilityElementsHidden={compact}
              importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
              style={{ height: chromeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, locationSummaryHeight] }), opacity: chromeProgress, overflow: 'hidden' }}
            >
            <View style={{ flexShrink: 0 }} onLayout={(event) => setLocationSummaryHeight(event.nativeEvent.layout.height)}>
            <TouchableOpacity
              style={styles.locationSummary}
              onPress={() => { setIsControlsExpanded(!isControlsExpanded); animateExpand(isControlsExpanded ? 0 : 1); }}
              accessibilityRole="button"
              accessibilityLabel="Change search location"
              accessibilityState={{ expanded: isControlsExpanded }}
            >
              <MapPin size={18} color={COLORS.brandGold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.locationTitle}>{coords ? 'Searching around your selected location' : 'Choose your search location'}</Text>
                <Text style={styles.locationSubtitle}>{coords ? `${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}` : 'Use your location or search by pincode'}</Text>
              </View>
              <Text style={styles.changeLabel}>{isControlsExpanded ? 'Done' : 'Change'}</Text>
            </TouchableOpacity>
            <View {...controlsPanResponder.panHandlers} style={styles.dragHandleRow}><View style={styles.dragHandleBar} /></View>

            </View>
            </Animated.View>

            <Animated.View
              pointerEvents={isControlsExpanded ? 'auto' : 'none'}
              accessibilityElementsHidden={!isControlsExpanded}
              importantForAccessibility={isControlsExpanded ? 'auto' : 'no-hide-descendants'}
              style={{
                height: collapsibleHeight > 0
                  ? expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, collapsibleHeight] })
                  : undefined,
                opacity: expandAnim,
                overflow: 'hidden',
              }}
            >
              <View
                onLayout={(e) => setCollapsibleHeight(e.nativeEvent.layout.height)}
                style={[styles.collapsibleContent, { flexShrink: 0 }]}
              >
                <View style={styles.locateHero}>
                  <RNImage source={require('../../../assets/vet/locate-vet.webp')} style={styles.locateHeroIcon} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locateHeroTitle}>Find care near you</Text>
                    <Text style={styles.locateHeroSub}>Clinics and pharmacies around your location.</Text>
                  </View>
                </View>

                <FeaturePrivacyNote
                  text="With your permission, we use your device location to find nearby clinics and pharmacies via Google Places. You can decline and search by pincode instead."
                  onPressFullPolicy={() => navigation.navigate('PrivacyPolicy' as never)}
                />

                {!showMapPicker && (
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
                )}

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



                    <TouchableOpacity style={styles.gpsButton} onPress={handleSearchThisLocation} disabled={isSearching}>
                      {isSearching ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.gpsButtonText}>Search This Location</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}



              </View>
            </Animated.View>
            {error !== '' && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}

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
              contentContainerStyle={styles.listContent}
              scrollEventThrottle={16}
              onScroll={handleResultsScroll}
              onScrollBeginDrag={(event) => { setShowDistanceOptions(false); scrollingByTouch.current = true; scrollTravel.current = 0; scrollAnchor.current = Math.max(0, event.nativeEvent.contentOffset.y); }}
              onScrollEndDrag={() => { scrollingByTouch.current = false; }}
              ListHeaderComponent={
                results.length > 0 ? (
                  <View style={styles.listHeaderRow}>
                    <Text style={styles.listHeaderText}>
                      {results.length} found within {radiusUsed ?? radiusKm} km
                    </Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                fallback ? (
                  <View style={styles.fallbackBox}>
                    <Text style={styles.fallbackText}>
                      No nearby results found. Consider booking an online consultation instead.
                    </Text>
                    <TouchableOpacity style={styles.fallbackButton} onPress={onSwitchToConsult}>
                      <Text style={styles.fallbackButtonText}>Book Online Consultation</Text>
                    </TouchableOpacity>
                  </View>
                ) : results.length > 0 ? (
                  // Short result lists leave blank space below the last
                  // card on taller screens -- a quiet end marker makes that
                  // read as "that's everyone nearby" instead of looking cut
                  // off or broken.
                  <Text style={styles.endOfResultsText}>That's everyone we found nearby</Text>
                ) : null
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Clinic/Pharmacy Detail — full-screen, same information the web
          app's side drawer shows for a Google-sourced result. */}
      <Modal visible={!!inspectingClinic} animationType="slide" onRequestClose={() => setInspectingClinic(null)}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>{inspectingClinic?.name || 'Clinic Detail'}</Text>
            <TouchableOpacity onPress={() => setInspectingClinic(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={22} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailScroll}>
            <View style={styles.detailPhotoWrap}>
              {isLoadingDetails && !inspectingDetails ? (
                <View style={[styles.detailsPhoto, styles.centerFill]}>
                  <ActivityIndicator size="large" color={COLORS.forestGreen} />
                </View>
              ) : inspectingDetails?.photo_url ? (
                <Image
                  source={{ uri: `${BASE_URL}${inspectingDetails.photo_url}`, headers: { Authorization: `Bearer ${accessToken}` } }}
                  style={styles.detailsPhoto}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.detailsPhoto, styles.centerFill, { backgroundColor: 'rgba(63,94,77,0.1)' }]}>
                  {category === 'pharmacy' ? (
                    <PillBottle size={36} color={COLORS.forestGreen} />
                  ) : (
                    <Stethoscope size={36} color={COLORS.forestGreen} />
                  )}
                </View>
              )}
              <View style={styles.detailPhotoBadgeRow}>
                <View style={styles.detailPhotoBadge}>
                  <Text style={styles.detailPhotoBadgeText}>Google</Text>
                </View>
                {inspectingClinic && (
                  <View style={styles.detailPhotoDistanceBadge}>
                    <MapPin size={10} color="#FFFFFF" />
                    <Text style={styles.detailPhotoDistanceBadgeText}>{inspectingClinic.distance_km.toFixed(1)} km away</Text>
                  </View>
                )}
              </View>
            </View>

            {inspectingClinic?.address && (
              <View style={styles.detailInfoCard}>
                <MapPin size={15} color={COLORS.forestGreen} style={{ marginTop: 1 }} />
                <Text style={styles.detailAddressText}>{inspectingClinic.address}</Text>
              </View>
            )}

            {!isLoadingDetails && inspectingDetails?.phone && (
              <View style={styles.detailInfoCard}>
                <Phone size={15} color={COLORS.forestGreen} />
                <Text style={[styles.detailPhoneText, { flex: 1 }]}>{inspectingDetails.phone}</Text>
                <TouchableOpacity
                  style={styles.detailCallChip}
                  onPress={() => Linking.openURL(`tel:${inspectingDetails.phone}`)}
                >
                  <Phone size={11} color="#FFFFFF" />
                  <Text style={styles.detailCallChipText}>Call</Text>
                </TouchableOpacity>
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

            {!isLoadingDetails && detailsError && (
              <View style={styles.detailsErrorBox}>
                <Text style={styles.detailsErrorText}>{detailsError}</Text>
                <TouchableOpacity onPress={() => inspectingClinic && handleOpenClinicDetail(inspectingClinic)}>
                  <Text style={styles.detailsErrorRetry}>Try again</Text>
                </TouchableOpacity>
              </View>
            )}

            {!isLoadingDetails && !detailsError && inspectingDetails && !inspectingDetails.phone && !inspectingDetails.photo_url && !inspectingDetails.opening_hours?.length && (
              <Text style={[styles.detailsText, { color: COLORS.textMuted }]}>No further details available from Google for this result.</Text>
            )}

            {inspectingDirectionsUrl && (
              <View style={styles.directionsRow}>
                <TouchableOpacity
                  style={styles.directionsButton}
                  onPress={() => inspectingClinic && handleOpenDirections(inspectingClinic)}
                >
                  <Navigation size={16} color="#FFFFFF" />
                  <Text style={styles.directionsButtonText}>Get Directions</Text>
                </TouchableOpacity>
                {inspectingDetails?.phone && (
                  <TouchableOpacity
                    style={styles.directionsCallButton}
                    onPress={() => Linking.openURL(`tel:${inspectingDetails.phone}`)}
                  >
                    <Phone size={16} color={COLORS.forestGreen} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = {
  compactDistance: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 5, minWidth: 64, minHeight: 44, borderRadius: 12, backgroundColor: '#F1E8DA' },
  locationSummary: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F1E8DA', borderRadius: 12 },
  locationTitle: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  locationSubtitle: { fontSize: 10, fontFamily: FONT_BODY, color: COLORS.textMuted, marginTop: 3 },
  changeLabel: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: '#976430' },
  cardSummary: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  cardActions: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, borderTopWidth: 1, borderTopColor: COLORS.kraftBorder, paddingTop: 10 },
  cardAction: { flex: 1, minWidth: 72, minHeight: 44, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: '#F3EBDD', borderRadius: 10, paddingHorizontal: 10 },
  cardActionText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee },
  bookAction: { backgroundColor: '#17120D' },
  sourceLabel: { fontSize: 10, fontFamily: FONT_BODY, color: COLORS.textMuted },
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
  controls: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  categoryRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 6 },
  dragHandleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 6,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.kraftBorder,
  },
  collapsibleContent: { gap: 10, paddingBottom: 8 },
  locateHero: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingVertical: 2 },
  locateHeroIcon: { width: 40, height: 40 },
  locateHeroTitle: { fontSize: 21, fontFamily: FONT_HEADING_SCRIPT, color: COLORS.textCoffee },
  locateHeroSub: { marginTop: 1, fontSize: 12, fontFamily: FONT_BODY, color: COLORS.textMuted },
  categoryChipIcon: { width: 22, height: 22 },
  categoryChip: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.cardAlt,
  },
  categoryChipActive: { backgroundColor: COLORS.forestGreen, borderColor: COLORS.forestGreen },
  categoryChipText: { fontSize: 12, fontFamily: FONT_BODY_BOLD, color: COLORS.textMuted },
  categoryChipTextActive: { color: '#FFFFFF' },
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
  detailsPhoto: { width: '100%' as const, aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: COLORS.kraftBorder },
  detailPhotoWrap: { position: 'relative' as const },
  detailPhotoBadgeRow: {
    position: 'absolute' as const,
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  detailPhotoBadge: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  detailPhotoBadgeText: { fontSize: 9, fontFamily: FONT_BODY_BOLD, textTransform: 'uppercase' as const, color: COLORS.textCoffee },
  detailPhotoDistanceBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  detailPhotoDistanceBadgeText: { fontSize: 9, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF' },
  detailInfoCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 12,
    padding: 12,
  },
  detailCallChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  detailCallChipText: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF', textTransform: 'uppercase' as const },
  radiusRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  radiusChip: {
    minHeight: 40,
    justifyContent: 'center' as const,
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
  // The tab navigator handles the system inset. Keep only enough scroll
  // clearance to move the final result above the floating assistant.
  listContent: { paddingHorizontal: 16, paddingBottom: 76, gap: 10 },
  listHeaderRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 4 },
  listHeaderText: { fontSize: 11, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  attributionText: { fontSize: 9, fontFamily: FONT_BODY, color: COLORS.textMuted },
  endOfResultsText: {
    fontSize: 10,
    fontFamily: FONT_BODY,
    color: COLORS.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 14,
    padding: 14,
    backgroundColor: COLORS.card,
    gap: 12,
  },
  resultImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: COLORS.kraftBorder },
  resultImgFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(63,94,77,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  resultBody: { flex: 1, gap: 5 },
  resultTitleRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: 6 },
  resultName: { fontSize: 14, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, flexShrink: 1 },
  resultDistancePill: {
    fontSize: 9,
    fontFamily: FONT_BODY_BOLD,
    color: COLORS.textMuted,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden' as const,
  },
  resultSub: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textMuted },
  resultMetaWrapRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  resultMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  resultMetaText: { fontSize: 10.5, fontFamily: FONT_BODY, color: COLORS.textCoffee, flexShrink: 1 },
  resultCtaRow: { marginTop: 5 },
  resultCtaPrimary: {
    flexDirection: 'row' as const,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: COLORS.forestGreen,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultCtaPrimaryText: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF', textTransform: 'uppercase' as const },
  resultCtaSecondary: {
    flexDirection: 'row' as const,
    alignSelf: 'flex-start' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultCtaSecondaryText: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: COLORS.textCoffee, textTransform: 'uppercase' as const },
  sourceBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sourceBadgeRegistered: { backgroundColor: 'rgba(63,94,77,0.15)' },
  sourceBadgeGoogle: { backgroundColor: 'rgba(44,24,16,0.08)' },
  sourceBadgeText: { fontSize: 8, fontFamily: FONT_BODY_BOLD, textTransform: 'uppercase' as const },
  sourceBadgeTextRegistered: { color: COLORS.forestGreen },
  sourceBadgeTextGoogle: { color: COLORS.textMuted },
  detailScroll: { flex: 1, padding: 20, gap: 12 },
  detailMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  detailDistanceText: { fontSize: 12, fontFamily: LEDGER_MONO, color: COLORS.textMuted },
  detailAddressText: { fontSize: 14, fontFamily: FONT_BODY, color: COLORS.textCoffee, lineHeight: 20 },
  detailPhoneText: { fontSize: 14, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  directionsRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  directionsButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: COLORS.forestGreen,
    paddingVertical: 14,
    borderRadius: 999,
  },
  directionsButtonText: { fontSize: 13, fontFamily: FONT_BODY_BOLD, color: '#FFFFFF', textTransform: 'uppercase' as const },
  directionsCallButton: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: 'rgba(63,94,77,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  detailsRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  detailsText: { fontSize: 11, fontFamily: FONT_BODY, color: COLORS.textCoffee },
  detailsErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  detailsErrorText: { fontSize: 12, fontFamily: FONT_BODY, color: '#991B1B', lineHeight: 17 },
  detailsErrorRetry: { fontSize: 10, fontFamily: FONT_BODY_BOLD, color: '#991B1B', textTransform: 'uppercase' as const, textDecorationLine: 'underline' as const },
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
