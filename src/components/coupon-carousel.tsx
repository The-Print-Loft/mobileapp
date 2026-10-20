import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Path, SvgXml } from 'react-native-svg';

import type { CouponOffer } from '@/api/coupons';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Filled check-circle glyph, `currentColor` — the "Active" coupon badge (12×12,
 *  Label/dark green on Label/light green). Same shape as the toast's, recolorable. */
const CHECK_BADGE_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C9.62663 0 7.30655 0.703788 5.33316 2.02236C3.35977 3.34094 1.8217 5.21508 0.913451 7.4078C0.00519941 9.60051 -0.232441 12.0133 0.230582 14.3411C0.693605 16.6689 1.83649 18.807 3.51472 20.4853C5.19295 22.1635 7.33115 23.3064 9.65892 23.7694C11.9867 24.2324 14.3995 23.9948 16.5922 23.0865C18.7849 22.1783 20.6591 20.6402 21.9776 18.6668C23.2962 16.6934 24 14.3734 24 12C23.9939 8.81927 22.7277 5.77057 20.4785 3.52146C18.2294 1.27234 15.1807 0.0060992 12 0ZM17.7115 9.9L10.95 16.3615C10.7752 16.526 10.5438 16.6169 10.3039 16.6154C10.1865 16.6171 10.0701 16.5955 9.96115 16.5519C9.85223 16.5084 9.75302 16.4436 9.66923 16.3615L6.28847 13.1308C6.1947 13.049 6.11844 12.949 6.06427 12.837C6.0101 12.725 5.97915 12.6031 5.97327 12.4788C5.96739 12.3545 5.9867 12.2303 6.03005 12.1137C6.07339 11.997 6.13988 11.8903 6.22551 11.8C6.31113 11.7097 6.41413 11.6377 6.52832 11.5882C6.6425 11.5387 6.76551 11.5129 6.88995 11.5121C7.01439 11.5114 7.13769 11.5359 7.25244 11.584C7.36719 11.6322 7.47103 11.703 7.5577 11.7923L10.3039 14.4115L16.4423 8.56154C16.6218 8.40495 16.8549 8.3238 17.0928 8.33505C17.3307 8.34631 17.5551 8.4491 17.719 8.62194C17.8829 8.79477 17.9736 9.02427 17.9722 9.26246C17.9708 9.50065 17.8774 9.72908 17.7115 9.9Z" fill="currentColor"/></svg>`;

/** Ticket-style coupon geometry (the homepage variant). */
const TICKET = {
  gutter: 16, // 16 leading and trailing — edge to edge within the page gutter
  height: 144,
  radius: 12, // top and bottom corners
  notch: 18, // side notches: a 36-tall semicircle cutting 18 inwards
  inset: 24, // content 24 from the left and right edges, clear of the notches
  // Decorative illustration on the right, flush to the edge. It's 185x144 — the
  // ticket's full height — with the right notch already cut out (transparent),
  // but its right-hand corners are square, so it's clipped to the ticket outline.
  art: require('../../assets/images/coupon-ticket.png'),
  artWidth: 185,
};

/**
 * The ticket outline: a rounded rectangle with a semicircular notch cut into the
 * middle of each side. Drawn as one SVG path rather than views, because the notches
 * have to be real cut-outs that show the page behind them — a view with a
 * border-radius can't do that. Fill and 1px stroke follow the same path, so the
 * border runs around the notches too.
 */
function TicketShape({
  id,
  width,
  height,
  fill,
  stroke,
}: {
  /** Unique per ticket — the SVG clip-path id must not collide across cards. */
  id: string;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}) {
  const r = TICKET.radius;
  const n = TICKET.notch;
  const d = 0.5; // inset by half the stroke so the 1px border isn't clipped
  const L = d;
  const R = width - d;
  const T = d;
  const B = height - d;
  const mid = height / 2;
  const path = [
    `M ${L + r} ${T}`,
    `H ${R - r}`,
    `A ${r} ${r} 0 0 1 ${R} ${T + r}`,
    `V ${mid - n}`,
    `A ${n} ${n} 0 0 0 ${R} ${mid + n}`, // right notch, curving inwards
    `V ${B - r}`,
    `A ${r} ${r} 0 0 1 ${R - r} ${B}`,
    `H ${L + r}`,
    `A ${r} ${r} 0 0 1 ${L} ${B - r}`,
    `V ${mid + n}`,
    `A ${n} ${n} 0 0 0 ${L} ${mid - n}`, // left notch, curving inwards
    `V ${T + r}`,
    `A ${r} ${r} 0 0 1 ${L + r} ${T}`,
    'Z',
  ].join(' ');
  const clipId = `ticket-${id}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={path} />
        </ClipPath>
      </Defs>
      <Path d={path} fill={fill} />
      {/* The art is clipped to the outline so its square corners take the ticket's
          12 radius, and its transparent notch lines up with the cut-out. */}
      <SvgImage
        href={TICKET.art}
        x={width - TICKET.artWidth}
        y={0}
        width={TICKET.artWidth}
        height={height}
        preserveAspectRatio="xMaxYMid meet"
        clipPath={`url(#${clipId})`}
      />
      {/* Border last, so it runs unbroken over the art's edge. */}
      <Path d={path} fill="none" stroke={stroke} strokeWidth={1} />
    </Svg>
  );
}

type Props = {
  offers: CouponOffer[];
  /** The clipped/applied code, if any — its card renders as "Active". */
  activeCode: string | null | undefined;
  onApply: (code: string) => void;
  onRemove: () => void;
  /** Outer scroll style — the caller owns spacing and any full-bleed offset. */
  style?: StyleProp<ViewStyle>;
  /**
   * `card` (default) — the cart's 240-wide card.
   * `ticket` — the homepage: full width inside a 16 gutter, 144 tall, with a
   * semicircular notch in each side.
   */
  variant?: 'card' | 'ticket';
};

/**
 * The "Offers for you" coupon cards, in a horizontal scroll. Shared by the cart
 * and the landing page so both show the same card and the same clip/unclip
 * experience: "Apply Code" turns the card white with an "Active" badge and the
 * button becomes "Remove Code"; tapping it again unclips.
 *
 * What "apply" actually does is the caller's business — the cart validates
 * against its basket, the landing page clips a code before there is one.
 */
export function CouponCarousel({
  offers,
  activeCode,
  onApply,
  onRemove,
  style,
  variant = 'card',
}: Props) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const ticket = variant === 'ticket';
  const ticketWidth = screenWidth - TICKET.gutter * 2;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={style}
      contentContainerStyle={styles.content}
      // Tickets are full width, so page one at a time instead of free-scrolling.
      snapToInterval={ticket ? ticketWidth + 12 : undefined}
      decelerationRate={ticket ? 'fast' : 'normal'}>
      {offers.map((c, i) => {
        const active = activeCode === c.code;
        return (
          <View
            key={c.code}
            style={[
              ticket ? [styles.ticket, { width: ticketWidth }] : styles.coupon,
              i > 0 && styles.gap,
              ticket
                ? null
                : {
                    // Applied → white; otherwise the brand surface.
                    backgroundColor: active ? theme.background : theme.brandSurface,
                    borderColor: theme.strokeFaint,
                  },
            ]}>
            {ticket && (
              <TicketShape
                id={c.code}
                width={ticketWidth}
                height={TICKET.height}
                // Same fill whether or not it's applied — the Active badge and the
                // button carry the state on this style, not the background.
                fill={theme.brandSurface}
                stroke={theme.strokeFaint}
              />
            )}
            {/* On the ticket, keep the copy clear of the art on the right: a long
                title wraps rather than running into the illustration. */}
            <View
              style={
                ticket
                  ? { maxWidth: ticketWidth - TICKET.inset - TICKET.artWidth }
                  : undefined
              }>
              <Text style={[styles.desc, { color: theme.textTertiary }]}>{c.title}</Text>
              <Text style={[styles.code, { color: theme.text }]}>{c.code}</Text>
            </View>

            {/* "Active" badge — pinned to the top-right once applied. */}
            {active && (
              <View
                style={[
                  styles.badge,
                  ticket && styles.ticketBadge,
                  { backgroundColor: theme.successBg },
                ]}>
                <SvgXml xml={CHECK_BADGE_ICON} width={12} height={12} color={theme.successFg} />
                <Text style={[styles.badgeText, { color: theme.successFg }]}>Active</Text>
              </View>
            )}

            <Pressable
              style={[
                styles.apply,
                ticket && styles.ticketApply,
                ticket && !active
                  ? // Ticket, not applied: solid Gray/black with a white label.
                    { backgroundColor: theme.text, borderColor: theme.text }
                  : {
                      backgroundColor: theme.background,
                      borderColor: active ? theme.removeStroke : theme.textTertiary,
                    },
              ]}
              onPress={() => (active ? onRemove() : onApply(c.code))}>
              <Text
                style={[
                  styles.applyText,
                  {
                    color: active
                      ? theme.removeText
                      : ticket
                        ? theme.onPrimary
                        : theme.text,
                  },
                ]}>
                {active ? 'Remove Code' : 'Apply Code'}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16, // first coupon 16 from the leading edge
  },
  gap: {
    marginLeft: 12, // 12 between coupons
  },
  ticket: {
    height: TICKET.height,
    paddingHorizontal: TICKET.inset, // 24 from the notched sides
    paddingVertical: 16,
    justifyContent: 'space-between', // copy at the top, button at the bottom
  },
  ticketBadge: {
    right: TICKET.inset, // align with the content inset, not the card's 16
  },
  ticketApply: {
    marginTop: 0, // pinned to the bottom by space-between, not a fixed gap
    alignSelf: 'flex-start', // left-aligned, sized to its label — not full width
    paddingHorizontal: 16, // 16 either side of "Apply Code" / "Remove Code"
  },
  coupon: {
    width: 240, // height grows with content (no fixed height)
    borderWidth: 1, // Additional stroke/10
    borderRadius: 12,
    padding: 16, // 16 top/leading/trailing/bottom
  },
  badge: {
    position: 'absolute',
    top: 16, // 16 from the top / trailing of the card
    right: 16,
    height: 20,
    flexDirection: 'row',
    alignItems: 'center', // centers the 12px glyph → 4 top/bottom
    paddingLeft: 4, // 4 to the glyph
    paddingRight: 8,
    borderRadius: 6,
  },
  badgeText: {
    marginLeft: 4, // 4 from the glyph
    fontFamily: FontFamily.bodyMedium, // Caption / Medium 12/18
    fontSize: 12,
    lineHeight: 18,
  },
  desc: {
    fontFamily: FontFamily.bodyMedium, // Body 2 / Medium 14/20, Gray/700
    fontSize: 14,
    lineHeight: 20,
  },
  code: {
    marginTop: 4, // 4 below the description
    fontFamily: FontFamily.titleBold, // Title 2 / Bold (Crimson Text) 20/30, Gray/black
    fontSize: 20,
    lineHeight: 30,
  },
  apply: {
    marginTop: 42, // 42 from the code to the button
    height: 40,
    borderWidth: 1, // Gray/700 stroke on white
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: {
    fontFamily: FontFamily.bodySemiBold, // Body 2 / SemiBold 14/20, Gray/black
    fontSize: 14,
    lineHeight: 20,
  },
});
