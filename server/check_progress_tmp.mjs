import { pool } from "./src/db/pool.js";

const studentId = 579; // Jayanta Chakrabarty, board=cbse, class=11, subject=biology

const rows = await pool.query(
  `
    SELECT
      chapter.chapter_number AS "chapterNumber",
      chapter.section_number AS "sectionNumber",
      au.assessment_unit_id AS "assessmentUnitId",
      COALESCE(sm.mastery_probability, 0) AS "masteryProbability",
      sm.updated_at AS "updatedAt"
    FROM assessment_unit AS au
    JOIN mv_chapter_catalog AS chapter ON chapter.chapter_id = au.fk_mst_chapter_id
    LEFT JOIN student_mastery AS sm ON sm.assessment_unit_id = au.assessment_unit_id AND sm.user_id = $1
    WHERE chapter.exam_goal_code = 'AISSCE' AND chapter.level_code = '11' AND chapter.subject_code = 'BIO'
      AND chapter.chapter_number = '1'
    ORDER BY chapter.section_number
  `,
  [studentId]
);

console.log("Total units in chapter 1:", rows.rows.length);
const withMastery = rows.rows.filter((r) => Number(r.masteryProbability) > 0);
console.log("Units with mastery_probability > 0:", withMastery.length);
console.log(withMastery.map((r) => ({ section: r.sectionNumber, unit: r.assessmentUnitId, mastery: r.masteryProbability })));

const masteredCount = rows.rows.filter((r) => Number(r.masteryProbability) >= 0.8).length;
console.log("Units >= 0.8 threshold (current 'progress' definition):", masteredCount);

const avgMastery = rows.rows.reduce((sum, r) => sum + Number(r.masteryProbability), 0) / rows.rows.length;
console.log("Average mastery probability across all units (alt definition):", Math.round(avgMastery * 100) + "%");

await pool.end();
