import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_PATH = path.join(__dirname, "data", "writingPracticeContent.json");
const OUTPUT_PATH = path.join(__dirname, "..", "src", "db", "seed_writing_practice.sql");

const sqlString = (value) => {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
};

const sqlNumber = (value) => (value === null || value === undefined ? "NULL" : Number(value));

const sqlJsonb = (value) => `${sqlString(JSON.stringify(value ?? null))}::jsonb`;

// Regenerated from server/scripts/data/writingPracticeContent.json any time
// content is edited -- slug-keyed upserts + FK-resolving subqueries, no
// hardcoded ids, so re-running after a content edit updates existing rows
// instead of duplicating them. Auto-discovered and run by
// server/src/db/bootstrap.js's initializeDatabase() on every `npm run
// db:init` (any server/src/db/seed_*.sql file), same as seed_app_settings.sql.
const buildSql = (content) => {
  const lines = [
    "-- GENERATED FILE -- do not edit directly.",
    "-- Regenerate with: node server/scripts/generateWritingPracticeSeedSql.js",
    "-- Source: server/scripts/data/writingPracticeContent.json",
    "",
  ];

  for (const category of content.categories) {
    lines.push(
      `INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)`,
      `VALUES (${sqlString(category.slug)}, ${sqlString(category.title)}, ${sqlString(category.subtitle)}, ${sqlString(
        category.description
      )}, ${sqlJsonb(category.formatTemplate)}, ${sqlNumber(category.wordLimit)}, ${sqlNumber(category.marks)}, ${sqlNumber(
        content.categories.indexOf(category)
      )})`,
      `ON CONFLICT (slug) DO UPDATE SET`,
      `  title = EXCLUDED.title,`,
      `  subtitle = EXCLUDED.subtitle,`,
      `  description = EXCLUDED.description,`,
      `  format_template = EXCLUDED.format_template,`,
      `  word_limit = EXCLUDED.word_limit,`,
      `  marks = EXCLUDED.marks,`,
      `  display_order = EXCLUDED.display_order;`,
      ""
    );

    category.subcategories.forEach((subcategory, subIndex) => {
      lines.push(
        `INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)`,
        `SELECT id, ${sqlString(subcategory.slug)}, ${sqlString(subcategory.title)}, ${sqlNumber(subIndex)}`,
        `FROM writing_practice_category WHERE slug = ${sqlString(category.slug)}`,
        `ON CONFLICT (fk_category_id, slug) DO UPDATE SET`,
        `  title = EXCLUDED.title,`,
        `  display_order = EXCLUDED.display_order;`,
        ""
      );

      subcategory.questions.forEach((question, qIndex) => {
        lines.push(
          `INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)`,
          `SELECT sc.id, ${sqlNumber(qIndex + 1)}, ${sqlString(question.title)}, ${sqlString(question.description)}, ${sqlNumber(
            question.wordLimit ?? category.wordLimit
          )}, ${sqlNumber(question.marks ?? category.marks)}, ${sqlNumber(qIndex)}`,
          `FROM writing_practice_subcategory sc`,
          `JOIN writing_practice_category c ON c.id = sc.fk_category_id`,
          `WHERE c.slug = ${sqlString(category.slug)} AND sc.slug = ${sqlString(subcategory.slug)}`,
          `ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET`,
          `  question_number = EXCLUDED.question_number,`,
          `  title = EXCLUDED.title,`,
          `  description = EXCLUDED.description,`,
          `  word_limit = EXCLUDED.word_limit,`,
          `  marks = EXCLUDED.marks;`,
          ""
        );
      });
    });
  }

  return lines.join("\n");
};

const run = async () => {
  const content = JSON.parse(await fs.readFile(CONTENT_PATH, "utf8"));
  const sql = buildSql(content);
  await fs.writeFile(OUTPUT_PATH, sql, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
