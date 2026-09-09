import React, { memo } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { ArrowLeft, ArrowRight, MapPin, Phone, Check, AlertCircle } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { UserProfile } from '../../store/authStore';
import DeliveryMapPicker from '../../components/DeliveryMapPicker';
import { styles } from './cartStyles';

interface AddressStepProps {
  user: UserProfile | null;
  coords: { latitude: number; longitude: number };
  onLocationChange: (lat: number, lng: number) => void;
  isLocating: boolean;
  onLocatePress: () => void;

  doorNo: string;
  onChangeDoorNo: (v: string) => void;
  street: string;
  onChangeStreet: (v: string) => void;
  city: string;
  onChangeCity: (v: string) => void;
  stateName: string;
  onChangeStateName: (v: string) => void;
  pincode: string;
  onChangePincode: (v: string) => void;

  phone: string;
  onChangePhone: (v: string) => void;
  onVerifyPhone: () => void;

  onBack: () => void;
  onProceedToPayment: () => void;
}

export const AddressStep = memo(function AddressStep({
  user,
  coords,
  onLocationChange,
  isLocating,
  onLocatePress,
  doorNo,
  onChangeDoorNo,
  street,
  onChangeStreet,
  city,
  onChangeCity,
  stateName,
  onChangeStateName,
  pincode,
  onChangePincode,
  phone,
  onChangePhone,
  onVerifyPhone,
  onBack,
  onProceedToPayment,
}: AddressStepProps) {
  return (
    <>
      {/* Back to Step 1 Button */}
      <TouchableOpacity style={styles.stepBackBtn} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeft size={16} color={COLORS.forestGreen} />
        <Text style={styles.stepBackText}>Back to Bowl Items</Text>
      </TouchableOpacity>

      {/* Interactive Delivery Location Map & GPS Locator */}
      <DeliveryMapPicker
        latitude={coords.latitude}
        longitude={coords.longitude}
        onLocationChange={onLocationChange}
        isLocating={isLocating}
        onLocatePress={onLocatePress}
      />

      {/* Structured Delivery Address Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <MapPin size={18} color={COLORS.brandGold} />
          <Text style={styles.sectionHeading}>Shipping Address</Text>
        </View>
        <Text style={styles.sectionSubtext}>
          Auto-filled via GPS or map pin. Saved automatically to your device for cold-chain courier dispatch.
        </Text>

        {/* Flat / Door / House No */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Flat / Door / House No *</Text>
          <TextInput
            value={doorNo}
            onChangeText={onChangeDoorNo}
            placeholder="e.g. Door No: 14/A, Lotus Apts"
            placeholderTextColor={COLORS.textLight}
            style={styles.inputField}
          />
        </View>

        {/* Street / Area / Landmark */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Street / Area / Landmark *</Text>
          <TextInput
            value={street}
            onChangeText={onChangeStreet}
            placeholder="e.g. 1st Cross, Indiranagar"
            placeholderTextColor={COLORS.textLight}
            style={styles.inputField}
          />
        </View>

        {/* City & State & Pincode Row */}
        <View style={styles.inputRow}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>City *</Text>
            <TextInput
              value={city}
              onChangeText={onChangeCity}
              placeholder="e.g. Bangalore"
              placeholderTextColor={COLORS.textLight}
              style={styles.inputField}
            />
          </View>

          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>State *</Text>
            <TextInput
              value={stateName}
              onChangeText={onChangeStateName}
              placeholder="e.g. Karnataka"
              placeholderTextColor={COLORS.textLight}
              style={styles.inputField}
            />
          </View>

          <View style={[styles.fieldGroup, { width: 90 }]}>
            <Text style={styles.fieldLabel}>PIN *</Text>
            <TextInput
              value={pincode}
              onChangeText={(t) => onChangePincode(t.replace(/\D/g, ''))}
              placeholder="560038"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              maxLength={6}
              style={styles.inputField}
            />
          </View>
        </View>

        {/* Recipient Phone & Verification */}
        <View style={[styles.sectionTitleRow, { marginTop: 12 }]}>
          <Phone size={18} color={COLORS.brandGold} />
          <Text style={styles.sectionHeading}>Recipient Mobile Phone *</Text>
          {user?.is_phone_verified ? (
            <View style={styles.phoneVerifiedBadge}>
              <Check size={12} color={COLORS.forestGreen} />
              <Text style={styles.phoneVerifiedText}>Verified</Text>
            </View>
          ) : (
            <View style={styles.phoneUnverifiedBadge}>
              <AlertCircle size={12} color={COLORS.brandGold} />
              <Text style={styles.phoneUnverifiedText}>Unverified</Text>
            </View>
          )}
        </View>

        <View style={styles.phoneRow}>
          <View style={styles.countryCodeBox}>
            <Text style={styles.countryCodeText}>+91</Text>
          </View>
          <TextInput
            value={phone}
            onChangeText={(t) => onChangePhone(t.replace(/\D/g, ''))}
            placeholder="10-digit mobile number"
            placeholderTextColor={COLORS.textLight}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.phoneInputFlex}
          />
          {!user?.is_phone_verified && (
            <TouchableOpacity style={styles.verifyPhoneBtn} onPress={onVerifyPhone} activeOpacity={0.8}>
              <Text style={styles.verifyPhoneBtnText}>Verify via SMS</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Step 2 Primary Action Bar */}
      <View style={styles.stepActionCard}>
        <View style={styles.stepActionRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.stepActionSub}>Delivering To</Text>
            <Text style={styles.stepActionAddressSnippet} numberOfLines={1}>
              {city ? `${city} (${pincode})` : 'Delivery Location'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.primaryStepBtn}
            onPress={onProceedToPayment}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryStepBtnText}>Proceed to Payment</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
});
