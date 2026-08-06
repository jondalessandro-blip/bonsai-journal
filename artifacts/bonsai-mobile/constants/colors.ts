/**
 * Design tokens synced from artifacts/bonsai-journal/src/index.css
 * HSL values converted to hex for React Native StyleSheet use.
 *
 * Light theme: warm earthy greens, creams, and browns
 * Dark theme: deep warm darks with the same hue family
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#3B2A1E',
    tint: '#3F6642',

    // Core surfaces
    background: '#F5EFE4',   // hsl(40 33% 96%)
    foreground: '#3B2A1E',   // hsl(24 20% 20%)

    // Cards / elevated surfaces
    card: '#F9F5EE',         // hsl(40 33% 98%)
    cardForeground: '#3B2A1E',

    // Primary action — forest green
    primary: '#3F6642',      // hsl(125 25% 35%)
    primaryForeground: '#F9F5EE', // hsl(40 33% 98%)

    // Secondary surfaces
    secondary: '#D9CCC0',    // hsl(30 20% 85%)
    secondaryForeground: '#3B2A1E',

    // Muted / subdued
    muted: '#EAE0D4',        // hsl(35 20% 90%)
    mutedForeground: '#796B63', // hsl(24 10% 45%)

    // Accent (same as muted)
    accent: '#EAE0D4',
    accentForeground: '#3B2A1E',

    // Destructive
    destructive: '#CC3333',  // hsl(0 60% 50%)
    destructiveForeground: '#F9F5EE',

    // Borders and inputs
    border: '#DDD4C7',       // hsl(30 15% 85%)
    input: '#DDD4C7',
  },

  dark: {
    text: '#EDE7DA',
    tint: '#4D7A50',

    background: '#221710',   // hsl(24 20% 12%)
    foreground: '#EDE7DA',   // hsl(40 30% 90%)

    card: '#2B1C13',         // hsl(24 20% 15%)
    cardForeground: '#EDE7DA',

    primary: '#4D7A50',      // hsl(125 30% 45%)
    primaryForeground: '#221710',

    secondary: '#352417',    // hsl(24 15% 20%)
    secondaryForeground: '#EDE7DA',

    muted: '#2E2019',        // hsl(24 15% 18%)
    mutedForeground: '#ADA49C', // hsl(40 10% 65%)

    accent: '#352C22',
    accentForeground: '#EDE7DA',

    destructive: '#AA2E2E',
    destructiveForeground: '#EDE7DA',

    border: '#3C2D23',       // hsl(24 15% 22%)
    input: '#3C2D23',
  },

  // Border radius in px — from --radius: 0.5rem → 8px
  radius: 8,
};

export default colors;
