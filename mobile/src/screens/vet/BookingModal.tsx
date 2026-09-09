import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import {
  X,
  Stethoscope,
  PawPrint,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar as CalendarIcon,
  Sunrise,
  Sun,
  Moon,
  Video,
} from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { Doctor, PetProfile } from '../../types';
import { getDoctorImageUrl, formatTime12h, QUICK_SYMPTOMS } from './vetHelpers';
import { useResponsive } from '../../hooks/useResponsive';
import { styles } from './vetStyles';

interface UpcomingDay {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  month: string;
  dayOfWeek: string;
}

interface CategorizedSlots {
  morning: string[];
  afternoon: string[];
  evening: string[];
}

interface BookingModalProps {
  doctor: Doctor | null;
  onClose: () => void;

  pets: PetProfile[];
  bookingPetId: number | null;
  onSelectPet: (petId: number) => void;

  upcomingDays: UpcomingDay[];
  selectedDateIndex: number;
  onSelectDateIndex: (idx: number) => void;
  currentChosenDay: UpcomingDay;
  workingDaysSet: Set<string>;
  scheduleSummary: string | null;

  loadingSlots: boolean;
  doctorSlots: string[];
  categorizedSlots: CategorizedSlots;
  selectedTime: string;
  onSelectTime: (slot: string) => void;
  isSlotInPast: (time24: string, dateStr: string) => boolean;

  reason: string;
  onChangeReason: (text: string) => void;

  bookingLoading: boolean;
  onConfirmBooking: () => void;
}

export function BookingModal({
  doctor,
  onClose,
  pets,
  bookingPetId,
  onSelectPet,
  upcomingDays,
  selectedDateIndex,
  onSelectDateIndex,
  currentChosenDay,
  workingDaysSet,
  scheduleSummary,
  loadingSlots,
  doctorSlots,
  categorizedSlots,
  selectedTime,
  onSelectTime,
  isSlotInPast,
  reason,
  onChangeReason,
  bookingLoading,
  onConfirmBooking,
}: BookingModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();

  const renderSlotChip = (slot: string) => {
    const isSelected = selectedTime === slot;
    const inPast = isSlotInPast(slot, currentChosenDay.dateStr);

    return (
      <TouchableOpacity
        key={slot}
        style={[
          styles.timeSlotChip,
          isSelected && styles.timeSlotChipSelected,
          inPast && styles.timeSlotChipDisabled,
        ]}
        onPress={() => {
          if (!inPast) onSelectTime(slot);
        }}
        disabled={inPast}
      >
        <Clock
          size={12}
          color={inPast ? '#D1D5DB' : isSelected ? '#FFFFFF' : COLORS.forestGreen}
        />
        <Text
          style={[
            styles.timeSlotText,
            isSelected && styles.timeSlotTextSelected,
            inPast && styles.timeSlotTextDisabled,
          ]}
        >
          {formatTime12h(slot)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={!!doctor} transparent animationType="slide">
      <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
        <View style={[styles.modalSheet, isTablet && modalSheetContainerStyle]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalSubHeader}>SCHEDULE APPOINTMENT</Text>
              <Text style={styles.modalTitle}>Book Video Consultation</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          {doctor && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              {/* Doctor Card Brief */}
              <View style={styles.modalDoctorBrief}>
                {getDoctorImageUrl(doctor) ? (
                  <Image source={{ uri: getDoctorImageUrl(doctor)! }} style={styles.modalDocAvatarImg} />
                ) : (
                  <View style={styles.docBriefAvatar}>
                    <Stethoscope size={20} color={COLORS.forestGreen} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalDocName}>
                    {doctor.name || (doctor.user ? `Dr. ${doctor.user.first_name}` : 'Specialist')}
                  </Text>
                  <Text style={styles.modalDocSpec}>{doctor.specialization}</Text>
                  <Text style={styles.modalDocFee}>
                    Consultation Fee: ₹{Number(doctor.consultation_fee).toFixed(0)} (30 min video)
                  </Text>
                </View>
              </View>

              {/* 1. SELECT PATIENT */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.modalFieldLabel}>1. SELECT PATIENT (PET)</Text>
                <Text style={styles.requiredBadge}>REQUIRED</Text>
              </View>

              {pets.length === 0 ? (
                <View style={styles.noPetsWarning}>
                  <AlertCircle size={16} color="#B45309" />
                  <Text style={styles.noPetsText}>
                    No registered pets found. Please add a pet in the Pets tab first.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsScroll}>
                  {pets.map((p) => {
                    const isChosen = bookingPetId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.petCard, isChosen && styles.petCardSelected]}
                        onPress={() => onSelectPet(p.id)}
                      >
                        {p.profile_image_url ? (
                          <Image source={{ uri: p.profile_image_url }} style={styles.petAvatarImg} />
                        ) : (
                          <View style={[styles.petAvatarBox, isChosen && styles.petAvatarBoxSelected]}>
                            <PawPrint size={16} color={isChosen ? '#FFFFFF' : COLORS.brandGold} />
                          </View>
                        )}
                        <View>
                          <Text style={[styles.petNameText, isChosen && styles.petNameTextSelected]}>
                            {p.name}
                          </Text>
                          <Text style={[styles.petBreedText, isChosen && styles.petBreedTextSelected]}>
                            {p.breed || p.species || 'Dog'}
                          </Text>
                        </View>
                        {isChosen && <CheckCircle2 size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* 2. SELECT DATE (14-DAY CALENDAR STRIP) */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.modalFieldLabel}>2. SELECT APPOINTMENT DATE</Text>
                <Text style={styles.subDateHint}>
                  {currentChosenDay.dayName}, {currentChosenDay.dayNum} {currentChosenDay.month}
                </Text>
              </View>

              {scheduleSummary ? (
                <View style={styles.scheduleSummaryBanner}>
                  <Clock size={13} color={COLORS.forestGreen} />
                  <Text style={styles.scheduleSummaryText}>Clinical Hours: {scheduleSummary}</Text>
                </View>
              ) : null}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarStrip}>
                {upcomingDays.map((day, idx) => {
                  const isSelected = selectedDateIndex === idx;
                  const isWorking = workingDaysSet.size === 0 || workingDaysSet.has(day.dayOfWeek);

                  return (
                    <TouchableOpacity
                      key={day.dateStr}
                      style={[
                        styles.dateItem,
                        !isWorking && styles.dateItemOffDuty,
                        isSelected && styles.dateItemSelected,
                      ]}
                      onPress={() => onSelectDateIndex(idx)}
                    >
                      <Text
                        style={[
                          styles.dateDayName,
                          !isWorking && styles.dateDayNameOffDuty,
                          isSelected && styles.dateDayNameSelected,
                        ]}
                      >
                        {day.dayName}
                      </Text>
                      <Text
                        style={[
                          styles.dateNumber,
                          !isWorking && styles.dateNumberOffDuty,
                          isSelected && styles.dateNumberSelected,
                        ]}
                      >
                        {day.dayNum}
                      </Text>
                      <Text
                        style={[
                          styles.dateMonth,
                          !isWorking && styles.dateMonthOffDuty,
                          isSelected && styles.dateMonthSelected,
                        ]}
                      >
                        {day.month}
                      </Text>
                      {isSelected ? (
                        <View style={styles.dateDotActive} />
                      ) : isWorking ? (
                        <View style={styles.dateDotWorking} />
                      ) : (
                        <Text style={styles.dateOffBadge}>OFF</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 3. SELECT TIME SLOT (Strictly Doctor's Scheduled Hours) */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.modalFieldLabel}>3. DOCTOR'S SCHEDULED HOURS</Text>
                {loadingSlots ? (
                  <ActivityIndicator size="small" color={COLORS.forestGreen} />
                ) : selectedTime ? (
                  <Text style={styles.selectedTimeBadge}>{formatTime12h(selectedTime)}</Text>
                ) : null}
              </View>

              {loadingSlots ? (
                <View style={styles.slotLoadingBox}>
                  <ActivityIndicator size="small" color={COLORS.forestGreen} />
                  <Text style={styles.slotLoadingText}>
                    Checking Dr. {doctor.name || 'specialist'}’s schedule...
                  </Text>
                </View>
              ) : doctorSlots.length === 0 ? (
                /* When doctor has no slots on this date */
                <View style={styles.noDoctorSlotsCard}>
                  <CalendarIcon size={24} color={COLORS.brandGold} />
                  <Text style={styles.noDoctorSlotsTitle}>
                    {workingDaysSet.size > 0 && !workingDaysSet.has(currentChosenDay.dayOfWeek)
                      ? `Doctor Off-Duty on ${currentChosenDay.dayName}`
                      : 'No Slots Available for this Date'}
                  </Text>
                  <Text style={styles.noDoctorSlotsSub}>
                    {workingDaysSet.size > 0 && !workingDaysSet.has(currentChosenDay.dayOfWeek)
                      ? `Dr. ${doctor.name || 'this specialist'} has no consultation hours on ${currentChosenDay.dayOfWeek}. ${scheduleSummary ? 'Active clinical hours: ' + scheduleSummary + '.' : ''} Please tap a highlighted working day (green dot) above.`
                      : `All consultation slots for Dr. ${doctor.name || 'this specialist'} on ${currentChosenDay.dayName}, ${currentChosenDay.dayNum} ${currentChosenDay.month} have already passed today or are booked. Please pick an upcoming working day.`}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.slotsSourceNotice}>
                    <CheckCircle2 size={12} color={COLORS.forestGreen} />
                    <Text style={styles.slotsSourceText}>
                      Official Doctor Schedule • {doctorSlots.length} Available Slots
                    </Text>
                  </View>

                  {/* Morning Section */}
                  {categorizedSlots.morning.length > 0 && (
                    <View style={styles.slotPeriodGroup}>
                      <View style={styles.slotPeriodHeader}>
                        <Sunrise size={14} color="#D97706" />
                        <Text style={styles.slotPeriodTitle}>
                          Morning Slots ({categorizedSlots.morning.length})
                        </Text>
                      </View>
                      <View style={styles.slotsGrid}>{categorizedSlots.morning.map(renderSlotChip)}</View>
                    </View>
                  )}

                  {/* Afternoon Section */}
                  {categorizedSlots.afternoon.length > 0 && (
                    <View style={styles.slotPeriodGroup}>
                      <View style={styles.slotPeriodHeader}>
                        <Sun size={14} color="#D97706" />
                        <Text style={styles.slotPeriodTitle}>
                          Afternoon Slots ({categorizedSlots.afternoon.length})
                        </Text>
                      </View>
                      <View style={styles.slotsGrid}>{categorizedSlots.afternoon.map(renderSlotChip)}</View>
                    </View>
                  )}

                  {/* Evening Section */}
                  {categorizedSlots.evening.length > 0 && (
                    <View style={styles.slotPeriodGroup}>
                      <View style={styles.slotPeriodHeader}>
                        <Moon size={14} color="#4B5563" />
                        <Text style={styles.slotPeriodTitle}>
                          Evening Slots ({categorizedSlots.evening.length})
                        </Text>
                      </View>
                      <View style={styles.slotsGrid}>{categorizedSlots.evening.map(renderSlotChip)}</View>
                    </View>
                  )}
                </>
              )}

              {/* 4. CHIEF SYMPTOMS & REASON */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.modalFieldLabel}>4. CHIEF REASON / SYMPTOMS</Text>
                <Text style={styles.requiredBadge}>REQUIRED</Text>
              </View>

              {/* Quick Symptom Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickSymptomsScroll}>
                {QUICK_SYMPTOMS.map((sym, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickSymptomChip}
                    onPress={() => {
                      const clean = sym.replace(/^[^\w]+/, '').trim();
                      onChangeReason(reason ? `${reason}, ${clean}` : clean);
                    }}
                  >
                    <Text style={styles.quickSymptomText}>{sym}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={styles.reasonInput}
                placeholder="Describe your pet's current diet, allergies, or symptoms in detail..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={reason}
                onChangeText={onChangeReason}
              />

              {/* 5. APPOINTMENT SUMMARY CARD */}
              <View style={styles.appointmentSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>APPOINTMENT DATE & TIME</Text>
                  <Text style={styles.summaryValue}>
                    {currentChosenDay.dayName}, {currentChosenDay.dayNum} {currentChosenDay.month} at{' '}
                    {selectedTime ? formatTime12h(selectedTime) : 'None Selected'}
                  </Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>PATIENT</Text>
                  <Text style={styles.summaryValue}>
                    {pets.find((p) => p.id === bookingPetId)?.name || 'Selected Pet'}
                  </Text>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>TOTAL CONSULTATION FEE</Text>
                  <Text style={styles.summaryFee}>₹{Number(doctor.consultation_fee).toFixed(0)}</Text>
                </View>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                style={[
                  styles.confirmBookBtn,
                  (bookingLoading || doctorSlots.length === 0 || !selectedTime) && styles.btnDisabled,
                ]}
                onPress={onConfirmBooking}
                disabled={bookingLoading || doctorSlots.length === 0 || !selectedTime}
              >
                {bookingLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Video size={18} color="#FFFFFF" />
                    <Text style={styles.confirmBookBtnText}>
                      {doctorSlots.length === 0
                        ? 'No Slots on this Date - Pick Another Day'
                        : `Pay ₹${Number(doctor.consultation_fee).toFixed(0)} & Confirm`}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
