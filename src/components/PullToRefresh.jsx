import React, { useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70; // px to pull before triggering refresh

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const getScrollParent = useCallback(() => {
    // Walk up the DOM to find the nearest scrollable ancestor
    let el = containerRef.current?.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  const onTouchStart = useCallback((e) => {
    const scrollParent = getScrollParent();
    if ((scrollParent?.scrollTop ?? 0) === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, [getScrollParent]);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    const scrollParent = getScrollParent();
    if (delta > 0 && (scrollParent?.scrollTop ?? 0) === 0) {
      // Dampen the pull
      setPullY(Math.min(delta * 0.5, THRESHOLD + 20));
    }
  }, [refreshing, getScrollParent]);

  const onTouchEnd = useCallback(async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      try { await onRefresh(); } finally {
        setRefreshing(false);
      }
    }
    startY.current = null;
    setPullY(0);
  }, [pullY, refreshing, onRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-150"
        style={{ height: `${pullY}px` }}
      >
        <RefreshCw
          className={`w-5 h-5 text-primary transition-transform ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: `rotate(${progress * 360}deg)`, opacity: progress }}
        />
      </div>
      {children}
    </div>
  );
}