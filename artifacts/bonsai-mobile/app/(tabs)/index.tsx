import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useListTrees } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const CARE_TYPE_ICONS: Record<string, string> = {
  Watering: 'water',
  Fertilizing: 'flask',
  Pruning: 'cut',
  Repotting: 'flower',
};

function TreeCard({ tree, onPress }: { tree: any; onPress: () => void }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const imageUrl = tree.coverThumb || tree.photoUrl;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardImageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <Ionicons name="leaf" size={32} color={colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName} numberOfLines={1}>
          {tree.name}
        </Text>
        {tree.species ? (
          <Text style={styles.cardSpecies} numberOfLines={1}>
            {tree.species}
          </Text>
        ) : null}
        {tree.stage ? (
          <View style={styles.stageBadge}>
            <Text style={styles.stageBadgeText}>{tree.stage}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function CollectionScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const { data: trees, isLoading, isError, refetch } = useListTrees(
    search ? { search } : undefined,
    { query: { staleTime: 30_000 } },
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Collection</Text>
        {trees && (
          <Text style={styles.headerCount}>{trees.length} trees</Text>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search trees..."
          placeholderTextColor={colors.mutedForeground}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyTitle}>Failed to load</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={trees ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
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
          scrollEnabled={!!(trees && trees.length > 0)}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={56} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>
                {search ? 'No trees found' : 'No trees yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? 'Try a different search term'
                  : 'Add your first bonsai in the web app'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TreeCard
              tree={item}
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: '/tree/[id]', params: { id: item.id } });
              }}
            />
          )}
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
      flexDirection: 'row',
      alignItems: 'baseline',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
      gap: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontFamily: 'Fraunces_700Bold',
      color: colors.foreground,
    },
    headerCount: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 16,
      paddingHorizontal: 12,
      height: 40,
      borderRadius: 10,
      backgroundColor: colors.muted,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.foreground,
    },
    row: {
      paddingHorizontal: 16,
      gap: 12,
    },
    listContent: {
      paddingTop: 4,
      gap: 12,
    },
    card: {
      flex: 1,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    cardImageContainer: {
      height: 130,
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    cardImagePlaceholder: {
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardContent: {
      padding: 12,
      gap: 2,
    },
    cardName: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    cardSpecies: {
      fontSize: 12,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
      fontStyle: 'italic',
    },
    stageBadge: {
      marginTop: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    stageBadgeText: {
      fontSize: 10,
      fontFamily: 'Outfit_500Medium',
      color: colors.mutedForeground,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
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
      paddingHorizontal: 40,
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
  });
}
