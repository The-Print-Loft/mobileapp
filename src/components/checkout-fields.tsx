import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shared checkout form inputs (used across the wizard's steps). */

type AutoCap = 'none' | 'words' | 'characters';

/** A required-field label: "Label" + a Primary/600 asterisk, or a Gray/500 "(Optional)". */
export function FieldLabel({ label, required }: { label: string; required: boolean }) {
  const theme = useTheme();
  return (
    <Text style={[styles.label, { color: theme.text }]}>
      {label}
      {required ? (
        <Text style={{ color: theme.required }}>*</Text>
      ) : (
        <Text style={{ color: theme.textSecondary }}> (Optional)</Text>
      )}
    </Text>
  );
}

/** A labelled text field whose stroke highlights (Gray/200 → Gray/400) on focus.
 *  `required` (default true) shows the asterisk; `chevron` adds a trailing chevron. */
export function Field({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  required = true,
  chevron = false,
  style,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: AutoCap;
  required?: boolean;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      <FieldLabel label={label} required={required} />
      <View>
        <TextInput
          style={[
            styles.input,
            chevron && styles.inputWithChevron,
            { color: theme.text, borderColor: focused ? theme.textMuted : theme.border },
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {chevron ? (
          <View style={styles.fieldChevron} pointerEvents="none">
            <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A labelled select field — looks like an input, shows the value (or a Gray/500
 *  placeholder when empty) + a chevron, and opens a picker on tap. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  required = true,
  style,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={style}>
      <FieldLabel label={label} required={required} />
      <Pressable style={[styles.input, styles.select, { borderColor: theme.border }]} onPress={onPress}>
        <Text style={[styles.selectValue, { color: value ? theme.text : theme.textSecondary }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 8, // gap to the input
    fontFamily: FontFamily.bodyMedium, // field label
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    height: 48,
    borderWidth: 1, // Gray/200 (Gray/400 when focused)
    borderRadius: 8,
    paddingHorizontal: 16,
    fontFamily: FontFamily.body, // Body 1 / Regular 16 (placeholder Gray/500)
    fontSize: 16,
  },
  inputWithChevron: {
    paddingRight: 44, // clear the chevron (16 inset + 20 icon + gap)
  },
  fieldChevron: {
    position: 'absolute',
    right: 16, // 16 from the right edge
    top: 0,
    bottom: 0,
    justifyContent: 'center', // vertically centered in the 48px field
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // value left, chevron right
  },
  selectValue: {
    fontFamily: FontFamily.body, // Body 1 / Regular 16
    fontSize: 16,
  },
});
