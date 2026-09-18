# Project instructions

## Avatar behavior (Viva / RobotAvatar)

The `RobotAvatar` component (`client/src/components/RobotAvatar.jsx`) and any UI that narrates speech to the student must follow this rule:

**The avatar must be visible for every moment speech is actually playing — not just some narration lines.** If a component calls `window.speechSynthesis.speak(...)` (directly or via a wrapper), the avatar's speaking state (mouth animation + ripple) must be shown for that entire narration, from the intro line through every subsequent line, with no gaps where speech is playing but the avatar isn't shown.

Concretely, in `client/src/components/StudentVivaMode.jsx`:
- All narration goes through `speakWithAvatar(text)`, not `speak(text)` directly — it toggles the shared `isNarrating` state around every call, so no individual narration line can be added without the avatar showing for it.
- The avatar's speaking presentation (`renderSpeakingAvatar()` — `RobotAvatar isSpeaking` wrapped in the ripple effect) covers: the intro line, every question being read, the "didn't hear a reply" message, and the AI feedback.
- The "Question N of 5" heading only renders once `questionIndex >= 0` (i.e. once a real question is active) — during the intro line it shows "Get ready..." instead, so there's never a bare "Question 0 of 5" with no content behind it.
- `RobotAvatar isThinking` (blinking eyes, no ripple) is reserved for the "grading" wait (AI is grading the answer) — the ripple is specifically a "speaking" cue and should not appear on the thinking state.
- The plain mic + ripple (`renderMicRipple()`) is intentionally kept separate from the avatar and used only for the "listening" stage (capturing the student's spoken reply), so recording the student's voice never looks like the avatar itself.

When adding a new narration line or a new speaking-avatar integration elsewhere in the app, follow the same pattern: never call `speechSynthesis.speak()` (or an equivalent) without the avatar's speaking state being shown for its full duration.
