// Reusable SVG "robot head" avatar -- no audio/network logic of its own,
// purely presentational and driven entirely by props, so any of the app's
// speechSynthesis-narrating components (StudentVivaMode.jsx today, others
// later) can reuse it without depending on how that component gets its
// speaking/thinking signal.
//
// `audioLevel` (0-1) is deliberately supported even though nothing in this
// app feeds it a real value yet -- it lets the mouth be driven directly by
// actual audio amplitude instead of the simple looping animation below, so
// a later PCM-amplitude-driven caller (e.g. eventually replacing the
// vendored @spatialwalk/avatarkit 3D avatar in AiTutorAvatarProvider.jsx)
// can reuse this same component without a redesign.
export const RobotAvatar = ({ isThinking = false, isSpeaking = false, audioLevel = null, size = 96, className = "" }) => {
  const isAudioDriven = audioLevel != null;
  const mouthScale = isAudioDriven ? Math.max(0.15, Math.min(1, audioLevel)) : null;
  const label = isSpeaking ? "Robot avatar, speaking" : isThinking ? "Robot avatar, thinking" : "Robot avatar";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`student-robot-avatar ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id="student-robot-avatar-head-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--teal) 55%, white)" />
          <stop offset="100%" stopColor="var(--teal)" />
        </linearGradient>
      </defs>

      {/* antenna */}
      <line x1="50" y1="6" x2="50" y2="16" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="5" r="4" fill="var(--teal)" />

      {/* ears */}
      <rect x="10" y="38" width="8" height="20" rx="4" fill="var(--teal)" />
      <rect x="82" y="38" width="8" height="20" rx="4" fill="var(--teal)" />

      {/* head */}
      <rect x="18" y="16" width="64" height="64" rx="24" fill="url(#student-robot-avatar-head-gradient)" />

      {/* sheen highlight -- fakes a 3D, lit-from-above look without any real 3D geometry */}
      <ellipse cx="38" cy="32" rx="16" ry="9" fill="#ffffff" opacity="0.25" />

      {/* eyes */}
      <ellipse
        className={`student-robot-avatar-eye ${isThinking ? "is-blinking" : ""}`}
        cx="38"
        cy="46"
        rx="6"
        ry="7"
        fill="#ffffff"
      />
      <ellipse
        className={`student-robot-avatar-eye ${isThinking ? "is-blinking" : ""}`}
        cx="62"
        cy="46"
        rx="6"
        ry="7"
        fill="#ffffff"
      />

      {/* mouth -- either a looping CSS animation (isSpeaking, no audioLevel)
          or a direct scale driven by audioLevel; never both at once. */}
      <rect
        className={`student-robot-avatar-mouth ${isSpeaking && !isAudioDriven ? "is-speaking" : ""}`}
        x="38"
        y="60"
        width="24"
        height="8"
        rx="4"
        fill="#ffffff"
        style={isAudioDriven ? { transform: `scaleY(${mouthScale})` } : undefined}
      />
    </svg>
  );
};
