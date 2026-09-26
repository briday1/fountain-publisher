export type WorkspacePattern = "dots" | "topographic" | "hyperspace" | "plain";
export type AnimatedPattern = Exclude<WorkspacePattern, "plain">;
export type BackgroundSpeed = "slow" | "normal" | "fast";
export type BackgroundDensity = "sparse" | "normal" | "dense";
export interface BackgroundOptions {
  animated: boolean;
  speed: BackgroundSpeed;
  density: BackgroundDensity;
}
export type BackgroundPreferences = Record<AnimatedPattern, BackgroundOptions>;
export const speedFactors = { slow: 0.5, normal: 1, fast: 2 } as const;
export const densityFactors = { sparse: 0.65, normal: 1, dense: 1.5 } as const;
export const defaultBackgroundOptions: BackgroundOptions = {
  animated: true,
  speed: "normal",
  density: "normal",
};

// Validate each field independently so older or partially saved preferences
// retain valid choices and gain defaults for newly introduced settings.
export function readBackgroundPreferences(
  saved: unknown,
): BackgroundPreferences {
  const source = saved && typeof saved === "object" ? saved : {};
  return Object.fromEntries(
    (["dots", "topographic", "hyperspace"] as const).map((pattern) => {
      const options = (source as Partial<BackgroundPreferences>)[pattern];
      return [
        pattern,
        {
          animated:
            typeof options?.animated === "boolean" ? options.animated : true,
          speed: Object.hasOwn(speedFactors, options?.speed ?? "")
            ? options!.speed
            : "normal",
          density: Object.hasOwn(densityFactors, options?.density ?? "")
            ? options!.density
            : "normal",
        },
      ];
    }),
  ) as BackgroundPreferences;
}
