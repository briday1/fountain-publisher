import { useSyncExternalStore } from "react";

// Layout follows available space, not the primary pointer. iPadOS reports a
// coarse touch pointer even when a Magic Keyboard/trackpad is attached.
const query = "(max-width: 950px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useMobileLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
