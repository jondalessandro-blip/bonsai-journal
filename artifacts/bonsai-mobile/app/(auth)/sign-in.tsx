import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSignIn } from '@clerk/expo';
import { type Href, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

export default function SignInPage() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = fetchStatus === 'fetching';

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return;
    if (signIn.status === 'complete') {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            // @ts-ignore
            if (typeof window !== 'undefined') window.location.href = url;
          } else {
            router.replace(url as Href);
          }
        },
      });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / brand mark */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color={colors.primaryForeground} />
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Bonsai Journal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {errors?.fields?.identifier && (
              <Text style={styles.error}>{errors.fields.identifier.message}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword((p) => !p)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
            {errors?.fields?.password && (
              <Text style={styles.error}>{errors.fields.password.message}</Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (!email || !password || isLoading) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleSubmit}
            disabled={!email || !password || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryButtonText}>Continue</Text>
            )}
          </Pressable>

          {errors && Object.keys(errors.fields ?? {}).length === 0 && (errors as any).message ? (
            <Text style={styles.error}>{(errors as any).message}</Text>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/sign-up">
            <Text style={styles.footerLink}>Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof import('@/hooks/useColors').useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingBottom: 40,
    },
    header: {
      alignItems: 'center',
      paddingTop: 60,
      paddingBottom: 48,
    },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontFamily: 'Fraunces_700Bold',
      color: colors.foreground,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    form: {
      gap: 16,
    },
    field: {
      gap: 6,
    },
    label: {
      fontSize: 14,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.foreground,
    },
    input: {
      height: 48,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      fontSize: 15,
      fontFamily: 'Outfit_400Regular',
      color: colors.foreground,
    },
    passwordRow: {
      position: 'relative',
    },
    passwordInput: {
      paddingRight: 48,
    },
    eyeButton: {
      position: 'absolute',
      right: 14,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    primaryButton: {
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonPressed: {
      opacity: 0.85,
    },
    primaryButtonText: {
      fontSize: 16,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primaryForeground,
    },
    error: {
      fontSize: 13,
      fontFamily: 'Outfit_400Regular',
      color: colors.destructive,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 32,
    },
    footerText: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: colors.mutedForeground,
    },
    footerLink: {
      fontSize: 14,
      fontFamily: 'Outfit_600SemiBold',
      color: colors.primary,
    },
  });
}
