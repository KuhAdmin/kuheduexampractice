import { useCallback, useEffect, useRef, useState } from "react";

// Generalizes the inline setInterval countdown timer already used by
// StudentVivaMode.jsx's listenForReply into a reusable hook. `seconds` is
// the starting count; call start() to (re)start it, stop() to cancel early.
// onExpire fires once when it reaches 0.
export const useCountdown = (seconds, { onExpire } = {}) => {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const intervalRef = useRef(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    let remaining = seconds;
    setSecondsLeft(remaining);
    intervalRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clear();
        onExpireRef.current?.();
      }
    }, 1000);
  }, [seconds, clear]);

  const stop = useCallback(() => {
    clear();
    setSecondsLeft(null);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { secondsLeft, isRunning: secondsLeft !== null, start, stop };
};
