// Reusable SVG "young male tutor" avatar -- mirrors RobotAvatar.jsx's exact
// prop contract (isThinking/isSpeaking/audioLevel/size/className) and
// presentational-only design (no audio/network logic of its own), so any
// speechSynthesis-narrating component can swap between the two faces without
// changing how it drives them. See RobotAvatar.jsx's own comment for why
// `audioLevel` is supported even though nothing feeds it a real value yet.
//
// The 3D illusion here is built the same way traditional cel-shaded/digital
// portrait art fakes depth on a flat surface: an off-center radial "sphere"
// gradient stands in for a single overhead-left light source, a blurred
// core-shadow clipped to the head models the far side falling into shadow, a
// thin rim-light arc catches the opposite edge, and a soft contact shadow
// grounds the whole bust -- no actual 3D geometry, same as RobotAvatar's own
// sheen trick, just carried further across more surfaces (hair, ears, lips).
export const MaleAvatar = ({ isThinking = false, isSpeaking = false, audioLevel = null, size = 96, className = "" }) => {
  const isAudioDriven = audioLevel != null;
  const mouthScale = isAudioDriven ? Math.max(0.15, Math.min(1, audioLevel)) : null;
  const label = isSpeaking ? "Tutor avatar, speaking" : isThinking ? "Tutor avatar, thinking" : "Tutor avatar";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`student-male-avatar ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <defs>
        {/* Off-center radial stand-in for an overhead-left light source --
            unlike a flat diagonal gradient, this falls off the way light
            actually wraps around a rounded surface, which is most of the
            "3D" illusion below. Used for every skin surface (head/neck/ears)
            so they all read as lit from the same direction. */}
        <radialGradient id="student-male-avatar-skin-gradient" cx="36%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fbdfc0" />
          <stop offset="55%" stopColor="#f0bd8d" />
          <stop offset="100%" stopColor="#c68a5c" />
        </radialGradient>
        {/* Golden-blonde rather than the original dark brown -- same
            off-center "light source" radial technique as the skin above. */}
        <radialGradient id="student-male-avatar-hair-gradient" cx="32%" cy="18%" r="90%">
          <stop offset="0%" stopColor="#f8e3a8" />
          <stop offset="60%" stopColor="#e0b768" />
          <stop offset="100%" stopColor="#b0813f" />
        </radialGradient>
        <linearGradient id="student-male-avatar-facial-hair-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#caa15a" />
          <stop offset="100%" stopColor="#8a6229" />
        </linearGradient>
        <linearGradient id="student-male-avatar-collar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--teal) 55%, white)" />
          <stop offset="100%" stopColor="var(--teal)" />
        </linearGradient>
        <linearGradient id="student-male-avatar-mouth-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8a4038" />
          <stop offset="100%" stopColor="#c0685c" />
        </linearGradient>
        <clipPath id="student-male-avatar-head-clip">
          <ellipse cx="50" cy="45" rx="27" ry="29" />
        </clipPath>
        <filter id="student-male-avatar-blur-sm" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>

      {/* contact shadow -- grounds the bust instead of it reading as a flat
          sticker floating on the background */}
      <ellipse cx="50" cy="97" rx="30" ry="5" fill="#000000" opacity="0.16" filter="url(#student-male-avatar-blur-sm)" />

      {/* shoulders / collar */}
      <path d="M12 100 C12 80 29 72 50 72 C71 72 88 80 88 100 Z" fill="url(#student-male-avatar-collar-gradient)" />
      <path d="M40 76 L50 90 L60 76 L54 72 L46 72 Z" fill="#ffffff" opacity="0.8" />

      {/* neck, with the jaw's shadow falling onto it */}
      <rect x="41" y="60" width="18" height="18" rx="7" fill="url(#student-male-avatar-skin-gradient)" />
      <ellipse cx="50" cy="61" rx="9" ry="3" fill="#8a5a3a" opacity="0.35" filter="url(#student-male-avatar-blur-sm)" />

      {/* ears, each with a small inner-shadow for the concha */}
      <ellipse cx="21" cy="50" rx="5" ry="7" fill="url(#student-male-avatar-skin-gradient)" />
      <ellipse cx="79" cy="50" rx="5" ry="7" fill="url(#student-male-avatar-skin-gradient)" />
      <ellipse cx="22" cy="50" rx="2" ry="3.4" fill="#8a5a3a" opacity="0.4" />
      <ellipse cx="78" cy="50" rx="2" ry="3.4" fill="#8a5a3a" opacity="0.4" />

      {/* head */}
      <ellipse cx="50" cy="45" rx="27" ry="29" fill="url(#student-male-avatar-skin-gradient)" />

      {/* everything below is clipped to the head silhouette so the shading
          layers never spill past its edge */}
      <g clipPath="url(#student-male-avatar-head-clip)">
        {/* far-side core shadow -- the part of the "sphere" turning away
            from the light */}
        <ellipse cx="66" cy="56" rx="16" ry="19" fill="#8a5636" opacity="0.28" filter="url(#student-male-avatar-blur-sm)" />
        {/* rim light on the opposite edge from the core shadow */}
        <path
          d="M74 30 A27 29 0 0 1 72 66"
          fill="none"
          stroke="#ffe8cc"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.35"
        />
        {/* soft cheek blush for extra roundness */}
        <ellipse cx="35" cy="54" rx="6" ry="4" fill="#e08a6b" opacity="0.22" filter="url(#student-male-avatar-blur-sm)" />
        <ellipse cx="63" cy="55" rx="6" ry="4" fill="#e08a6b" opacity="0.16" filter="url(#student-male-avatar-blur-sm)" />
      </g>

      {/* sheen highlight -- the brightest specular catch-light, layered on
          top of the softer radial shading above */}
      <ellipse cx="37" cy="27" rx="12" ry="7" fill="#ffffff" opacity="0.22" filter="url(#student-male-avatar-blur-sm)" />

      {/* short, tidy hairstyle with a side part, plus a crown highlight for
          strand-like volume instead of a flat silhouette */}
      <path
        d="M22 39 C19 18 33 8 50 8 C67 8 81 18 78 39 C74 30 67 33 66 25 C58 33 42 33 34 25 C33 33 26 30 22 39 Z"
        fill="url(#student-male-avatar-hair-gradient)"
      />
      <path
        d="M27 30 C27 17 37 11 47 10.5"
        fill="none"
        stroke="#fff3d6"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* eyebrows -- a warm sandy brown, a shade darker than the blonde hair
          for definition, rather than the original near-black */}
      <path d="M31 37 Q38 32 45 36" fill="none" stroke="#9c7038" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M55 36 Q62 32 69 37" fill="none" stroke="#9c7038" strokeWidth="2.4" strokeLinecap="round" />

      {/* French-cut beard -- a thin strap along the jaw from each sideburn
          down into a fuller, slightly pointed chin patch, cheeks left bare.
          Kept well clear of the mouth (y 61-67) so the lips stay visible. */}
      <path
        d="M27 53 C25 62 27 71 36 76 C43 79 57 79 64 76 C73 71 75 62 73 53 C70 58 66 66 58 69 C53 71 47 71 42 69 C34 66 30 58 27 53 Z"
        fill="url(#student-male-avatar-facial-hair-gradient)"
      />

      {/* eye-socket shadow, sitting behind the eyes themselves so it still
          reads even while a blink closes them */}
      <ellipse cx="39" cy="45" rx="7.5" ry="5.5" fill="#8a5636" opacity="0.14" />
      <ellipse cx="61" cy="45" rx="7.5" ry="5.5" fill="#8a5636" opacity="0.14" />

      {/* eyes -- sclera, iris/pupil, and a small specular dot for glossiness */}
      <g className={`student-male-avatar-eye ${isThinking ? "is-blinking" : ""}`}>
        <ellipse cx="39" cy="46" rx="5.5" ry="5" fill="#ffffff" />
        <circle cx="40" cy="46" r="2.6" fill="#3a2a1c" />
        <circle cx="39" cy="44.6" r="0.9" fill="#ffffff" />
      </g>
      <g className={`student-male-avatar-eye ${isThinking ? "is-blinking" : ""}`}>
        <ellipse cx="61" cy="46" rx="5.5" ry="5" fill="#ffffff" />
        <circle cx="60" cy="46" r="2.6" fill="#3a2a1c" />
        <circle cx="59" cy="44.6" r="0.9" fill="#ffffff" />
      </g>

      {/* nose -- a light bridge catch-light paired with a shadow on the far
          side gives it a ridge instead of reading as a flat squiggle */}
      <path d="M48.4 48 Q46.6 55 49.4 57" fill="none" stroke="#ffe8cc" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <path d="M50.2 48 Q52.4 55 53 55.6" fill="none" stroke="#a56a42" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />

      {/* moustache -- static (not part of the animated mouth group below)
          since a real moustache sits on the still upper lip/skin and doesn't
          move with the jaw the way the mouth's open/close animation does */}
      <path
        d="M42 59 C44 55 48 56 50 58 C52 56 56 55 58 59 C55 61.5 52 60 50 60.5 C48 60 45 61.5 42 59 Z"
        fill="url(#student-male-avatar-facial-hair-gradient)"
      />

      {/* mouth -- a thinner cupid's-bow upper lip over a fuller, rounder
          lower lip (with its own seam and shine), instead of the old plain
          rounded-rect bar. Either a looping CSS animation (isSpeaking, no
          audioLevel) or a direct scale driven by audioLevel; never both at
          once -- same mechanism as before, just applied to a real lip shape
          so it still reads as "opening" without needing to separately
          animate the two lips apart. */}
      <g
        className={`student-male-avatar-mouth ${isSpeaking && !isAudioDriven ? "is-speaking" : ""}`}
        style={isAudioDriven ? { transform: `scaleY(${mouthScale})` } : undefined}
      >
        <path
          d="M40 63.2 Q45 63 50 63 Q55 63 60 63.2 Q58.5 68 50 68.3 Q41.5 68 40 63.2 Z"
          fill="url(#student-male-avatar-mouth-gradient)"
        />
        <ellipse cx="50" cy="65.3" rx="6" ry="1.6" fill="#ffffff" opacity="0.25" />
        <path
          d="M40 63.2 Q43.5 61 47 62.2 Q48.5 61.2 50 61.8 Q51.5 61.2 53 62.2 Q56.5 61 60 63.2 Q55 62.6 50 62.8 Q45 62.6 40 63.2 Z"
          fill="#8a4038"
        />
        <path d="M41 63.2 Q50 64.3 59 63.2" fill="none" stroke="#5c2e28" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
      </g>
    </svg>
  );
};
