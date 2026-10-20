/**
 * Pure color-matrix math for the builder's Effects + Adjust. Everything reduces
 * to a single 4x5 color matrix (the format Skia's `ColorFilter.MakeMatrix`
 * wants), so the live preview and the full-res print export share one pipeline
 * and never diverge. No Skia import here — this stays testable and native-free.
 *
 * A color matrix maps [r,g,b,a,1] → [r',g',b',a'] on 0..1 channels.
 *
 * The exact "feel" of each preset / the Adjust scaling is tunable — these are
 * reasonable starting points.
 */

export type ColorMatrix = number[]; // length 20 (4 rows x 5 cols)

/** Adjust inputs, each neutral at 0 (the slider range is -100..100). */
export type Adjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
};

export const IDENTITY: ColorMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 1, 0,
];

/** Compose two matrices: apply `b` first, then `a` (treats each as 5x5 with an
 *  implicit [0,0,0,0,1] bottom row). */
export function compose(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const r: ColorMatrix = new Array(20).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[i * 5 + k] * b[k * 5 + j];
      sum += a[i * 5 + 4] * (j === 4 ? 1 : 0); // a's offset · b's implicit row
      r[i * 5 + j] = sum;
    }
  }
  return r;
}

/** Additive brightness offset (o added to each of R,G,B). */
function brightnessMatrix(o: number): ColorMatrix {
  return [1, 0, 0, 0, o, 0, 1, 0, 0, o, 0, 0, 1, 0, o, 0, 0, 0, 1, 0];
}

/** Contrast around the 0.5 midpoint: out = (in - 0.5)·c + 0.5. */
function contrastMatrix(c: number): ColorMatrix {
  const t = 0.5 * (1 - c);
  return [c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0];
}

/** Saturation via luma-weighted interpolation (s=0 grayscale, 1 identity). */
function saturationMatrix(s: number): ColorMatrix {
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  return [
    (1 - s) * lr + s, (1 - s) * lg, (1 - s) * lb, 0, 0,
    (1 - s) * lr, (1 - s) * lg + s, (1 - s) * lb, 0, 0,
    (1 - s) * lr, (1 - s) * lg, (1 - s) * lb + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

/** Channel scale (per R/G/B multiplier) — for warm/cool tints. */
function scaleRGB(r: number, g: number, b: number): ColorMatrix {
  return [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
}

/** The Adjust matrix from the three slider values (brightness → contrast → saturation). */
export function adjustMatrix({ brightness, contrast, saturation }: Adjustments): ColorMatrix {
  const b = brightnessMatrix((brightness / 100) * 0.5); // ±0.5 at the extremes
  const c = contrastMatrix(1 + contrast / 100); // 0..2
  const s = saturationMatrix(1 + saturation / 100); // 0..2
  return compose(s, compose(c, b));
}

/** Effect presets (id → matrix). "none" is the identity. */
export const EFFECT_MATRICES: Record<string, ColorMatrix> = {
  none: IDENTITY,
  vivid: compose(saturationMatrix(1.4), contrastMatrix(1.1)),
  noir: compose(contrastMatrix(1.3), saturationMatrix(0)),
  mono: saturationMatrix(0),
  sepia: [
    0.393, 0.769, 0.189, 0, 0,
    0.349, 0.686, 0.168, 0, 0,
    0.272, 0.534, 0.131, 0, 0,
    0, 0, 0, 1, 0,
  ],
  warm: scaleRGB(1.1, 1.0, 0.9),
  cool: scaleRGB(0.9, 1.0, 1.1),
  fade: compose(brightnessMatrix(0.05), compose(contrastMatrix(0.85), saturationMatrix(0.9))),
};

/** The full pipeline: Adjust first, then the Effect preset on top. */
export function buildColorMatrix(photo: Adjustments & { filter: string }): ColorMatrix {
  const effect = EFFECT_MATRICES[photo.filter] ?? IDENTITY;
  return compose(effect, adjustMatrix(photo));
}
