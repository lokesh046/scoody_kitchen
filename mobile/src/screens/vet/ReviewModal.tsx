import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { X, Star } from 'lucide-react-native';
import { COLORS } from '../../theme/colors';
import { useResponsive } from '../../hooks/useResponsive';
import { styles } from './vetStyles';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  rating: number;
  onChangeRating: (rating: number) => void;
  comment: string;
  onChangeComment: (comment: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function ReviewModal({
  isOpen,
  onClose,
  rating,
  onChangeRating,
  comment,
  onChangeComment,
  isSubmitting,
  onSubmit,
}: ReviewModalProps) {
  const { isTablet, modalOverlayStyle, modalSheetContainerStyle } = useResponsive();

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={isTablet ? modalOverlayStyle : styles.modalOverlay}>
        <View style={[styles.reviewModalSheet, isTablet && modalSheetContainerStyle]}>
          <View style={styles.reviewModalHeaderRow}>
            <Text style={styles.reviewModalTitle}>Rate Your Consultation</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={COLORS.textCoffee} />
            </TouchableOpacity>
          </View>

          <Text style={styles.reviewModalSubtitle}>
            How was your experience with the veterinary specialist?
          </Text>

          <View style={styles.reviewStarRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => onChangeRating(star)}
                activeOpacity={0.7}
                style={styles.reviewStarBtn}
              >
                <Star size={32} color={COLORS.brandGold} fill={star <= rating ? COLORS.brandGold : 'none'} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.reviewCommentInput}
            placeholder="Share details about the advice you received (optional)..."
            placeholderTextColor={COLORS.textLight}
            value={comment}
            onChangeText={onChangeComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.reviewSubmitBtn, isSubmitting && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.reviewSubmitBtnText}>Submit Review</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
