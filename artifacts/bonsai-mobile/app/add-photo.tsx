import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image as RNImage,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useRequestUploadUrl,
  useCreateTreePhoto,
  getListTreePhotosQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

export default function AddPhotoScreen() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedSize, setPickedSize] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [date] = useState(new Date().toISOString().slice(0, 10));

  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: createPhoto } = useCreateTreePhoto();

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setPickedSize(result.assets[0].fileSize ?? 500_000);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      // On web, fall back to library picker
      pickFromLibrary();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPickedUri(result.assets[0].uri);
      setPickedSize(result.assets[0].fileSize ?? 500_000);
    }
  };

  const handleUpload = async () => {
    if (!pickedUri || !treeId) return;
    setUploading(true);
    try {
      const name = `tree-${treeId}-${Date.now()}.jpg`;
      const size = pickedSize || 500_000;
      const contentType = 'image/jpeg';

      // 1. Get presigned upload URL
      const { uploadURL, objectPath } = await requestUploadUrl({
        data: { name, size, contentType },
      });

      // 2. Fetch the local file as a blob and PUT to presigned URL
      const localResponse = await fetch(pickedUri);
      const blob = await localResponse.blob();
      await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
      });

      // 3. Create photo record
      await createPhoto({
        id: treeId,
        data: { photoUrl: objectPath, takenAt: date },
      });

      queryClient.invalidateQueries({ queryKey: getListTreePhotosQueryKey(treeId) });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      Alert.alert('Upload failed', 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: insets.bottom + (Platform.OS === 'web' ? 34 : 16) },
      ]}
    >
      {/* Preview area */}
      <View style={styles.previewArea}>
        {pickedUri ? (
          <RNImage source={{ uri: pickedUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="image-outline" size={64} color={colors.mutedForeground} />
            <Text style={styles.previewHint}>Choose or take a photo</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.pickerRow}>
          {Platform.OS !== 'web' && (
            <Pressable
              style={({ pressed }) => [styles.pickerButton, pressed && { opacity: 0.8 }]}
              onPress={takePhoto}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={styles.pickerButtonText}>Camera</Text>
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.pickerButton, pressed && { opacity: 0.8 }]}
            onPress={pickFromLibrary}
          >
            <Ionicons name="images" size={24} color={colors.primary} />
            <Text style={styles.pickerButtonText}>Library</Text>
          </Pressable>
        </View>

        {pickedUri && (
          <>
            <View style={styles.dateLabelRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.mutedForeground} />
              <Text style={styles.dateLabel}>Photo will be logged as {date}</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.uploadButton,
                (uploading) && styles.uploadButtonDisabled,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={20} color={colors.primaryForeground} />
                  <Text style={styles.uploadButtonText}>Upload Photo</Text>
                </>
              )}
            </Pressable>
          </>
        )}
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
    previewArea: {
      flex: 1,
      margin: 16,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 240,
    },
    preview: {
      width: '100%',
      height: '100%',
    },
    previewPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    previewHint: {
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    actions: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 12,
    },
    pickerRow: {
      flexDirection: 'row',
      gap: 12,
    },
    pickerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    pickerButtonText: {
      fontSize: 15,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primary,
    },
    dateLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 4,
    },
    dateLabel: {
      fontSize: 13,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    uploadButtonDisabled: {
      opacity: 0.6,
    },
    uploadButtonText: {
      fontSize: 16,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
  });
}
