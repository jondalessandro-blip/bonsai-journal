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
import { useSignUp } from '@clerk/expo';
import { type Href, Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

export default function SignUpPage() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = makeStyles(colors);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = fetchStatus === 'fetching';
  const needsVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) return;
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl('/');
          if (url.startsWith('http')) {
            if (typeof window !== 'undefined') (window as any).location.href = url;
          } else {
            router.replace(url as Href);
          }
        },
      });
    }
  };

  if (needsVerification) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="mail" size={36} color={colors.primaryForeground} />
            </View>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>We sent a code to {email}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={6}
              />
              {errors?.fields?.code && (
                <Text style={styles.error}>{errors.fields.code.message}</Text>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (!code || isLoading) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleVerify}
              disabled={!code || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={styles.primaryButtonText}>Verify email</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => signUp.verifications.sendEmailCode()}
            >
              <Text style={styles.secondaryButtonText}>Resend code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color={colors.primaryForeground} />
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start your bonsai journal</Text>
        </View>

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
            {errors?.fields?.emailAddress && (
              <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
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
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in">
            <Text style={styles.footerLink}>Sign in</Text>
          </Link>
        </View>

        {/* Required for Clerk bot protection */}
        <View nativeID="clerk-captcha" />
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
    codeInput: {
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center',
      height: 64,
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
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: 12,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontFamily: 'Outfit_500Medium',
      color: colors.primary,
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
