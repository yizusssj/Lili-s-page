import { useCallback, useRef } from "react";

const FALLBACK_STEP = 26;
const TAP_DISTANCE = 11;
const FLICK_DURATION = 260;

function getEventTime(event) {
  return Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
}

export default function useBoardGestures({
  columns = 10,
  enabled,
  onDrop,
  onMoveDown,
  onMoveLeft,
  onMoveRight,
  onRotate,
}) {
  const gestureRef = useRef(null);

  const resetGesture = useCallback(() => {
    gestureRef.current = null;
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const step = rect.width > 0
      ? Math.max(18, Math.min(34, (rect.width / columns) * 0.78))
      : FALLBACK_STEP;

    gestureRef.current = {
      downwardAnchor: event.clientY,
      dropped: false,
      horizontalAnchor: event.clientX,
      moved: false,
      pointerId: event.pointerId,
      startTime: getEventTime(event),
      startX: event.clientX,
      startY: event.clientY,
      step,
    };
  }, [columns, enabled]);

  const onPointerMove = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!enabled || !gesture || gesture.pointerId !== event.pointerId || gesture.dropped) return;

    event.preventDefault();
    const totalX = event.clientX - gesture.startX;
    const totalY = event.clientY - gesture.startY;
    if (Math.hypot(totalX, totalY) >= TAP_DISTANCE) gesture.moved = true;

    const elapsed = getEventTime(event) - gesture.startTime;
    if (
      totalY >= gesture.step * 3.1
      && totalY > Math.abs(totalX) * 1.25
      && elapsed <= FLICK_DURATION
    ) {
      gesture.dropped = true;
      onDrop();
      return;
    }

    const horizontalDelta = event.clientX - gesture.horizontalAnchor;
    const horizontalSteps = Math.min(5, Math.floor(Math.abs(horizontalDelta) / gesture.step));
    if (horizontalSteps > 0) {
      const action = horizontalDelta < 0 ? onMoveLeft : onMoveRight;
      for (let index = 0; index < horizontalSteps; index += 1) action();
      gesture.horizontalAnchor += Math.sign(horizontalDelta) * horizontalSteps * gesture.step;
    }

    const downwardDelta = event.clientY - gesture.downwardAnchor;
    const downwardSteps = Math.min(5, Math.floor(downwardDelta / gesture.step));
    if (downwardSteps > 0) {
      for (let index = 0; index < downwardSteps; index += 1) onMoveDown();
      gesture.downwardAnchor += downwardSteps * gesture.step;
    } else if (downwardDelta < -gesture.step) {
      gesture.downwardAnchor = event.clientY;
    }
  }, [enabled, onDrop, onMoveDown, onMoveLeft, onMoveRight]);

  const onPointerUp = useCallback((event) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (enabled && !gesture.moved && !gesture.dropped) onRotate();
    resetGesture();
  }, [enabled, onRotate, resetGesture]);

  return {
    onContextMenu: (event) => event.preventDefault(),
    onLostPointerCapture: resetGesture,
    onPointerCancel: resetGesture,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
