import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Navigation, MapPin, Compass } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface DeliveryMapPickerProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
  isLocating: boolean;
  onLocatePress: () => void;
}

const PRESET_LOCATIONS = [
  { label: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { label: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { label: 'Whitefield', lat: 12.9698, lng: 77.7500 },
  { label: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { label: 'Mumbai', lat: 19.0760, lng: 72.8777 },
];

export default function DeliveryMapPicker({
  latitude,
  longitude,
  onLocationChange,
  isLocating,
  onLocatePress,
}: DeliveryMapPickerProps) {
  const webViewRef = useRef<WebView>(null);

  // Sync marker when lat/lng updates from outside (e.g. GPS, Preset or Geocode)
  useEffect(() => {
    if (webViewRef.current) {
      const script = `if (window.updateCenter) { window.updateCenter(${latitude}, ${longitude}); } true;`;
      webViewRef.current.injectJavaScript(script);
    }
  }, [latitude, longitude]);

  const leafletHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F9F6F0; }
        .leaflet-control-attribution { display: none !important; }
        .custom-marker {
          background-color: #3F5E4D;
          border: 2.5px solid #FFFFFF;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${latitude}, ${longitude}], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-marker',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        var marker = L.marker([${latitude}, ${longitude}], {
          icon: customIcon,
          draggable: true
        }).addTo(map);

        marker.on('dragend', function(e) {
          var coord = e.target.getLatLng();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MOVE', lat: coord.lat, lng: coord.lng }));
          }
        });

        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MOVE', lat: e.latlng.lat, lng: e.latlng.lng }));
          }
        });

        window.updateCenter = function(lat, lng) {
          map.setView([lat, lng], 15);
          marker.setLatLng([lat, lng]);
        };
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MOVE' && data.lat && data.lng) {
        onLocationChange(Number(data.lat), Number(data.lng));
      }
    } catch (e) {
      console.log('Error parsing map message:', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <MapPin size={16} color={COLORS.forestGreen} />
          <Text style={styles.label}>Delivery Pin Location</Text>
        </View>

        <TouchableOpacity
          style={styles.locateBtn}
          onPress={onLocatePress}
          disabled={isLocating}
          activeOpacity={0.8}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Navigation size={13} color="#FFFFFF" />
              <Text style={styles.locateBtnText}>Use GPS</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.subtext}>
        Tap anywhere or drag the pin to pinpoint your courier gate or doorstep.
      </Text>

      {/* Quick City Presets for Easy 1-Tap Testing */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetScroll}
      >
        <View style={styles.presetLabelWrapper}>
          <Compass size={12} color={COLORS.textMuted} />
          <Text style={styles.presetLabel}>Presets:</Text>
        </View>
        {PRESET_LOCATIONS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={styles.presetPill}
            onPress={() => onLocationChange(preset.lat, preset.lng)}
          >
            <Text style={styles.presetPillText}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Interactive Map Frame */}
      <View style={styles.mapFrame}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: leafletHtml }}
          style={styles.webView}
          onMessage={handleMessage}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textCoffee,
  },
  locateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.forestGreen,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  locateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: -2,
  },
  presetScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  presetLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 2,
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  presetPill: {
    backgroundColor: '#FAF4EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
  },
  presetPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brandGold,
  },
  mapFrame: {
    height: 180,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.kraftBorder,
    backgroundColor: COLORS.canvas,
    marginTop: 2,
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
