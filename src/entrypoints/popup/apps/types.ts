/**
 * Contract every popup sub-app must implement.
 *
 * Lifecycle per navigation:
 *   mount()   — called each time the app view becomes active; receives the DOM
 *               container to render into plus an AbortSignal that fires when the
 *               user navigates away before mount() resolves.
 *   unmount() — called before the container is torn down; clean up timers,
 *               event listeners, and page-side side-effects (e.g. highlights).
 */
export interface PopupApp {
  /** Must match the corresponding id in featureRegistry */
  readonly id: string;
  readonly icon: {
    /** HTML rendered inside .app-icon — inline SVG or <img> tag */
    html: string;
    bg: string;
  };
  mount(container: HTMLElement, signal: AbortSignal): Promise<void> | void;
  unmount?(): Promise<void> | void;
}
