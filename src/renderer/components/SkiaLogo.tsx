import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface Props {
  showTagline?: boolean;
}

export default function SkiaLogo({ showTagline = true }: Props) {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo.png')}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.logoText}>SKIA</Text>
      {showTagline && (
        <Text style={styles.tagline}>She Knows It All</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  image: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 10,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,215,0,0.55)',
    letterSpacing: 3,
    marginTop: 2,
    marginBottom: 14,
  },
});
