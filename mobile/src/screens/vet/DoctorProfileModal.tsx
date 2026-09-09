import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { X, ShieldCheck, Stethoscope, Star, Award, Building2, MapPin, Clock, Video } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { Doctor } from '../../types';
import { DoctorReviewItem } from '../../api/doctors';
import { getDoctorImageUrl } from './vetHelpers';
import { useResponsive } from '../../hooks/useResponsive';
import { styles } from './vetStyles';

interface DoctorProfileModalProps {
  doctor: Doctor | null;
  doctorDetail: Doctor | null;
  loading: boolean;
  reviews: DoctorReviewItem[];
  scheduleSummary: string | null;
  onClose: () => void;
  onBook: () => void;
}

export function DoctorProfileModal({
  doctor,
  doctorDetail,
  loading,
  reviews,
  scheduleSummary,
  onClose,
  onBook,
}: DoctorProfileModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();

  return (
    <Modal visible={!!doctor} transparent animationType="slide">
      <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
        <View style={[styles.profileModalSheet, isTablet && modalSheetContainerStyle]}>
          {/* Profile Header Bar */}
          <View style={styles.modalHeader}>
            <View style={styles.profileHeaderBadgeRow}>
              <ShieldCheck size={18} color={COLORS.forestGreen} />
              <View>
                <Text style={styles.modalSubHeader}>CLINICAL SPECIALIST</Text>
                <Text style={styles.modalTitle}>Doctor Profile</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.profileLoadingBox}>
              <ActivityIndicator size="large" color={COLORS.forestGreen} />
              <Text style={styles.slotLoadingText}>Loading specialist credentials & reviews...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.profileContentScroll}>
              {doctor && (
                <>
                  {/* Hero Card */}
                  <View style={styles.profileHeroCard}>
                    {getDoctorImageUrl(doctor) ? (
                      <Image source={{ uri: getDoctorImageUrl(doctor)! }} style={styles.profileHeroImg} />
                    ) : (
                      <View style={styles.profileHeroImgFallback}>
                        <Stethoscope size={36} color={COLORS.forestGreen} />
                      </View>
                    )}

                    <Text style={styles.profileHeroName}>
                      {doctorDetail?.name ||
                        doctor.name ||
                        (doctor.user
                          ? `Dr. ${doctor.user.first_name} ${doctor.user.last_name || ''}`.trim()
                          : 'Veterinary Specialist')}
                    </Text>

                    <Text style={styles.profileHeroSpec}>
                      {doctorDetail?.specialization || doctor.specialization}
                    </Text>

                    {/* Highlights Pill Row */}
                    <View style={styles.profilePillRow}>
                      <View style={styles.profileHighlightPill}>
                        <Star size={12} color="#D97706" fill="#D97706" />
                        <Text style={styles.profileHighlightPillText}>
                          {doctorDetail?.average_rating
                            ? `${doctorDetail.average_rating.toFixed(1)} (${doctorDetail.review_count || 0})`
                            : '5.0 Rating'}
                        </Text>
                      </View>

                      {doctor.experience_years ? (
                        <View style={styles.profileHighlightPill}>
                          <Award size={12} color={COLORS.forestGreen} />
                          <Text style={styles.profileHighlightPillText}>
                            {doctor.experience_years} Years Exp
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.profileHighlightPill}>
                        <ShieldCheck size={12} color={COLORS.forestGreen} />
                        <Text style={styles.profileHighlightPillText}>Verified</Text>
                      </View>
                    </View>
                  </View>

                  {/* About Doctor (Full Bio) */}
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>ABOUT THE SPECIALIST</Text>
                    <Text style={styles.profileBioText}>
                      {doctorDetail?.bio ||
                        doctor.bio ||
                        'Dedicated veterinary nutritionist committed to helping pets thrive on wholesome, balanced nutrition.'}
                    </Text>
                  </View>

                  {/* Credentials & Expertise */}
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>CREDENTIALS & EXPERTISE</Text>
                    <View style={styles.profileInfoBox}>
                      <View style={styles.profileInfoRow}>
                        <Award size={16} color={COLORS.brandGold} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profileInfoLabel}>Medical Qualification</Text>
                          <Text style={styles.profileInfoValue}>
                            {doctorDetail?.qualification ||
                              doctor.qualification ||
                              'Certified Veterinary Professional'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.profileInfoDivider} />

                      <View style={styles.profileInfoRow}>
                        <Stethoscope size={16} color={COLORS.forestGreen} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profileInfoLabel}>Specialization</Text>
                          <Text style={styles.profileInfoValue}>
                            {doctorDetail?.specialization || doctor.specialization}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Associated Clinic */}
                  {doctorDetail?.clinic && (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>AFFILIATED CLINIC</Text>
                      <View style={styles.profileInfoBox}>
                        <View style={styles.profileInfoRow}>
                          <Building2 size={16} color={COLORS.forestGreen} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.profileInfoLabel}>Practice / Clinic Name</Text>
                            <Text style={styles.profileInfoValue}>{doctorDetail.clinic.name}</Text>
                          </View>
                        </View>

                        {(doctorDetail.clinic.city || doctorDetail.clinic.state) && (
                          <>
                            <View style={styles.profileInfoDivider} />
                            <View style={styles.profileInfoRow}>
                              <MapPin size={16} color={COLORS.brandGold} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.profileInfoLabel}>Location</Text>
                                <Text style={styles.profileInfoValue}>
                                  {[doctorDetail.clinic.city, doctorDetail.clinic.state]
                                    .filter(Boolean)
                                    .join(', ')}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Clinical Schedule */}
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>CONSULTATION SCHEDULE</Text>
                    <View style={styles.profileScheduleBox}>
                      <Clock size={16} color={COLORS.forestGreen} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileScheduleTitle}>Working Hours</Text>
                        <Text style={styles.profileScheduleSub}>
                          {scheduleSummary || 'Monday to Friday • Official Consultation Hours'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Patient Reviews */}
                  <View style={styles.profileSection}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.profileSectionTitle}>PATIENT REVIEWS</Text>
                      <Text style={styles.reviewsCountBadge}>{reviews.length} Verified Reviews</Text>
                    </View>

                    {reviews.length === 0 ? (
                      <View style={styles.noReviewsBox}>
                        <Text style={styles.noReviewsText}>
                          No reviews submitted yet for this specialist.
                        </Text>
                      </View>
                    ) : (
                      reviews.map((rev) => {
                        const reviewerName = rev.customer
                          ? [rev.customer.first_name, rev.customer.last_name].filter(Boolean).join(' ')
                          : 'Pet Parent';
                        const dateFormatted = new Date(rev.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });

                        return (
                          <View key={rev.id} style={styles.reviewCard}>
                            <View style={styles.reviewCardTop}>
                              <View style={styles.reviewerInfo}>
                                <View style={styles.reviewerAvatar}>
                                  <Text style={styles.reviewerAvatarText}>
                                    {(reviewerName[0] || 'P').toUpperCase()}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={styles.reviewerName}>{reviewerName}</Text>
                                  <Text style={styles.reviewDate}>{dateFormatted}</Text>
                                </View>
                              </View>
                              <View style={styles.reviewStarsRow}>
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    size={11}
                                    color={s <= rev.rating ? '#D97706' : '#E5E7EB'}
                                    fill={s <= rev.rating ? '#D97706' : 'none'}
                                  />
                                ))}
                              </View>
                            </View>
                            {rev.comment ? <Text style={styles.reviewComment}>{rev.comment.trim()}</Text> : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          )}

          {/* Bottom Sticky Action Bar */}
          {doctor && (
            <View style={styles.profileBottomBar}>
              <View>
                <Text style={styles.feeLabel}>CONSULTATION FEE</Text>
                <Text style={styles.feeVal}>₹{Number(doctor.consultation_fee).toFixed(0)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.profileBookBtn, !doctor.is_available && styles.bookDocBtnDisabled]}
                disabled={!doctor.is_available}
                onPress={onBook}
              >
                <Video size={16} color="#FFFFFF" />
                <Text style={styles.profileBookBtnText}>
                  {doctor.is_available ? 'Book Video Consult' : 'Currently Away'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
