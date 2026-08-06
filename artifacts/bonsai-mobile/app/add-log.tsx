import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateTreeLog, getListTreeLogsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

const CARE_TYPES = [
  { label: 'Watering', icon: 'water-outline' as const },
  { label: 'Fertilizing', icon: 'flask-outline' as const },
  { label: 'Pruning', icon: 'cut-outline' as const },
  { label: 'Repotting', icon: 'flower-outline' as const },
  { label: 'Wiring', icon: 'git-branch-outline' as const },
  { label: 'Pest Treatment', icon: 'bug-outline' as const },
  { label: 'Observation', icon: 'eye-outline' as const },
  { label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

export default function AddLogScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState('Watering');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const { mutateAsync: createLog, isPending } = useCreateTreeLog();

  const handleSave = async () => {
    if (!treeId) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await createLog({
      id: treeId,
      data: { type: selectedType, date, notes: notes || undefined },
    });
    queryClient.invalidateQueries({ queryKey: getListTreeLogsQueryKey(treeId) });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 0) }]}>
      <KeyboardAwareScrollViewCompat
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        bottomOffset={20}
      >
        {/* Care type picker */}
        <Text style={styles.sectionLabel}>Type of care</Text>
        <View style={styles.typeGrid}>
          {CARE_TYPES.map((ct) => {
            const isSelected = selectedType === ct.label;
            return (
              <Pressable
                key={ct.label}
                style={({ pressed }) => [
                  styles.typeButton,
                  isSelected && styles.typeButtonSelected,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedType(ct.label);
                }}
              >
                <Ionicons
                  name={ct.icon}
                  size={22}
                  color={isSelected ? colors.primaryForeground : colors.foreground}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    isSelected && styles.typeLabelSelected,
                  ]}
                >
                  {ct.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date */}
        <Text style={styles.sectionLabel}>Date</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numbers-and-punctuation"
        />

        {/* Notes */}
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it go? Any observations..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Save */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            isPending && styles.saveButtonDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveButtonText}>Save Care Log</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      padding: 20,
      gap: 8,
    },
    sectionLabel: {
      fontSize: 13,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 16,
      marginBottom: 4,
    },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    typeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    typeButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeLabel: {
      fontSize: 13,
      fontFamily: 'Outfit_500Medium',
      color: colors.foreground,
    },
    typeLabelSelected: {
      color: colors.primaryForeground,
    },
    input: {
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.foreground,
    },
    textArea: {
      height: 120,
    },
    saveButton: {
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
  });
}
