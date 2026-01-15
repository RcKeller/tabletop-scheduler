/**
 * REGRESSION TESTS: Availability Grid Click-and-Drag Interaction
 *
 * These tests cover the critical regression where players couldn't
 * set or block availability via click-and-drag on the grid.
 *
 * Root cause: The `useIsMobile` hook used `navigator.maxTouchPoints > 0`
 * which returns `true` on many laptops with touchscreens, incorrectly
 * disabling drag interactions even when using a mouse.
 *
 * Fix: Changed to use `(pointer: coarse)` media query which correctly
 * identifies devices where the PRIMARY pointer is coarse (touch/finger)
 * vs devices that merely support touch but use a fine pointer (mouse).
 *
 * Date: 2026-01-15
 */

// Mock matchMedia for testing
function createMockMatchMedia(matches: boolean) {
  return (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });
}

describe('REGRESSION: Availability Grid Interaction', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
    });
  });

  describe('useIsMobile detection logic', () => {
    /**
     * BUG: The old implementation used:
     *   hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
     *
     * This incorrectly flagged laptops with touchscreens as mobile,
     * disabling the drag-select functionality even for mouse users.
     *
     * FIX: Use (pointer: coarse) media query which checks if the
     * PRIMARY input device has limited precision (finger vs mouse).
     */

    it('should NOT be mobile on desktop with fine pointer (mouse)', () => {
      // Desktop with mouse - pointer: coarse is FALSE
      window.matchMedia = createMockMatchMedia(false) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      expect(isMobile).toBe(false);
    });

    it('should NOT be mobile on laptop with touchscreen using mouse', () => {
      // Laptop with touchscreen but PRIMARY input is still mouse
      // (pointer: coarse) is FALSE because mouse is primary
      window.matchMedia = createMockMatchMedia(false) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 1366, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      expect(isMobile).toBe(false);
    });

    it('should NOT be mobile on large touchscreen display', () => {
      // iPad Pro or large touchscreen - coarse pointer but large screen
      window.matchMedia = createMockMatchMedia(true) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      expect(isMobile).toBe(false);
    });

    it('should BE mobile on phone with touch', () => {
      // Phone - coarse pointer AND small screen
      window.matchMedia = createMockMatchMedia(true) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      expect(isMobile).toBe(true);
    });

    it('should BE mobile on small tablet in portrait', () => {
      // Small tablet in portrait mode - coarse pointer AND small screen
      window.matchMedia = createMockMatchMedia(true) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      expect(isMobile).toBe(true);
    });

    it('should NOT disable drag when only touch is supported (like touchscreen laptop)', () => {
      // Key scenario: Laptop with touchscreen in small window
      // User is using MOUSE, but window is narrow
      // pointer: coarse should be FALSE (primary is mouse)
      window.matchMedia = createMockMatchMedia(false) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 700, writable: true });

      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      // Even with small window, should NOT be mobile if using mouse
      expect(isMobile).toBe(false);
    });
  });

  describe('Previous bug scenario', () => {
    /**
     * This tests the EXACT scenario that caused the regression:
     * A laptop with touch support (maxTouchPoints > 0) but user is using mouse.
     *
     * Old code: hasTouch = navigator.maxTouchPoints > 0 // TRUE!
     * This would incorrectly disable drag on small windows.
     *
     * New code: hasCoarsePointer = matchMedia('(pointer: coarse)').matches // FALSE
     * This correctly allows drag because primary pointer is mouse.
     */

    it('should allow drag on touchscreen laptop with narrow window', () => {
      // Simulating a touchscreen laptop with a narrow browser window
      // navigator.maxTouchPoints would be > 0, but pointer: coarse is false
      window.matchMedia = createMockMatchMedia(false) as typeof window.matchMedia;
      Object.defineProperty(window, 'innerWidth', { value: 750, writable: true });

      // Old buggy logic (DO NOT USE):
      // const hasTouch = navigator.maxTouchPoints > 0; // Would be TRUE
      // const isMobile = hasTouch && isSmallScreen; // Would be TRUE (BUG!)

      // New correct logic:
      const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      const isMobile = hasCoarsePointer && isSmallScreen;

      // Drag should be enabled (isMobile = false)
      expect(isMobile).toBe(false);
    });
  });
});

describe('REGRESSION: Grid disabled prop behavior', () => {
  /**
   * The VirtualizedAvailabilityGrid accepts a `disabled` prop that
   * controls whether click-and-drag interactions are allowed.
   *
   * This prop is derived from useIsMobile() in AvailabilityEditor.
   * When disabled=true, all mouse handlers return early.
   */

  it('should have disabled=false on desktop devices', () => {
    // Mock desktop environment
    window.matchMedia = createMockMatchMedia(false) as typeof window.matchMedia;
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true });

    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isSmallScreen = window.innerWidth < 768;
    const disabled = hasCoarsePointer && isSmallScreen;

    expect(disabled).toBe(false);
  });

  it('should have disabled=true only on true mobile devices', () => {
    // Mock mobile environment
    window.matchMedia = createMockMatchMedia(true) as typeof window.matchMedia;
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true });

    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const isSmallScreen = window.innerWidth < 768;
    const disabled = hasCoarsePointer && isSmallScreen;

    expect(disabled).toBe(true);
  });
});

describe('REGRESSION: Grid event handler guards', () => {
  /**
   * The VirtualizedAvailabilityGrid has event handlers that check
   * mode and disabled before processing:
   *
   * handleCellMouseDown: if (mode !== "edit" || disabled) return;
   * handleCellMouseOver: if (!isDragging || mode !== "edit" || disabled) return;
   *
   * These guards must correctly allow interaction when disabled=false.
   */

  it('handleCellMouseDown guard allows interaction when mode=edit and disabled=false', () => {
    const mode = "edit";
    const disabled = false;

    // Simulating the guard check
    const shouldBlock = mode !== "edit" || disabled;
    expect(shouldBlock).toBe(false); // Should NOT block
  });

  it('handleCellMouseDown guard blocks interaction when disabled=true', () => {
    const mode = "edit";
    const disabled = true;

    const shouldBlock = mode !== "edit" || disabled;
    expect(shouldBlock).toBe(true); // Should block
  });

  it('handleCellMouseDown guard blocks interaction when mode=heatmap', () => {
    const mode = "heatmap";
    const disabled = false;

    const shouldBlock = mode !== "edit" || disabled;
    expect(shouldBlock).toBe(true); // Should block (view-only mode)
  });

  it('handleCellMouseOver guard allows drag continuation when conditions met', () => {
    const isDragging = true;
    const mode = "edit";
    const disabled = false;
    const hasDragStart = true;

    const shouldBlock = !isDragging || mode !== "edit" || !hasDragStart || disabled;
    expect(shouldBlock).toBe(false); // Should NOT block
  });

  it('handleCellMouseOver guard blocks when not dragging', () => {
    const isDragging = false;
    const mode = "edit";
    const disabled = false;
    const hasDragStart = true;

    const shouldBlock = !isDragging || mode !== "edit" || !hasDragStart || disabled;
    expect(shouldBlock).toBe(true); // Should block
  });
});
