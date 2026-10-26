import React, { useCallback, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import {
  Stethoscope,
  Video,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  X,
  PawPrint,
  Building2,
  Star,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { Doctor } from '../../types';
import { Consultation } from '../../api/consultations';
import { styles } from './vetStyles';
import { getStatusBadge, getDoctorImageUrl, formatDate } from './vetHelpers';

// Pure Memoized Consultation Card Component
interface ConsultationCardItemProps {
  consultation: Consultation;
  isJoining: boolean;
  onJoinVideo: (consultation: Consultation) => void;
  onCancel: (consultationId: number) => void;
  onReview: (consultationId: number) => void;
  reviewsEnabled: boolean;
  cardWidth?: any;
}

export const ConsultationCardItem = memo(function ConsultationCardItem({
  consultation,
  isJoining,
  onJoinVideo,
  onCancel,
  onReview,
  reviewsEnabled,
  cardWidth,
}: ConsultationCardItemProps) {
  const statusInfo = getStatusBadge(consultation.status);
  const doc = consultation.doctor;
  const pet = consultation.pet;
  const docImg = getDoctorImageUrl(doc);
  const isCallActive =
    consultation.status === 'confirmed' || consultation.status === 'in_progress';
  const isCompleted = consultation.status === 'completed';
  const isPending = consultation.status === 'pending';

  const scheduledDateStr = useMemo(
    () => formatDate(consultation.scheduled_at),
    [consultation.scheduled_at]
  );

  const handleJoin = useCallback(() => {
    onJoinVideo(consultation);
  }, [onJoinVideo, consultation]);

  const handleCancel = useCallback(() => {
    onCancel(consultation.id);
  }, [onCancel, consultation.id]);

  const handleReview = useCallback(() => {
    onReview(consultation.id);
  }, [onReview, consultation.id]);

  return (
    <View style={[styles.consultationCard, cardWidth ? { width: cardWidth } : null]}>
      {/* Card Top Row: ID, Time, Badge */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIdBadge}>
          <Text style={styles.cardIdText}>APPT #{consultation.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
          {isCallActive && <View style={styles.livePulseDot} />}
          <Text style={[styles.statusBadgeText, { color: statusInfo.text }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Doctor Profile Info */}
      <View style={styles.doctorInfoRow}>
        {docImg ? (
          <Image source={{ uri: docImg }} style={styles.doctorAvatar} />
        ) : (
          <View style={styles.doctorAvatarFallback}>
            <Stethoscope size={22} color={COLORS.forestGreen} />
          </View>
        )}
        <View style={styles.doctorTextCol}>
          <Text style={styles.doctorName}>
            {doc?.user?.first_name
              ? `Dr. ${doc.user.first_name} ${doc.user.last_name || ''}`.trim()
              : 'Certified Veterinary Specialist'}
          </Text>
          <Text style={styles.doctorSpec}>
            {doc?.specialization || 'Clinical Nutritionist'}
          </Text>
          {doc?.clinic?.name && (
            <View style={styles.clinicRow}>
              <Building2 size={12} color={COLORS.textMuted} />
              <Text style={styles.clinicText}>
                {doc.clinic.name} • {doc.clinic.city || 'India'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardDivider} />

      {/* Patient & Appointment Details */}
      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>PATIENT</Text>
          <View style={styles.detailValueRow}>
            <PawPrint size={13} color={COLORS.brandGold} />
            <Text style={styles.detailValueText}>
              {pet ? `${pet.name} (${pet.breed || pet.species})` : 'Registered Pet'}
            </Text>
          </View>
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>SCHEDULED TIME</Text>
          <View style={styles.detailValueRow}>
            <Clock size={13} color={COLORS.forestGreen} />
            <Text style={styles.detailValueText}>{scheduledDateStr}</Text>
          </View>
        </View>
      </View>

      {/* Reason / Symptoms Card */}
      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>CHIEF REASON / SYMPTOMS:</Text>
        <Text style={styles.reasonText}>"{consultation.reason}"</Text>
      </View>

      {/* Doctor Clinical Notes & Dietary Advice (If Completed) */}
      {isCompleted && (
        <View style={styles.doctorNotesBox}>
          <View style={styles.notesHeader}>
            <FileText size={15} color={COLORS.forestGreen} />
            <Text style={styles.notesHeaderTitle}>
              Doctor's Clinical Notes & Dietary Advice
            </Text>
          </View>
          <Text style={styles.doctorNotesText}>
            {consultation.doctor_notes ||
              'Consultation completed. Formal dietary notes and meal formulation instructions are being finalized by the specialist.'}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.cardActionRow}>
        {isCallActive && (
          <TouchableOpacity
            style={[styles.joinCallBtn, isJoining && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Video size={16} color="#FFFFFF" />
                <Text style={styles.joinCallBtnText}>Join Live Video Call</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isPending && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <X size={14} color="#DC2626" />
            <Text style={styles.cancelBtnText}>Cancel Booking</Text>
          </TouchableOpacity>
        )}

        {isCompleted && (
          <View style={styles.completedStamp}>
            <CheckCircle2 size={14} color={COLORS.forestGreen} />
            <Text style={styles.completedStampText}>Consultation Completed</Text>
          </View>
        )}

        {isCompleted && reviewsEnabled && (
          <TouchableOpacity style={styles.leaveReviewBtn} onPress={handleReview}>
            <Star size={14} color={COLORS.brandGold} />
            <Text style={styles.leaveReviewBtnText}>Leave a Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Pure Memoized Doctor Directory Card Component
interface DoctorDirectoryCardProps {
  doc: Doctor;
  onSelectProfile: (doc: Doctor) => void;
  onBook: (doc: Doctor) => void;
  cardWidth?: any;
}

export const DoctorDirectoryCard = memo(function DoctorDirectoryCard({
  doc,
  onSelectProfile,
  onBook,
  cardWidth,
}: DoctorDirectoryCardProps) {
  const docName =
    doc.name ||
    (doc.user
      ? `Dr. ${doc.user.first_name} ${doc.user.last_name || ''}`.trim()
      : 'Veterinary Specialist');
  const docImg = getDoctorImageUrl(doc);

  const handleProfilePress = useCallback(() => {
    onSelectProfile(doc);
  }, [onSelectProfile, doc]);

  const handleBookPress = useCallback(() => {
    onBook(doc);
  }, [onBook, doc]);

  return (
    <View style={[styles.docCard, cardWidth ? { width: cardWidth } : null]}>
      <TouchableOpacity activeOpacity={0.85} onPress={handleProfilePress}>
        <View style={styles.docCardTop}>
          {docImg ? (
            <Image source={{ uri: docImg }} style={styles.docImg} />
          ) : (
            <View style={styles.docImgFallback}>
              <Stethoscope size={26} color={COLORS.forestGreen} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.verifiedRow}>
              <Text style={styles.docCardName}>{docName}</Text>
              <ShieldCheck size={14} color={COLORS.forestGreen} />
            </View>
            <Text style={styles.docCardSpec}>{doc.specialization}</Text>
            {doc.qualification && (
              <Text style={styles.docCardQual}>{doc.qualification}</Text>
            )}
            <View style={styles.docCardStatsRow}>
              {doc.experience_years ? (
                <Text style={styles.docCardExp}>{doc.experience_years} yrs exp</Text>
              ) : null}
              {doc.average_rating ? (
                <View style={styles.ratingBadge}>
                  <Star size={10} color="#D97706" fill="#D97706" />
                  <Text style={styles.ratingBadgeText}>
                    {doc.average_rating.toFixed(1)} ({doc.review_count || 0})
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </View>

        {doc.bio && (
          <Text style={styles.docBio} numberOfLines={2}>
            {doc.bio}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.cardDivider} />

      <View style={styles.docCardBottom}>
        <View>
          <Text style={styles.feeLabel}>CONSULTATION FEE</Text>
          <Text style={styles.feeVal}>
            ₹{Number(doc.consultation_fee).toFixed(0)}
          </Text>
        </View>

        <View style={styles.docCardActionsRow}>
          <TouchableOpacity
            style={styles.viewProfileOutlineBtn}
            onPress={handleProfilePress}
          >
            <Info size={13} color={COLORS.forestGreen} />
            <Text style={styles.viewProfileOutlineBtnText}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bookDocBtn, !doc.is_available && styles.bookDocBtnDisabled]}
            disabled={!doc.is_available}
            onPress={handleBookPress}
          >
            <Video size={14} color="#FFFFFF" />
            <Text style={styles.bookDocBtnText}>
              {doc.is_available ? 'Book' : 'Away'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
