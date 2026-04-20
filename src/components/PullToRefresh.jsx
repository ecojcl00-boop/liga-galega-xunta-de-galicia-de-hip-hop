import React, { useRef, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70; // px to pull before triggering refresh

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    // Only activate when scrolled to the very top
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && containerRef.current?.scrollTop === 0) {
      // Dampen the pull
      setPullY(Math.min(delta * 0.5, THRESHOLD + 20));
    }
  }, [refreshing]);

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
      className="flex-1 overflow-y-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ overscrollBehaviorY: "none" }}
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