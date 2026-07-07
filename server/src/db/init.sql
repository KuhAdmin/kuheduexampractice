CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT,
  google_id VARCHAR(255) UNIQUE,
  provider VARCHAR(30) NOT NULL DEFAULT 'local',
  avatar_url TEXT,
  role VARCHAR(30) NOT NULL DEFAULT 'student',
  board VARCHAR(60),
  student_class VARCHAR(30),
  subject VARCHAR(60),
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS board VARCHAR(60);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS student_class VARCHAR(30);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS subject VARCHAR(60);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_notifications_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mst_country (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

INSERT INTO mst_country (name_code, name)
VALUES ('IN', 'INDIA')
ON CONFLICT (name_code) DO UPDATE
SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS mst_state (
  id BIGSERIAL PRIMARY KEY,
  state_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  fk_country_id BIGINT NOT NULL REFERENCES mst_country(id)
);

INSERT INTO mst_state (state_id, name, fk_country_id)
SELECT 'DEL', 'Delhi', country.id
FROM mst_country AS country
WHERE country.name = 'INDIA'
ON CONFLICT (state_id) DO UPDATE
SET name = EXCLUDED.name,
    fk_country_id = EXCLUDED.fk_country_id;

CREATE TABLE IF NOT EXISTS mst_exam_type (
  id BIGSERIAL PRIMARY KEY,
  type_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL
);

INSERT INTO mst_exam_type (type_id, name)
VALUES
  ('BRD', 'BOARD'),
  ('COM', 'COMPETITION'),
  ('ENT', 'ENTRANCE'),
  ('JOB', 'GOVERNMENT JOB')
ON CONFLICT (type_id) DO UPDATE
SET name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS mst_exam_goal (
  id BIGSERIAL PRIMARY KEY,
  goal_id VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  fk_mst_exam_type_id BIGINT NOT NULL REFERENCES mst_exam_type(id),
  fk_state_id BIGINT NOT NULL REFERENCES mst_state(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO mst_exam_goal (goal_id, name, fk_mst_exam_type_id, fk_state_id, is_active)
SELECT seed.goal_id, seed.name, exam_type.id, state.id, seed.is_active
FROM (
  VALUES
    ('AISSCE', 'All India Senior School Certificate Examination', 'BOARD', 'Delhi', TRUE),
    ('JEE-MAIN', 'IIT Joint Entrance Exam - Main', 'ENTRANCE', 'Delhi', TRUE),
    ('JEE-ADVANCED', 'IIT Joint Entrance Exam - Advanced', 'ENTRANCE', 'Delhi', TRUE),
    ('NEET', 'National Eligibility cum Entrance Test', 'ENTRANCE', 'Delhi', TRUE),
    ('CUET', 'Common University Entrance Test', 'ENTRANCE', 'Delhi', TRUE),
    ('Olympiad', 'Olympiad', 'COMPETITION', 'Delhi', TRUE)
) AS seed(goal_id, name, exam_type_name, state_name, is_active)
JOIN mst_exam_type AS exam_type
  ON exam_type.name = seed.exam_type_name
JOIN mst_state AS state
  ON state.name = seed.state_name
ON CONFLICT (goal_id) DO UPDATE
SET name = EXCLUDED.name,
    fk_mst_exam_type_id = EXCLUDED.fk_mst_exam_type_id,
    fk_state_id = EXCLUDED.fk_state_id,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS mst_level (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO mst_level (name_code, name, display_order)
VALUES
  ('11', 'Class 11', 0),
  ('12', 'Class 12', 1)
ON CONFLICT (name_code) DO UPDATE
SET name = EXCLUDED.name,
    display_order = EXCLUDED.display_order;

CREATE TABLE IF NOT EXISTS mst_subject (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO mst_subject (name_code, name, display_order, is_active)
VALUES
  ('PHY', 'Physics', 0, TRUE),
  ('CHM', 'Chemistry', 1, TRUE),
  ('BIO', 'Biology', 2, TRUE),
  ('MAT', 'Mathematics', 3, TRUE),
  ('SCI', 'Science', 4, TRUE),
  ('EVS', 'Environmental Studies', 5, TRUE),
  ('BTC', 'Biotechnology', 6, TRUE),
  ('EGR', 'Engineering Graphics', 7, TRUE),
  ('CSC', 'Computer Science', 8, TRUE),
  ('IPR', 'Informatics Practices', 9, TRUE),
  ('AIN', 'Artificial Intelligence', 10, TRUE),
  ('ITE', 'Information Technology', 11, TRUE),
  ('WEB', 'Web Application', 12, TRUE),
  ('DSC', 'Data Science', 13, TRUE),
  ('EHW', 'Electronics & Hardware', 14, TRUE),
  ('SST', 'Social Studies', 15, TRUE),
  ('SSC', 'Social Science', 16, TRUE),
  ('HIS', 'History', 17, TRUE),
  ('GEO', 'Geography', 18, TRUE),
  ('POL', 'Political Science', 19, TRUE),
  ('ECO', 'Economics', 20, TRUE),
  ('ENG', 'English', 21, TRUE),
  ('HIN', 'Hindi', 22, TRUE),
  ('BEN', 'Bengali', 23, TRUE)
ON CONFLICT (name_code) DO UPDATE
SET name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS mst_book (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  fk_mst_subject_id BIGINT NOT NULL REFERENCES mst_subject(id),
  fk_mst_level_id BIGINT NOT NULL REFERENCES mst_level(id),
  fk_mst_exam_goal_id BIGINT NOT NULL REFERENCES mst_exam_goal(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (name_code, fk_mst_level_id, fk_mst_exam_goal_id)
);

INSERT INTO mst_book (
  name_code,
  name,
  fk_mst_subject_id,
  fk_mst_level_id,
  fk_mst_exam_goal_id,
  display_order,
  is_active
)
SELECT
  seed.name_code,
  seed.name,
  subject.id,
  level.id,
  exam_goal.id,
  seed.display_order,
  seed.is_active
FROM (
  VALUES
    ('PHY11I', 'Physics Part-I', 'PHY', '11', 'AISSCE', 0, TRUE),
    ('PHY11II', 'Physics Part-II', 'PHY', '11', 'AISSCE', 1, TRUE),
    ('CHM11I', 'Chemistry Part-I', 'CHM', '11', 'AISSCE', 0, TRUE),
    ('CHM11II', 'Chemistry Part-II', 'CHM', '11', 'AISSCE', 0, TRUE),
    ('BIOLOGY', 'Biology', 'BIO', '11', 'AISSCE', 0, TRUE),
    ('MATH', 'Mathematics', 'MAT', '11', 'AISSCE', 0, TRUE),
    ('PHY12I', 'Physics Part-I', 'PHY', '12', 'AISSCE', 0, TRUE),
    ('PHY12II', 'Physics Part-II', 'PHY', '12', 'AISSCE', 1, TRUE),
    ('CHM12I', 'Chemistry Part-I', 'CHM', '12', 'AISSCE', 1, TRUE),
    ('CHM12II', 'Chemistry Part-II', 'CHM', '12', 'AISSCE', 1, TRUE),
    ('BIOLOGY', 'Biology', 'BIO', '12', 'AISSCE', 0, TRUE),
    ('MATH12I', 'Mathematics Part-I', 'MAT', '12', 'AISSCE', 0, TRUE),
    ('MATH12II', 'Mathematics Part-II', 'MAT', '12', 'AISSCE', 1, TRUE)
) AS seed(name_code, name, subject_code, level_code, goal_id, display_order, is_active)
JOIN mst_subject AS subject
  ON subject.name_code = seed.subject_code
JOIN mst_level AS level
  ON level.name_code = seed.level_code
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.goal_id = seed.goal_id
ON CONFLICT (name_code, fk_mst_level_id, fk_mst_exam_goal_id) DO UPDATE
SET name = EXCLUDED.name,
    fk_mst_subject_id = EXCLUDED.fk_mst_subject_id,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS mst_practice_type (
  id BIGSERIAL PRIMARY KEY,
  name_code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO mst_practice_type (name_code, name, display_order, is_active)
VALUES
  ('QR', 'Quick Revision', 0, TRUE),
  ('CM', 'Chapter Master', 1, TRUE),
  ('CB', 'Competency Based', 2, TRUE),
  ('FM', 'Full Mock', 3, TRUE),
  ('MB', 'Memory Booster', 4, TRUE),
  ('WR', 'Weak Area Retry', 5, TRUE)
ON CONFLICT (name_code) DO UPDATE
SET name = EXCLUDED.name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS mst_chapter (
  id BIGSERIAL PRIMARY KEY,
  chapter_number VARCHAR(40) NOT NULL,
  chapter_name VARCHAR(255) NOT NULL,
  section_number VARCHAR(40),
  topic_name VARCHAR(255),
  display_order INTEGER NOT NULL DEFAULT 0,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (fk_mst_book_id, chapter_number, section_number, topic_name)
);

ALTER TABLE mst_chapter
DROP CONSTRAINT IF EXISTS mst_chapter_fk_mst_book_id_chapter_number_section_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mst_chapter_book_chapter_section_topic
ON mst_chapter (fk_mst_book_id, chapter_number, section_number, topic_name);

INSERT INTO mst_chapter (
  chapter_number,
  chapter_name,
  section_number,
  topic_name,
  display_order,
  fk_mst_book_id,
  is_active
)
VALUES
  ('1', 'Units and Measurements', '1.1', 'Introduction', 0, 6, TRUE),
  ('1', 'Units and Measurements', '1.2', 'The International System of Units', 1, 6, TRUE),
  ('1', 'Units and Measurements', '1.3', 'Significant Figures', 2, 6, TRUE),
  ('1', 'Units and Measurements', '1.4', 'Dimensions of Physical Quantities', 3, 6, TRUE),
  ('1', 'Units and Measurements', '1.5', 'Dimensional Formulae and Dimensional Equations', 4, 6, TRUE),
  ('1', 'Units and Measurements', '1.6', 'Dimensional Analysis and its Applications', 5, 6, TRUE),
  ('2', 'Motion in a Straight Line', '2.1', 'Introduction', 6, 6, TRUE),
  ('2', 'Motion in a Straight Line', '2.2', 'Instantaneous Velocity and Speed', 7, 6, TRUE),
  ('2', 'Motion in a Straight Line', '2.3', 'Acceleration', 8, 6, TRUE),
  ('2', 'Motion in a Straight Line', '2.4', 'Kinematic Equations for Uniformly Accelerated Motion', 9, 6, TRUE),
  ('3', 'Motion in a Plane', '3.1', 'Introduction', 10, 6, TRUE),
  ('3', 'Motion in a Plane', '3.2', 'Scalars and Vectors', 11, 6, TRUE),
  ('3', 'Motion in a Plane', '3.3', 'Multiplication of Vectors by Real Numbers', 12, 6, TRUE),
  ('3', 'Motion in a Plane', '3.4', 'Addition and Subtraction of Vectors - Graphical Method', 13, 6, TRUE),
  ('3', 'Motion in a Plane', '3.5', 'Resolution of Vectors', 14, 6, TRUE),
  ('3', 'Motion in a Plane', '3.6', 'Vector Addition - Analytical Method', 15, 6, TRUE),
  ('3', 'Motion in a Plane', '3.7', 'Motion in a Plane', 16, 6, TRUE),
  ('3', 'Motion in a Plane', '3.8', 'Motion in a Plane with Constant Acceleration', 17, 6, TRUE),
  ('3', 'Motion in a Plane', '3.9', 'Projectile Motion', 18, 6, TRUE),
  ('3', 'Motion in a Plane', '3.10', 'Uniform Circular Motion', 19, 6, TRUE),
  ('4', 'Laws of Motion', '4.1', 'Introduction', 20, 6, TRUE),
  ('4', 'Laws of Motion', '4.2', 'Aristotle''s Fallacy', 21, 6, TRUE),
  ('4', 'Laws of Motion', '4.3', 'The Law of Inertia', 22, 6, TRUE),
  ('4', 'Laws of Motion', '4.4', 'Newton''s First Law of Motion', 23, 6, TRUE),
  ('4', 'Laws of Motion', '4.5', 'Newton''s Second Law of Motion', 24, 6, TRUE),
  ('4', 'Laws of Motion', '4.6', 'Newton''s Third Law of Motion', 25, 6, TRUE),
  ('4', 'Laws of Motion', '4.7', 'Conservation of Momentum', 26, 6, TRUE),
  ('4', 'Laws of Motion', '4.8', 'Equilibrium of a Particle', 27, 6, TRUE),
  ('4', 'Laws of Motion', '4.9', 'Common Forces in Mechanics', 28, 6, TRUE),
  ('4', 'Laws of Motion', '4.10', 'Circular Motion', 29, 6, TRUE),
  ('4', 'Laws of Motion', '4.11', 'Solving Problems in Mechanics', 30, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.1', 'Introduction', 31, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.2', 'Notions of Work and Kinetic Energy: The Work-Energy Theorem', 32, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.3', 'Work', 33, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.4', 'Kinetic Energy', 34, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.5', 'Work Done by a Variable Force', 35, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.6', 'The Work-Energy Theorem for a Variable Force', 36, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.7', 'The Concept of Potential Energy', 37, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.8', 'The Conservation of Mechanical Energy', 38, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.9', 'The Potential Energy of a Spring', 29, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.10', 'Power', 40, 6, TRUE),
  ('5', 'Work, Energy and Power', '5.11', 'Collisions', 41, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.1', 'Introduction', 42, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.2', 'Centre of Mass', 43, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.3', 'Motion of Centre of Mass', 44, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.4', 'Linear Momentum of a System of Particles', 45, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.5', 'Vector Product of Two Vectors', 46, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.6', 'Angular Velocity and its Relation with Linear Velocity', 47, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.7', 'Torque and Angular Momentum', 48, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.8', 'Equilibrium of a Rigid Body', 49, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.9', 'Moment of Inertia', 50, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.10', 'Kinematics of Rotational Motion About a Fixed Axis', 51, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.11', 'Dynamics of Rotational Motion About a Fixed Axis', 52, 6, TRUE),
  ('6', 'System of Particles and Rotational Motion', '6.12', 'Angular Momentum in Case of Rotations About a Fixed Axis', 53, 6, TRUE),
  ('7', 'Gravitation', '7.1', 'Introduction', 54, 6, TRUE),
  ('7', 'Gravitation', '7.2', 'Kepler''s Laws', 55, 6, TRUE),
  ('7', 'Gravitation', '7.3', 'Universal Law of Gravitation', 56, 6, TRUE),
  ('7', 'Gravitation', '7.4', 'The Gravitational Constant', 57, 6, TRUE),
  ('7', 'Gravitation', '7.5', 'Acceleration Due to Gravity of the Earth', 58, 6, TRUE),
  ('7', 'Gravitation', '7.6', 'Acceleration Due to Gravity Below and Above the Surface of Earth', 59, 6, TRUE),
  ('7', 'Gravitation', '7.7', 'Gravitational Potential Energy', 60, 6, TRUE),
  ('7', 'Gravitation', '7.8', 'Escape Speed', 61, 6, TRUE),
  ('7', 'Gravitation', '7.9', 'Earth Satellites', 62, 6, TRUE),
  ('7', 'Gravitation', '7.10', 'Energy of an Orbiting Satellite', 63, 6, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.1', 'Introduction', 0, 5, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.2', 'Stress and Strain', 1, 5, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.3', 'Hooke''s Law', 2, 5, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.4', 'Stress-Strain Curve', 3, 5, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.5', 'Elastic Moduli', 4, 5, TRUE),
  ('8', 'Mechanical Properties of Solids', '8.6', 'Applications of Elastic Behaviour of Materials', 5, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.1', 'Introduction', 6, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.2', 'Pressure', 7, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.3', 'Streamline Flow', 8, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.4', 'Bernoulli''s Principle', 9, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.5', 'Viscosity', 10, 5, TRUE),
  ('9', 'Mechanical Properties of Fluids', '9.6', 'Surface Tension', 11, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.1', 'Introduction', 12, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.2', 'Temperature and Heat', 13, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.3', 'Measurement of Temperature', 14, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.4', 'Ideal Gas Equation and Absolute Temperature', 15, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.5', 'Thermal Expansion', 16, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.6', 'Specific Heat Capacity', 17, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.7', 'Calorimetry', 18, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.8', 'Change of State', 19, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.9', 'Heat Transfer', 20, 5, TRUE),
  ('10', 'Thermal Properties of Matter', '10.10', 'Newton''s Law of Cooling', 21, 5, TRUE),
  ('11', 'Thermodynamics', '11.1', 'Introduction', 22, 5, TRUE),
  ('11', 'Thermodynamics', '11.2', 'Thermal Equilibrium', 23, 5, TRUE),
  ('11', 'Thermodynamics', '11.3', 'Zeroth Law of Thermodynamics', 24, 5, TRUE),
  ('11', 'Thermodynamics', '11.4', 'Heat, Internal Energy and Work', 25, 5, TRUE),
  ('11', 'Thermodynamics', '11.5', 'First Law of Thermodynamics', 26, 5, TRUE),
  ('11', 'Thermodynamics', '11.6', 'Specific Heat Capacity', 27, 5, TRUE),
  ('11', 'Thermodynamics', '11.7', 'Thermodynamic State Variables and Equation of State', 28, 5, TRUE),
  ('11', 'Thermodynamics', '11.8', 'Thermodynamic Processes', 29, 5, TRUE),
  ('11', 'Thermodynamics', '11.9', 'Second Law of Thermodynamics', 30, 5, TRUE),
  ('11', 'Thermodynamics', '11.10', 'Reversible and Irreversible Processes', 31, 5, TRUE),
  ('11', 'Thermodynamics', '11.11', 'Carnot Engine', 32, 5, TRUE),
  ('12', 'Kinetic Theory', '12.1', 'Introduction', 33, 5, TRUE),
  ('12', 'Kinetic Theory', '12.2', 'Molecular Nature of Matter', 34, 5, TRUE),
  ('12', 'Kinetic Theory', '12.3', 'Behaviour of Gases', 35, 5, TRUE),
  ('12', 'Kinetic Theory', '12.4', 'Kinetic Theory of an Ideal Gas', 36, 5, TRUE),
  ('12', 'Kinetic Theory', '12.5', 'Law of Equipartition of Energy', 37, 5, TRUE),
  ('12', 'Kinetic Theory', '12.6', 'Specific Heat Capacity', 38, 5, TRUE),
  ('12', 'Kinetic Theory', '12.7', 'Mean Free Path', 39, 5, TRUE),
  ('13', 'Oscillations', '13.1', 'Introduction', 40, 5, TRUE),
  ('13', 'Oscillations', '13.2', 'Periodic and Oscillatory Motions', 41, 5, TRUE),
  ('13', 'Oscillations', '13.3', 'Simple Harmonic Motion', 42, 5, TRUE),
  ('13', 'Oscillations', '13.4', 'Simple Harmonic Motion and Uniform Circular Motion', 43, 5, TRUE),
  ('13', 'Oscillations', '13.5', 'Velocity and Acceleration in Simple Harmonic Motion', 44, 5, TRUE),
  ('13', 'Oscillations', '13.6', 'Force Law for Simple Harmonic Motion', 45, 5, TRUE),
  ('13', 'Oscillations', '13.7', 'Energy in Simple Harmonic Motion', 46, 5, TRUE),
  ('13', 'Oscillations', '13.8', 'The Simple Pendulum', 47, 5, TRUE),
  ('14', 'Waves', '14.1', 'Introduction', 48, 5, TRUE),
  ('14', 'Waves', '14.2', 'Transverse and Longitudinal Waves', 49, 5, TRUE),
  ('14', 'Waves', '14.3', 'Displacement Relation in a Progressive Wave', 50, 5, TRUE),
  ('14', 'Waves', '14.4', 'The Speed of a Travelling Wave', 51, 5, TRUE),
  ('14', 'Waves', '14.5', 'The Principle of Superposition of Waves', 52, 5, TRUE),
  ('14', 'Waves', '14.6', 'Reflection of Waves', 53, 5, TRUE),
  ('14', 'Waves', '14.7', 'Beats', 54, 5, TRUE),
  ('1', 'Electric Charges and Fields', '1.1', 'Introduction', 0, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.2', 'Electric Charge', 1, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.3', 'Conductors and Insulators', 2, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.4', 'Basic Properties of Electric Charge', 3, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.5', 'Coulomb''s Law', 4, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.6', 'Forces Between Multiple Charges', 5, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.7', 'Electric Field', 6, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.8', 'Electric Field Lines', 7, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.9', 'Electric Flux', 8, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.10', 'Electric Dipole', 9, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.11', 'Dipole in a Uniform External Field', 10, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.12', 'Continuous Charge Distribution', 11, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.13', 'Gauss''s Law', 12, 13, TRUE),
  ('1', 'Electric Charges and Fields', '1.14', 'Applications of Gauss''s Law', 13, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.1', 'Introduction', 14, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.2', 'Electrostatic Potential', 15, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.3', 'Potential Due to a Point Charge', 16, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.4', 'Potential Due to an Electric Dipole', 17, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.5', 'Potential Due to a System of Charges', 18, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.6', 'Equipotential Surfaces', 19, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.7', 'Potential Energy of a System of Charges', 20, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.8', 'Potential Energy in an External Field', 21, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.9', 'Electrostatics of Conductors', 22, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.10', 'Dielectrics and Polarisation', 23, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.11', 'Capacitors and Capacitance', 24, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.12', 'The Parallel Plate Capacitor', 25, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.13', 'Effect of Dielectric on Capacitance', 26, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.14', 'Combination of Capacitors', 27, 13, TRUE),
  ('2', 'Electrostatic Potential and Capacitance', '2.15', 'Energy Stored in a Capacitor', 28, 13, TRUE),
  ('3', 'Current Electricity', '3.1', 'Introduction', 29, 13, TRUE),
  ('3', 'Current Electricity', '3.2', 'Electric Current', 30, 13, TRUE),
  ('3', 'Current Electricity', '3.3', 'Electric Currents in Conductors', 31, 13, TRUE),
  ('3', 'Current Electricity', '3.4', 'Ohm''s Law', 32, 13, TRUE),
  ('3', 'Current Electricity', '3.5', 'Drift of Electrons and the Origin of Resistivity', 33, 13, TRUE),
  ('3', 'Current Electricity', '3.6', 'Limitations of Ohm''s Law', 34, 13, TRUE),
  ('3', 'Current Electricity', '3.7', 'Resistivity of Various Materials', 35, 13, TRUE),
  ('3', 'Current Electricity', '3.8', 'Temperature Dependence of Resistivity', 36, 13, TRUE),
  ('3', 'Current Electricity', '3.9', 'Electrical Energy, Power', 37, 13, TRUE),
  ('3', 'Current Electricity', '3.10', 'Cells, EMF, Internal Resistance', 38, 13, TRUE),
  ('3', 'Current Electricity', '3.11', 'Cells in Series and in Parallel', 39, 13, TRUE),
  ('3', 'Current Electricity', '3.12', 'Kirchhoff''s Rules', 40, 13, TRUE),
  ('3', 'Current Electricity', '3.13', 'Wheatstone Bridge', 41, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.1', 'Introduction', 42, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.2', 'Magnetic Force', 43, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.3', 'Motion in a Magnetic Field', 44, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.4', 'Magnetic Field Due to a Current Element (Biot-Savart Law)', 45, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.5', 'Magnetic Field on the Axis of a Circular Current Loop', 46, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.6', 'Ampere''s Circuital Law', 47, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.7', 'The Solenoid', 48, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.8', 'Force Between Two Parallel Currents, the Ampere', 49, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.9', 'Torque on Current Loop, Magnetic Dipole', 50, 13, TRUE),
  ('4', 'Moving Charges and Magnetism', '4.10', 'The Moving Coil Galvanometer', 51, 13, TRUE),
  ('5', 'Magnetism and Matter', '5.1', 'Introduction', 52, 13, TRUE),
  ('5', 'Magnetism and Matter', '5.2', 'The Bar Magnet', 53, 13, TRUE),
  ('5', 'Magnetism and Matter', '5.3', 'Magnetism and Gauss''s Law', 54, 13, TRUE),
  ('5', 'Magnetism and Matter', '5.4', 'Magnetisation and Magnetic Intensity', 55, 13, TRUE),
  ('5', 'Magnetism and Matter', '5.5', 'Magnetic Properties of Materials', 56, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.1', 'Introduction', 57, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.2', 'The Experiments of Faraday and Henry', 58, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.3', 'Magnetic Flux', 59, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.4', 'Faraday''s Law of Induction', 60, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.5', 'Lenz''s Law and Conservation of Energy', 61, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.6', 'Motional Electromotive Force', 62, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.7', 'Inductance', 63, 13, TRUE),
  ('6', 'Electromagnetic Induction', '6.8', 'AC Generator', 64, 13, TRUE),
  ('7', 'Alternating Current', '7.1', 'Introduction', 65, 13, TRUE),
  ('7', 'Alternating Current', '7.2', 'AC Voltage Applied to a Resistor', 66, 13, TRUE),
  ('7', 'Alternating Current', '7.3', 'Representation of AC Current and Voltage by Rotating Vectors - Phasors', 67, 13, TRUE),
  ('7', 'Alternating Current', '7.4', 'AC Voltage Applied to an Inductor', 68, 13, TRUE),
  ('7', 'Alternating Current', '7.5', 'AC Voltage Applied to a Capacitor', 69, 13, TRUE),
  ('7', 'Alternating Current', '7.6', 'AC Voltage Applied to a Series LCR Circuit', 70, 13, TRUE),
  ('7', 'Alternating Current', '7.7', 'Power in AC Circuit: The Power Factor', 71, 13, TRUE),
  ('7', 'Alternating Current', '7.8', 'Transformers', 72, 13, TRUE),
  ('8', 'Electromagnetic Waves', '8.1', 'Introduction', 73, 13, TRUE),
  ('8', 'Electromagnetic Waves', '8.2', 'Displacement Current', 74, 13, TRUE),
  ('8', 'Electromagnetic Waves', '8.3', 'Electromagnetic Waves', 75, 13, TRUE),
  ('8', 'Electromagnetic Waves', '8.4', 'Electromagnetic Spectrum', 76, 13, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.1', 'Introduction', 0, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.2', 'Reflection of Light by Spherical Mirrors', 1, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.3', 'Refraction', 2, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.4', 'Total Internal Reflection', 3, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.5', 'Refraction at Spherical Surfaces and by Lenses', 4, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.6', 'Refraction through a Prism', 5, 12, TRUE),
  ('9', 'Ray Optics and Optical Instruments', '9.7', 'Optical Instruments', 6, 12, TRUE),
  ('10', 'Wave Optics', '10.1', 'Introduction', 7, 12, TRUE),
  ('10', 'Wave Optics', '10.2', 'Huygens Principle', 8, 12, TRUE),
  ('10', 'Wave Optics', '10.3', 'Refraction and Reflection of Plane Waves using Huygens Principle', 9, 12, TRUE),
  ('10', 'Wave Optics', '10.4', 'Coherent and Incoherent Addition of Waves', 10, 12, TRUE),
  ('10', 'Wave Optics', '10.5', 'Interference of Light Waves and Young''s Experiment', 11, 12, TRUE),
  ('10', 'Wave Optics', '10.6', 'Diffraction', 12, 12, TRUE),
  ('10', 'Wave Optics', '10.7', 'Polarisation', 13, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.1', 'Introduction', 14, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.2', 'Electron Emission', 15, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.3', 'Photoelectric Effect', 16, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.4', 'Experimental Study of Photoelectric Effect', 17, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.5', 'Photoelectric Effect and Wave Theory of Light', 18, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.6', 'Einstein''s Photoelectric Equation: Energy Quantum of Radiation', 19, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.7', 'Particle Nature of Light: The Photon', 20, 12, TRUE),
  ('11', 'Dual Nature of Radiation and Matter', '11.8', 'Wave Nature of Matter', 21, 12, TRUE),
  ('12', 'Atoms', '12.1', 'Introduction', 22, 12, TRUE),
  ('12', 'Atoms', '12.2', 'Alpha-particle Scattering and Rutherford''s Nuclear Model of Atom', 23, 12, TRUE),
  ('12', 'Atoms', '12.3', 'Atomic Spectra', 24, 12, TRUE),
  ('12', 'Atoms', '12.4', 'Bohr Model of the Hydrogen Atom', 25, 12, TRUE),
  ('12', 'Atoms', '12.5', 'The Line Spectra of the Hydrogen Atom', 26, 12, TRUE),
  ('12', 'Atoms', '12.6', 'De Broglie''s Explanation of Bohr''s Second Postulate of Quantisation', 27, 12, TRUE),
  ('13', 'Nuclei', '13.1', 'Introduction', 28, 12, TRUE),
  ('13', 'Nuclei', '13.2', 'Atomic Masses and Composition of Nucleus', 29, 12, TRUE),
  ('13', 'Nuclei', '13.3', 'Size of the Nucleus', 30, 12, TRUE),
  ('13', 'Nuclei', '13.4', 'Mass-Energy and Nuclear Binding Energy', 31, 12, TRUE),
  ('13', 'Nuclei', '13.5', 'Nuclear Force', 32, 12, TRUE),
  ('13', 'Nuclei', '13.6', 'Radioactivity', 33, 12, TRUE),
  ('13', 'Nuclei', '13.7', 'Nuclear Energy', 34, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.1', 'Introduction', 35, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.2', 'Classification of Metals, Conductors and Semiconductors', 36, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.3', 'Intrinsic Semiconductor', 37, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.4', 'Extrinsic Semiconductor', 38, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.5', 'p-n Junction', 39, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.6', 'Semiconductor Diode', 40, 12, TRUE),
  ('14', 'Semiconductor Electronics: Materials, Devices and Simple Circuits', '14.7', 'Application of Junction Diode as a Rectifier', 41, 12, TRUE),
  ('1', 'The Living World', '1.1', 'Diversity in the Living World', 0, 2, TRUE),
  ('1', 'The Living World', '1.2', 'Taxonomic Categories', 1, 2, TRUE),
  ('1', 'The Living World', '1.2.1', 'Species', 2, 2, TRUE),
  ('1', 'The Living World', '1.2.2', 'Genus', 3, 2, TRUE),
  ('1', 'The Living World', '1.2.3', 'Family', 4, 2, TRUE),
  ('1', 'The Living World', '1.2.4', 'Order', 5, 2, TRUE),
  ('1', 'The Living World', '1.2.5', 'Class', 6, 2, TRUE),
  ('1', 'The Living World', '1.2.6', 'Phylum', 7, 2, TRUE),
  ('1', 'The Living World', '1.2.7', 'Kingdom', 8, 2, TRUE),
  ('2', 'Biological Classification', '2.1', 'Kingdom Monera', 9, 2, TRUE),
  ('2', 'Biological Classification', '2.1.1', 'Archaebacteria', 10, 2, TRUE),
  ('2', 'Biological Classification', '2.1.2', 'Eubacteria', 11, 2, TRUE),
  ('2', 'Biological Classification', '2.2', 'Kingdom Protista', 12, 2, TRUE),
  ('2', 'Biological Classification', '2.2.1', 'Chrysophytes', 13, 2, TRUE),
  ('2', 'Biological Classification', '2.2.2', 'Dinoflagellates', 14, 2, TRUE),
  ('2', 'Biological Classification', '2.2.3', 'Euglenoids', 15, 2, TRUE),
  ('2', 'Biological Classification', '2.2.4', 'Slime Moulds', 16, 2, TRUE),
  ('2', 'Biological Classification', '2.2.5', 'Protozoans', 17, 2, TRUE),
  ('2', 'Biological Classification', '2.3', 'Kingdom Fungi', 18, 2, TRUE),
  ('2', 'Biological Classification', '2.3.1', 'Phycomycetes', 19, 2, TRUE),
  ('2', 'Biological Classification', '2.3.2', 'Ascomycetes', 20, 2, TRUE),
  ('2', 'Biological Classification', '2.3.3', 'Basidiomycetes', 21, 2, TRUE),
  ('2', 'Biological Classification', '2.3.4', 'Deuteromycetes', 22, 2, TRUE),
  ('2', 'Biological Classification', '2.4', 'Kingdom Plantae', 23, 2, TRUE),
  ('2', 'Biological Classification', '2.5', 'Kingdom Animalia', 24, 2, TRUE),
  ('2', 'Biological Classification', '2.6', 'Viruses, Viroids, Prions and Lichens', 25, 2, TRUE),
  ('3', 'Plant Kingdom', '3.1', 'Algae', 26, 2, TRUE),
  ('3', 'Plant Kingdom', '3.1.1', 'Chlorophyceae', 27, 2, TRUE),
  ('3', 'Plant Kingdom', '3.1.2', 'Phaeophyceae', 28, 2, TRUE),
  ('3', 'Plant Kingdom', '3.1.3', 'Rhodophyceae', 29, 2, TRUE),
  ('3', 'Plant Kingdom', '3.2', 'Bryophytes', 30, 2, TRUE),
  ('3', 'Plant Kingdom', '3.2.1', 'Liverworts', 31, 2, TRUE),
  ('3', 'Plant Kingdom', '3.2.2', 'Mosses', 32, 2, TRUE),
  ('3', 'Plant Kingdom', '3.3', 'Pteridophytes', 33, 2, TRUE),
  ('3', 'Plant Kingdom', '3.4', 'Gymnosperms', 34, 2, TRUE),
  ('3', 'Plant Kingdom', '3.5', 'Angiosperms', 35, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1', 'Basis of Classification', 36, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.1', 'Levels of Organisation', 37, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.2', 'Symmetry', 38, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.3', 'Diploblastic and Triploblastic Organisation', 39, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.4', 'Coelom', 40, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.5', 'Segmentation', 41, 2, TRUE),
  ('4', 'Animal Kingdom', '4.1.6', 'Notochord', 42, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2', 'Classification of Animals', 43, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.1', 'Phylum Porifera', 44, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.2', 'Phylum Coelenterata (Cnidaria)', 45, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.3', 'Phylum Ctenophora', 46, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.4', 'Phylum Platyhelminthes', 47, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.5', 'Phylum Aschelminthes', 48, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.6', 'Phylum Annelida', 49, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.7', 'Phylum Arthropoda', 50, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.8', 'Phylum Mollusca', 51, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.9', 'Phylum Echinodermata', 52, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.10', 'Phylum Hemichordata', 53, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11', 'Phylum Chordata', 54, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.1', 'Class Cyclostomata', 55, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.2', 'Class Chondrichthyes', 56, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.3', 'Class Osteichthyes', 57, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.4', 'Class Amphibia', 58, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.5', 'Class Reptilia', 59, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.6', 'Class Aves', 60, 2, TRUE),
  ('4', 'Animal Kingdom', '4.2.11.7', 'Class Mammalia', 61, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.1', 'The Root', 62, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.1.1', 'Regions of the Root', 63, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.2', 'The Stem', 64, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.3', 'The Leaf', 65, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.3.1', 'Venation', 66, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.3.2', 'Types of Leaves', 67, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.3.3', 'Phyllotaxy', 68, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.4', 'The Inflorescence', 69, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5', 'The Flower', 70, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5.1', 'Parts of a Flower', 71, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5.1.1', 'Calyx', 72, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5.1.2', 'Corolla', 73, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5.1.3', 'Androecium', 74, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.5.1.4', 'Gynoecium', 75, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.6', 'The Fruit', 76, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.7', 'The Seed', 77, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.7.1', 'Structure of a Dicotyledonous Seed', 78, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.7.2', 'Structure of Monocotyledonous Seed', 79, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.8', 'Semi-technical Description of a Typical Flowering Plant', 80, 2, TRUE),
  ('5', 'Morphology of Flowering Plants', '5.9', 'Solanaceae', 81, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.1', 'The Tissue System', 82, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.1.1', 'Epidermal Tissue System', 83, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.1.2', 'The Ground Tissue System', 84, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.1.3', 'The Vascular Tissue System', 85, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2', 'Anatomy of Dicotyledonous and Monocotyledonous Plants', 86, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.1', 'Dicotyledonous Root', 87, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.2', 'Monocotyledonous Root', 88, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.3', 'Dicotyledonous Stem', 89, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.4', 'Monocotyledonous Stem', 90, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.5', 'Dorsiventral (Dicotyledonous) Leaf', 91, 2, TRUE),
  ('6', 'Anatomy of Flowering Plants', '6.2.6', 'Isobilateral (Monocotyledonous) Leaf', 92, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.1', 'Organ and Organ System', 93, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2', 'Frogs', 94, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.1', 'Morphology', 95, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2', 'Anatomy', 96, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.1', 'Digestive System', 97, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.2', 'Respiratory System', 98, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.3', 'Circulatory System', 99, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.4', 'Excretory System', 100, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.5', 'Nervous System and Endocrine System', 101, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.6', 'Sense Organs', 102, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.7', 'Male Reproductive System', 103, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.8', 'Female Reproductive System', 104, 2, TRUE),
  ('7', 'Structural Organisation in Animals', '7.2.2.9', 'Fertilisation and Development', 105, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.1', 'What is a Cell', 106, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.2', 'Cell Theory', 107, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.3', 'An Overview of Cell', 108, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.4', 'Prokaryotic Cells', 109, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.4.1', 'Cell Envelope and its Modifications', 110, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.4.2', 'Ribosomes and Inclusion Bodies', 111, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5', 'Eukaryotic Cells', 112, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.1', 'Cell Membrane', 113, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.2', 'Cell Wall', 114, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.3', 'Endomembrane System', 115, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.3.1', 'Endoplasmic Reticulum (ER)', 116, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.3.2', 'Golgi Apparatus', 117, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.3.3', 'Lysosomes', 118, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.3.4', 'Vacuoles', 119, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.4', 'Mitochondria', 120, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.5', 'Plastids', 121, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.6', 'Ribosomes', 122, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.7', 'Cytoskeleton', 123, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.8', 'Cilia and Flagella', 124, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.9', 'Centrosome and Centrioles', 125, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.10', 'Nucleus', 126, 2, TRUE),
  ('8', 'Cell The Unit of Life', '8.5.11', 'Microbodies', 127, 2, TRUE),
  ('9', 'Biomolecules', '9.1', 'How to Analyse Chemical Composition', 128, 2, TRUE),
  ('9', 'Biomolecules', '9.2', 'Primary and Secondary Metabolites', 129, 2, TRUE),
  ('9', 'Biomolecules', '9.3', 'Biomacromolecules', 130, 2, TRUE),
  ('9', 'Biomolecules', '9.4', 'Proteins', 131, 2, TRUE),
  ('9', 'Biomolecules', '9.5', 'Polysaccharides', 132, 2, TRUE),
  ('9', 'Biomolecules', '9.6', 'Nucleic Acids', 133, 2, TRUE),
  ('9', 'Biomolecules', '9.7', 'Structure of Proteins', 134, 2, TRUE),
  ('9', 'Biomolecules', '9.8', 'Enzymes', 135, 2, TRUE),
  ('9', 'Biomolecules', '9.8.1', 'Chemical Reactions', 136, 2, TRUE),
  ('9', 'Biomolecules', '9.8.2', 'How do Enzymes bring about such High Rates of Chemical Conversions', 137, 2, TRUE),
  ('9', 'Biomolecules', '9.8.3', 'Nature of Enzyme Action', 138, 2, TRUE),
  ('9', 'Biomolecules', '9.8.4', 'Factors Affecting Enzyme Activity', 139, 2, TRUE),
  ('9', 'Biomolecules', '9.8.5', 'Classification and Nomenclature of Enzymes', 140, 2, TRUE),
  ('9', 'Biomolecules', '9.8.6', 'Co-factors', 141, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.1', 'Cell Cycle', 142, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.1.1', 'Phases of Cell Cycle', 143, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2', 'M Phase', 144, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2.1', 'Prophase', 145, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2.2', 'Metaphase', 146, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2.3', 'Anaphase', 147, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2.4', 'Telophase', 148, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.2.5', 'Cytokinesis', 149, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.3', 'Significance of Mitosis', 150, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4', 'Meiosis', 151, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1', 'Meiosis I', 152, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.1', 'Leptotene', 153, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.2', 'Zygotene', 154, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.3', 'Pachytene', 155, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.4', 'Diplotene', 156, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.5', 'Diakinesis', 157, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.6', 'Metaphase I', 158, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.7', 'Anaphase I', 159, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.1.8', 'Telophase I', 160, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.2', 'Meiosis II', 161, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.2.1', 'Prophase II', 162, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.2.2', 'Metaphase II', 163, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.2.3', 'Anaphase II', 164, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.4.2.4', 'Telophase II', 165, 2, TRUE),
  ('10', 'Cell Cycle and Cell Division', '10.5', 'Significance of Meiosis', 166, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.1', 'What do we Know?', 167, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.2', 'Early Experiments', 168, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.3', 'Where does Photosynthesis take place?', 169, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.4', 'How many Types of Pigments are involved in Photosynthesis?', 170, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.5', 'What is Light Reaction?', 171, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.6', 'The Electron Transport', 172, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.6.1', 'Splitting of Water', 173, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.6.2', 'Cyclic and Non-cyclic Photophosphorylation', 174, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.6.3', 'Chemiosmotic Hypothesis', 175, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7', 'Where are the ATP and NADPH Used?', 176, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7.1', 'The Primary Acceptor of CO2', 177, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7.2', 'The Calvin Cycle', 178, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7.2.1', 'Carboxylation', 179, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7.2.2', 'Reduction', 180, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.7.2.3', 'Regeneration', 181, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.8', 'The C4 Pathway', 182, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.8.1', 'Kranz Anatomy', 183, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.8.2', 'Hatch and Slack Pathway', 184, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.9', 'Photorespiration', 185, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.10', 'Factors Affecting Photosynthesis', 186, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.10.1', 'Light', 187, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.10.2', 'Carbon Dioxide Concentration', 188, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.10.3', 'Temperature', 189, 2, TRUE),
  ('11', 'Photosynthesis in Higher Plants', '11.10.4', 'Water', 190, 2, TRUE),
  ('12', 'Respiration in Plants', '12.1', 'Do Plants Breathe?', 191, 2, TRUE),
  ('12', 'Respiration in Plants', '12.2', 'Glycolysis', 192, 2, TRUE),
  ('12', 'Respiration in Plants', '12.3', 'Fermentation', 193, 2, TRUE),
  ('12', 'Respiration in Plants', '12.4', 'Aerobic Respiration', 194, 2, TRUE),
  ('12', 'Respiration in Plants', '12.4.1', 'Tricarboxylic Acid Cycle', 195, 2, TRUE),
  ('12', 'Respiration in Plants', '12.4.2', 'Electron Transport System (ETS) and Oxidative Phosphorylation', 196, 2, TRUE),
  ('12', 'Respiration in Plants', '12.5', 'The Respiratory Balance Sheet', 197, 2, TRUE),
  ('12', 'Respiration in Plants', '12.6', 'Amphibolic Pathway', 198, 2, TRUE),
  ('12', 'Respiration in Plants', '12.7', 'Respiratory Quotient', 199, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1', 'Growth', 200, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1.1', 'Plant Growth Generally is Indeterminate', 201, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1.2', 'Growth is Measurable', 202, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1.3', 'Phases of Growth', 203, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1.4', 'Growth Rates', 204, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.1.5', 'Conditions for Growth', 205, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.2', 'Differentiation Dedifferentiation and Redifferentiation', 206, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.3', 'Development', 207, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4', 'Plant Growth Regulators', 208, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.1', 'Characteristics', 209, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.2', 'The Discovery of Plant Growth Regulators', 210, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3', 'Physiological Effects of Plant Growth Regulators', 211, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3.1', 'Auxins', 212, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3.2', 'Gibberellins', 213, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3.3', 'Cytokinins', 214, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3.4', 'Ethylene', 215, 2, TRUE),
  ('13', 'Plant Growth and Development', '13.4.3.5', 'Abscisic Acid', 216, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.1', 'Respiratory Organs', 217, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.1.1', 'Human Respiratory System', 218, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.2', 'Mechanism of Breathing', 219, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.2.1', 'Respiratory Volumes and Capacities', 220, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.3', 'Exchange of Gases', 221, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.4', 'Transport of Gases', 222, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.4.1', 'Transport of Oxygen', 223, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.4.2', 'Transport of Carbon Dioxide', 224, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.5', 'Regulation of Respiration', 225, 2, TRUE),
  ('14', 'Breathing and Exchange of Gases', '14.6', 'Disorders of Respiratory System', 226, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1', 'Blood', 227, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.1', 'Plasma', 228, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.2', 'Formed Elements', 229, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.3', 'Blood Groups', 230, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.3.1', 'ABO Grouping', 231, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.3.2', 'Rh Grouping', 232, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.1.4', 'Coagulation of Blood', 233, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.2', 'Lymph (Tissue Fluid)', 234, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.3', 'Circulatory Pathways', 235, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.3.1', 'Human Circulatory System', 236, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.3.2', 'Cardiac Cycle', 237, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.3.3', 'Electrocardiogram (ECG)', 238, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.4', 'Double Circulation', 239, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.5', 'Regulation of Cardiac Activity', 240, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.6', 'Disorders of Circulatory System', 241, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.6.1', 'High Blood Pressure (Hypertension)', 242, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.6.2', 'Coronary Artery Disease (CAD)', 243, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.6.3', 'Angina', 244, 2, TRUE),
  ('15', 'Body Fluids and Circulation', '15.6.4', 'Heart Failure', 245, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.1', 'Human Excretory System', 246, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.2', 'Urine Formation', 247, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.3', 'Function of the Tubules', 248, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.3.1', 'Proximal Convoluted Tubule (PCT)', 249, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.3.2', 'Henle''s Loop', 250, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.3.3', 'Distal Convoluted Tubule (DCT)', 251, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.3.4', 'Collecting Duct', 252, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.4', 'Mechanism of Concentration of the Filtrate', 253, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.5', 'Regulation of Kidney Function', 254, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.6', 'Micturition', 255, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.7', 'Role of Other Organs in Excretion', 256, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.8', 'Disorders of the Excretory System', 257, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.8.1', 'Uremia and Hemodialysis', 258, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.8.2', 'Kidney Transplantation', 259, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.8.3', 'Renal Calculi', 260, 2, TRUE),
  ('16', 'Excretory Products and Their Elimination', '16.8.4', 'Glomerulonephritis', 261, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.1', 'Types of Movement', 262, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.1.1', 'Amoeboid Movement', 263, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.1.2', 'Ciliary Movement', 264, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.1.3', 'Muscular Movement', 265, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2', 'Muscle', 266, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.1', 'Skeletal Muscles', 267, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.2', 'Visceral Muscles', 268, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.3', 'Cardiac Muscles', 269, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.4', 'Structure of Muscle Fibre', 270, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.5', 'Sarcolemma and Sarcoplasm', 271, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.6', 'Myofibrils and Myofilaments', 272, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.7', 'Sarcomere', 273, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.8', 'H-Zone', 274, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9', 'Structure of Contractile Proteins', 275, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9.1', 'Actin Filament', 276, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9.2', 'Tropomyosin', 277, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9.3', 'Troponin Complex', 278, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9.4', 'Myosin Filament', 279, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.9.5', 'Meromyosin (HMM and LMM)', 280, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10', 'Mechanism of Muscle Contraction', 281, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.1', 'Sliding Filament Theory', 282, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.2', 'Motor Unit', 283, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.3', 'Neuromuscular Junction', 284, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.4', 'Role of Acetylcholine', 285, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.5', 'Role of Calcium Ions', 286, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.6', 'Cross Bridge Formation', 287, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.7', 'ATP Hydrolysis and Muscle Contraction', 288, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.8', 'Muscle Relaxation', 289, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.9', 'Muscle Fatigue', 290, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.10', 'Red Muscle Fibres', 291, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.2.10.11', 'White Muscle Fibres', 292, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3', 'Skeletal System', 293, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.1', 'Axial Skeleton', 294, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.2', 'Skull', 295, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.2.1', 'Cranial Bones', 296, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.2.2', 'Facial Bones', 297, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.2.3', 'Hyoid Bone', 298, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.2.4', 'Ear Ossicles', 299, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3', 'Vertebral Column', 300, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3.1', 'Cervical Vertebrae', 301, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3.2', 'Thoracic Vertebrae', 302, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3.3', 'Lumbar Vertebrae', 303, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3.4', 'Sacral Region', 304, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.3.5', 'Coccygeal Region', 305, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.4', 'Sternum', 306, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.5', 'Ribs and Rib Cage', 307, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.5.1', 'True Ribs', 308, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.5.2', 'False Ribs', 309, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.5.3', 'Floating Ribs', 310, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.6', 'Appendicular Skeleton', 311, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.7', 'Fore Limb Bones', 312, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.8', 'Hind Limb Bones', 313, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.9', 'Pectoral Girdle', 314, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.9.1', 'Scapula', 315, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.9.2', 'Clavicle', 316, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10', 'Pelvic Girdle', 317, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10.1', 'Coxal Bone', 318, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10.2', 'Ilium', 319, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10.3', 'Ischium', 320, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10.4', 'Pubis', 321, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.3.10.5', 'Acetabulum', 322, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4', 'Joints', 323, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.1', 'Fibrous Joints', 324, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.2', 'Cartilaginous Joints', 325, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3', 'Synovial Joints', 326, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3.1', 'Ball and Socket Joint', 327, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3.2', 'Hinge Joint', 328, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3.3', 'Pivot Joint', 329, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3.4', 'Gliding Joint', 330, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.4.3.5', 'Saddle Joint', 331, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5', 'Disorders of Muscular and Skeletal System', 332, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.1', 'Myasthenia Gravis', 333, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.2', 'Muscular Dystrophy', 334, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.3', 'Tetany', 335, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.4', 'Arthritis', 336, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.5', 'Osteoporosis', 337, 2, TRUE),
  ('17', 'Locomotion and Movement', '17.5.6', 'Gout', 338, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.1', 'Neural System', 339, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.1.1', 'Neurons', 340, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.1.2', 'Neural Organisation in Hydra', 341, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.1.3', 'Neural Organisation in Insects', 342, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.1.4', 'Neural Organisation in Vertebrates', 343, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2', 'Human Neural System', 344, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.1', 'Central Neural System (CNS)', 345, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.2', 'Peripheral Neural System (PNS)', 346, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.3', 'Afferent Nerve Fibres', 347, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.4', 'Efferent Nerve Fibres', 348, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.5', 'Somatic Neural System', 349, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.6', 'Autonomic Neural System', 350, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.7', 'Sympathetic Neural System', 351, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.8', 'Parasympathetic Neural System', 352, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.2.9', 'Visceral Nervous System', 353, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3', 'Neuron as Structural and Functional Unit of Neural System', 354, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.1', 'Cell Body', 355, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.2', 'Nissl''s Granules', 356, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.3', 'Dendrites', 357, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.4', 'Axon', 358, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.5', 'Synaptic Knob', 359, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.6', 'Neurotransmitters', 360, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.7', 'Multipolar Neurons', 361, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.8', 'Bipolar Neurons', 362, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.9', 'Unipolar Neurons', 363, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.10', 'Myelinated Nerve Fibres', 364, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.11', 'Schwann Cells', 365, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.12', 'Myelin Sheath', 366, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.13', 'Nodes of Ranvier', 367, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.14', 'Non-Myelinated Nerve Fibres', 368, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15', 'Generation and Conduction of Nerve Impulse', 369, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.1', 'Polarised Membrane', 370, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.2', 'Resting Potential', 371, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.3', 'Sodium-Potassium Pump', 372, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.4', 'Depolarisation', 373, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.5', 'Action Potential', 374, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.6', 'Nerve Impulse', 375, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.7', 'Impulse Conduction Through Axon', 376, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.15.8', 'Repolarisation', 377, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16', 'Transmission of Impulses', 378, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.1', 'Synapse', 379, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.2', 'Synaptic Cleft', 380, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.3', 'Electrical Synapse', 381, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.4', 'Chemical Synapse', 382, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.5', 'Synaptic Vesicles', 383, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.6', 'Post-Synaptic Receptors', 384, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.7', 'Excitatory Potential', 385, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.3.16.8', 'Inhibitory Potential', 386, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4', 'Central Neural System', 387, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.1', 'Brain', 388, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.2', 'Cranial Meninges', 389, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.2.1', 'Dura Mater', 390, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.2.2', 'Arachnoid', 391, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.2.3', 'Pia Mater', 392, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3', 'Forebrain', 393, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.1', 'Cerebrum', 394, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.2', 'Cerebral Hemispheres', 395, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.3', 'Corpus Callosum', 396, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.4', 'Cerebral Cortex', 397, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.5', 'Grey Matter', 398, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.6', 'White Matter', 399, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.7', 'Motor Areas', 400, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.8', 'Sensory Areas', 401, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.9', 'Association Areas', 402, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.10', 'Thalamus', 403, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.11', 'Hypothalamus', 404, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.12', 'Hypothalamic Hormones', 405, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.13', 'Limbic Lobe', 406, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.14', 'Limbic System', 407, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.15', 'Amygdala', 408, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.3.16', 'Hippocampus', 409, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.4', 'Midbrain', 410, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.4.1', 'Cerebral Aqueduct', 411, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.4.2', 'Corpora Quadrigemina', 412, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.5', 'Hindbrain', 413, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.5.1', 'Pons', 414, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.5.2', 'Cerebellum', 415, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.5.3', 'Medulla Oblongata', 416, 2, TRUE),
  ('18', 'Neural Control and Coordination', '18.4.5.4', 'Brain Stem', 417, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.1', 'Endocrine Glands and Hormones', 418, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.1.1', 'Endocrine Glands', 419, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.1.2', 'Ductless Glands', 420, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.1.3', 'Hormones', 421, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.1.4', 'Intercellular Messengers', 422, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2', 'Human Endocrine System', 423, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1', 'Hypothalamus', 424, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.1', 'Neurosecretory Cells', 425, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.2', 'Hypothalamic Nuclei', 426, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.3', 'Releasing Hormones', 427, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.4', 'Inhibiting Hormones', 428, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.5', 'Gonadotrophin Releasing Hormone (GnRH)', 429, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.6', 'Somatostatin', 430, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.1.7', 'Portal Circulatory System', 431, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2', 'Pituitary Gland', 432, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.1', 'Sella Tursica', 433, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.2', 'Adenohypophysis', 434, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.3', 'Neurohypophysis', 435, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.4', 'Pars Distalis', 436, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.5', 'Pars Intermedia', 437, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.6', 'Pars Nervosa', 438, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.7', 'Growth Hormone (GH)', 439, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.8', 'Prolactin (PRL)', 440, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.9', 'Thyroid Stimulating Hormone (TSH)', 441, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.10', 'Adrenocorticotrophic Hormone (ACTH)', 442, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.11', 'Luteinizing Hormone (LH)', 443, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.12', 'Follicle Stimulating Hormone (FSH)', 444, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.13', 'Melanocyte Stimulating Hormone (MSH)', 445, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.14', 'Oxytocin', 446, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.15', 'Vasopressin (ADH)', 447, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.16', 'Gigantism', 448, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.17', 'Pituitary Dwarfism', 449, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.18', 'Acromegaly', 450, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.2.19', 'Diabetes Insipidus', 451, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.3', 'Pineal Gland', 452, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.3.1', 'Melatonin', 453, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.3.2', 'Sleep-Wake Cycle', 454, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.3.3', 'Diurnal Rhythm', 455, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4', 'Thyroid Gland', 456, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.1', 'Thyroid Follicles', 457, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.2', 'Follicular Cells', 458, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.3', 'Thyroxine (T4)', 459, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.4', 'Triiodothyronine (T3)', 460, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.5', 'Iodine Deficiency', 461, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.6', 'Hypothyroidism', 462, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.7', 'Goitre', 463, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.8', 'Cretinism', 464, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.9', 'Hyperthyroidism', 465, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.10', 'Exophthalmic Goitre', 466, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.11', 'Graves Disease', 467, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.12', 'Basal Metabolic Rate', 468, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.4.13', 'Thyrocalcitonin (TCT)', 469, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.5', 'Parathyroid Gland', 470, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.5.1', 'Parathyroid Hormone (PTH)', 471, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.5.2', 'Bone Resorption', 472, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.5.3', 'Hypercalcemic Hormone', 473, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.6', 'Thymus', 474, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.6.1', 'Thymosins', 475, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.6.2', 'T-Lymphocytes', 476, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.6.3', 'Cell-Mediated Immunity', 477, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.6.4', 'Humoral Immunity', 478, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7', 'Adrenal Gland', 479, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.1', 'Adrenal Cortex', 480, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.2', 'Adrenal Medulla', 481, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.3', 'Addison''s Disease', 482, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.4', 'Adrenaline (Epinephrine)', 483, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.5', 'Noradrenaline (Norepinephrine)', 484, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.6', 'Catecholamines', 485, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.7', 'Fight or Flight Response', 486, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.8', 'Zona Reticularis', 487, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.9', 'Zona Fasciculata', 488, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.10', 'Zona Glomerulosa', 489, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.11', 'Glucocorticoids', 490, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.12', 'Cortisol', 491, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.13', 'Mineralocorticoids', 492, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.14', 'Aldosterone', 493, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.7.15', 'Androgenic Steroids', 494, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8', 'Pancreas', 495, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.1', 'Islets of Langerhans', 496, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.2', 'Alpha Cells', 497, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.3', 'Beta Cells', 498, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.4', 'Glucagon', 499, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.5', 'Glycogenolysis', 500, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.6', 'Gluconeogenesis', 501, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.7', 'Hyperglycemia', 502, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.8', 'Insulin', 503, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.9', 'Glycogenesis', 504, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.10', 'Hypoglycemia', 505, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.8.11', 'Diabetes Mellitus', 506, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.9', 'Testis', 507, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.9.1', 'Leydig Cells', 508, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.9.2', 'Androgens', 509, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.9.3', 'Testosterone', 510, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.9.4', 'Spermatogenesis', 511, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.10', 'Ovary', 512, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.10.1', 'Estrogen', 513, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.10.2', 'Progesterone', 514, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.2.10.3', 'Corpus Luteum', 515, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3', 'Hormones of Heart Kidney and Gastrointestinal Tract', 516, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.1', 'Atrial Natriuretic Factor (ANF)', 517, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.2', 'Erythropoietin', 518, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.3', 'Gastrin', 519, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.4', 'Secretin', 520, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.5', 'Cholecystokinin (CCK)', 521, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.6', 'Gastric Inhibitory Peptide (GIP)', 522, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.3.7', 'Growth Factors', 523, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4', 'Mechanism of Hormone Action', 524, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.1', 'Hormone Receptors', 525, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.2', 'Membrane Bound Receptors', 526, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.3', 'Intracellular Receptors', 527, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.4', 'Nuclear Receptors', 528, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.5', 'Hormone Receptor Complex', 529, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.6', 'Second Messengers', 530, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.6.1', 'cAMP', 531, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.6.2', 'IP3', 532, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.6.3', 'Calcium Ion Signalling', 533, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.7', 'Peptide Hormones', 534, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.8', 'Steroid Hormones', 535, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.9', 'Iodothyronines', 536, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.10', 'Amino Acid Derivative Hormones', 537, 2, TRUE),
  ('19', 'Chemical Coordination and Integration', '19.4.11', 'Gene Expression Regulation', 538, 2, TRUE)
ON CONFLICT (fk_mst_book_id, chapter_number, section_number, topic_name) DO UPDATE
SET chapter_name = EXCLUDED.chapter_name,
    topic_name = EXCLUDED.topic_name,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS teacher_feedback_note CASCADE;
DROP TABLE IF EXISTS teacher_assignment CASCADE;
DROP TABLE IF EXISTS student_mastery CASCADE;
DROP TABLE IF EXISTS student_response CASCADE;
DROP TABLE IF EXISTS student_attempt_item CASCADE;
DROP TABLE IF EXISTS student_attempt CASCADE;
DROP TABLE IF EXISTS audit_event CASCADE;
DROP TABLE IF EXISTS editorial_comment CASCADE;
DROP TABLE IF EXISTS review_decision CASCADE;
DROP TABLE IF EXISTS review_queue CASCADE;
DROP TABLE IF EXISTS publish_bundle CASCADE;
DROP TABLE IF EXISTS practice_set_item CASCADE;
DROP TABLE IF EXISTS practice_set CASCADE;
DROP TABLE IF EXISTS question_bank_item_version CASCADE;
DROP TABLE IF EXISTS question_bank_item CASCADE;
DROP TABLE IF EXISTS layer7_learning_analytics CASCADE;
DROP TABLE IF EXISTS layer7_adaptive_next_action CASCADE;
DROP TABLE IF EXISTS layer7_performance_summary CASCADE;
DROP TABLE IF EXISTS layer7_parent_note CASCADE;
DROP TABLE IF EXISTS layer7_teacher_note CASCADE;
DROP TABLE IF EXISTS layer7_revision_note CASCADE;
DROP TABLE IF EXISTS layer7_adaptive_remediation CASCADE;
DROP TABLE IF EXISTS layer7_misconception_feedback CASCADE;
DROP TABLE IF EXISTS layer7_memory_reinforcement_retrieval_cue CASCADE;
DROP TABLE IF EXISTS layer7_memory_reinforcement CASCADE;
DROP TABLE IF EXISTS layer7_progressive_hint CASCADE;
DROP TABLE IF EXISTS layer7_distractor_analysis CASCADE;
DROP TABLE IF EXISTS layer7_learning_support CASCADE;
DROP TABLE IF EXISTS layer7_learning_support_contract CASCADE;
DROP TABLE IF EXISTS layer6_assessment_item_acceptable_answer CASCADE;
DROP TABLE IF EXISTS layer6_assessment_item_option CASCADE;
DROP TABLE IF EXISTS layer6_assessment_item CASCADE;
DROP TABLE IF EXISTS layer6_assessment_item_contract CASCADE;
DROP TABLE IF EXISTS layer5_blueprint_recommended_after_failure CASCADE;
DROP TABLE IF EXISTS layer5_blueprint_concept_dependency CASCADE;
DROP TABLE IF EXISTS layer5_blueprint_secondary_concept CASCADE;
DROP TABLE IF EXISTS layer5_item_blueprint CASCADE;
DROP TABLE IF EXISTS layer5_item_blueprint_contract CASCADE;
DROP TABLE IF EXISTS layer4_strategy_generator_constraint CASCADE;
DROP TABLE IF EXISTS layer4_strategy_remediation CASCADE;
DROP TABLE IF EXISTS layer4_strategy_recommendation CASCADE;
DROP TABLE IF EXISTS layer4_assessment_strategy CASCADE;
DROP TABLE IF EXISTS layer4_assessment_strategy_contract CASCADE;
DROP TABLE IF EXISTS layer3_capability_opportunity CASCADE;
DROP TABLE IF EXISTS layer3_capability_dependency CASCADE;
DROP TABLE IF EXISTS layer3_capability_dimension CASCADE;
DROP TABLE IF EXISTS layer3_assessment_capability CASCADE;
DROP TABLE IF EXISTS layer3_assessment_capability_contract CASCADE;
DROP TABLE IF EXISTS layer2_concept_memory_associated_concept CASCADE;
DROP TABLE IF EXISTS layer2_concept_memory_retrieval_cue CASCADE;
DROP TABLE IF EXISTS layer2_concept_memory_supporting_concept CASCADE;
DROP TABLE IF EXISTS layer2_concept_memory CASCADE;
DROP TABLE IF EXISTS layer2_concept_memory_contract CASCADE;
DROP TABLE IF EXISTS layer1_assessment_unit CASCADE;
DROP TABLE IF EXISTS layer1_question_pattern CASCADE;
DROP TABLE IF EXISTS layer1_memory_hook CASCADE;
DROP TABLE IF EXISTS layer1_common_misconception CASCADE;
DROP TABLE IF EXISTS layer1_exception CASCADE;
DROP TABLE IF EXISTS layer1_terminology_related_concept CASCADE;
DROP TABLE IF EXISTS layer1_terminology CASCADE;
DROP TABLE IF EXISTS layer1_diagram_tested_label CASCADE;
DROP TABLE IF EXISTS layer1_diagram_label CASCADE;
DROP TABLE IF EXISTS layer1_diagram CASCADE;
DROP TABLE IF EXISTS layer1_classification_group CASCADE;
DROP TABLE IF EXISTS layer1_classification CASCADE;
DROP TABLE IF EXISTS layer1_comparison_similarity CASCADE;
DROP TABLE IF EXISTS layer1_comparison_difference CASCADE;
DROP TABLE IF EXISTS layer1_comparison CASCADE;
DROP TABLE IF EXISTS layer1_relationship CASCADE;
DROP TABLE IF EXISTS layer1_cause_effect CASCADE;
DROP TABLE IF EXISTS layer1_stage_sequence_stage CASCADE;
DROP TABLE IF EXISTS layer1_stage_sequence CASCADE;
DROP TABLE IF EXISTS layer1_process_step CASCADE;
DROP TABLE IF EXISTS layer1_process_output CASCADE;
DROP TABLE IF EXISTS layer1_process_input CASCADE;
DROP TABLE IF EXISTS layer1_process CASCADE;
DROP TABLE IF EXISTS layer1_function CASCADE;
DROP TABLE IF EXISTS layer1_structure_part CASCADE;
DROP TABLE IF EXISTS layer1_structure CASCADE;
DROP TABLE IF EXISTS layer1_core_concept CASCADE;
DROP TABLE IF EXISTS layer1_knowledge_contract CASCADE;
DROP TABLE IF EXISTS concept_alias CASCADE;
DROP TABLE IF EXISTS concept CASCADE;
DROP TABLE IF EXISTS assessment_unit_dependency CASCADE;
DROP TABLE IF EXISTS assessment_unit_supporting_concept CASCADE;
DROP TABLE IF EXISTS assessment_unit CASCADE;
DROP TABLE IF EXISTS layer_contract_dependency CASCADE;
DROP TABLE IF EXISTS layer_output_contract CASCADE;
DROP TABLE IF EXISTS layer_input_contract CASCADE;
DROP TABLE IF EXISTS layer_run CASCADE;
DROP TABLE IF EXISTS assessment_pipeline_run_layer CASCADE;
DROP TABLE IF EXISTS assessment_pipeline_run CASCADE;
DROP TABLE IF EXISTS source_parse_version CASCADE;
DROP TABLE IF EXISTS source_ocr_text CASCADE;
DROP TABLE IF EXISTS source_section_image CASCADE;
DROP TABLE IF EXISTS source_section CASCADE;
DROP TABLE IF EXISTS source_document CASCADE;
DROP TABLE IF EXISTS generation_registry CASCADE;
DROP TABLE IF EXISTS mst_section CASCADE;

CREATE TABLE IF NOT EXISTS generation_registry (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  pipeline_job_id UUID,
  layer_number INTEGER NOT NULL,
  layer_name VARCHAR(120) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  contract_schema_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_name VARCHAR(120),
  openai_response_id VARCHAR(120),
  cache_key TEXT,
  source_hash TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_pipeline_run (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE,
  source_document_id BIGINT,
  source_section_id BIGINT,
  fk_mst_chapter_id BIGINT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_pipeline_run_layer (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES assessment_pipeline_run(job_id) ON DELETE CASCADE,
  generation_id UUID REFERENCES generation_registry(generation_id) ON DELETE SET NULL,
  layer_number INTEGER NOT NULL,
  layer_name VARCHAR(120) NOT NULL,
  source_section_id BIGINT,
  assessment_unit_id VARCHAR(80),
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_name VARCHAR(120),
  status VARCHAR(40) NOT NULL DEFAULT 'queued',
  is_cached BOOLEAN NOT NULL DEFAULT FALSE,
  token_input INTEGER NOT NULL DEFAULT 0,
  token_output INTEGER NOT NULL DEFAULT 0,
  openai_response_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_document (
  id BIGSERIAL PRIMARY KEY,
  document_code VARCHAR(80) UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(60) NOT NULL DEFAULT 'textbook',
  board_name VARCHAR(120),
  class_name VARCHAR(120),
  subject_name VARCHAR(120),
  chapter_name VARCHAR(255),
  language_code VARCHAR(20) NOT NULL DEFAULT 'en',
  owner_user_id BIGINT REFERENCES users(id),
  review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_section (
  id BIGSERIAL PRIMARY KEY,
  source_document_id BIGINT NOT NULL REFERENCES source_document(id) ON DELETE CASCADE,
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  section_code VARCHAR(80),
  section_number VARCHAR(80),
  title VARCHAR(255) NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_document_id, section_code)
);

CREATE TABLE IF NOT EXISTS content_update_event (
  id BIGSERIAL PRIMARY KEY,
  exam_goal_code VARCHAR(20) NOT NULL,
  level_code VARCHAR(20) NOT NULL,
  subject_code VARCHAR(20) NOT NULL,
  chapter_number VARCHAR(40),
  chapter_name VARCHAR(255) NOT NULL,
  section_number VARCHAR(80),
  topic_name VARCHAR(255),
  source_section_id BIGINT REFERENCES source_section(id) ON DELETE SET NULL,
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id) ON DELETE SET NULL,
  target_layer_number INTEGER,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_update_event_audience
ON content_update_event (exam_goal_code, level_code, subject_code, created_at DESC);

CREATE TABLE IF NOT EXISTS source_section_image (
  id BIGSERIAL PRIMARY KEY,
  source_section_id BIGINT NOT NULL REFERENCES source_section(id) ON DELETE CASCADE,
  image_sequence INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  width_px INTEGER,
  height_px INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_ocr_text (
  id BIGSERIAL PRIMARY KEY,
  source_section_id BIGINT NOT NULL REFERENCES source_section(id) ON DELETE CASCADE,
  ocr_provider VARCHAR(120),
  ocr_confidence NUMERIC(5,4),
  raw_text TEXT,
  normalized_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_parse_version (
  id BIGSERIAL PRIMARY KEY,
  source_section_id BIGINT NOT NULL REFERENCES source_section(id) ON DELETE CASCADE,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  generation_id UUID REFERENCES generation_registry(generation_id),
  parse_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  parser_name VARCHAR(120),
  parse_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  parsed_text TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer_run (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  layer_number INTEGER NOT NULL,
  layer_name VARCHAR(120) NOT NULL,
  source_document_id BIGINT REFERENCES source_document(id),
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  assessment_unit_id VARCHAR(80),
  parent_generation_id UUID REFERENCES generation_registry(generation_id),
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  contract_schema_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_name VARCHAR(120),
  openai_response_id VARCHAR(120),
  cache_key TEXT,
  source_hash TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  token_input INTEGER NOT NULL DEFAULT 0,
  token_output INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer_input_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  layer_number INTEGER NOT NULL,
  layer_name VARCHAR(120) NOT NULL,
  source_document_id BIGINT REFERENCES source_document(id),
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  assessment_unit_id VARCHAR(80),
  parent_generation_id UUID REFERENCES generation_registry(generation_id),
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  contract_schema_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_name VARCHAR(120),
  openai_response_id VARCHAR(120),
  cache_key TEXT,
  source_hash TEXT,
  input_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  token_input INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer_output_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  layer_number INTEGER NOT NULL,
  layer_name VARCHAR(120) NOT NULL,
  source_document_id BIGINT REFERENCES source_document(id),
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  assessment_unit_id VARCHAR(80),
  parent_generation_id UUID REFERENCES generation_registry(generation_id),
  prompt_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  contract_schema_version VARCHAR(50) NOT NULL DEFAULT '1.0',
  model_name VARCHAR(120),
  openai_response_id VARCHAR(120),
  cache_key TEXT,
  source_hash TEXT,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  token_output INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer_contract_dependency (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  depends_on_generation_id UUID NOT NULL REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  dependency_role VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (generation_id, depends_on_generation_id, dependency_role)
);

CREATE TABLE IF NOT EXISTS layer_generation_version (
  id BIGSERIAL PRIMARY KEY,
  assessment_unit_id VARCHAR(80) NOT NULL,
  layer_number INTEGER NOT NULL,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  token_input INTEGER NOT NULL DEFAULT 0,
  token_output INTEGER NOT NULL DEFAULT 0,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_unit_id, layer_number, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_layer_generation_version_selected
  ON layer_generation_version (assessment_unit_id, layer_number)
  WHERE is_selected;

CREATE INDEX IF NOT EXISTS idx_layer_generation_version_lookup
  ON layer_generation_version (assessment_unit_id, layer_number);

-- 'approved' | 'rejected' ('pending' reserved for a future moderator-triggered
-- regeneration flow). Defaults to 'approved' so existing/future admin-direct
-- pipeline generations keep their current visibility; only a moderator
-- "request changes"/"reject" decision ever moves a version to 'rejected'.
ALTER TABLE layer_generation_version
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS assessment_unit (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) NOT NULL UNIQUE,
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  primary_concept VARCHAR(255) NOT NULL,
  learning_objective TEXT,
  concept_category VARCHAR(80) NOT NULL,
  curriculum_importance VARCHAR(40) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_unit_supporting_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  supporting_concept VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assessment_unit_dependency (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  depends_on_assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  dependency_type VARCHAR(80) NOT NULL DEFAULT 'prerequisite',
  UNIQUE (assessment_unit_id, depends_on_assessment_unit_id, dependency_type)
);

CREATE TABLE IF NOT EXISTS concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  concept_name VARCHAR(255) NOT NULL,
  concept_family VARCHAR(80) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS concept_alias (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  concept_id BIGINT NOT NULL REFERENCES concept(id) ON DELETE CASCADE,
  alias_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS layer1_knowledge_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  source_section_id BIGINT REFERENCES source_section(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  context_summary TEXT NOT NULL,
  contract_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer1_core_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  concept_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_structure (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(120),
  location TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS layer1_structure_part (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_structure_id BIGINT NOT NULL REFERENCES layer1_structure(id) ON DELETE CASCADE,
  important_part VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_function (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  structure_name VARCHAR(255),
  function_text TEXT NOT NULL,
  importance TEXT,
  related_process VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS layer1_process (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  name VARCHAR(255) NOT NULL,
  purpose TEXT,
  location TEXT
);

CREATE TABLE IF NOT EXISTS layer1_process_input (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_process_id BIGINT NOT NULL REFERENCES layer1_process(id) ON DELETE CASCADE,
  input_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_process_output (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_process_id BIGINT NOT NULL REFERENCES layer1_process(id) ON DELETE CASCADE,
  output_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_process_step (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_process_id BIGINT NOT NULL REFERENCES layer1_process(id) ON DELETE CASCADE,
  step_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_stage_sequence (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  name VARCHAR(255) NOT NULL,
  sequence_type VARCHAR(120),
  important_notes TEXT
);

CREATE TABLE IF NOT EXISTS layer1_stage_sequence_stage (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_stage_sequence_id BIGINT NOT NULL REFERENCES layer1_stage_sequence(id) ON DELETE CASCADE,
  stage_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_cause_effect (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  cause TEXT NOT NULL,
  effect TEXT NOT NULL,
  biological_reason TEXT
);

CREATE TABLE IF NOT EXISTS layer1_relationship (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  relationship_name VARCHAR(255) NOT NULL,
  relationship_type VARCHAR(100),
  related_concepts TEXT[] NOT NULL DEFAULT '{}',
  relationship_summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS layer1_comparison (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  entity_1 VARCHAR(255) NOT NULL,
  entity_2 VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS layer1_comparison_difference (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_comparison_id BIGINT NOT NULL REFERENCES layer1_comparison(id) ON DELETE CASCADE,
  difference_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_comparison_similarity (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_comparison_id BIGINT NOT NULL REFERENCES layer1_comparison(id) ON DELETE CASCADE,
  similarity_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_classification (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  category VARCHAR(255) NOT NULL,
  classification_basis TEXT
);

CREATE TABLE IF NOT EXISTS layer1_classification_group (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_classification_id BIGINT NOT NULL REFERENCES layer1_classification(id) ON DELETE CASCADE,
  group_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_diagram (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  diagram_name VARCHAR(255) NOT NULL,
  purpose TEXT
);

CREATE TABLE IF NOT EXISTS layer1_diagram_label (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_diagram_id BIGINT NOT NULL REFERENCES layer1_diagram(id) ON DELETE CASCADE,
  label_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_diagram_tested_label (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_diagram_id BIGINT NOT NULL REFERENCES layer1_diagram(id) ON DELETE CASCADE,
  label_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_terminology (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  term VARCHAR(255) NOT NULL,
  definition TEXT
);

CREATE TABLE IF NOT EXISTS layer1_terminology_related_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer1_terminology_id BIGINT NOT NULL REFERENCES layer1_terminology(id) ON DELETE CASCADE,
  related_concept VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_exception (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  topic VARCHAR(255) NOT NULL,
  exception_text TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS layer1_common_misconception (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  concept VARCHAR(255),
  misconception TEXT NOT NULL,
  reason_for_confusion TEXT,
  correction TEXT
);

CREATE TABLE IF NOT EXISTS layer1_memory_hook (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  concept VARCHAR(255) NOT NULL,
  memory_type VARCHAR(80),
  memory_hook TEXT NOT NULL,
  why_it_helps TEXT
);

CREATE TABLE IF NOT EXISTS layer1_question_pattern (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  pattern_name VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer1_assessment_unit (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) NOT NULL,
  primary_concept VARCHAR(255) NOT NULL,
  learning_objective TEXT,
  concept_category VARCHAR(80) NOT NULL,
  curriculum_importance VARCHAR(40) NOT NULL,
  UNIQUE (generation_id, assessment_unit_id)
);

ALTER TABLE IF EXISTS assessment_unit
ADD COLUMN IF NOT EXISTS learning_objective TEXT;

ALTER TABLE IF EXISTS layer1_assessment_unit
ADD COLUMN IF NOT EXISTS learning_objective TEXT;

CREATE TABLE IF NOT EXISTS layer2_concept_memory_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  contract_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer2_concept_memory (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  primary_concept VARCHAR(255) NOT NULL,
  canonical_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  story TEXT,
  analogy TEXT,
  visual_hook TEXT,
  real_world_connection TEXT,
  memory_trick TEXT,
  curiosity_hook TEXT,
  micro_activity TEXT,
  misconception_alert TEXT,
  memory_difficulty VARCHAR(40),
  estimated_memory_strength NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  UNIQUE (generation_id, assessment_unit_id)
);

ALTER TABLE IF EXISTS layer2_concept_memory
ADD COLUMN IF NOT EXISTS curiosity_hook TEXT;

ALTER TABLE IF EXISTS layer2_concept_memory
ADD COLUMN IF NOT EXISTS micro_activity TEXT;

ALTER TABLE IF EXISTS layer2_concept_memory
ADD COLUMN IF NOT EXISTS canonical_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS layer2_concept_memory_supporting_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer2_concept_memory_id BIGINT NOT NULL REFERENCES layer2_concept_memory(id) ON DELETE CASCADE,
  supporting_concept VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer2_concept_memory_retrieval_cue (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer2_concept_memory_id BIGINT NOT NULL REFERENCES layer2_concept_memory(id) ON DELETE CASCADE,
  retrieval_cue VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer2_concept_memory_associated_concept (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer2_concept_memory_id BIGINT NOT NULL REFERENCES layer2_concept_memory(id) ON DELETE CASCADE,
  associated_concept VARCHAR(255) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

-- Whatever media (image or video) is currently attached to one of the 7
-- Layer 2 memory-hook sections, run AFTER Layer 2 has already been
-- generated -- deliberately NOT wired into generation_registry/
-- layer_generation_version (those are keyed to real pipeline layers 1-7;
-- inventing a fictitious "layer 8" would misuse that idiom). Mirrors just
-- the version_number + is_selected + partial-unique-index pattern already
-- established there. Two ways to fill a section's media slot -- AI
-- generation (source='generated', image only) or a manual admin upload
-- (source='uploaded', image or video) -- share this same table and
-- versioning: whichever happened most recently is is_selected.
-- Supersedes the earlier image-only memory_hook_image table (left in place,
-- unused, per this file's additive-only convention).
CREATE TABLE IF NOT EXISTS memory_hook_media (
  id BIGSERIAL PRIMARY KEY,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  section_key VARCHAR(24) NOT NULL CHECK (section_key IN (
    'analogy', 'visualHook', 'curiosityHook', 'memoryTrick',
    'story', 'realWorldConnection', 'microActivity'
  )),
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  source VARCHAR(10) NOT NULL CHECK (source IN ('generated', 'uploaded')),
  version_number INTEGER NOT NULL,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  prompt_text TEXT,
  aspect_ratio VARCHAR(10) DEFAULT '3:2',
  media_data TEXT NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  original_file_name VARCHAR(255),
  model_name VARCHAR(120),
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  error_message TEXT,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_unit_id, section_key, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_hook_media_selected
ON memory_hook_media (assessment_unit_id, section_key) WHERE is_selected;

-- Append-only log of a student's own responses to the Layer 2 "Try This"
-- micro-activity prompt, plus the qualitative AI feedback each one got. No
-- is_selected/versioning idiom here -- unlike memory_hook_media, there's no
-- single "active" response to pick, just a history read via ORDER BY
-- created_at DESC.
CREATE TABLE IF NOT EXISTS micro_activity_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_micro_activity_response_lookup
ON micro_activity_response (user_id, assessment_unit_id, created_at DESC);

-- Chapter-end textbook exercise questions, extracted from an admin-uploaded
-- photo of the exercise page. Keyed by (fk_mst_book_id, chapter_number) --
-- NOT a single mst_chapter row, since mst_chapter is itself row-per-section
-- (it carries section_number/topic_name), so "a whole chapter" has no single
-- row to reference. Unlike Layer 6 items (generated from chapter body text
-- with no single right answer to guess), these questions DO have one true
-- answer that the AI must infer without seeing an answer key -- hence the
-- approval_status gate: nothing reaches students until a moderator approves it.
CREATE TABLE IF NOT EXISTS chapter_exercise_upload (
  id BIGSERIAL PRIMARY KEY,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  chapter_number VARCHAR(40) NOT NULL,
  chapter_name VARCHAR(255),
  image_data TEXT NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  pipeline_job_id UUID REFERENCES assessment_pipeline_run(job_id) ON DELETE SET NULL,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chapter_exercise_question (
  id BIGSERIAL PRIMARY KEY,
  chapter_exercise_upload_id BIGINT NOT NULL REFERENCES chapter_exercise_upload(id) ON DELETE CASCADE,
  fk_mst_book_id BIGINT NOT NULL REFERENCES mst_book(id),
  chapter_number VARCHAR(40) NOT NULL,
  question_number VARCHAR(20),
  question_text TEXT NOT NULL,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('single_select', 'free_text', 'matching')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT,
  interaction_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  reviewed_by BIGINT REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chapter_exercise_question_lookup
ON chapter_exercise_question (fk_mst_book_id, chapter_number, approval_status);

-- Upsert-on-conflict (one current answer per student per question), unlike
-- micro_activity_response's append-only history -- here we want a clean
-- answered/correct state per question to drive the Book Questions %.
CREATE TABLE IF NOT EXISTS chapter_exercise_response (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chapter_exercise_question_id BIGINT NOT NULL REFERENCES chapter_exercise_question(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN,
  feedback_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_exercise_question_id)
);

CREATE TABLE IF NOT EXISTS layer3_assessment_capability_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer4_assessment_strategy_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer5_item_blueprint_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  blueprint_id VARCHAR(80),
  output_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer5_item_blueprint (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  blueprint_id VARCHAR(80) NOT NULL UNIQUE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  question_family VARCHAR(120) NOT NULL,
  interaction_type VARCHAR(120) NOT NULL,
  expected_answer_type VARCHAR(120) NOT NULL,
  blooms_level VARCHAR(80) NOT NULL,
  difficulty VARCHAR(40) NOT NULL,
  marks INTEGER NOT NULL DEFAULT 0,
  estimated_time_seconds INTEGER NOT NULL DEFAULT 0,
  common_misconception TEXT,
  success_criteria TEXT,
  memory_support JSONB NOT NULL DEFAULT '{}'::jsonb,
  generator_constraints JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS layer6_assessment_item_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  contract_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer6_assessment_item (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  item_id VARCHAR(80) NOT NULL UNIQUE,
  blueprint_id VARCHAR(80) REFERENCES layer5_item_blueprint(blueprint_id) ON DELETE SET NULL,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  question_family VARCHAR(120),
  interaction_type VARCHAR(120),
  difficulty VARCHAR(40),
  blooms_level VARCHAR(80),
  assessment_dimension VARCHAR(120),
  learning_objective TEXT,
  question TEXT NOT NULL,
  correct_answer TEXT,
  interaction_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagram_instruction TEXT,
  marks INTEGER NOT NULL DEFAULT 0,
  estimated_time_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer6_assessment_item_option (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer6_assessment_item_id BIGINT NOT NULL REFERENCES layer6_assessment_item(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer6_assessment_item_acceptable_answer (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer6_assessment_item_id BIGINT NOT NULL REFERENCES layer6_assessment_item(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer7_learning_support_contract (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL UNIQUE REFERENCES generation_registry(generation_id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  contract_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS layer7_learning_support (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  concept_explanation TEXT,
  correct_answer_reasoning TEXT,
  real_world_insight TEXT,
  mastery_recommendation VARCHAR(80)
);

CREATE TABLE IF NOT EXISTS layer7_distractor_analysis (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer7_learning_support_id BIGINT NOT NULL REFERENCES layer7_learning_support(id) ON DELETE CASCADE,
  option_text TEXT,
  reason_selected TEXT,
  why_incorrect TEXT,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer7_progressive_hint (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer7_learning_support_id BIGINT NOT NULL REFERENCES layer7_learning_support(id) ON DELETE CASCADE,
  hint_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS layer7_misconception_feedback (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer7_learning_support_id BIGINT NOT NULL REFERENCES layer7_learning_support(id) ON DELETE CASCADE,
  misconception TEXT,
  reason TEXT,
  correction TEXT
);

CREATE TABLE IF NOT EXISTS layer7_adaptive_remediation (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID NOT NULL REFERENCES generation_registry(generation_id),
  layer7_learning_support_id BIGINT NOT NULL REFERENCES layer7_learning_support(id) ON DELETE CASCADE,
  remediation_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_bank_item (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES generation_registry(generation_id),
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  blueprint_id VARCHAR(80) REFERENCES layer5_item_blueprint(blueprint_id) ON DELETE SET NULL,
  item_id VARCHAR(80) REFERENCES layer6_assessment_item(item_id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  current_version_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_question_bank_item_item_id
ON question_bank_item (item_id) WHERE item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS question_bank_item_version (
  id BIGSERIAL PRIMARY KEY,
  question_bank_item_id BIGINT NOT NULL REFERENCES question_bank_item(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  generation_id UUID REFERENCES generation_registry(generation_id),
  item_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  review_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_bank_item_id, version_number)
);

CREATE TABLE IF NOT EXISTS practice_set (
  id BIGSERIAL PRIMARY KEY,
  practice_set_code VARCHAR(80) UNIQUE,
  name VARCHAR(255) NOT NULL,
  fk_mst_practice_type_id BIGINT REFERENCES mst_practice_type(id),
  fk_mst_subject_id BIGINT REFERENCES mst_subject(id),
  fk_mst_level_id BIGINT REFERENCES mst_level(id),
  fk_mst_exam_goal_id BIGINT REFERENCES mst_exam_goal(id),
  fk_mst_chapter_id BIGINT REFERENCES mst_chapter(id),
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE practice_set
ADD COLUMN IF NOT EXISTS source_section_id BIGINT REFERENCES source_section(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_set_source_section
ON practice_set (source_section_id) WHERE source_section_id IS NOT NULL;

ALTER TABLE practice_set
ADD COLUMN IF NOT EXISTS source_assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_set_source_assessment_unit
ON practice_set (source_assessment_unit_id) WHERE source_assessment_unit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS practice_set_item (
  id BIGSERIAL PRIMARY KEY,
  practice_set_id BIGINT NOT NULL REFERENCES practice_set(id) ON DELETE CASCADE,
  question_bank_item_id BIGINT NOT NULL REFERENCES question_bank_item(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  publish_state VARCHAR(40) NOT NULL DEFAULT 'draft',
  UNIQUE (practice_set_id, question_bank_item_id)
);

CREATE TABLE IF NOT EXISTS publish_bundle (
  id BIGSERIAL PRIMARY KEY,
  bundle_code VARCHAR(80) UNIQUE,
  practice_set_id BIGINT REFERENCES practice_set(id) ON DELETE CASCADE,
  published_by BIGINT REFERENCES users(id),
  publish_status VARCHAR(40) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS review_queue (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  assigned_to BIGINT REFERENCES users(id),
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- entity_type = 'section_layer', entity_id = source_section.id: a moderation
-- task bundles review of one section's layer across all its assessment units.
ALTER TABLE review_queue
ADD COLUMN IF NOT EXISTS layer_number INTEGER;

ALTER TABLE review_queue
ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS review_decision (
  id BIGSERIAL PRIMARY KEY,
  review_queue_id BIGINT NOT NULL REFERENCES review_queue(id) ON DELETE CASCADE,
  decision VARCHAR(40) NOT NULL,
  decision_notes TEXT,
  decided_by BIGINT REFERENCES users(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS editorial_comment (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NOT NULL,
  comment_text TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_event (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_attempt (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_set_id BIGINT NOT NULL REFERENCES practice_set(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(8,2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_attempt_in_progress
ON student_attempt (user_id, practice_set_id) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS student_attempt_item (
  id BIGSERIAL PRIMARY KEY,
  student_attempt_id BIGINT NOT NULL REFERENCES student_attempt(id) ON DELETE CASCADE,
  question_bank_item_id BIGINT REFERENCES question_bank_item(id) ON DELETE SET NULL,
  item_id VARCHAR(80) REFERENCES layer6_assessment_item(item_id) ON DELETE SET NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  marks_awarded NUMERIC(8,2),
  UNIQUE (student_attempt_id, display_order)
);

CREATE TABLE IF NOT EXISTS student_response (
  id BIGSERIAL PRIMARY KEY,
  generation_id UUID REFERENCES generation_registry(generation_id),
  student_attempt_id BIGINT REFERENCES student_attempt(id) ON DELETE CASCADE,
  student_attempt_item_id BIGINT REFERENCES student_attempt_item(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  student_answer TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0,
  confidence_rating NUMERIC(4,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_mastery (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) NOT NULL REFERENCES assessment_unit(assessment_unit_id) ON DELETE CASCADE,
  mastery_level VARCHAR(40) NOT NULL DEFAULT 'Needs Practice',
  mastery_probability NUMERIC(4,3) NOT NULL DEFAULT 0.000,
  last_generation_id UUID REFERENCES generation_registry(generation_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, assessment_unit_id)
);

CREATE TABLE IF NOT EXISTS teacher_assignment (
  id BIGSERIAL PRIMARY KEY,
  teacher_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  practice_set_id BIGINT REFERENCES practice_set(id) ON DELETE SET NULL,
  assignment_status VARCHAR(40) NOT NULL DEFAULT 'assigned',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS teacher_feedback_note (
  id BIGSERIAL PRIMARY KEY,
  teacher_assignment_id BIGINT REFERENCES teacher_assignment(id) ON DELETE CASCADE,
  student_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  assessment_unit_id VARCHAR(80) REFERENCES assessment_unit(assessment_unit_id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generation_registry_layer
ON generation_registry (layer_number, layer_name, status);

CREATE INDEX IF NOT EXISTS idx_generation_registry_pipeline_job
ON generation_registry (pipeline_job_id, layer_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_registry_layer_cache
ON generation_registry (layer_number, prompt_version, model_name, cache_key, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_pipeline_run_status
ON assessment_pipeline_run (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_pipeline_run_layer_job
ON assessment_pipeline_run_layer (job_id, layer_number, assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_source_section_mst_chapter
ON source_section (fk_mst_chapter_id);

CREATE INDEX IF NOT EXISTS idx_layer_run_section
ON layer_run (source_section_id, fk_mst_chapter_id, layer_number);

CREATE INDEX IF NOT EXISTS idx_layer_output_contract_generation_status
ON layer_output_contract (generation_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_unit_section
ON assessment_unit (source_section_id, fk_mst_chapter_id);

CREATE INDEX IF NOT EXISTS idx_layer1_assessment_unit
ON layer1_assessment_unit (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_layer2_concept_memory_au
ON layer2_concept_memory (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_layer5_item_blueprint_au
ON layer5_item_blueprint (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_layer6_assessment_item_au
ON layer6_assessment_item (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_layer7_learning_support_au
ON layer7_learning_support (assessment_unit_id);

CREATE INDEX IF NOT EXISTS idx_student_response_au
ON student_response (assessment_unit_id, created_at);

DROP MATERIALIZED VIEW IF EXISTS mv_book_catalog;

CREATE MATERIALIZED VIEW mv_book_catalog AS
SELECT
  book.id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  subject.display_order AS subject_display_order,
  subject.is_active AS subject_is_active,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  level.display_order AS level_display_order,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  exam_goal.is_active AS exam_goal_is_active,
  exam_type.id AS exam_type_id,
  exam_type.type_id AS exam_type_code,
  exam_type.name AS exam_type_name,
  state.id AS state_id,
  state.state_id AS state_code,
  state.name AS state_name,
  country.id AS country_id,
  country.name_code AS country_code,
  country.name AS country_name
FROM mst_book AS book
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
JOIN mst_exam_type AS exam_type
  ON exam_type.id = exam_goal.fk_mst_exam_type_id
JOIN mst_state AS state
  ON state.id = exam_goal.fk_state_id
JOIN mst_country AS country
  ON country.id = state.fk_country_id;

CREATE UNIQUE INDEX idx_mv_book_catalog_book_id
ON mv_book_catalog (book_id);

CREATE INDEX idx_mv_book_catalog_filters
ON mv_book_catalog (
  subject_code,
  level_code,
  exam_goal_code,
  book_is_active
);

DROP MATERIALIZED VIEW IF EXISTS mv_chapter_catalog;

CREATE MATERIALIZED VIEW mv_chapter_catalog AS
SELECT
  chapter.id AS chapter_id,
  chapter.chapter_number,
  chapter.chapter_name,
  chapter.section_number,
  chapter.topic_name,
  chapter.display_order AS chapter_display_order,
  chapter.is_active AS chapter_is_active,
  chapter.fk_mst_book_id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  exam_type.id AS exam_type_id,
  exam_type.type_id AS exam_type_code,
  exam_type.name AS exam_type_name,
  state.id AS state_id,
  state.state_id AS state_code,
  state.name AS state_name,
  country.id AS country_id,
  country.name_code AS country_code,
  country.name AS country_name,
  COALESCE(array_length(string_to_array(chapter.section_number, '.'), 1), 0) AS section_depth,
  CONCAT_WS(
    ' > ',
    country.name,
    state.name,
    exam_type.name,
    exam_goal.name,
    level.name,
    subject.name,
    book.name,
    chapter.chapter_name,
    chapter.topic_name
  ) AS breadcrumb
FROM mst_chapter AS chapter
JOIN mst_book AS book
  ON book.id = chapter.fk_mst_book_id
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
JOIN mst_exam_type AS exam_type
  ON exam_type.id = exam_goal.fk_mst_exam_type_id
JOIN mst_state AS state
  ON state.id = exam_goal.fk_state_id
JOIN mst_country AS country
  ON country.id = state.fk_country_id;

CREATE UNIQUE INDEX idx_mv_chapter_catalog_chapter_id
ON mv_chapter_catalog (chapter_id);

CREATE INDEX idx_mv_chapter_catalog_filters
ON mv_chapter_catalog (
  book_id,
  chapter_number,
  section_number,
  chapter_is_active
);

CREATE INDEX idx_mv_chapter_catalog_academic
ON mv_chapter_catalog (
  subject_code,
  level_code,
  exam_goal_code
);

DROP MATERIALIZED VIEW IF EXISTS mv_book_chapter_summary;

CREATE MATERIALIZED VIEW mv_book_chapter_summary AS
SELECT
  book.id AS book_id,
  book.name_code AS book_code,
  book.name AS book_name,
  book.display_order AS book_display_order,
  book.is_active AS book_is_active,
  subject.id AS subject_id,
  subject.name_code AS subject_code,
  subject.name AS subject_name,
  level.id AS level_id,
  level.name_code AS level_code,
  level.name AS level_name,
  exam_goal.id AS exam_goal_id,
  exam_goal.goal_id AS exam_goal_code,
  exam_goal.name AS exam_goal_name,
  COUNT(chapter.id) AS topic_count,
  COUNT(*) FILTER (WHERE chapter.is_active) AS active_topic_count,
  COUNT(DISTINCT chapter.chapter_number) AS chapter_count,
  MIN(chapter.display_order) AS first_topic_display_order,
  MAX(chapter.display_order) AS last_topic_display_order
FROM mst_book AS book
JOIN mst_subject AS subject
  ON subject.id = book.fk_mst_subject_id
JOIN mst_level AS level
  ON level.id = book.fk_mst_level_id
JOIN mst_exam_goal AS exam_goal
  ON exam_goal.id = book.fk_mst_exam_goal_id
LEFT JOIN mst_chapter AS chapter
  ON chapter.fk_mst_book_id = book.id
GROUP BY
  book.id,
  book.name_code,
  book.name,
  book.display_order,
  book.is_active,
  subject.id,
  subject.name_code,
  subject.name,
  level.id,
  level.name_code,
  level.name,
  exam_goal.id,
  exam_goal.goal_id,
  exam_goal.name;

CREATE UNIQUE INDEX idx_mv_book_chapter_summary_book_id
ON mv_book_chapter_summary (book_id);

CREATE INDEX idx_mv_book_chapter_summary_filters
ON mv_book_chapter_summary (
  subject_code,
  level_code,
  exam_goal_code,
  book_is_active
);
