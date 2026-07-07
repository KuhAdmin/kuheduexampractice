import { pool } from "./src/db/pool.js";
import { getReturningDashboardForUser, listRemainingConceptsForUser } from "./src/services/studentDashboardService.js";

const student = { id: "579", board: "cbse", studentClass: "11", subject: "biology" };

const dashboard = await getReturningDashboardForUser({
  userId: student.id,
  board: student.board,
  studentClass: student.studentClass,
  subject: student.subject,
});

console.log("continueCard:", JSON.stringify(dashboard.continueCard, null, 2));
console.log("weakConcepts:", JSON.stringify(dashboard.weakConcepts, null, 2));
console.log("streak:", JSON.stringify(dashboard.streak, null, 2));

const remaining = await listRemainingConceptsForUser({
  userId: student.id,
  board: student.board,
  studentClass: student.studentClass,
  subject: student.subject,
});

console.log("remaining concepts count:", remaining.concepts.length);
console.log("first 3 remaining:", JSON.stringify(remaining.concepts.slice(0, 3), null, 2));

await pool.end();
