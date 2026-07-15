import { useCallback, useRef } from "react";

const DEFAULT_THRESHOLD = 24;

function getDirection(deltaX, deltaY) {
  if (Math.abs(deltaX) > Math.abs(deltaY)) return deltaX < 0 ? "left" : "right";
  return deltaY < 0 ? "up" : "down";
}

export default function useDirectionalGesture({
  continuous = false,
  enabled,
  onDirection,
  threshold = DEFAULT_THRESHOLD,
}) {
  const gestureRef = useRef(null);

  const reset = useCallback(() => {
    gestureRef.current = null;
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gestureRef.current = {
      anchorX: event.clientX,
      anchorY: event.clientY,
      pointerId: event.pointerId,
      triggered: false,
    };
  }, [enabled]);

  const onPointerMove = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!enabled || !gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.triggered && !continuous) return;

    event.preventDefault();
    const deltaX = event.clientX - gesture.anchorX;
    const deltaY = event.clientY - gesture.anchorY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return;

    onDirection(getDirection(deltaX, deltaY));
    gesture.triggered = true;
    if (continuous) {
      gesture.anchorX = event.clientX;
      gesture.anchorY = event.clientY;
    }
  }, [continuous, enabled, onDirection, threshold]);

  const onPointerUp = useCallback((event) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    reset();
  }, [reset]);

  return {
    onContextMenu: (event) => event.preventDefault(),
    onLostPointerCapture: reset,
    onPointerCancel: reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
