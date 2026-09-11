-- GENERATED FILE -- do not edit directly.
-- Regenerate with: node server/scripts/generateWritingPracticeSeedSql.js
-- Source: server/scripts/data/writingPracticeContent.json

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('notice-writing', 'Notice Writing', NULL, 'A Notice is a formal, brief written communication placed on an official board to convey specific information to a defined audience.', '[{"label":"School Name & ''NOTICE'' Heading","guidance":"Write the school/institution name at the top, followed by the word ''NOTICE'' as a title."},{"label":"Date of Issuance","guidance":"Add the date the notice is issued, e.g. 10th September 2026."},{"label":"Heading/Title","guidance":"Give the notice a short, clear title describing its purpose."},{"label":"Body","guidance":"Answer Who, What, When, Where, Whom to contact, and the Deadline — all within the word limit."},{"label":"Signature Block","guidance":"End with your signature, name, and designation/class."}]'::jsonb, 50, NULL, 0)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-events-cultural-programs', 'School Events & Cultural Programs', 0
FROM writing_practice_category WHERE slug = 'notice-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Annual Cultural Fest', 'You are Rohan / Riya, the Cultural Secretary of St. Xavier''s School, Kolkata. Your school is organizing its Annual Cultural Fest, "Sanskriti 2026," for students of Classes 6 to 8. Draft a notice in not more than 50 words inviting interested students to give their names for music, dance, and drama auditions. Include details regarding the date, time, venue, and deadline for submission.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'school-events-cultural-programs'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inter-House Quiz Competition', 'You are Aarav / Ananya, the Head Boy / Head Girl of Modern Public School, Delhi. The school is conducting an Inter-House Science and General Knowledge Quiz Competition for Classes 6 to 8. Draft a notice in about 50 words informing house captains to select candidates and submit their names to the undersigned.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'school-events-cultural-programs'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'lost-found-items', 'Lost & Found Items', 1
FROM writing_practice_category WHERE slug = 'notice-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Lost Item (Wristwatch)', 'You are Vikas / Sunita, a student of Class 7-A at Kendriya Vidyalaya, Salt Lake. You lost your blue Fastrack wristwatch in the school playground during the recess period. Draft a notice in not more than 50 words to be put up on the school notice board giving details of the watch and promising a suitable reward to the finder.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'lost-found-items'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Found Item (Water Bottle)', 'You are Dev / Sneha, studying in Class 6-C, Delhi Public School, Nagerbazar. You found an expensive stainless-steel water bottle in the school library. Draft a notice in about 50 words asking the rightful owner to claim it from you after providing proper identification details.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'lost-found-items'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'excursions-tours-field-trips', 'Excursions, Tours & Field Trips', 2
FROM writing_practice_category WHERE slug = 'notice-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Educational Field Trip', 'You are the President of the Eco and Heritage Club of Indus Valley School, Dumdum. The club is planning a one-day educational tour to the local Science City and Planetarium for students of Class 8. Draft a notice in not more than 50 words mentioning the date, cost per student, last date for consent slip submission, and required belongings.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'excursions-tours-field-trips'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Summer Adventure Camp', 'You are Kabir / Priya, the Sports Captain of Army Public School. The school is organizing a 3-day Summer Adventure Camp during the upcoming vacation for middle school students. Draft a notice in about 50 words providing details about activities, charges, and submission of parent consent forms.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'excursions-tours-field-trips'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'drives-social-service-initiatives', 'Drives & Social Service Initiatives', 3
FROM writing_practice_category WHERE slug = 'notice-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Book & Uniform Donation Drive', 'You are Sameer / Diya, Student Coordinator of the Social Service Club at Heritage Academy, Kolkata. The school is organizing a "Book and Uniform Donation Drive" to help underprivileged children at the start of the new academic session. Draft a notice in not more than 50 words encouraging students of Classes 6–8 to donate old textbooks, storybooks, and usable uniforms.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'drives-social-service-initiatives'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Tree Plantation Drive', 'You are the Environment Club Secretary of National English School. To mark World Environment Day, your school is holding a Tree Plantation Drive on the school campus. Draft a notice in about 50 words inviting students to participate and bring a small sapling for planting.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'drives-social-service-initiatives'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'meetings-general-information', 'Meetings & General Information', 4
FROM writing_practice_category WHERE slug = 'notice-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Meeting of Student Council / Class Monitors', 'You are the School Captain of Ryan International School. Draft a notice in not more than 50 words calling an urgent meeting of all Class Monitors and Student Council members of Classes 6 to 8 to discuss discipline during the upcoming terminal examinations.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'meetings-general-information'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Change in School Timings', 'You are the Student Prefect of DAV Public School. Due to severe winter weather conditions, the school management has decided to alter the daily school hours starting next Monday. Draft a notice in about 50 words informing students of the revised arrival and dismissal timings.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'notice-writing' AND sc.slug = 'meetings-general-information'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('message-writing', 'Message Writing', NULL, 'A Message conveys crucial facts from a telephonic conversation or verbal instruction briefly to someone who was unavailable.', '[{"label":"''MESSAGE'' Heading + Date & Time","guidance":"Start with the word ''MESSAGE'', then note the date and time it was written."},{"label":"Salutation","guidance":"Address the message to the intended recipient by name, e.g. ''Mom,'' or ''Rahul,''."},{"label":"Body","guidance":"State who called, what the message is, and what needs to be done — concise and informal, within 50 words."},{"label":"Sender''s Name","guidance":"Sign off with your first name only — no formal closing needed."}]'::jsonb, 50, NULL, 1)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'family-domestic-situations', 'Family & Domestic Situations', 0
FROM writing_practice_category WHERE slug = 'message-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Arrival of a Relative', 'You are Karan. Your mother is at work. Her brother, Uncle Suresh, calls to say he will be arriving from Mumbai this evening at 7:00 PM on the Rajdhani Express. He asks her to pick him up at the station or send a cab. Since you have to leave for your guitar class, write a message in not more than 50 words for your mother.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'family-domestic-situations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Change in Tuition/Coaching Class Timing', 'You are Priya. Your elder sister, Neha, is at school. Her math tutor, Mr. Sharma, called to inform her that today''s evening tuition class has been rescheduled from 5:00 PM to 6:30 PM due to a personal emergency. You are leaving for the dentist. Draft a message for Neha in about 50 words.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'family-domestic-situations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Delivery Confirmation / Appliance Repair', 'You are Rahul. A technician from Samsung Customer Care calls to inform your father that the washing machine repair person will visit your house between 4:00 PM and 5:00 PM today. He requests that someone be available at home with the warranty card. Your father is at the office, and you are going out to play. Write a message for your father in not more than 50 words.', 50, NULL, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'family-domestic-situations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-academic-notes', 'School & Academic Notes', 1
FROM writing_practice_category WHERE slug = 'message-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Borrowed Book / Project Submission', 'You are Sneha. Your classmate, Anish, called your home phone while you were out. Your brother took the call. Anish mentioned that he has completed the group Science project file and will bring it to school tomorrow. He asked you to bring the charts and sketch pens. Your brother leaves a message for you before going to his swimming class. Draft the message in not more than 50 words.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'school-academic-notes'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Postponement of Football Practice', 'You are Dev. The sports coach, Mr. Roy, called your house to leave a message for your classmate, Kabir. He stated that the afternoon football practice is cancelled today due to rain and will instead take place tomorrow morning at 6:30 AM. Since Kabir is not at home and you have to go for your music lesson, write a message for Kabir in about 50 words.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'school-academic-notes'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Change of Exam Syllabus / Notes Request', 'You are Tanvi. Your friend, Diya, called to tell your sister, Riya, that the English teacher has reduced one chapter (The Desert) from the upcoming unit test syllabus. She also asked Riya to return her English notebook tomorrow. Riya is not at home. Draft a message for Riya in not more than 50 words.', 50, NULL, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'school-academic-notes'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'social-community-requests', 'Social & Community Requests', 2
FROM writing_practice_category WHERE slug = 'message-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Birthday Party Venue Change', 'You are Aarav. Your friend, Rohan, called to inform your brother, Aditya, that the venue for his birthday party this evening has been shifted from his house to ''Flurys Bakery, Park Street'' at 6:00 PM. Aditya is taking a nap, and you are leaving for tuition. Write a message for Aditya in not more than 50 words.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'social-community-requests'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Society / Apartment Meeting Notice', 'You are Meera. The Secretary of your housing society called to inform your mother that an urgent flat owners'' meeting has been called at 7:30 PM today in the community hall to discuss water supply issues. Your mother is at the market. Write a message for your mother in not more than 50 words.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'social-community-requests'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'medical-health-updates', 'Medical & Health Updates', 3
FROM writing_practice_category WHERE slug = 'message-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Doctor''s Appointment Confirmation', 'You are Vikram. The receptionist at Apollo Clinic called to inform your father that his appointment with Dr. Sen has been confirmed for 7:15 PM today instead of 8:00 PM. She asked him to bring his previous medical reports. Your father is in a meeting. Write a message for your father in about 50 words.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'medical-health-updates'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Sick Leave / Homework Request', 'You are Ishan. Your classmate, Sarthak, called to say he will not attend school tomorrow due to high fever. He requested that you collect the homework assignments for Math and Science from the teachers and inform the class monitor about his leave application. Since you are going to the market, write a message for yourself/your mother to remember this task.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'message-writing' AND sc.slug = 'medical-health-updates'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('diary-entry', 'Diary Entry', NULL, 'A Diary Entry records personal thoughts, emotions, and experiences in an informal, reflective, first-person tone.', '[{"label":"Date, Day & Time","guidance":"Record the date, day of the week, and time you are writing."},{"label":"''Dear Diary,'' Salutation","guidance":"Open with the informal salutation ''Dear Diary,''."},{"label":"Body (First Person)","guidance":"Write in first person (''I''), expressing genuine feelings and reflections on what happened, in chronological order."},{"label":"Sign-off","guidance":"End with your first name only."}]'::jsonb, 50, NULL, 2)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'emotional-personal-experiences', 'Emotional & Personal Experiences', 0
FROM writing_practice_category WHERE slug = 'diary-entry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'First Day at a New School', 'You recently changed your school and attended your first day at the new school today. You felt a mix of nervousness, excitement, and warmth when your classmates welcomed you. Express your feelings and experiences in a diary entry in about 50 words.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'emotional-personal-experiences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Winning an Inter-School Competition', 'Today, you won the First Prize in the Inter-School Declamation / Debate Competition. You had spent weeks practicing, and your parents and teachers were immensely proud of you. Write a diary entry in about 50 words recording your joy and sense of achievement.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'emotional-personal-experiences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'A Misunderstanding with a Close Friend', 'You had a major argument with your best friend today over a trivial matter during recess, and neither of you spoke for the rest of the day. You now feel deeply remorseful. Write a diary entry in not more than 50 words reflecting on what happened and how you plan to make amends tomorrow.', 50, NULL, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'emotional-personal-experiences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'outings-trips-unforgettable-events', 'Outings, Trips & Unforgettable Events', 1
FROM writing_practice_category WHERE slug = 'diary-entry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Visiting an Old Age Home', 'As part of your school''s Social Service Club, you visited a local home for senior citizens today. Interacting with the elderly residents brought both sadness and valuable life lessons. Express your emotions in a diary entry in about 50 words.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'outings-trips-unforgettable-events'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'An Unexpected Power Outage on a Rainy Evening', 'Rain flooded your locality evening, leading to a long power outage. Instead of using gadgets, your family spent time sitting together, lighting candles, telling stories, and listening to the rain. Write a diary entry in about 50 words capturing this cozy experience.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'outings-trips-unforgettable-events'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'First Experience Cooking a Meal', 'Today, while your parents were out, you tried cooking a simple dish (like pasta or an omelet) for the first time by yourself. Write a diary entry in not more than 50 words expressing your excitement, how the food turned out, and the thrill of independence.', 50, NULL, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'outings-trips-unforgettable-events'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'social-environmental-ethical-reflections', 'Social, Environmental & Ethical Reflections', 2
FROM writing_practice_category WHERE slug = 'diary-entry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Witnessing an Act of Kindness', 'On your way back from school today, you saw a young boy helping an elderly blind person cross a busy road amidst heavy traffic. The act touched your heart deeply. Write a diary entry in about 50 words reflecting on the importance of compassion.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'social-environmental-ethical-reflections'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Day Without Any Digital Screens / Gadgets', 'Your parents challenged you to spend an entire Sunday without touching your smartphone, tablet, or TV. Though it felt difficult initially, you discovered new ways to enjoy your time. Record your feelings about this experience in a diary entry in about 50 words.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'social-environmental-ethical-reflections'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'challenges-moral-dilemmas', 'Challenges & Moral Dilemmas', 3
FROM writing_practice_category WHERE slug = 'diary-entry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Returning a Found Lost Item', 'You found a lost wallet containing money and identity cards on the school playground today. Instead of keeping it, you handed it over to the principal''s office, and the owner was found. Write a diary entry in about 50 words reflecting on the satisfaction of doing the right thing.', 50, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'challenges-moral-dilemmas'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Performance Anxiety Before Terminal Exams', 'With your school annual/terminal examinations starting tomorrow, you are feeling overwhelmed by exam anxiety despite having prepared well. Write a diary entry in about 50 words expressing your fears and how you are trying to calm yourself down.', 50, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'diary-entry' AND sc.slug = 'challenges-moral-dilemmas'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('bio-sketch', 'Bio-Sketch (Biographical Sketch)', NULL, 'A Bio-Sketch is a short, third-person analytical profile of a person built from factual cues, in a formal, informative tone.', '[{"label":"Name Heading","guidance":"Start with the full name of the person as a heading."},{"label":"Opening: Identity & Birth","guidance":"Begin the paragraph with full name, birth date/place, and key identity/profession."},{"label":"Body: Achievements","guidance":"Turn the given cues into smooth, connected sentences covering their career and major achievements."},{"label":"Tense & Perspective","guidance":"Use past tense for a deceased person, present/present-perfect for a living one — always third person (''He''/''She''), no personal opinions."},{"label":"Conclusion","guidance":"End with their awards, legacy, or most notable contribution."}]'::jsonb, 60, NULL, 3)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'famous-indian-authors-poets', 'Famous Indian Authors & Poets', 0
FROM writing_practice_category WHERE slug = 'bio-sketch'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Rabindranath Tagore', 'Based on the hints given below, write a biographical sketch of Rabindranath Tagore in about 50–60 words: Born: May 7, 1861, Kolkata, West Bengal. Profession: Poet, writer, painter, and philosopher; founder of Visva-Bharati University, Santiniketan. Key Achievements: Wrote Gitanjali; awarded Nobel Prize in Literature in 1913 (first Asian recipient); composed national anthems of India and Bangladesh. Died: August 7, 1941, Kolkata.', 60, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'famous-indian-authors-poets'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ruskin Bond', 'Using the profile details provided, draft a short bio-sketch of children''s author Ruskin Bond in 50–60 words: Born: May 19, 1934, Kasauli, Himachal Pradesh. Residence: Landour, Mussoorie (resides with his adopted family). Famous Works: The Room on the Roof (first novel at age 17), The Blue Umbrella, Our Trees Still Grow in Dehra. Awards: Sahitya Akademi Award (1992), Padma Shri (1999), Padma Bhushan (2014). Theme: Deep love for nature, mountains, and simple life in Indian hill stations.', 60, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'famous-indian-authors-poets'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'inspirational-scientists-visionaries', 'Inspirational Scientists & Visionaries', 1
FROM writing_practice_category WHERE slug = 'bio-sketch'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Dr. A.P.J. Abdul Kalam', 'Write a biographical sketch of Dr. A.P.J. Abdul Kalam in about 60 words using the following information: Born: October 15, 1931, Rameswaram, Tamil Nadu. Popularly Known As: "Missile Man of India" and the "People''s President". Career: Aerospace scientist at ISRO and DRDO; played a pivotal role in India''s Pokhran-II nuclear tests; served as the 11th President of India (2002–2007). Notable Books: Wings of Fire, Ignited Minds. Died: July 27, 2015, Shillong while delivering a lecture to students.', 60, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'inspirational-scientists-visionaries'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Kalpana Chawla', 'Draft a bio-sketch of astronaut Kalpana Chawla in 50–60 words based on the given cues: Born: March 17, 1962, Karnal, Haryana. Education: Aeronautical Engineering from Punjab Engineering College; Ph.D. in Aerospace Engineering from USA. Achievement: First woman of Indian origin in space; flew on Space Shuttle Columbia in 1997 as a mission specialist. Tragedy: Passed away on February 1, 2003, during the re-entry of Space Shuttle Columbia. Legacy: Inspires millions of young girls to pursue space science.', 60, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'inspirational-scientists-visionaries'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'sports-legends-cultural-icons', 'Sports Legends & Cultural Icons', 2
FROM writing_practice_category WHERE slug = 'bio-sketch'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Major Dhyan Chand', 'Use the notes below to construct a biographical sketch of Major Dhyan Chand in about 50–60 words: Born: August 29, 1905, Prayagraj, Uttar Pradesh. Sport: Field Hockey; known as the "Wizard of Hockey" for extraordinary ball control. Career Highlights: Won three Olympic gold medals for India (1928, 1932, and 1936); scored over 400 international goals. Honors: Awarded Padma Bhushan (1956); his birthday (August 29) is celebrated as National Sports Day in India. Died: December 3, 1979.', 60, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'sports-legends-cultural-icons'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Lata Mangeshkar', 'Write a short biographical sketch of singer Lata Mangeshkar in about 60 words using the given cues: Born: September 28, 1929, Indore, Madhya Pradesh. Known As: "Nightingale of India" and "Queen of Melody". Career: Sang thousands of songs across 36 Indian languages in a career spanning over seven decades. Major Honors: Padma Bhushan (1969), Dadasaheb Phalke Award (1989), Padma Vibhushan (1999), Bharat Ratna (2001). Died: February 6, 2022, Mumbai.', 60, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'sports-legends-cultural-icons'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'historical-leaders-social-reformers', 'Historical Leaders & Social Reformers', 3
FROM writing_practice_category WHERE slug = 'bio-sketch'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Swami Vivekananda', 'Read the cues below and write a bio-sketch of Swami Vivekananda in 50–60 words: Born: January 12, 1863, Kolkata (Original name: Narendranath Datta). Discipline: Chief disciple of Ramakrishna Paramahamsa; founded the Ramakrishna Math and Ramakrishna Mission. Key Event: Historic speech at the Parliament of the World''s Religions in Chicago (1893) introducing Hinduism to the West. Legacy: National Youth Day is celebrated on his birthday; promoted harmony, courage, and youth empowerment. Died: July 4, 1902, Belur Math, West Bengal.', 60, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'historical-leaders-social-reformers'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Rani Lakshmibai', 'Construct a short biographical sketch of Rani Lakshmibai of Jhansi in 50–60 words: Born: November 19, 1828, Varanasi (Childhood name: Manikarnika / Manu). Role: Queen of the princely state of Jhansi; prominent leader in the Indian Rebellion of 1857. Attributes: Expert in horse riding, sword fighting, and martial arts; symbol of bravery and resistance against British rule. Died: June 18, 1858, fighting bravely near Gwalior at age 29.', 60, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'historical-leaders-social-reformers'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-local-figures-factual-profiles', 'School & Local Figures (Factual Profiles)', 4
FROM writing_practice_category WHERE slug = 'bio-sketch'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Mr. K.L. Sharma (Favorite School Sports Teacher)', 'Write a bio-sketch of a retired physical education teacher based on the given cues in 50–60 words: Name & Age: Mr. K.L. Sharma, 62 years old. Service: Served as Senior Sports Master at City High School for 35 years. Qualifications: M.P.Ed. from Lakshmibai National College of Physical Education; former national-level football player. Special Traits: Strict disciplinarian yet caring, coached school teams to 12 state championships, passionate about fitness. Post-Retirement: Runs a free weekend sports academy for underprivileged children in his town.', 60, NULL, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'school-local-figures-factual-profiles'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Dr. Sunita Rao (Community Health Worker)', 'Draft a biographical sketch of community doctor Dr. Sunita Rao using the details below: Born & Raised: 1980, Pune, Maharashtra. Education: MBBS and M.D. in Community Medicine from KEM Hospital, Mumbai. Work: Founder of ''Rural Health Trust''; treats poor patients free of charge in over 20 villages. Key Projects: Set up mobile medical vans, organized free eye check-up camps, and conducted awareness programs on child nutrition. Recognition: Received the State Civilian Award for Public Service in 2022.', 60, NULL, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'bio-sketch' AND sc.slug = 'school-local-figures-factual-profiles'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('letter-to-the-editor-environment-civic', 'Letter to the Editor', 'Environmental & Civic Issues', 'A formal letter to a newspaper editor raising civic, social, or environmental issues to build public awareness.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date below it."},{"label":"Editor''s Address & Subject","guidance":"Address it to ''The Editor'', name of the newspaper, and city — then a one-line Subject stating the issue."},{"label":"Salutation","guidance":"Begin with ''Sir / Madam,''."},{"label":"Body Paragraph 1 — State the Problem","guidance":"Clearly describe the issue: what, where, and its nature."},{"label":"Body Paragraph 2 — Consequences","guidance":"Explain the effects or risks it causes to residents/students/the public."},{"label":"Body Paragraph 3 — Solution","guidance":"Suggest practical measures or request prompt action from the authorities."},{"label":"Closing","guidance":"End with a hopeful closing line, ''Yours sincerely,'' and your full name."}]'::jsonb, 100, 6, 4)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environmental-cleanliness-issues', 'Environmental & Cleanliness Issues', 0
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-environment-civic'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Garbage Accumulation and Open Dumping', 'You are Rohan / Riya, residing at 12-A, Park Street, Kolkata. The area near your school has become a dumping site for open garbage, causing health hazards and stray animal menaces. Write a letter to the Editor of The Times of India highlighting the issue and requesting the municipal authorities to clear the waste regularly.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'environmental-cleanliness-issues'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Excessive Noise Pollution During Festival Seasons', 'You are Aarav / Ananya, living at 45, Green Park Colony, New Delhi. Unrestricted use of loudspeakers till late at night during festival seasons severely disturbs elderly citizens and students preparing for exams. Write a letter to the Editor of a national daily drawing attention to the issue and suggesting strict noise-control guidelines.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'environmental-cleanliness-issues'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Deforestation and Loss of Green Cover in Urban Areas', 'You are Kabir / Sneha, a resident of Block C, Salt Lake, Kolkata. Rapid urban construction in your locality has led to the cutting down of old trees, impacting bird populations and raising local temperatures. Write a letter to the Editor of The Telegraph urging citizens and authorities to conduct tree plantation drives.', 100, 6, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'environmental-cleanliness-issues'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'public-safety-civic-infrastructure', 'Public Safety & Civic Infrastructure', 1
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-environment-civic'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Potholes and Poor Condition of Roads', 'You are Vikas / Sunita, residing at 88, MG Road, Bengaluru. Potholes on the main road in your area have caused several minor accidents and traffic jams during rainy days. Write a letter to the Editor of The Deccan Herald bringing this problem to the notice of the public works department.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'public-safety-civic-infrastructure'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Frequent Power Outages During Exam Season', 'You are Dev / Priya, living at 23, Lake Gardens, Kolkata. Frequent power cuts during evening study hours are severely affecting students preparing for final examinations. Write a letter to the Editor of The Statesman appealing to the electricity board to ensure uninterrupted power supply.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'public-safety-civic-infrastructure'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Rash Driving by Minors and Reckless Cyclists', 'You are Sameer / Diya, a student living at 56, Civil Lines, Jaipur. Reckless driving by underage drivers near school zones poses a constant danger to pedestrians and students. Write a letter to the Editor of a local daily suggesting stricter traffic checks and parental awareness.', 100, 6, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'public-safety-civic-infrastructure'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'health-lifestyle-student-well-being', 'Health, Lifestyle & Student Well-being', 2
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-environment-civic'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Growing Addiction to Mobile Games and Screen Time', 'You are Tanvi / Ishan, a resident of 14, Model Town, Chandigarh. You have noticed that children in your neighborhood spend most of their outdoor leisure time playing mobile games instead of physical sports. Write a letter to the Editor of The Tribune highlighting the physical and mental health impact of excessive screen time.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'health-lifestyle-student-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Unhealthy Junk Food Consumption Near School Premises', 'You are Vikram / Meera, studying in Class 8 at Army Public School, Pune. Unhygienic food stalls selling deep-fried junk food right outside the school gate are promoting poor eating habits among young children. Write a letter to the Editor of a national daily raising awareness about the importance of healthy nutrition for students.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'health-lifestyle-student-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'animal-welfare-community-responsibility', 'Animal Welfare & Community Responsibility', 3
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-environment-civic'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Cruelty towards Stray Animals and Birds in Summer', 'You are Sarthak / Pooja, residing at 102, Dumdum Road, Kolkata. During peak summer months, stray dogs and birds suffer severely due to lack of drinking water and shelter. Write a letter to the Editor of The Indian Express encouraging residents to place water bowls outside their homes and treat animals with compassion.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'animal-welfare-community-responsibility'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Wastage of Drinking Water in Residential Societies', 'You are Aditya / Neha, living at 67, Vasant Kunj, Delhi. Overflowing water tanks and negligent washing of vehicles using hosepipes lead to massive wastage of drinking water every morning. Write a letter to the Editor of a local newspaper advocating water conservation practices.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-environment-civic' AND sc.slug = 'animal-welfare-community-responsibility'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('letter-of-complaint-official-commercial', 'Letter of Complaint (Official / Commercial)', NULL, 'A formal letter reporting defective goods, poor service, or civic grievances to companies, shopkeepers, or administrative authorities.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date."},{"label":"Recipient & Subject","guidance":"Address The Manager/Executive Engineer/Proprietor and the company/store/department, with a one-line Subject naming the item or issue."},{"label":"Salutation & Opening","guidance":"Begin ''Sir / Madam,'' then state what you purchased/complained about, from where, and the date/bill number."},{"label":"Body Paragraph 1 — The Defect","guidance":"Describe the exact defect, fault, or issue experienced."},{"label":"Body Paragraph 2 — Inconvenience","guidance":"Mention the inconvenience caused and reference the warranty/receipt."},{"label":"Body Paragraph 3 — Expected Action","guidance":"State clearly what you want: replacement, repair, or full refund within a specific timeframe."},{"label":"Closing","guidance":"Request urgent resolution, mention enclosed bill/warranty copies, and close ''Yours faithfully,'' with your name."}]'::jsonb, 100, 6, 5)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'defective-commercial-goods-electronics', 'Defective Commercial Goods & Electronics', 0
FROM writing_practice_category WHERE slug = 'letter-of-complaint-official-commercial'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Defective Wristwatch / Electronic Item', 'You are Rohan / Riya, residing at 12-A, Park Street, Kolkata. You recently purchased a wristwatch from ''Time Style Electronics, Park Circus'' for your father''s birthday. However, it stopped working within three days. Write a letter of complaint to the Store Manager requesting an immediate replacement or full refund. Mention the bill date and cash memo number.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'defective-commercial-goods-electronics'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Damaged Sports Goods Received by School', 'You are Rahul / Sneha, Sports Captain of Model Public School, Delhi. Your school recently ordered 10 cricket bats and 15 footballs from ''M/s National Sports Goods, Chandni Chowk''. Upon unboxing, you found 2 bats cracked and 3 footballs damaged. Write a letter of complaint to the Sales Manager requesting prompt replacement.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'defective-commercial-goods-electronics'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Defective Laptop / Desktop Computer', 'You are Kabir / Ananya, residing at 45, Salt Lake, Kolkata. You bought a desktop computer from ''Tech Solutions, E-Mall'' two weeks ago. The monitor screen keeps flickering, and the CPU shuts down unexpectedly. Write a letter of complaint to the Customer Support Manager requesting repair under warranty.', 100, 6, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'defective-commercial-goods-electronics'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'defective-books-educational-supplies', 'Defective Books & Educational Supplies', 1
FROM writing_practice_category WHERE slug = 'letter-of-complaint-official-commercial'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Misprinted / Damaged Textbooks', 'You are Vikas / Sunita, studying in Class 7 at Kendriya Vidyalaya. You bought a set of NCERT textbooks from ''Standard Book Depot, College Street, Kolkata''. Several pages in the Science and Mathematics books are missing or misprinted. Write a letter of complaint to the Proprietor asking for a replacement.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'defective-books-educational-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Faulty Scientific Calculator / Stationery Items', 'You are Dev / Priya, living at 88, Civil Lines, Jaipur. You ordered a set of mathematical drawing instruments and scientific calculators online from ''Student Needs Store''. The box arrived with a broken protractor and a malfunctioning calculator. Write a letter of complaint to the Customer Care Cell demanding replacement.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'defective-books-educational-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'civic-municipal-complaints-official', 'Civic & Municipal Complaints (Official)', 2
FROM writing_practice_category WHERE slug = 'letter-of-complaint-official-commercial'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Non-Functioning Streetlights in the Locality', 'You are Aarav / Tanvi, residing at Block C, Lake Gardens, Kolkata. Most of the streetlights on your main road have been out of order for over two weeks, making the area unsafe at night. Write an official letter of complaint to the Executive Engineer, Electricity Board / Municipal Corporation, requesting urgent repair.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'civic-municipal-complaints-official'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Irregular Water Supply / Contaminated Water', 'You are Sameer / Diya, living at 56, Green Park Colony, New Delhi. Your locality has been receiving muddy, contaminated tap water for the past four days, creating health risks for residents. Write an official letter of complaint to the Chief Engineer, Delhi Jal Board / Municipal Water Department, demanding immediate corrective measures.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'civic-municipal-complaints-official'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Overflowing Sewage and Blocked Drains', 'You are Vikram / Meera, a resident of 23, Model Town, Chandigarh. The open sewage drains in your neighborhood are blocked and overflowing onto the street, emitting a foul odor and breeding mosquitoes. Write an official letter of complaint to the Health Officer, Municipal Corporation.', 100, 6, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'civic-municipal-complaints-official'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'poor-service-transportation-grievances', 'Poor Service & Transportation Grievances', 3
FROM writing_practice_category WHERE slug = 'letter-of-complaint-official-commercial'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Poor Service at a Local Restaurant / Catering Event', 'You are Sarthak / Pooja, residing at 102, Dumdum Road, Kolkata. You booked a catering service from ''Royal Caterers'' for a family dinner. The food was delivered two hours late, cold, and missing two dishes from the agreed menu. Write a letter of complaint to the Proprietor requesting a partial refund.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'poor-service-transportation-grievances'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Negligent Bus Service / Overcharging by School Bus Operator', 'You are Aditya / Neha, a student of Class 8 living in Vasant Kunj, Delhi. The private transport driver carrying students to school consistently drives rashly and picks up unauthorized passengers. Write a formal letter of complaint to the School Transport In-Charge / Principal requesting strict disciplinary action.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-complaint-official-commercial' AND sc.slug = 'poor-service-transportation-grievances'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('letter-of-inquiry', 'Letter of Inquiry', NULL, 'A formal letter seeking detailed information about courses, coaching classes, travel packages, hostel facilities, or product catalogs.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date."},{"label":"Recipient & Subject","guidance":"Address The Director/Manager/Administrative Officer and the institute/company/agency, with a one-line Subject."},{"label":"Salutation & Reference","guidance":"Begin ''Sir / Madam,'' and reference the advertisement or reason you are inquiring."},{"label":"State Your Purpose","guidance":"Say who you are (e.g. a Class 8 student) and what program/product you''re interested in."},{"label":"Numbered Questions","guidance":"List the specific details you need: duration/timings, fees and payment mode, eligibility, and availability of material/certificates."},{"label":"Closing","guidance":"Request a brochure/prospectus and an early response, then close ''Yours faithfully,'' with your name."}]'::jsonb, 100, 6, 6)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'educational-courses-workshops-summer-camps', 'Educational Courses, Workshops & Summer Camps', 0
FROM writing_practice_category WHERE slug = 'letter-of-inquiry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inquiry About a Summer Coding / Robotics Workshop', 'You are Rohan / Riya, residing at 12-A, Park Street, Kolkata. You saw an advertisement for a "Young Coders Summer Workshop" conducted by TechKidz Academy, Salt Lake. Write a letter to the Director inquiring about the course duration, eligibility, batch timings, fee structure, and certification provided.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'educational-courses-workshops-summer-camps'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inquiry About Foreign Language Classes', 'You are Aarav / Ananya, living at 45, Green Park, New Delhi. You wish to learn basic French during your upcoming vacation. Write a letter to the Administrative Officer at Alliance Française / Indo-French Language Institute asking for details regarding beginner weekend batches, total fees, course material, and mode of teaching (online/offline).', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'educational-courses-workshops-summer-camps'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Inquiry About Art & Craft / Creative Writing Classes', 'You are Kabir / Sneha, residing at Block C, Dumdum Road, Kolkata. You are interested in joining an "Advanced Art & Illustration Course" during the summer break. Write a letter of inquiry to the Director of Srijan Art Academy asking about batch sizes, fee structure, material costs, and timings for Class 8 students.', 100, 6, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'educational-courses-workshops-summer-camps'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'sports-academies-fitness-programs', 'Sports Academies & Fitness Programs', 1
FROM writing_practice_category WHERE slug = 'letter-of-inquiry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inquiry About Joining a Swimming Club', 'You are Vikas / Sunita, a student of Class 7 living at 88, MG Road, Bengaluru. You want to join the summer swimming coaching camp organized by YMCA Sports Complex. Write a letter to the Sports Secretary inquiring about membership fees, slot availability for junior swimmers, coach credentials, and safety measures.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'sports-academies-fitness-programs'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inquiry About a Cricket Academy Admission', 'You are Dev / Priya, living at 23, Civil Lines, Jaipur. You aspire to join the National Cricket Academy''s weekend training program. Write a letter to the Chief Coach asking about admission requirements, trial dates, coaching fees, uniform details, and practice timings.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'sports-academies-fitness-programs'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'tours-travel-excursions', 'Tours, Travel & Excursions', 2
FROM writing_practice_category WHERE slug = 'letter-of-inquiry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inquiry About an Educational School Tour Package', 'You are Rahul / Ananya, Sports Secretary / Student Coordinator of Model Public School, Kolkata. Your school is planning a 3-day educational tour to Science City and Sundarbans for 50 students of Class 8. Write a letter to the Manager of Globe Travel Agency inquiring about travel packages, per-head costs, lodging options, food arrangements, and student discounts.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'tours-travel-excursions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inquiry About Family Summer Resort Booking', 'You are Sameer / Diya, residing at 56, Lake Gardens, Kolkata. Your family plans to visit Darjeeling for 5 days in May. Write a letter to the Manager of Pine Ridge Hill Resort, Darjeeling inquiring about room tariffs, availability of family suites, complimentary breakfast, and sightseeing arrangements.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'tours-travel-excursions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'commercial-catalogs-discounts-equipment', 'Commercial Catalogs, Discounts & Equipment', 3
FROM writing_practice_category WHERE slug = 'letter-of-inquiry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inquiry About Bulk Book Supply for School Library', 'You are Vikram / Meera, Student Librarian of City High School, Delhi. Your school intends to purchase storybooks, reference encyclopedias, and science journals in bulk. Write a letter to the Manager of Standard Book Depot, College Street asking for a latest catalog, bulk discount rates, delivery charges, and terms of payment.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'commercial-catalogs-discounts-equipment'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inquiry About Purchasing Sports Equipment', 'You are Sarthak / Pooja, Sports Captain of Heritage Academy, Pune. You plan to order sports kit items (badminton rackets, footballs, and table tennis sets) for your school sports club. Write a letter to M/s Champion Sports Goods asking for a product price list, warranty terms, and discounts for educational institutions.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'commercial-catalogs-discounts-equipment'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'competitions-scholarship-exams', 'Competitions & Scholarship Exams', 4
FROM writing_practice_category WHERE slug = 'letter-of-inquiry'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inquiry About National Science Talent Exam', 'You are Aditya / Neha, a student of Class 8 living at 67, Vasant Kunj, New Delhi. You want to participate in the upcoming National Science Olympiad / Talent Search Examination. Write a letter to the Examination Controller of the organizing body inquiring about registration deadlines, examination syllabus, sample paper availability, and entry fees.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-of-inquiry' AND sc.slug = 'competitions-scholarship-exams'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('placing-an-order', 'Placing an Order', 'School Club Purchases', 'A commercial formal letter written to purchase goods such as books, sports equipment, lab apparatus, or furniture for a school club.', '[{"label":"Sender''s Address & Date","guidance":"Write your school/club address at the top left, followed by the date."},{"label":"Recipient & Subject","guidance":"Address The Sales Manager/Proprietor and the store/firm name, with a one-line Subject naming the item category."},{"label":"Opening","guidance":"Begin ''Sir / Madam,'' and state you are placing an order for the items listed below."},{"label":"Itemized Table","guidance":"List each item with S.No., Item Name, Brand, and Quantity in a simple table."},{"label":"Terms & Conditions","guidance":"State expectations for condition, any agreed discount, delivery timeframe, and payment mode."},{"label":"Closing","guidance":"Close ''Yours faithfully,'' with your name and designation/class."}]'::jsonb, 100, 6, 7)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'sports-equipment-games', 'Sports Equipment & Games', 0
FROM writing_practice_category WHERE slug = 'placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Sports Equipment for School Club', 'You are Rohan / Riya, Sports Captain of St. Xavier''s School, Kolkata. Write a letter to the Sales Manager of M/s Champion Sports Goods, MG Road, Kolkata, placing an order for cricket bats, footballs, badminton rackets, and shuttlecocks required for the upcoming annual sports meet. Request an institutional discount and safe delivery.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'sports-equipment-games'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Table Tennis & Indoor Games Kit', 'You are Aarav / Ananya, Secretary of the Indoor Games Club, Modern Public School, Delhi. Write a letter to M/s Grand Games & Sports, Chandni Chowk, Delhi, placing an order for table tennis boards, balls, chess sets, and carrom boards. Mention payment terms and delivery dates.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'sports-equipment-games'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'books-stationary-library-supplies', 'Books, Stationary & Library Supplies', 1
FROM writing_practice_category WHERE slug = 'placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Storybooks for School Library', 'You are Kabir / Sneha, Student Librarian of Heritage Academy, Dumdum. Write a letter to M/s National Book Store, College Street, Kolkata, placing a bulk order for fiction storybooks, dictionaries, and encyclopedias for the junior school library. Specify titles, quantities, and discount expectations.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'books-stationary-library-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Art & Craft Material for Science & Art Club', 'You are Vikas / Sunita, Art Secretary of City High School, Salt Lake. Write a letter to M/s Craft World Supplies, Park Street, Kolkata, placing an order for acrylic paints, drawing canvases, sketch pens, and display boards for the annual art exhibition.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'books-stationary-library-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'musical-instruments-cultural-gear', 'Musical Instruments & Cultural Gear', 2
FROM writing_practice_category WHERE slug = 'placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Musical Instruments for Music Room', 'You are Dev / Priya, Music Club In-charge at Army Public School, Pune. Write a letter to M/s Melody Music Store, FC Road, Pune, placing an order for acoustic guitars, keyboards, harmoniums, and tabla sets for the school music department. Request safe packaging and prompt delivery.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'musical-instruments-cultural-gear'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Costumes & Props for Dramatics Society', 'You are Rahul / Tanvi, Cultural Secretary of Ryan International School, Jaipur. Write a letter to M/s Rangmanch Costume House, MI Road, Jaipur, placing an order for traditional dance costumes, masks, and stage props for the annual play.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'musical-instruments-cultural-gear'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'lab-classroom-supplies', 'Lab & Classroom Supplies', 3
FROM writing_practice_category WHERE slug = 'placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Science Lab Apparatus & Glassware', 'You are Sameer / Diya, Student Lab Assistant at National English School, Kolkata. Write a letter to M/s Scientific Glassware & Co., Barasat, placing an order for test tubes, measuring cylinders, magnifying glasses, and microscopes for the middle school science laboratory.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'lab-classroom-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Classroom Furniture & Whiteboards', 'You are Vikram / Meera, Head Boy / Head Girl of Model High School, Bengaluru. Write a letter to M/s Imperial Office & School Furniture, Indiranagar, Bengaluru, placing an order for student desks, whiteboards, and display cork boards for the newly constructed classrooms.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'lab-classroom-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'uniforms-badges-event-essentials', 'Uniforms, Badges & Event Essentials', 4
FROM writing_practice_category WHERE slug = 'placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'House Badges and Medals for Sports Day', 'You are Sarthak / Pooja, Event Coordinator at DAV Public School, Chandigarh. Write a letter to M/s Trophy & Badge House, Sector 17, Chandigarh, placing an order for house prefect badges, victory medals, and trophies for the annual prize distribution ceremony.', 100, 6, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'uniforms-badges-event-essentials'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'School Uniforms & Sports Tracksuits', 'You are Aditya / Neha, Student Representative of Green Valley School, Vasant Kunj, Delhi. Write a letter to M/s Dresswell Uniform Tailors, Karol Bagh, Delhi, placing an order for tracksuits, caps, and sports shoes for the school athletic team participating in the zonal sports meet.', 100, 6, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'placing-an-order' AND sc.slug = 'uniforms-badges-event-essentials'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('analytical-paragraph', 'Analytical Paragraph', NULL, 'An Analytical Paragraph interprets data from a chart, graph, table, or visual prompt, summarizing trends and comparisons objectively without personal opinion.', '[{"label":"Introductory Sentence","guidance":"Introduce the source and topic of the chart/table, e.g. ''The given pie chart illustrates the distribution of...''."},{"label":"Highlight Extremes","guidance":"Point out the highest and lowest values, e.g. ''A staggering 45% of students...''."},{"label":"Compare & Group","guidance":"Compare contrasting figures (''In sharp contrast, only 10%...'') and group similar percentages/trends together."},{"label":"Concluding Sentence","guidance":"Summarize the main takeaway or trend in one sentence, without introducing personal opinions."}]'::jsonb, 100, 5, 8)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'student-habits-daily-routines', 'Student Habits & Daily Routines', 0
FROM writing_practice_category WHERE slug = 'analytical-paragraph'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Daily Screen Time vs. Physical Activity', 'Below is data collected from a survey of 200 middle-school students regarding their daily free-time distribution: Playing Video Games / Smartphone: 40%. Watching Television / OTT: 25%. Outdoor Sports & Exercise: 15%. Reading Books / Creative Hobbies: 10%. Socializing with Family / Friends: 10%. Write an analytical paragraph in 80–100 words summarizing the main trends, comparing screen-based vs. physical activities, and drawing a conclusion.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'student-habits-daily-routines'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Modes of Transportation Used by School Students', 'A survey conducted at a local high school recorded how students travel to school daily: School Bus: 45%. Bicycles: 25%. Private Cars / Scooters (Parents): 20%. Walking: 10%. Write an analytical paragraph in 80–100 words analyzing the data to highlight the dominant modes of transit and environmental considerations.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'student-habits-daily-routines'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'food-health-preferences', 'Food & Health Preferences', 1
FROM writing_practice_category WHERE slug = 'analytical-paragraph'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Dietary Choices at the School Canteen', 'The following table shows the weekly sales distribution of food items at a school canteen: Junk Food & Fried Snacks (Samosas, Chips): 45%. Aerated / Carbonated Drinks: 25%. Fresh Fruit Juices & Milkshakes: 18%. Healthy Meals (Sandwiches, Fruit Bowl): 12%. Write an analytical paragraph in 80–100 words interpreting the consumption patterns and contrasting healthy versus unhealthy choices among students.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'food-health-preferences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Water Consumption Patterns in Residential Neighborhoods', 'Study the breakdown of daily household water usage in an urban residential housing society: Bathing & Hygiene: 35%. Washing Clothes & Dishes: 30%. Toilet Flushing: 20%. Cooking & Drinking: 10%. Gardening & Car Washing: 5%. Write an analytical paragraph in 80–100 words summarizing where water is consumed most and emphasizing potential areas for conservation.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'food-health-preferences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'academic-co-curricular-choices', 'Academic & Co-Curricular Choices', 2
FROM writing_practice_category WHERE slug = 'analytical-paragraph'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Student Enrollment in After-School Clubs', 'The pie chart data below shows enrollment preferences among Class 7 students for co-curricular clubs: Robotics & STEM Club: 35%. Art & Craft Club: 25%. Music & Drama Club: 20%. Eco & Gardening Club: 12%. Literary & Debate Club: 8%. Write an analytical paragraph in 80–100 words analyzing the popularity of technical versus creative and environmental clubs.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'academic-co-curricular-choices'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Preferred Reading Genres Among Middle Schoolers', 'A survey carried out in a school library revealed the following reading preferences for Class 6 vs Class 8 students: Comics & Graphic Novels: 50% vs 20%. Mystery & Adventure Fiction: 30% vs 45%. Science & General Knowledge: 15% vs 25%. Biographies & History: 5% vs 10%. Write an analytical paragraph in 80–100 words comparing how reading choices evolve between Class 6 and Class 8.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'academic-co-curricular-choices'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environmental-public-issues', 'Environmental & Public Issues', 3
FROM writing_practice_category WHERE slug = 'analytical-paragraph'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Types of Household Solid Waste Generated Daily', 'The waste audit of an urban neighborhood revealed the following composition of garbage: Organic / Kitchen Waste: 50%. Single-Use Plastics & Packaging: 30%. Paper & Cardboard: 12%. Glass & Metal: 5%. E-Waste & Hazardous Items: 3%. Write an analytical paragraph in 80–100 words highlighting the major waste components and the scope for composting and recycling.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'environmental-public-issues'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Public Park Usage by Different Age Groups', 'A local municipal survey tracked park visitor frequency during weekends: Senior Citizens (Morning Walkers): 40%. Children below 12 years (Playground): 30%. Teenagers & Young Adults (Sports): 20%. Working Professionals: 10%. Write an analytical paragraph in 80–100 words summarizing park utilization across demographics.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'environmental-public-issues'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'consumer-trends-technology-usage', 'Consumer Trends & Technology Usage', 4
FROM writing_practice_category WHERE slug = 'analytical-paragraph'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Primary Devices Used for Online Learning', 'Data recorded during a survey on digital devices used by students for home study shows: Smartphones: 55%. Laptops / Desktop PCs: 30%. Tablets: 15%. Write an analytical paragraph in 80–100 words analyzing device accessibility and ease of learning among students.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'consumer-trends-technology-usage'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Preferred Celebration Activities for Festival Seasons', 'Survey results on how families plan to celebrate upcoming festivals: Eco-Friendly / Green Celebrations at Home: 45%. Traveling / Outstation Vacations: 25%. Shopping & Dining Out: 20%. Community / Club Events: 10%. Write an analytical paragraph in 80–100 words highlighting the trend toward eco-conscious celebrations compared to commercial activities.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'analytical-paragraph' AND sc.slug = 'consumer-trends-technology-usage'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('descriptive-paragraph-person-event-cue', 'Descriptive Paragraph (Person / Event / Cue)', 'Set 1 — Cue-Based', 'A Descriptive Paragraph vividly describes a person, place, event, or experience using sensory details, adjectives, and factual cues.', '[{"label":"Opening Sentence","guidance":"State clearly who, what, or where you are describing."},{"label":"Sensory & Adjectival Details","guidance":"Use vivid adjectives and sensory language covering sight, sound, smell, and touch."},{"label":"Logical Flow","guidance":"For a person: appearance → mannerisms → character traits → impact. For an event: setting → sights/sounds → key highlights → final impression."},{"label":"Concluding Sentence","guidance":"Summarize your overall feeling or impression in one line."}]'::jsonb, 100, 5, 9)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-people-personalities', 'Describing People & Personalities', 0
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-cue'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Describing Your Favorite School Teacher', 'Write a descriptive paragraph in 80–100 words about your favorite teacher based on the following cues: Appearance: Neat attire, warm smile, calm demeanor. Teaching Style: Interactive, uses real-life examples and stories, encourages questions. Key Qualities: Patient, treats all students equally, strict when necessary. Impact: Inspires students to love the subject and build confidence.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-people-personalities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Describing a Local Artisan or Street Craftsman', 'Based on the cues given below, write a descriptive paragraph in 80–100 words describing a traditional potter at work in your neighborhood: Setting: Small outdoor stall, surrounded by wet clay mounds and terracotta pots. Appearance: Weather-beaten face, calloused hands, clay-stained apron. Process: Spinning the potter''s wheel effortlessly, shaping raw clay with delicate fingers, sun-drying finished pots. Impression: Dedication to an ancient craft, artistic skill, quiet pride in work.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-people-personalities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Describing Your Grandparent', 'Write a descriptive paragraph in 80–100 words about your grandfather or grandmother using these visual and character cues: Physical Features: Silver hair, gentle eyes, wrinkled face that lightens up with a smile. Daily Routine: Early riser, spends time gardening, reading newspapers, taking evening walks. Personality: Full of wisdom, tells fascinating childhood stories, patient listener. Emotional Connection: A source of comfort, warmth, and unconditional love.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-people-personalities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-events-celebrations', 'Describing Events & Celebrations', 1
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-cue'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The School Annual Sports Day', 'Write a descriptive paragraph in 80–100 words describing your school''s Annual Sports Day based on the following cues: Atmosphere: Colorful flags, house tents, cheering crowds, brisk morning air. Activities: March-past by house contingents, 100m sprint, relay races, tug-of-war. Key Moments: Tight finish in the relay race, loud applause from parents and teachers. Conclusion: Prize distribution ceremony, national anthem, feelings of team spirit and joy.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-events-celebrations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Local Craft Mela / Street Fair', 'Describe a bustling handicraft exhibition or village mela you visited recently in 80–100 words using these cues: Visuals & Sounds: Brightly decorated stalls, colorful textiles, aroma of street food, laughter and music. Attractions: Stalls selling wooden toys, pottery, handwoven sarees; giant Ferris wheel. Crowd: Families, children buying balloons, artisans demonstrating their crafts. Overall Experience: Vibrant celebration of culture, art, and community joy.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-events-celebrations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'A Rainstorm on a Hot Summer Afternoon', 'Write a descriptive paragraph in 80–100 words describing the sudden arrival of a monsoon rainstorm after a scorching summer day: Before the Storm: Dark heavy clouds gathering, gusty wind swaying trees, smell of wet earth (petrichor). During the Rain: Heavy downpour, water gushing down gutters, children running out to splash in puddles. Aftermath: Cool breeze, washed green trees, sense of relief from suffocating heat.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-events-celebrations'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-places-scenarios-experiences', 'Describing Places, Scenarios & Experiences', 2
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-cue'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'A Visit to a Bustling Fish & Vegetable Market', 'Based on the given cues, write a descriptive paragraph in 80–100 words describing a local morning market: Sights & Sounds: Vendors shouting prices, mountains of fresh green vegetables and fish on ice, shoppers bargaining. Sensory Details: Smell of fresh coriander and fish, chatter of crowds, clattering of scales. Activity: Continuous movement, quick transactions, vibrant chaotic energy.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-places-scenarios-experiences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Peaceful Morning in a Public Park', 'Write a descriptive paragraph in 80–100 words describing an early morning scene at a nearby park: Environment: Dew-drops on fresh grass, chirping of birds, soft golden sunlight filtering through leaves. People Around: Elderly citizens practicing yoga, joggers on the track, children playing on swings. Atmosphere: Tranquil, refreshing, filled with clean morning breeze and positive energy.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'describing-places-scenarios-experiences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'picture-cue-based-narratives', 'Picture & Cue-Based Narratives', 3
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-cue'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'An Act of Community Cleanliness (Swachh Bharat Cue)', 'Write a descriptive paragraph in 80–100 words based on a visual prompt showing a group of school students cleaning a neighborhood park: Action: Students wearing gloves, holding broomsticks, collecting plastic waste and dry leaves. Cooperation: Working together in pairs, filling garbage bags, painting park benches. Result: Transformation of a dirty littered spot into a clean, green garden space. Message: Civic responsibility, joy of collective teamwork.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'picture-cue-based-narratives'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Day at an Old Age Home (Social Service Cue)', 'Write a descriptive paragraph in 80–100 words describing a school field trip to a senior citizens'' care facility: Setting: Quiet, well-kept courtyard with gardens and peaceful sitting areas. Interactions: Students chatting with elderly residents, sharing sweets, playing board games, singing songs. Emotions: Bright smiles on glowing faces, tears of joy, valuable life lessons learned by students.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-cue' AND sc.slug = 'picture-cue-based-narratives'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('informal-letter', 'Informal Letter', NULL, 'An Informal Letter is a personal, conversational, warm letter written to close family members, relatives, or friends.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date."},{"label":"Salutation","guidance":"Begin ''Dear [Name],'' followed by a friendly opening line asking after them."},{"label":"Body Paragraph 1 — Main Reason","guidance":"Express the main news, invitation, or purpose clearly."},{"label":"Body Paragraph 2 — Personal Touch","guidance":"Add details, feelings, advice, or description as needed."},{"label":"Closing","guidance":"Send regards to their family, then close ''Your lovingly / Yours affectionately,'' with your first name."}]'::jsonb, 100, 5, 10)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'letters-to-friends-advice-invitations-news', 'Letters to Friends (Advice, Invitations & News)', 0
FROM writing_practice_category WHERE slug = 'informal-letter'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Inviting a Friend to Your Birthday Party / Family Function', 'You are Ayan / Ananya living at 15, Lake Road, Kolkata. Write a letter to your close friend, Rahul, inviting him to attend your 13th birthday celebration at your residence. Mention the date, time, special arrangements, and games planned.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-friends-advice-invitations-news'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Advising a Friend to Reduce Screen Time', 'You are Kabir / Sneha residing at 42, Vasant Vihar, New Delhi. You noticed that your friend, Rohan, spends excessive time playing online mobile games. Write a letter advising him on the harms of screen addiction and suggesting outdoor sports and reading instead.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-friends-advice-invitations-news'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Describing a Vacation / School Trip Experience', 'You are Dev / Riya living at 88, Park Street, Kolkata. You recently returned from a 3-day school educational trip to the Sundarbans / Darjeeling. Write a letter to your friend describing the sights you saw, the adventure, and how much you missed their presence.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-friends-advice-invitations-news'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 4, 'Congratulating a Friend on Academic / Sports Success', 'You are Aarav / Pooja living at 23, Civil Lines, Jaipur. Your friend, Sarthak, secured first place in the Regional Science Olympiad. Write a letter congratulating him on his achievement and appreciating his hard work.', 100, 5, 3
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-friends-advice-invitations-news'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'letters-to-siblings-guidance-encouragement', 'Letters to Siblings (Guidance & Encouragement)', 1
FROM writing_practice_category WHERE slug = 'informal-letter'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Advising a Younger Sibling to Focus on Health & Studies', 'You are Rohan / Tanvi staying in a hostel at St. Xavier''s School, Darjeeling. Write a letter to your younger brother/sister advising them to manage their time wisely between exam preparation, balanced diet, and adequate sleep.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-siblings-guidance-encouragement'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Encouraging a Brother/Sister After a Setback', 'You are Vikram / Meera staying in Bengaluru. Your younger sister felt disheartened after not winning a prize in the school debate competition. Write an encouraging letter highlighting the importance of participation and learning from mistakes.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-siblings-guidance-encouragement'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'letters-to-parents-grandparents', 'Letters to Parents & Grandparents (Sharing Updates & Affection)', 2
FROM writing_practice_category WHERE slug = 'informal-letter'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Letter from Hostel to Parents Requesting Books / Permission', 'You are Sameer / Diya studying at Residential Public School, Dehradun. Write a letter to your parents updating them on your studies, hostel routine, and requesting permission (and funds) to join an upcoming educational tour organized by the school.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-parents-grandparents'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Expressing Gratitude / Birthday Wishes to Grandparents', 'You are Sarthak / Neha living at 56, MG Road, Pune. Your grandmother''s 70th birthday is approaching, but you are unable to visit her due to upcoming unit tests. Write a letter wishing her a happy birthday, expressing your love, and promising to visit soon.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'letters-to-parents-grandparents'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'special-occasions-festivals', 'Special Occasions & Festivals', 3
FROM writing_practice_category WHERE slug = 'informal-letter'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Describing How You Celebrated a Festival', 'You are Aditya / Riya living at Block C, Dumdum, Kolkata. Write a letter to your cousin living in Mumbai describing how you celebrated Durga Puja / Diwali with family, detailing the food, lights, family gatherings, and eco-friendly festivities.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'special-occasions-festivals'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Inviting a Cousin to Spend Summer Vacation Together', 'You are Vikas / Sunita residing at 12, Salt Lake, Kolkata. Write a letter to your cousin inviting them to visit your town during the upcoming summer holidays to join a coding workshop and explore local sight-seeing spots together.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'informal-letter' AND sc.slug = 'special-occasions-festivals'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('formal-letter-school-authorities', 'Formal Letter (School Authorities / Principals)', NULL, 'A formal letter to the Principal, Headmaster, or Class Teacher for official requests, leaves, permissions, or complaints within the school environment.', '[{"label":"Recipient & Date","guidance":"Address The Principal/Class Teacher and school name, followed by the date."},{"label":"Subject","guidance":"Give a short, clear Subject line stating the purpose of the letter."},{"label":"Salutation & Introduction","guidance":"Begin ''Respected Sir / Madam,'' then introduce yourself: name, class/section, roll number."},{"label":"Body Paragraph 1 — Purpose","guidance":"State the exact purpose of the letter clearly."},{"label":"Body Paragraph 2 — Details","guidance":"Provide necessary details — dates, reasons, enclosures, or assurances about missed classwork."},{"label":"Closing","guidance":"Request the favour graciously, then close ''Yours obediently / Yours faithfully,'' with your full name, class, and roll number."}]'::jsonb, 100, 5, 11)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'applications-for-leave-absence', 'Applications for Leave & Absence', 0
FROM writing_practice_category WHERE slug = 'formal-letter-school-authorities'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Leave Application Due to Illness', 'You are Rohan / Riya, a student of Class 7-A at St. Xavier''s School, Kolkata. You have been suffering from high fever and doctor has advised three days of complete bed rest. Write a letter to your Principal requesting leave of absence for three days. Mention the medical certificate attached.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'applications-for-leave-absence'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Leave Application for Attending a Family Function', 'You are Aarav / Ananya, studying in Class 6-C at Modern Public School, Delhi. Your elder sister is getting married in your native town next week. Write an application to your Principal requesting four days of leave to attend the wedding ceremonies.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'applications-for-leave-absence'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Application for Leave Due to Urgent Domestic Work', 'You are Kabir / Sneha, a student of Class 8-B at Kendriya Vidyalaya, Salt Lake. Due to a sudden family emergency at home, you will not be able to attend school tomorrow. Write a letter to your Class Teacher requesting one day leave of absence.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'applications-for-leave-absence'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'requests-for-facilities-fee-concessions', 'Requests for Facilities & Fee Concessions', 1
FROM writing_practice_category WHERE slug = 'formal-letter-school-authorities'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Request for Full / Partial Fee Concession', 'You are Vikas / Sunita, a hardworking student of Class 8-A at City High School, Kolkata. Your father has recently suffered a major business setback and is finding it difficult to pay your school fees. Write an application to the Principal requesting a full fee concession on merit-cum-means grounds.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'requests-for-facilities-fee-concessions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Request to Issue a Character / Transfer Certificate', 'You are Dev / Priya, studying in Class 7-B at Army Public School, Pune. Your father, a defense officer, has been transferred to Jaipur. Write a formal letter to your Principal requesting the issuance of your Transfer Certificate (TC) and Character Certificate at the earliest.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'requests-for-facilities-fee-concessions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Request to Arrange Remedial / Extra Classes', 'You are Rahul / Tanvi, Class Monitor of Class 8-C at DAV Public School, Chandigarh. Due to the recent illness of your Mathematics teacher, several chapters remain incomplete before the upcoming terminal examination. Write a letter to your Principal requesting special remedial classes for Math.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'requests-for-facilities-fee-concessions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'permissions-for-events-activities', 'Permissions for Events & Activities', 2
FROM writing_practice_category WHERE slug = 'formal-letter-school-authorities'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Permission to Organize a Charity / Donation Drive', 'You are Sameer / Diya, President of the Social Service Club at Heritage Academy, Dumdum. Your club wishes to organize a "Book and Old Clothes Donation Drive" on campus to help local underprivileged children. Write a letter to your Principal seeking formal permission and allotment of a space for collecting donations.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'permissions-for-events-activities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Permission to Participate in an Inter-School Competition', 'You are Sarthak / Pooja, a student of Class 7-A at National English School, Kolkata. You have been selected to represent your school at the State Level Inter-School Chess Tournament occurring on a working day. Write an application to your Principal requesting permission to participate and grant duty leave.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'permissions-for-events-activities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-facility-environment-improvement', 'School Facility & Environment Improvement', 3
FROM writing_practice_category WHERE slug = 'formal-letter-school-authorities'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Request for Improving Canteen Hygiene / Food Quality', 'You are Aditya / Neha, Student Prefect of Class 8-A at Green Valley School, Vasant Kunj, Delhi. Many students have complained about unhygienic conditions and unhealthy food choices in the school canteen. Write a formal letter to your Principal requesting an inspection and inclusion of healthy food options.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'school-facility-environment-improvement'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Request for Purchasing New Books for the Junior Library', 'You are Vikram / Meera, Student Library Monitor of Class 6-B at Model High School, Bengaluru. The school library currently lacks updated general knowledge books and popular children''s fiction storybooks. Write a letter to your Principal requesting the purchase of new books for middle school students.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'formal-letter-school-authorities' AND sc.slug = 'school-facility-environment-improvement'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('letter-to-the-editor-civic-social-issues', 'Letter to the Editor', 'Civic & Social Issues', 'A formal letter to a newspaper editor raising public awareness of local civic, environmental, and social problems.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date below it."},{"label":"Editor''s Address & Subject","guidance":"Address it to ''The Editor'', name of the newspaper, and city — then a one-line Subject stating the issue."},{"label":"Salutation","guidance":"Begin with ''Sir / Madam,''."},{"label":"Body Paragraph 1 — Describe the Issue","guidance":"Describe the issue clearly — the location and nature of the problem."},{"label":"Body Paragraph 2 — Consequences","guidance":"Mention consequences: health risks, safety hazards, or inconvenience caused."},{"label":"Body Paragraph 3 — Suggested Action","guidance":"Suggest practical measures or request prompt action by the authorities."},{"label":"Closing","guidance":"End with a hopeful closing line, ''Yours sincerely,'' and your full name."}]'::jsonb, 100, 5, 12)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environmental-protection-sanitation', 'Environmental Protection & Sanitation', 0
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-civic-social-issues'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Open Dumping of Plastic Waste Near School Zones', 'You are Rohan / Riya, residing at 12-A, Park Street, Kolkata. Unchecked plastic waste and uncollected garbage piles outside local school gates create severe health risks and foul odors. Write a letter to the Editor of The Telegraph highlighting the health hazards and demanding regular municipal cleaning.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'environmental-protection-sanitation'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Indiscriminate Felling of Trees for Urban Expansion', 'You are Aarav / Ananya, living at 45, Green Park Colony, New Delhi. Old trees along neighborhood roads are being cut down rapidly for widening streets, reducing local green cover and bird habitats. Write a letter to the Editor of The Times of India advocating urban tree plantation drives and stricter conservation laws.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'environmental-protection-sanitation'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Industrial Effluents and Water Pollution in Local Rivers', 'You are Kabir / Sneha, residing near Dumdum, Kolkata. Nearby small-scale workshops and factories dump untreated chemical waste into local canals and water bodies. Write a letter to the Editor of The Statesman urging environmental authorities to enforce pollution control standards.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'environmental-protection-sanitation'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'public-safety-traffic-safety', 'Public Safety & Traffic Safety', 1
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-civic-social-issues'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Open Potholes and Waterlogging During Monsoons', 'You are Vikas / Sunita, a resident of 88, MG Road, Bengaluru. Potholes filled with rainwater during the monsoon season cause frequent traffic jams and motorcycle accidents. Write a letter to the Editor of The Deccan Herald appealing to the Public Works Department for urgent road repairs.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'public-safety-traffic-safety'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Rash Driving and Over-Speeding Near Residential Areas', 'You are Dev / Priya, living at 23, Civil Lines, Jaipur. Over-speeding commercial vehicles and reckless driving during evening hours pose severe threats to elderly walkers and children. Write a letter to the Editor of a local daily suggesting speed breakers, traffic signals, and police patrolling.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'public-safety-traffic-safety'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Non-Functioning Streetlights and Rising Nighttime Crime', 'You are Rahul / Tanvi, residing at Block C, Salt Lake, Kolkata. Pitch-dark streets due to broken streetlights encourage theft and make night commutes unsafe for women and children. Write a letter to the Editor of The Indian Express demanding immediate streetlight maintenance.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'public-safety-traffic-safety'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'health-hygiene-public-utilities', 'Health, Hygiene & Public Utilities', 2
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-civic-social-issues'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Contaminated Tap Water Supply in Residential Blocks', 'You are Sameer / Diya, living at 56, Model Town, Chandigarh. Residents in your area have been receiving muddy, foul-smelling tap water, leading to cases of waterborne diseases. Write a letter to the Editor of The Tribune requesting the Municipal Water Board to inspect and filter the water supply.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'health-hygiene-public-utilities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Stray Dog Menace and Lack of Animal Vaccination', 'You are Sarthak / Pooja, residing at 102, Vasant Kunj, New Delhi. An increasing population of aggressive stray dogs near local parks has led to recent dog-bite incidents among children. Write a letter to the Editor of a national daily advocating humane sterilization, vaccination drives, and proper shelter facilities.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'health-hygiene-public-utilities'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'digital-awareness-youth-well-being', 'Digital Awareness & Youth Well-being', 3
FROM writing_practice_category WHERE slug = 'letter-to-the-editor-civic-social-issues'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Loss of Outdoor Playgrounds to Commercial Encroachments', 'You are Vikram / Meera, living in Pune. Local vacant plots and parks previously used by neighborhood children for sports are being turned into illegal parking spaces and commercial stalls. Write a letter to the Editor highlighting the loss of recreational spaces for young youth.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'digital-awareness-youth-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Rise in Excessive Screen Time and Social Isolation Among Children', 'You are Aditya / Neha, a resident of Lake Gardens, Kolkata. You observe that children spend their leisure time glued to smartphones rather than interacting with peers or playing physical games. Write a letter to the Editor of a newspaper encouraging parents and schools to promote balanced digital habits and community play activities.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'letter-to-the-editor-civic-social-issues' AND sc.slug = 'digital-awareness-youth-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('official-business-letter-of-complaint', 'Official / Business Letter of Complaint', 'Corporate & Consumer Grievances', 'A formal letter to corporate management, retail stores, or administrative heads reporting damaged goods, defective electronics, or unsatisfactory customer service.', '[{"label":"Sender''s Address & Date","guidance":"Write your address at the top left, followed by the date."},{"label":"Recipient & Subject","guidance":"Address The Manager/Customer Care Officer and company/store/firm, with a Subject naming the item/service and Invoice/Cash Memo No."},{"label":"Opening","guidance":"State the item/service purchased, from where, on what date, and vide which Bill/Cash Memo No."},{"label":"Body Paragraph 1 — Defect/Deficiency","guidance":"State the exact defect, fault, or deficiency in service clearly."},{"label":"Body Paragraph 2 — Inconvenience","guidance":"Explain the inconvenience caused, referencing the warranty/receipt."},{"label":"Body Paragraph 3 — Expected Resolution","guidance":"State expected action — free repair, immediate replacement, or refund within a specific timeframe."},{"label":"Closing","guidance":"Request urgent resolution and mention enclosed bill/warranty copies, then close ''Yours faithfully,'' with your name."}]'::jsonb, 100, 5, 13)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'defective-consumer-electronics-home-appliances', 'Defective Consumer Electronics & Home Appliances', 0
FROM writing_practice_category WHERE slug = 'official-business-letter-of-complaint'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Defective Smartwatch / Electronic Gadget', 'You are Rohan / Riya, residing at 12-A, Park Street, Kolkata. You purchased a smartwatch from ''Tech Store, Park Circus'' ten days ago (Cash Memo No. TS/4501). The battery drains completely within two hours, and the touch display repeatedly freezes. Write a letter of complaint to the Store Manager requesting an immediate replacement under warranty.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-consumer-electronics-home-appliances'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Malfunctioning Water Purifier / Home Appliance', 'You are Aarav / Ananya, living at 45, Green Park, New Delhi. You bought an electric water purifier from ''Home Comfort Electronics'' three weeks ago. It has started leaking continuously and dispensing cloudy water. Write a letter of complaint to the Customer Support Manager requesting urgent home service or product replacement.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-consumer-electronics-home-appliances'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Damaged Bicycle Delivered via Online Purchase', 'You are Kabir / Sneha, residing at Block C, Dumdum, Kolkata. You ordered a multi-gear bicycle online from ''Speedster Cycles Pvt. Ltd.'' Upon unboxing the delivery package, you discovered a bent front wheel rim and deep scratches on the frame. Write an official letter of complaint to the Sales Head demanding a free replacement.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-consumer-electronics-home-appliances'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'defective-educational-goods-school-supplies', 'Defective Educational Goods & School Supplies', 1
FROM writing_practice_category WHERE slug = 'official-business-letter-of-complaint'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Misprinted & Missing Pages in School Reference Books', 'You are Vikas / Sunita, a student of Class 7 residing at 88, MG Road, Bengaluru. You bought a set of science reference books from ''Standard Book Depot, Brigade Road''. Pages 45 to 80 in the Physics section are completely blank due to a printing error. Write a letter of complaint to the Proprietor requesting a replacement copy.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-educational-goods-school-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Faulty Sports Equipment Delivered to School Club', 'You are Dev / Priya, Sports Captain of Model Public School, Jaipur. Your school ordered a bulk lot of 15 footballs and 10 badminton rackets from ''National Sports Wear''. Upon inspection, four footballs were found punctured and two racket frames warped. Write a business letter of complaint to the Sales Manager requesting prompt replacement.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-educational-goods-school-supplies'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'defective-furniture-classroom-infrastructure', 'Defective Furniture & Classroom Infrastructure', 2
FROM writing_practice_category WHERE slug = 'official-business-letter-of-complaint'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Defective Computer Desks / Study Tables', 'You are Rahul / Tanvi, living at 23, Civil Lines, Chandigarh. You bought a wooden study desk with an attached bookshelf from ''Imperial Furniture Mart''. Within a week, one of the main drawers jammed permanently and the wooden veneer began peeling off. Write a letter of complaint to the Store Manager requesting repair or exchange.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-furniture-classroom-infrastructure'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Broken Laboratory Glassware Received', 'You are Sameer / Diya, Student Science Club Coordinator at National English School, Kolkata. Your club ordered 50 glass test tubes and 20 measuring flasks from ''Precision Scientific Instruments''. Over half of the glass items arrived cracked due to poor cushioning and packaging. Write a complaint letter to the Distribution Manager demanding a fresh delivery.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'defective-furniture-classroom-infrastructure'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'unsatisfactory-commercial-public-services', 'Unsatisfactory Commercial & Public Services', 3
FROM writing_practice_category WHERE slug = 'official-business-letter-of-complaint'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Poor Catering Service at a Family Function', 'You are Sarthak / Pooja, residing at 102, Salt Lake, Kolkata. You hired ''Royal Caterers'' for your sister''s engagement dinner. The food was served over an hour late, two dishes from the agreed menu were missing, and the drinks were lukewarm. Write a letter of complaint to the Proprietor requesting a partial refund.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'unsatisfactory-commercial-public-services'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Negligent Bus Transport Service for School Commute', 'You are Vikram / Meera, residing at Vasant Kunj, New Delhi. The private school bus operator (''City Kids Transport'') repeatedly arrives 30 minutes late, over-crowds seats, and operates without a working air conditioner despite full monthly fee payments. Write an official letter of complaint to the Transport Manager requesting immediate corrective action.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'unsatisfactory-commercial-public-services'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Delayed Courier Delivery & Damaged Package', 'You are Aditya / Neha, living at 67, Model Town, Pune. You sent an urgent birthday gift parcel through ''Express Express Couriers'' to your cousin. The parcel arrived two weeks late with the outer box badly crushed and the gift inside broken. Write an official complaint letter to the Customer Grievance Officer claiming compensation for negligence.', 100, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'official-business-letter-of-complaint' AND sc.slug = 'unsatisfactory-commercial-public-services'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('commercial-letter-for-placing-an-order', 'Commercial Letter for Placing an Order', 'Supplier/Publisher Orders', 'A formal business document written to suppliers, publishers, or wholesale merchants to buy goods, books, or equipment, featuring a neat itemized order table.', '[{"label":"Sender''s Address & Date","guidance":"Write your school/club address at the top left, followed by the date."},{"label":"Recipient & Subject","guidance":"Address The Sales Manager/Manager and the firm name, with a one-line Subject."},{"label":"Opening","guidance":"State you wish to place a bulk order for the following items for the academic session."},{"label":"Itemized Table","guidance":"List each item with S.No., Item/Book Title, Author/Brand, and Quantity in a simple table."},{"label":"Delivery & Payment Terms","guidance":"State condition expectations, delivery timeframe, any agreed discount, and payment mode."},{"label":"Closing","guidance":"Close ''Yours faithfully,'' with your name and designation/role."}]'::jsonb, 100, 5, 14)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-library-books', 'School Library & Books', 0
FROM writing_practice_category WHERE slug = 'commercial-letter-for-placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Ordering Books for the School Library', 'You are Rohan / Riya, the Student Librarian of St. Xavier''s School, Kolkata. Write a letter to the Sales Manager of Oxford University Press, Park Street, Kolkata, placing a bulk order for English grammar textbooks, dictionaries, and storybooks for middle school students. Specify mode of payment and request a school discount.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'school-library-books'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ordering Science Journals & Reference Manuals', 'You are Aarav / Ananya, Secretary of the Science Club at Modern Public School, Delhi. Write a letter to the Manager of S. Chand & Company Ltd., Daryaganj, New Delhi, placing an order for science lab manuals, encyclopedias, and monthly science journals.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'school-library-books'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'sports-equipment-games-commercial', 'Sports Equipment & Games', 1
FROM writing_practice_category WHERE slug = 'commercial-letter-for-placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Ordering Sports Goods for the Annual Sports Meet', 'You are Kabir / Sneha, Sports Captain of Kendriya Vidyalaya, Salt Lake, Kolkata. Write a letter to Cosco Sports Works, MG Road, Kolkata, placing an order for cricket bats, footballs, badminton rackets, and shuttlecocks. Ask for a trade discount and timely delivery before the annual sports meet.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'sports-equipment-games-commercial'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ordering Indoor Board Games for School Activity Room', 'You are Vikas / Sunita, Student Coordinator at City High School, Bengaluru. Write a letter to Pioneer Games & Toys Pvt. Ltd., Brigade Road, Bengaluru, placing an order for chess boards, carrom boards, and Scrabble sets for the indoor games room.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'sports-equipment-games-commercial'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-canteen-events-office-furniture', 'School Canteen, Events & Office Furniture', 2
FROM writing_practice_category WHERE slug = 'commercial-letter-for-placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Ordering Wooden Furniture for the School Library / Lab', 'You are Dev / Priya, School Prefect at Army Public School, Pune. Write a letter to Godrej Furniture Mart, FC Road, Pune, placing an order for study tables, wooden chairs, and steel almirahs. Request safe packing and transport.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'school-canteen-events-office-furniture'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ordering Sound Equipment for School Auditorium', 'You are Rahul / Tanvi, Cultural Secretary of DAV Public School, Chandigarh. Write a letter to Ahuja Sound Systems, Sector 17, Chandigarh, placing an order for microphones, amplifiers, and speakers for the school auditorium prior to the Annual Day function.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'school-canteen-events-office-furniture'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'science-lab-equipment-computer-hardware', 'Science Laboratory Equipment & Computer Hardware', 3
FROM writing_practice_category WHERE slug = 'commercial-letter-for-placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Ordering Apparatus for the Middle School Science Lab', 'You are Sameer / Diya, Student Lab Assistant at Heritage Academy, Dumdum, Kolkata. Write a formal letter to Ray Scientific Supplies, College Street, Kolkata, placing an order for glass test tubes, beakers, measuring cylinders, and magnifying glasses. Emphasize fragile packing.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'science-lab-equipment-computer-hardware'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ordering Computer Accessories for the IT Lab', 'You are Sarthak / Pooja, IT Club Representative at National English School, Kolkata. Write a letter to Neelam Computers, E-Mall, Chandni Chowk, Kolkata, placing an order for USB keyboards, optical mice, headphones, and mouse pads for the computer laboratory.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'science-lab-equipment-computer-hardware'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'uniforms-art-supplies-musical-instruments', 'Uniforms, Art Supplies & Musical Instruments', 4
FROM writing_practice_category WHERE slug = 'commercial-letter-for-placing-an-order'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Ordering Art & Craft Supplies for the Art Room', 'You are Vikram / Meera, Art Club President at Model High School, Bengaluru. Write a letter to Camel Art House, Commercial Street, Bengaluru, placing an order for watercolor sets, canvas boards, paintbrushes, and sketching pencils.', 100, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'uniforms-art-supplies-musical-instruments'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Ordering Musical Instruments for the School Music Band', 'You are Aditya / Neha, Music Secretary at Green Valley School, Vasant Kunj, Delhi. Write a letter to Rikhi Ram & Sons Music Store, Connaught Place, New Delhi, placing an order for acoustic guitars, keyboards, tablas, and flutes for the school choir.', 100, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'commercial-letter-for-placing-an-order' AND sc.slug = 'uniforms-art-supplies-musical-instruments'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('story-writing', 'Story Writing (Given Cues / Outline / Title)', NULL, 'Story Writing evaluates imagination, plot structuring, character development, and narrative flow, built from given cues, an outline, or a title.', '[{"label":"Catchy Title","guidance":"Give the story a short, engaging title."},{"label":"Introduction / Exposition","guidance":"Introduce the main character(s), setting, and initial scenario using engaging starter phrases or sensory details."},{"label":"Rising Action & Climax","guidance":"Introduce the central conflict, difficulty, or event; show action, presence of mind, or decision-making."},{"label":"Resolution & Conclusion","guidance":"Resolve the problem naturally and wrap up the narrative neatly."},{"label":"Moral","guidance":"End with a clear, one-line moral highlighting the core value, e.g. ''Honesty is the best policy.''"}]'::jsonb, 120, 7, 15)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'moral-dilemmas-honesty', 'Moral Dilemmas & Honesty', 0
FROM writing_practice_category WHERE slug = 'story-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Lost Wallet', 'Construct a story in 100–120 words using the outline provided below. Give your story a suitable title and a moral: A poor schoolboy finds a leather wallet on the playground... contains a large amount of cash and an ID card... tempted to buy shoes he always wanted... remembers his mother''s advice on honesty... decides to hand it over to the Principal... owner turns out to be a chief guest... boy rewarded for integrity.', 120, 7, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'moral-dilemmas-honesty'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Test of Friendship', 'Write an imaginative story in 100–120 words based on the given prompt. Assign an appropriate title and moral: Two close friends, Rohan and Soham, walking through a dark forest... hear a sudden roar... a bear approaches... Rohan quickly climbs a tall tree, leaving Soham behind... Soham remembers a lesson and lies still on the ground, holding his breath... bear sniffs him and walks away... Rohan comes down and asks what the bear whispered... Soham gives a fitting response.', 120, 7, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'moral-dilemmas-honesty'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'presence-of-mind-bravery', 'Presence of Mind & Bravery', 1
FROM writing_practice_category WHERE slug = 'story-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Clever Thief and the Young Girl', 'Develop a story in 100–120 words based on the given hints. Give a suitable title: Little Priya home alone on a rainy evening... hears suspicious noises near the back door... sees a stranger trying to pick the lock... panics at first but stays calm... slips into the kitchen... dials the police quietly... turns on loud music on the speaker to confuse the intruder... police arrive in time and apprehend the thief... Priya praised for bravery and presence of mind.', 120, 7, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'presence-of-mind-bravery'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Stray Dog''s Gratitude', 'Write a short story in 100–120 words based on the following cues: A young boy named Aarav feeds an injured stray dog outside his house every day... names him ''Bruno''... months pass... one night, a small fire breaks out in the kitchen while the family is asleep... Bruno smells smoke and barks continuously outside the window... family wakes up just in time... fire put out safely... Bruno becomes a beloved hero.', 120, 7, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'presence-of-mind-bravery'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'kindness-compassion', 'Kindness & Compassion', 2
FROM writing_practice_category WHERE slug = 'story-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Gift of a Pair of Shoes', 'Create a narrative story in 100–120 words using the given outline: An energetic boy named Kabir loves playing football... notices an underprivileged barefoot boy watching him from outside the school field every afternoon... Kabir saves his pocket money for two months... buys a new pair of sports shoes... gifts them to the boy on his birthday... sees the priceless smile on his face... realizes true happiness lies in giving.', 120, 7, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'kindness-compassion'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Strayed Bird', 'Write a creative story in 100–120 words using the given hints: A young girl finds a small injured pigeon with a broken wing in her balcony... nurses it back to health with food, water, and bandages... builds a cozy box... bird recovers and learns to flutter again... girl feels attached and reluctant to let it go... realizes freedom is more precious... opens the cage and lets it fly into the sky.', 120, 7, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'kindness-compassion'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'wisdom-funny-folk-tale-inferences', 'Wisdom & Funny / Folk Tale Inferences', 3
FROM writing_practice_category WHERE slug = 'story-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Greedy Goose / Merchant', 'Write a story in 100–120 words based on the classic outline below. Add a creative title and moral: A poor farmer owns a special goose... goose lays one golden egg every morning... farmer grows rich gradually... becomes impatient and greedy... wants all the golden eggs at once... kills the goose to search inside... finds nothing... loses both the goose and his source of wealth.', 120, 7, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'wisdom-funny-folk-tale-inferences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Woodcutter and the River Fairy', 'Develop a story in 100–120 words using the provided cues: Honest woodcutter cutting wood near a river... axe slips and falls into deep water... woodcutter cries in distress... river goddess appears... offers an axe made of gold... woodcutter denies it is his... she offers a silver axe... he denies again... she finally brings his old iron axe... woodcutter happily accepts... goddess impressed by his truthfulness and rewards him with all three axes.', 120, 7, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'wisdom-funny-folk-tale-inferences'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'starter-sentence-unexpected-encounters', 'Starter Sentence & Unexpected Encounters', 4
FROM writing_practice_category WHERE slug = 'story-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'An Unexpected Mystery', 'Complete the story in 100–120 words starting with the given introductory sentence: "The old wooden door of the abandoned house slowly creaked open as the wind blew, revealing a glowing metallic box on the dusty floor..." Continue the story detailing what was inside the box, how the main character reacted, and how the adventure concluded. Give it a mysterious title.', 120, 7, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'starter-sentence-unexpected-encounters'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Rainy Day Rescue', 'Complete the story in 100–120 words beginning with the following line: "Heavy rain had flooded the street within an hour, and 12-year-old Dev was watching the rising water level from his porch when he noticed a tiny kitten stranded on a floating wooden plank..." Narrate how Dev managed to rescue the kitten safely, bring it home, and convince his parents to adopt it. Include a title and moral.', 120, 7, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'story-writing' AND sc.slug = 'starter-sentence-unexpected-encounters'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('article-writing', 'Article Writing (School Magazine / Newspaper)', NULL, 'An Article for a School Magazine or Student Newspaper expresses thoughts, opinions, and analysis on contemporary topics, school activities, or social issues.', '[{"label":"Catchy Title & Byline","guidance":"Give the article a catchy title, followed immediately by ''By: [Author''s Name, Class & Section]''."},{"label":"Introduction","guidance":"Hook the reader with a general fact, rhetorical question, or strong opening statement, then introduce the core topic."},{"label":"Main Body","guidance":"Elaborate on the issue with specific facts, examples, or consequences, maintaining logical flow."},{"label":"Conclusion & Call to Action","guidance":"Offer practical solutions, positive recommendations, or a memorable concluding thought."}]'::jsonb, 120, 5, 16)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environment-climate-sustainability', 'Environment, Climate & Sustainability', 0
FROM writing_practice_category WHERE slug = 'article-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Say No to Single-Use Plastics in School', 'You are Rohan / Riya of Class 8-A. Single-use plastic bottles and polythene bags continue to pollute school campuses and local drains. Write an article in 100–120 words for your school magazine titled "Plastic-Free School: Small Steps, Big Impact" highlighting alternative habits like using cloth bags and stainless-steel water bottles.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'environment-climate-sustainability'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Conserving Water in Daily Life', 'You are Aarav / Ananya of Class 7-B. Water scarcity during summer months is becoming a major challenge across cities. Write an article in 100–120 words for your school newspaper on "Every Drop Counts: Simple Ways to Save Water at Home and School".', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'environment-climate-sustainability'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'The Importance of Urban Tree Plantation', 'You are Kabir / Sneha of Class 6-C. Rapid construction has drastically reduced green spaces and bird habitats in urban areas. Write an article for your school magazine emphasizing the role students can play in tree plantation drives. Give your article a catchy title.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'environment-climate-sustainability'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'health-hygiene-youth-well-being', 'Health, Hygiene & Youth Well-being', 1
FROM writing_practice_category WHERE slug = 'article-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Impact of Junk Food vs. Healthy Diet', 'You are Vikas / Sunita of Class 8-C. Easy access to processed junk food and sugary drinks leads to fatigue, obesity, and poor concentration among school children. Write an article in 100–120 words titled "Fuel Your Body: Choosing Health Over Junk" for your school magazine.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'health-hygiene-youth-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Balancing Screen Time and Outdoor Games', 'You are Dev / Priya of Class 7-A. Excessive video gaming and continuous smartphone scrolling are keeping students away from sports fields. Write an article in 100–120 words for your school newspaper on "Unplug and Play: Why Outdoor Sports Matter More Than Ever".', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'health-hygiene-youth-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Mental Health and Overcoming Exam Stress', 'You are Rahul / Tanvi of Class 8-B. Many students experience anxiety and sleeplessness during mid-term and annual exams. Write an article for your school magazine suggesting practical tips such as structured timetables, regular breaks, and deep-breathing exercises.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'health-hygiene-youth-well-being'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-life-reading-digital-habits', 'School Life, Reading & Digital Habits', 2
FROM writing_practice_category WHERE slug = 'article-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Declining Habit of Book Reading in the Digital Age', 'You are Sameer / Diya of Class 7-C. With the rise of short online videos, children are spending less time reading storybooks and novels. Write an article in 100–120 words titled "Rediscovering the Magic of Books" for your school magazine.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'school-life-reading-digital-habits'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Cyber Safety and Responsible Internet Use', 'You are Sarthak / Pooja of Class 8-A. As online learning and social interaction grow, students need to be cautious about sharing personal information online. Write an article in 100–120 words on "Navigating the Digital World Safely" for your school newspaper.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'school-life-reading-digital-habits'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'social-values-community-ethics', 'Social Values, Community & Ethics', 3
FROM writing_practice_category WHERE slug = 'article-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Importance of Discipline and Time Management', 'You are Vikram / Meera of Class 6-A. Managing time efficiently between homework, sports, and hobbies is essential for a student''s success. Write an article in 100–120 words titled "Mastering Time: The Key to Academic Success" for your school magazine.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'social-values-community-ethics'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Promoting Kindness and Inclusivity in Classrooms', 'You are Aditya / Neha of Class 7-B. Bullying, excluding peers, or teasing can hurt classmates emotionally. Write an article in 100–120 words for your school magazine on "Building a Kind and Inclusive Classroom Culture".', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'article-writing' AND sc.slug = 'social-values-community-ethics'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('speech-writing', 'Speech Writing', NULL, 'A Speech is a formal address delivered verbally to an audience, such as during school morning assemblies, competitions, or special occasions.', '[{"label":"Suitable Title","guidance":"Give the speech a clear title matching its topic."},{"label":"Opening Address / Salutation","guidance":"Greet formally: ''Respected Principal, esteemed teachers, and my dear friends...'', then introduce yourself and your topic."},{"label":"Introduction & Central Idea","guidance":"Hook the audience with a quote, question, or strong fact, then state the core thesis/topic clearly."},{"label":"Core Arguments & Examples","guidance":"Explain the significance, impact, or challenges connected to the topic using persuasive language (''We must remember...'')."},{"label":"Conclusion & Call to Action","guidance":"Summarize your main point in 1–2 inspiring sentences and end with a strong closing thought."},{"label":"Thank You","guidance":"Close with ''Thank you and have a wonderful day ahead!''"}]'::jsonb, 120, 5, 17)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-assemblies-academic-occasions', 'School Assemblies & Academic Occasions', 0
FROM writing_practice_category WHERE slug = 'speech-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The Value of Discipline in Student Life', 'You are Rohan / Riya, Head Boy / Head Girl of your school. Prepare a speech in 100–120 words to be delivered in the morning assembly on "Discipline: The Foundation of Success", highlighting how time management and self-control shape a student''s future.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'school-assemblies-academic-occasions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Teachers'' Day Tribute', 'You are Aarav / Ananya of Class 8-A. Deliver a speech in 100–120 words on the occasion of Teachers'' Day, thanking teachers for their guidance, patience, and contribution toward building young minds.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'school-assemblies-academic-occasions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'The Magic and Power of Reading Books', 'You are Kabir / Sneha, Student Library Prefect. Write a speech in 100–120 words for the morning assembly on "Why Reading Should Be Your Daily Habit", emphasizing how books expand vocabulary, knowledge, and creative imagination.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'school-assemblies-academic-occasions'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environment-health-lifestyle', 'Environment, Health & Lifestyle', 1
FROM writing_practice_category WHERE slug = 'speech-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'World Environment Day / Protecting Our Planet', 'You are Vikas / Sunita, President of the Eco Club. Deliver a speech in 100–120 words on "Beat Plastic Pollution: Our Duty Towards Earth", encouraging students to switch to eco-friendly habits like planting trees and avoiding plastic water bottles.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'environment-health-lifestyle'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'The Importance of Fitness and Physical Sports', 'You are Dev / Priya, Sports Captain of your school. Prepare a speech in 100–120 words to be delivered on National Sports Day titled "Healthy Body, Sharper Mind: Why Outdoor Games Matter", highlighting the risks of excessive screen time.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'environment-health-lifestyle'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Choosing Healthy Nutrition Over Junk Food', 'You are Rahul / Tanvi of Class 7-C. Write a speech in 100–120 words for the school morning assembly on "Fuel Your Mind: The Power of a Balanced Diet", explaining how healthy food habits improve concentration and energy levels.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'environment-health-lifestyle'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'social-values-ethics-community', 'Social Values, Ethics & Community', 2
FROM writing_practice_category WHERE slug = 'speech-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Promoting Kindness and Stopping School Bullying', 'You are Sameer / Diya of Class 8-B. Prepare a speech in 100–120 words for Anti-Bullying Week titled "Spread Kindness, Not Fear", urging students to support one another and build an inclusive school environment.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'social-values-ethics-community'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Cleanliness is Next to Godliness (Swachh Bharat)', 'You are Sarthak / Pooja of Class 6-A. Deliver a speech in 100–120 words on "Cleanliness Begins with Us", motivating classmates to keep their classrooms, school corridors, and homes spotless.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'social-values-ethics-community'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'national-pride-technology-future-vision', 'National Pride, Technology & Future Vision', 3
FROM writing_practice_category WHERE slug = 'speech-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Independence Day / Republic Day Address', 'You are Vikram / Meera of Class 8-C. Prepare a patriotic speech in 100–120 words to be delivered on Independence Day on "Preserving Freedom: Our Responsibilities as Young Citizens".', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'national-pride-technology-future-vision'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Cyber Safety and Responsible Digital Citizenship', 'You are Aditya / Neha, IT Club Representative. Write a speech in 100–120 words for the morning assembly titled "Smart and Safe Internet Habits", advising peers on privacy protection, avoiding online scams, and respectful digital behavior.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'speech-writing' AND sc.slug = 'national-pride-technology-future-vision'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('debate-writing', 'Debate Writing (For / Against the Motion)', NULL, 'A Debate presents a formal, logical argument for or against a stated motion, aimed at convincing an audience and judges of a specific viewpoint.', '[{"label":"Topic / Motion & Stance","guidance":"State the motion clearly, then declare whether you are speaking FOR or AGAINST it."},{"label":"Formal Salutation / Opening","guidance":"Greet formally: ''Respected Chairperson, honorable judges, worthy opponents, and dear audience...''."},{"label":"Stance Definition & Rhetorical Opening","guidance":"Define your stance clearly in sentence one, opening with a compelling fact, statistic, or rhetorical question."},{"label":"Core Arguments & Rebuttals","guidance":"Present 2–3 logical, well-structured arguments using persuasive signposts (''Furthermore...'', ''My worthy opponents might argue that... however...'')."},{"label":"Strong Closing","guidance":"Summarize your core thesis forcefully and reiterate why your side holds the stronger ground."},{"label":"Thank You","guidance":"Close with ''Thank you!''"}]'::jsonb, 120, 5, 18)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'technology-digital-life', 'Technology & Digital Life', 0
FROM writing_practice_category WHERE slug = 'debate-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Mobile Phones for Middle School Students', 'Motion: "Mobile phones are essential educational tools for middle school students." You are Rohan / Riya of Class 8. Write a debate speech in 100–120 words either FOR or AGAINST the motion to be delivered in the Inter-House Debate Competition.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'technology-digital-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Online vs. Offline Classrooms', 'Motion: "Online learning can completely replace traditional classroom schooling." You are Aarav / Ananya of Class 7. Prepare a debate in 100–120 words taking a firm stand either FOR or AGAINST the motion, highlighting aspects like social interaction, practical exposure, and convenience.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'technology-digital-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Artificial Intelligence and Human Jobs', 'Motion: "Artificial Intelligence will do more harm than good for human workers in the future." You are Kabir / Sneha of Class 8. Write a debate speech in 100–120 words arguing either FOR or AGAINST the motion for your school assembly debate.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'technology-digital-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'school-policies-academic-life', 'School Policies & Academic Life', 1
FROM writing_practice_category WHERE slug = 'debate-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'School Uniforms', 'Motion: "School uniforms should be abolished to encourage student individuality." You are Vikas / Sunita of Class 6. Write a debate in 100–120 words either FOR or AGAINST the motion, addressing issues like equality, discipline, expression, and cost.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'school-policies-academic-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Homework Burden', 'Motion: "Daily homework should be eliminated for students of Classes 6 to 8." You are Dev / Priya of Class 7. Write a debate speech in 100–120 words arguing either FOR or AGAINST the motion for the Annual Debate Competition.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'school-policies-academic-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'Examinations vs. Continuous Evaluation', 'Motion: "Pen-and-paper examinations are the best measure of a student''s intelligence." You are Rahul / Tanvi of Class 8. Prepare a debate speech in 100–120 words taking a clear stance either FOR or AGAINST the motion.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'school-policies-academic-life'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'youth-lifestyle-entertainment', 'Youth, Lifestyle & Entertainment', 2
FROM writing_practice_category WHERE slug = 'debate-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Video Games and Violent Behavior', 'Motion: "Playing video games causes aggressive behavior in young adolescents." You are Sameer / Diya of Class 7. Write a debate in 100–120 words either FOR or AGAINST the motion, analyzing stress relief, screen addiction, and social skills.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'youth-lifestyle-entertainment'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Fast Food Canteens in Schools', 'Motion: "School canteens should completely ban fast food and carbonated drinks." You are Sarthak / Pooja of Class 6. Write a debate speech in 100–120 words arguing either FOR or AGAINST the motion to be delivered in the Literary Club debate.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'youth-lifestyle-entertainment'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'environment-society', 'Environment & Society', 3
FROM writing_practice_category WHERE slug = 'debate-writing'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Zoos and Animal Captivity', 'Motion: "Zoos serve no educational purpose and should be closed down globally." You are Vikram / Meera of Class 8. Prepare a debate speech in 100–120 words either FOR or AGAINST the motion, examining wildlife conservation versus animal rights.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'environment-society'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'Pocket Money for Middle Schoolers', 'Motion: "Middle school students should be given fixed monthly pocket money by parents." You are Aditya / Neha of Class 6. Write a debate in 100–120 words taking a stand either FOR or AGAINST the motion, highlighting financial responsibility versus unnecessary spending.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'debate-writing' AND sc.slug = 'environment-society'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_category (slug, title, subtitle, description, format_template, word_limit, marks, display_order)
VALUES ('descriptive-paragraph-person-event-place', 'Descriptive Paragraph (Person / Event / Place)', 'Set 2 — Detailed Cues', 'A Descriptive Paragraph paints a vivid mental picture using sensory details (sight, sound, touch, smell, taste) and descriptive adjectives.', '[{"label":"Title","guidance":"Give the paragraph a short, fitting title."},{"label":"Opening/Topic Sentence","guidance":"Introduce the subject — person, event, or place — with an engaging overview."},{"label":"Supporting Details","guidance":"For a person: physical traits, mannerisms, clothing, key qualities, impact on others. For an event: chronological sequence, sights, sounds, emotional energy, climax. For a place: spatial layout, colors, atmosphere, sensory impressions."},{"label":"Vivid Language","guidance":"Use vivid adjectives (radiant, towering, bustling) and sensory imagery (petrichor, deafening cheer, gleaming marble) with smooth spatial/temporal transitions (adjacent to, gradually, as dusk fell)."},{"label":"Concluding Sentence","guidance":"Summarize your overall feeling or lasting memory associated with the subject."}]'::jsonb, 120, 5, 19)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  format_template = EXCLUDED.format_template,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-a-person-appearance-habits-personality', 'Describing a Person (Appearance, Habits, Personality)', 0
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-place'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'My Favorite Teacher', 'Write a descriptive paragraph in 100–120 words about your English teacher. Describe her physical appearance, tone of voice, teaching style, acts of kindness, and why she inspires you.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-person-appearance-habits-personality'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Grandparent / Wise Elder', 'Describe your grandfather in 100–120 words. Focus on his facial features (wrinkled smile, silver hair), his gentle voice, his daily routine, and the valuable life stories he shares with you.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-person-appearance-habits-personality'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'The Neighborhood Shopkeeper / Baker', 'Write a descriptive paragraph in 100–120 words about a local baker or shopkeeper you visit regularly. Detail his appearance, friendly demeanor, the bustling atmosphere of his shop, and his interactions with customers.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-person-appearance-habits-personality'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-an-event-experience', 'Describing an Event / Experience (Vivid Actions, Sounds, Feelings)', 1
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-place'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'Annual Sports Day at School', 'Write a descriptive paragraph in 100–120 words describing your school''s Annual Sports Day. Capture the colorful banners, cheering crowds, energetic track races, drumbeats, and the triumphant award ceremony.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-an-event-experience'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Rainy Afternoon in My City', 'Describe a sudden torrential downpour in your city in 100–120 words. Focus on sensory details: the dark storm clouds, petrichor (smell of wet earth), sound of raindrops hitting windowpanes, and paper boats floating in puddles.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-an-event-experience'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'A Local Cultural Festival / Fair', 'Write a descriptive paragraph in 100–120 words about visiting a local craft fair or festive market during Durga Puja / Diwali / Eid. Describe the glittering lights, crowded stalls, aroma of street food, and joyful chatter.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-an-event-experience'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 4, 'A Fire Accident / Rescue Operation', 'Describe a fire emergency scene in 100–120 words. Focus on the thick black smoke, blaring sirens of the approaching fire brigade, brave efforts of firefighters, and the eventual relief when everyone is safely evacuated.', 120, 5, 3
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-an-event-experience'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_subcategory (fk_category_id, slug, title, display_order)
SELECT id, 'describing-a-place-location-architecture-atmosphere', 'Describing a Place (Location, Architecture, Atmosphere)', 2
FROM writing_practice_category WHERE slug = 'descriptive-paragraph-person-event-place'
ON CONFLICT (fk_category_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  display_order = EXCLUDED.display_order;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 1, 'The School Library', 'Write a descriptive paragraph in 100–120 words describing your school library. Detail the neatly organized tall wooden bookshelves, the quiet atmosphere, the smell of old paper, and students absorbed in reading.', 120, 5, 0
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-place-location-architecture-atmosphere'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 2, 'A Scenic Hill Station / Beach', 'Describe a scenic holiday location you visited recently (e.g., a misty hill station or a sunny sea beach) in 100–120 words. Focus on the landscape, refreshing breeze, natural colors, and peaceful ambience.', 120, 5, 1
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-place-location-architecture-atmosphere'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;

INSERT INTO writing_practice_question (fk_subcategory_id, question_number, title, description, word_limit, marks, display_order)
SELECT sc.id, 3, 'An Historical Monument', 'Write a descriptive paragraph in 100–120 words describing a historical monument you visited (e.g., Victoria Memorial, Taj Mahal, Red Fort). Describe its grand stone architecture, surrounding manicured gardens, historical vibe, and visitor activity.', 120, 5, 2
FROM writing_practice_subcategory sc
JOIN writing_practice_category c ON c.id = sc.fk_category_id
WHERE c.slug = 'descriptive-paragraph-person-event-place' AND sc.slug = 'describing-a-place-location-architecture-atmosphere'
ON CONFLICT (fk_subcategory_id, display_order) DO UPDATE SET
  question_number = EXCLUDED.question_number,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  word_limit = EXCLUDED.word_limit,
  marks = EXCLUDED.marks;
