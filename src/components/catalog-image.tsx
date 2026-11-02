import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** Empty-state placeholder shown when a card has no image (or it fails). */
const PLACEHOLDER_SVG = `<svg width="58" height="58" viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M54.1922 55.9912H3.79219C2.79814 55.9912 1.99219 55.1871 1.99219 54.1953V3.78717C1.99219 2.79537 2.79814 1.99124 3.79219 1.99124H54.1922C55.1862 1.99124 55.9922 2.79537 55.9922 3.78717V54.1953C55.9922 55.1871 55.1862 55.9912 54.1922 55.9912Z" fill="#FAFAFA" stroke="#D6D6D6" stroke-width="3.9825" stroke-miterlimit="10"/>
<path d="M51.0938 6.87958V50.9811H6.89062V6.87958H51.0938Z" fill="#D6D6D6" stroke="#D6D6D6" stroke-width="0.7965"/>
<path d="M21.0381 27.6308C21.5369 26.6308 22.9549 26.5901 23.5107 27.5614L30.6582 40.0556C31.4717 41.477 33.5015 41.5407 34.4033 40.1737L37.1885 35.953C37.7469 35.1065 38.9946 35.1156 39.541 35.9696L46.2666 46.4901H11.6377L21.0381 27.6308Z" fill="#FAFAFA" stroke="#D6D6D6" stroke-width="0.7965"/>
<path d="M40.2422 11.3693C43.7509 11.3693 46.5936 14.2067 46.5938 17.7052C46.5938 21.2039 43.751 24.0421 40.2422 24.0421C36.7334 24.0421 33.8906 21.2039 33.8906 17.7052C33.8908 14.2067 36.7335 11.3693 40.2422 11.3693Z" fill="#FAFAFA" stroke="#D6D6D6" stroke-width="0.7965"/>
</svg>`;

type Props = {
  uri?: string;
  /** Fixed image height in px. */
  height: number;
  /** Extra styling on the image container (e.g. a border radius). */
  style?: StyleProp<ViewStyle>;
};

/**
 * A catalog image area (shared by tier1 / tier2 cards). Shows a native spinner
 * while the image loads, and an icon placeholder when there's no image or the
 * load fails. Fills its parent's width at the given height.
 */
export function CatalogImage({ uri, height, style }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(Boolean(uri));
  const [failed, setFailed] = useState(false);

  const showImage = Boolean(uri) && !failed;
  const showPlaceholder = !uri || failed;

  return (
    <View style={[styles.image, { height, backgroundColor: theme.backgroundElement }, style]}>
      {showImage && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      )}
      {showImage && loading && (
        <View style={styles.overlay}>
          <ActivityIndicator color={theme.textSecondary} />
        </View>
      )}
      {showPlaceholder && (
        <View style={styles.overlay}>
          <SvgXml xml={PLACEHOLDER_SVG} width={58} height={58} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
