import { Stack } from 'expo-router';

/** The Gallery tab's stack — just the photo grid, under a native "Gallery" header. */
export default function GalleryStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Gallery' }} />
    </Stack>
  );
}
