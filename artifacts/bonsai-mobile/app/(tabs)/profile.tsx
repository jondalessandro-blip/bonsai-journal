import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { useAuth, useUser } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/(auth)/sign-in');
  };

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? '?';

  const displayName =
    user?.firstName
      ? `${user.firstName} ${user.lastName ?? ''}`.trim()
      : user?.emailAddresses?.[0]?.emailAddress ?? 'Bonsai Keeper';

  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {/* Avatar + name */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.displayName}>{displayName}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      {/* Info rows */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="person-outline" size={20} color={colors.primary} />
            <Text style={styles.rowLabel}>Name</Text>
            <Text style={styles.rowValue}>{displayName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
          </View>
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>App</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            <Text style={styles.rowLabel}>Bonsai Journal Mobile</Text>
            <Text style={styles.rowValue}>v1.0</Text>
          </View>
        </View>
      </View>

      {/* Sign out */}
      <View style={[styles.section, { marginTop: 'auto' }]}>
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.8 }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
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
    profileSection: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    avatarText: {
      fontSize: 28,
      fontFamily: 'Fraunces_700Bold',
      color: colors.primaryForeground,
    },
    displayName: {
      fontSize: 20,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    email: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginLeft: 4,
    },
    card: {
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.foreground,
    },
    rowValue: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      maxWidth: 160,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 52,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.destructive,
      backgroundColor: colors.card,
    },
    signOutText: {
      fontSize: 16,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.destructive,
    },
  });
}
