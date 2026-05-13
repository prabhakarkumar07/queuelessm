import React from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { palette, ui } from '../src/theme/ui';

export default function ModalScreen() {
  return (
    <View style={[ui.screen, styles.container]}>
      <View style={[ui.panel, styles.card]}>
        <Text style={ui.kicker}>QueueLess</Text>
        <Text style={ui.title}>Session notice</Text>
        <Text style={ui.subtitle}>Return to the app when you are ready to continue.</Text>
        <Link href="/" dismissTo style={styles.link}>
          Back to app
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: 20 },
  card: { padding: 18 },
  link: { marginTop: 16, color: palette.ink, fontSize: 14, fontWeight: '900' },
});
