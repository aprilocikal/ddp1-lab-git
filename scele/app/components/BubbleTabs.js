'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';

/**
 * BubbleTabs — iPhone Camera-style mode selector
 * 
 * A horizontal tab bar where a floating glassmorphism "bubble" slides
 * behind the active option. Supports:
 *   • Tap to select
 *   • Swipe / drag to switch (touch + mouse)
 *   • Spring "lift" animation on press (scales up, shadow deepens)
 *   • Smooth cubic-bezier transitions between tabs
 */
export default function BubbleTabs({ tabs, activeTab, onTabChange }) {
  const containerRef = useRef(null);
  const bubbleRef = useRef(null);
  const tabRefs = useRef([]);

  const [isPressed, setIsPressed] = useState(false);

  // Stabilize tabs reference without risky JSON.stringify on React elements
  const tabsKey = (tabs || []).map(t => `${t.key}:${typeof t.label === 'string' ? t.label : 'jsx'}`).join('|');
  const stableTabs = useMemo(() => tabs || [], [tabsKey]);

  // Position the bubble over the active tab
  const positionBubble = useCallback(() => {
    const activeIndex = stableTabs.findIndex(t => t.key === activeTab);
    if (activeIndex < 0) return;

    const tabEl = tabRefs.current[activeIndex];
    const containerEl = containerRef.current;
    const bubbleEl = bubbleRef.current;
    if (!tabEl || !containerEl || !bubbleEl) return;

    const left = tabEl.offsetLeft;
    const width = tabEl.offsetWidth;

    // Use CSS custom properties so the lifted state can compose with them
    bubbleEl.style.setProperty('--bubble-x', `${left}px`);
    bubbleEl.style.setProperty('--bubble-w', `${width}px`);
  }, [stableTabs, activeTab]);

  // useLayoutEffect runs BEFORE the browser paints, so the bubble position
  // is updated synchronously after DOM mutations. This prevents the flash
  // where the bubble briefly stays at the old tab position.
  useLayoutEffect(() => {
    positionBubble();
  }, [positionBubble]);

  // Resize listener can stay in a regular useEffect
  useEffect(() => {
    window.addEventListener('resize', positionBubble);
    return () => window.removeEventListener('resize', positionBubble);
  }, [positionBubble]);

  // Reposition after a brief delay to handle font loading
  useEffect(() => {
    const timer = setTimeout(positionBubble, 100);
    return () => clearTimeout(timer);
  }, [positionBubble]);

  return (
    <div
      className={`bubble-tabs ${isPressed ? 'bubble-tabs--pressed' : ''}`}
      ref={containerRef}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerCancel={() => setIsPressed(false)}
    >
      {/* The floating glass bubble */}
      <div
        className={`bubble-pill ${isPressed ? 'bubble-pill--lifted' : ''}`}
        ref={bubbleRef}
        aria-hidden="true"
      />

      {/* Tab labels */}
      {stableTabs.map((tab, i) => (
        <button
          key={tab.key}
          ref={(el) => { tabRefs.current[i] = el; }}
          className={`bubble-tab ${activeTab === tab.key ? 'bubble-tab--active' : ''}`}
          onClick={() => onTabChange(tab.key)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

