import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useGetTree, useListTreeLogs, useListTreePhotos } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_HEIGHT = 260;

const CARE_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Watering: 'water-outline',
  Fertilizing: 'flask-outline',
  Pruning: 'cut-outline',
  Repotting: 'flower-outline',
  Wiring: 'git-branch-outline',
  'Pest Treatment': 'bug-outline',
  'Status Change': 'swap-horizontal-outline',
  Observation: 'eye-outline',
  Other: 'ellipsis-horizontal-outline',
};

type Tab = 'logs' | 'photos';

export default function TreeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('logs');

  const { data: tree, isLoading: treeLoading, isError: treeError, refetch: refetchTree } = useGetTree(id);
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useListTreeLogs(id);
  const { data: photos, isLoading: photosLoading, refetch: refetchPhotos } = useListTreePhotos(id);

  const isLoading = treeLoading || logsLoading || photosLoading;
  const onRefresh = () => { refetchTree(); refetchLogs(); refetchPhotos(); };

  if (treeLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (treeError || !tree) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
        <Text style={styles.errorText}>Tree not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const heroUrl = tree.photoUrl;

  return (
    <View style={styles.container}>
      {/* Configure Stack header */}
      <Stack.Screen
        options={{
          title: tree.name,
          headerTransparent: !!heroUrl,
          headerTintColor: heroUrl ? '#fff' : colors.foreground,
          headerBackTitle: 'Back',
          headerStyle: heroUrl ? {} : { backgroundColor: colors.background },
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image */}
        {heroUrl ? (
          <View style={styles.hero}>
            <Image source={{ uri: heroUrl }} style={styles.heroImage} contentFit="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent']}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Ionicons name="leaf" size={64} color={colors.primary} />
          </View>
        )}

        {/* Tree info card */}
        <View style={styles.infoCard}>
          <Text style={styles.treeName}>{tree.name}</Text>
          {tree.species ? (
            <Text style={styles.treeSpecies}>{tree.species}</Text>
          ) : null}

          {/* Badges */}
          <View style={styles.badges}>
            {tree.stage && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tree.stage}</Text>
              </View>
            )}
            {tree.climate && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tree.climate}</Text>
              </View>
            )}
            {tree.foliage && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tree.foliage}</Text>
              </View>
            )}
            {tree.style && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tree.style}</Text>
              </View>
            )}
          </View>

          {tree.tags && tree.tags.length > 0 && (
            <View style={styles.tags}>
              {tree.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, activeTab === 'logs' && styles.tabActive]}
            onPress={() => setActiveTab('logs')}
          >
            <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
              Care Log
            </Text>
            {logs && logs.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{logs.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
            onPress={() => setActiveTab('photos')}
          >
            <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
              Photos
            </Text>
            {photos && photos.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{photos.length}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Tab content */}
        {activeTab === 'logs' && (
          <View style={styles.tabContent}>
            {logsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
            ) : logs && logs.length > 0 ? (
              logs.map((log, idx) => {
                const iconName = CARE_TYPE_ICONS[log.type] || 'ellipse-outline';
                return (
                  <View key={log.id}>
                    <View style={styles.logRow}>
                      <View style={styles.logIconBox}>
                        <Ionicons name={iconName} size={18} color={colors.primary} />
                      </View>
                      <View style={styles.logContent}>
                        <Text style={styles.logType}>{log.type}</Text>
                        {log.notes ? (
                          <Text style={styles.logNotes}>{log.notes}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.logDate}>
                        {new Date(log.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year:
                            new Date(log.date).getFullYear() !== new Date().getFullYear()
                              ? 'numeric'
                              : undefined,
                        })}
                      </Text>
                    </View>
                    {idx < (logs?.length ?? 0) - 1 && <View style={styles.logDivider} />}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyTab}>
                <Ionicons name="calendar-outline" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyTabText}>No care logs yet</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'photos' && (
          <View style={styles.tabContent}>
            {photosLoading ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 24 }} />
            ) : photos && photos.length > 0 ? (
              <View style={styles.photoGrid}>
                {photos.map((photo) => (
                  <View key={photo.id} style={styles.photoCell}>
                    <Image
                      source={{ uri: photo.photoUrl }}
                      style={styles.photoThumb}
                      contentFit="cover"
                    />
                    <Text style={styles.photoDate}>
                      {new Date(photo.takenAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTab}>
                <Ionicons name="camera-outline" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyTabText}>No progression photos yet</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FABs */}
      <View style={[styles.fabRow, { bottom: insets.bottom + (Platform.OS === 'web' ? 34 : 24) }]}>
        <Pressable
          style={({ pressed }) => [styles.fabSecondary, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/add-log', params: { treeId: id } });
          }}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.fabSecondaryText}>Log Care</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.fabPrimary, pressed && { opacity: 0.85 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/add-photo', params: { treeId: id } });
          }}
        >
          <Ionicons name="camera" size={20} color={colors.primaryForeground} />
          <Text style={styles.fabPrimaryText}>Add Photo</Text>
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
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    hero: {
      height: HERO_HEIGHT,
      width: '100%',
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroPlaceholder: {
      backgroundColor: colors.muted,
    },
    infoCard: {
      padding: 20,
      backgroundColor: colors.background,
    },
    treeName: {
      fontSize: 26,
      fontFamily: 'Fraunces_700Bold',
      color: colors.foreground,
      marginBottom: 4,
    },
    treeSpecies: {
      fontSize: 16,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      fontStyle: 'italic',
      marginBottom: 12,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: 'Outfit_500Medium',
      color: colors.mutedForeground,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 4,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
      backgroundColor: colors.accent,
    },
    tagText: {
      fontSize: 12,
      fontFamily: 'Outfit_400Regular',
      color: colors.primary,
    },
    tabRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 6,
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: colors.primary,
    },
    tabBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 10,
      backgroundColor: colors.muted,
    },
    tabBadgeText: {
      fontSize: 11,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.mutedForeground,
    },
    tabContent: {
      paddingTop: 8,
    },
    logRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    logIconBox: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    logContent: {
      flex: 1,
      gap: 2,
    },
    logType: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    logNotes: {
      fontSize: 13,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    logDate: {
      fontSize: 12,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      paddingTop: 2,
    },
    logDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 64,
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 12,
      gap: 8,
    },
    photoCell: {
      width: (SCREEN_W - 40) / 3,
      gap: 4,
    },
    photoThumb: {
      width: '100%',
      height: (SCREEN_W - 40) / 3,
      borderRadius: 10,
      backgroundColor: colors.muted,
    },
    photoDate: {
      fontSize: 10,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    emptyTab: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 8,
    },
    emptyTabText: {
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    fabRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      gap: 12,
    },
    fabPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      gap: 8,
    },
    fabPrimaryText: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
    fabSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.primary,
      gap: 8,
    },
    fabSecondaryText: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primary,
    },
    errorText: {
      fontSize: 16,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    backButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    backButtonText: {
      fontSize: 14,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
  });
}
