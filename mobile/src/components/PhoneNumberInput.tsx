import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { COUNTRIES, type Country } from '../constants/countries';
import { getCountry } from '../utils/phone';

interface PhoneNumberInputProps {
  country: string; // iso2
  onCountryChange: (iso2: string) => void;
  nationalNumber: string;
  onNationalNumberChange: (digits: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

// Country-code-aware phone entry: a searchable flag/dial-code picker next
// to a plain digits field, instead of a single input with a hardcoded "+91"
// label. Used anywhere a user enters a phone number for verification.
export function PhoneNumberInput({
  country,
  onCountryChange,
  nationalNumber,
  onNationalNumberChange,
  disabled,
  placeholder = '9876543210',
  autoFocus,
}: PhoneNumberInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = getCountry(country);

  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dialCode.includes(query.replace(/\D/g, ''))
      )
    : COUNTRIES;

  const renderItem = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={[styles.row, item.iso2 === country && styles.rowSelected]}
      onPress={() => {
        onCountryChange(item.iso2);
        setPickerOpen(false);
        setQuery('');
      }}
      activeOpacity={0.7}
    >
      <Text style={styles.rowFlag}>{item.flag}</Text>
      <Text style={styles.rowName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.rowDial}>+{item.dialCode}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      <TouchableOpacity
        style={styles.countryButton}
        onPress={() => !disabled && setPickerOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Text style={styles.flag}>{selected.flag}</Text>
        <Text style={styles.dialCode}>+{selected.dialCode}</Text>
        {!disabled && <ChevronDown size={12} color="#A8998C" />}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={nationalNumber}
        onChangeText={(val) => onNationalNumberChange(val.replace(/\D/g, ''))}
        placeholder={placeholder}
        placeholderTextColor="#A8998C"
        keyboardType="number-pad"
        autoFocus={autoFocus}
        editable={!disabled}
      />

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#2C1810" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Search size={14} color="#A8998C" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search country or code..."
              placeholderTextColor="#A8998C"
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.iso2}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EBE0D0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  containerDisabled: {
    opacity: 0.85,
    backgroundColor: '#F8F5F0',
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#EBE0D0',
  },
  flag: { fontSize: 16, lineHeight: 18 },
  dialCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1810',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#2C1810',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modalSafeArea: { flex: 1, backgroundColor: '#FAF7F2' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBE0D0',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#2C1810' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EBE0D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#2C1810' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EFE9',
  },
  rowSelected: { backgroundColor: '#F3EFE9' },
  rowFlag: { fontSize: 18 },
  rowName: { flex: 1, fontSize: 13, color: '#2C1810' },
  rowDial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#715D52',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
