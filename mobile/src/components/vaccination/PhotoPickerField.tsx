import React from 'react';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../theme/colors';
import type { PickedPhoto } from '../../api/vaccinations';

const MAX_BYTES = 8 * 1024 * 1024;

const toPhoto = (a: ImagePicker.ImagePickerAsset): PickedPhoto | null => {
  if (a.fileSize && a.fileSize > MAX_BYTES) {
    Alert.alert('Photo too large', 'Please choose a photo under 8 MB.');
    return null;
  }
  const type = a.mimeType && /^image\/(jpeg|png|webp)$/.test(a.mimeType) ? a.mimeType : 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return { uri: a.uri, name: `vaccine-card-${Date.now()}.${ext}`, type };
};

/** Vaccine card photo: take one with the camera or upload from the gallery. Required wherever a dose is recorded. */
export default function PhotoPickerField({ photo, onChange }: { photo: PickedPhoto | null; onChange: (p: PickedPhoto | null) => void }) {
  const take = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Camera permission needed', 'Allow camera access in Settings, or upload a photo from your gallery instead.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!res.canceled && res.assets[0]) { const p = toPhoto(res.assets[0]); if (p) onChange(p); }
  };
  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
    if (!res.canceled && res.assets[0]) { const p = toPhoto(res.assets[0]); if (p) onChange(p); }
  };

  if (photo) {
    return (
      <View style={styles.preview}>
        <Image source={{ uri: photo.uri }} style={styles.thumb} accessibilityLabel="Vaccine card photo" />
        <Text style={styles.previewText} numberOfLines={1}>Photo added</Text>
        <TouchableOpacity onPress={() => onChange(null)} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel="Remove photo">
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.label}>Vaccine card photo <Text style={styles.req}>*</Text></Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={take} accessibilityRole="button" accessibilityLabel="Take photo of vaccine card">
          <Text style={styles.btnText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={upload} accessibilityRole="button" accessibilityLabel="Upload photo of vaccine card">
          <Text style={styles.btnText}>Upload photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: COLORS.textCoffee, marginBottom: 6, fontWeight: '600' },
  req: { color: COLORS.accentRed },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 44, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.kraftBorder, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card },
  btnText: { color: COLORS.textCoffee, fontWeight: '700', fontSize: 13 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: COLORS.kraftBorder, borderRadius: 6, padding: 8, backgroundColor: COLORS.card },
  thumb: { width: 52, height: 52, borderRadius: 4 },
  previewText: { flex: 1, color: COLORS.textCoffee, fontSize: 13 },
  removeBtn: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  removeText: { color: COLORS.accentRed, fontWeight: '700', fontSize: 12 },
});
