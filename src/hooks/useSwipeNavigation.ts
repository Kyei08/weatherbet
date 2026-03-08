import { useState, useCallback } from 'react';

type SwipeDirection = 'left' | 'right';

interface UseSwipeNavigationOptions<T extends string> {
  views: T[];
  activeView: T;
  setActiveView: (view: T) => void;
  /** Minimum drag distance in px to trigger a swipe (default 50) */
  threshold?: number;
}

export function useSwipeNavigation<T extends string>({
  views,
  activeView,
  setActiveView,
  threshold = 50,
}: UseSwipeNavigationOptions<T>) {
  const currentIndex = views.indexOf(activeView);

  const handleDragEnd = useCallback(
    (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
      const swipe = info.offset.x;
      const velocity = Math.abs(info.velocity.x);

      // Use velocity to allow quick flicks with less distance
      const effectiveThreshold = velocity > 500 ? threshold * 0.4 : threshold;

      if (swipe < -effectiveThreshold && currentIndex < views.length - 1) {
        setActiveView(views[currentIndex + 1]);
      } else if (swipe > effectiveThreshold && currentIndex > 0) {
        setActiveView(views[currentIndex - 1]);
      }
    },
    [currentIndex, views, setActiveView, threshold]
  );

  return {
    currentIndex,
    totalViews: views.length,
    dragProps: {
      drag: 'x' as const,
      dragConstraints: { left: 0, right: 0 },
      dragElastic: 0.2,
      onDragEnd: handleDragEnd,
    },
  };
}
