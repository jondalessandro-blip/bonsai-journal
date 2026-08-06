import React from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useListUpcomingReminders } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const CARE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Watering: 'water-outline',
  Fertilizing: 'flask-outline',
  Pruning: 'cut-outline',
  Repotting: 'flower-outline',
  Wiring: 'git-branch-outline',
  'Pest Treatment': 'bug-outline',
  Observation: 'eye-outline',
};

function ReminderCard({ reminder }: { reminder: any }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const iconName = CARE_TYPE_ICONS[reminder.type] || 'calendar-outline';
  const isOverdue = reminder.daysUntilDue < 0;
  const isDueToday = reminder.daysUntilDue === 0;

  let urgencyColor = colors.mutedForeground;
  if (isOverdue) urgencyColor = colors.destructive;
  else if (isDueToday) urgencyColor = '#E8920A'; // amber

  const dueLabel = isOverdue
    ? `${Math.abs(reminder.daysUntilDue)}d overdue`
    : isDueToday
    ? 'Due today'
    : `In ${reminder.daysUntilDue}d`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      onPress={() =>
        router.push({ pathname: '/tree/[id]', params: { id: reminder.treeId } })
      }
    >
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Ionicons name={iconName} size={22} color={colors.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.treeName}>{reminder.treeName}</Text>
        <Text style={styles.type}>{reminder.type}</Text>
        {reminder.notes ? (
          <Text style={styles.notes} numberOfLines={1}>
            {reminder.notes}
          </Text>
        ) : null}
      </View>
      <View style={styles.dueContainer}>
        <Text style={[styles.dueLabel, { color: urgencyColor }]}>{dueLabel}</Text>
        <Text style={styles.dueDate}>
          {new Date(reminder.dueDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>
    </Pressable>
  );
}

export default function RemindersScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { data: reminders, isLoading, isError, refetch } = useListUpcomingReminders({
    query: { staleTime: 60_000 },
  });

  const overdue = reminders?.filter((r) => r.daysUntilDue < 0) ?? [];
  const upcoming = reminders?.filter((r) => r.daysUntilDue >= 0) ?? [];

  const sections = [
    ...(overdue.length > 0
      ? [{ type: 'header', label: 'Overdue', id: 'h-overdue' }, ...overdue.map((r) => ({ ...r, type: 'item' }))]
      : []),
    ...(upcoming.length > 0
      ? [{ type: 'header', label: 'Upcoming — next 30 days', id: 'h-upcoming' }, ...upcoming.map((r) => ({ ...r, type: 'item' }))]
      : []),
  ];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.errorText}>Failed to load reminders</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, i) => (item as any).id || (item as any).treeId + i}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={sections.length > 0}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={56} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySubtitle}>
                No reminders in the next 30 days
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            if ((item as any).type === 'header') {
              return (
                <Text style={styles.sectionHeader}>{(item as any).label}</Text>
              );
            }
            return <ReminderCard reminder={item} />;
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'Fraunces_700Bold',
      color: colors.foreground,
    },
    sectionHeader: {
      fontSize: 13,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.mutedForeground,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      flex: 1,
      gap: 2,
    },
    treeName: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    type: {
      fontSize: 13,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    notes: {
      fontSize: 12,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    dueContainer: {
      alignItems: 'flex-end',
      gap: 2,
    },
    dueLabel: {
      fontSize: 13,
      fontFamily: 'Outfit_600SemiBold',
    },
    dueDate: {
      fontSize: 12,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    listContent: {
      paddingTop: 4,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    errorText: {
      fontSize: 16,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    retryButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    retryText: {
      fontSize: 14,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
  });
}
