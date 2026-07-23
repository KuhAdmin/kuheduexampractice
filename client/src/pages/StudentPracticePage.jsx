import { StudentPageShell } from "../components/StudentPageShell";

const STEM_LAB_EXPLORE_URL = "https://stemlab.site/explore";

export const StudentPracticePage = () => (
  <StudentPageShell pageClass="student-page--practice" legacyModifierClass="student-practice-phone">
    <iframe
      className="student-practice-frame"
      src={STEM_LAB_EXPLORE_URL}
      title="STEM Lab Explore"
      allow="fullscreen"
    />
  </StudentPageShell>
);
