# KUHEDU Practice

## Product Requirements Document

Version: 1.0  
Status: MVP  
Target Domain: `kuhedu-exam-prep.study`

## 1. Overview

KUHEDU Practice is a mobile-first exam preparation platform for CBSE Class 11 and 12 students. The platform enables chapter-wise discovery, practice attempts, premium subscription access, performance tracking, and internal question bank creation through an AI-assisted Assessment Studio.

## 2. Goals

### Business Goals

- launch a usable MVP for CBSE Class 11 and 12 practice
- create a monetizable premium layer
- establish an internal content production workflow
- build foundations for future scaling across boards and exams

### Student Goals

- practice by subject, chapter, and format
- improve recall and exam readiness
- understand mistakes and weak concepts
- return for repeated practice

### Internal Team Goals

- create and manage structured question banks
- preserve AI-assisted academic analysis
- publish practice sets with quality control

## 3. MVP Scope

### Included

- authentication
- board, class, subject, chapter browsing
- practice set listing
- free vs premium access control
- subscription purchase and validation
- test engine
- result page with concept feedback
- internal Assessment Studio
- AI workflow capture and storage

### Excluded

- live classes
- discussion forums
- tutor marketplace
- fully automated AI question generation
- adaptive learning engine
- gamification and leaderboards

## 4. Target Users

### Student

Attributes:

- CBSE Class 11 or 12
- primarily mobile user

Needs:

- chapter-wise practice
- board-style preparation
- fast retry and progress visibility

### Content Creator

Needs:

- upload source materials
- generate and edit AI insights
- author questions manually
- preview and publish sets

### Administrator

Needs:

- manage users and subscriptions
- manage catalog and content
- monitor platform analytics

## 5. Information Architecture

The academic hierarchy should be modeled as:

```text
Board
  -> Class
    -> Subject
      -> Chapter
        -> Section
          -> AI Analysis
          -> Question Bank
          -> Practice Set
```

## 6. Functional Requirements

### 6.1 Authentication

Users should be able to:

- register
- log in
- log out
- request password reset
- reset password securely

Requirements:

- JWT or equivalent token-based authentication
- hashed passwords
- role-based access for Student, Content Creator, and Admin

### 6.2 Landing Page

The landing page should be mobile first and include:

- hero section
- board selector
- class selector
- subject selector
- chapter selector
- practice type selector
- search action
- featured practice sets
- premium upgrade banner
- footer

Acceptance criteria:

- students can reach a filtered practice listing from the landing page
- all controls are usable on small mobile screens

### 6.3 Catalog Browsing

Students should be able to browse:

- board
- class
- subject
- chapter
- section
- available practice sets

Requirements:

- chapter pages should show available practice types
- practice sets must indicate free or premium status
- content should be filterable and searchable

### 6.4 Practice Types

Supported MVP practice types:

- Quick Practice
- NCERT Practice
- Board Pattern
- Competency Based
- Assertion Reason
- Case Study
- Memory Booster
- Grand Chapter Test

### 6.5 Free vs Premium Access

Free users should have:

- limited tests
- limited analytics

Premium users should have:

- unlimited access where designated
- premium practice sets
- memory booster content
- detailed analysis

Commercial baseline:

- monthly subscription at Rs. 500

### 6.6 Search and Filters

Users should be able to search or filter by:

- board
- class
- subject
- chapter
- practice type
- difficulty
- premium availability

Acceptance criteria:

- filters are composable
- empty states are informative

### 6.7 Test Engine

The practice attempt experience should support:

- timer
- question palette
- previous navigation
- next navigation
- mark for review
- autosave
- submit flow
- submit confirmation dialog

Student behaviors to support:

- resume incomplete tests
- retake completed tests
- bookmark questions
- report incorrect questions

### 6.8 Result Page

Each completed attempt should show:

- score
- percentage
- correct count
- wrong count
- skipped count
- weak concepts
- strong concepts
- suggested next practice
- premium upgrade recommendation when relevant

### 6.9 Assessment Studio

Assessment Studio is an internal content creation tool.

Workflow:

1. Upload image or source material
2. Capture AI context analysis
3. Capture AI memory strategy
4. Capture AI question pattern suggestions
5. Capture misconceptions and correction strategies
6. Manually author questions
7. Preview content
8. Publish practice set

Required authoring states:

- Draft
- Preview
- Publish
- Archive

### 6.10 AI Workflow Capture

The platform should preserve structured responses to the following internal prompts:

#### Context Analysis

Store:

- summary
- keywords
- formulae
- concepts
- entities

#### Memory Reinforcement Strategy

Store:

- story
- analogy
- real-world example
- visual hook
- mnemonic

#### Question Pattern Suggestions

Store:

- MCQ
- numerical
- assertion
- match
- fill in the blanks
- HOTS
- competency
- case study

#### Misconception Analysis

Store:

- common mistake
- correction strategy

Data rule:

- AI analysis history must be preserved and never overwritten

### 6.11 Subject-Specific Authoring Support

Physics:

- formula support
- diagrams
- units

Chemistry:

- chemical equations
- molecule imagery

Mathematics:

- LaTeX support
- graph support

Biology:

- diagrams
- label support

### 6.12 Admin Panel

Admin capabilities should include:

- dashboard
- user management
- subscription management
- subject and chapter management
- question bank management
- practice set publishing
- reports
- analytics

## 7. Data Model Requirements

Core entities:

- User
- Subscription
- Board
- Class
- Subject
- Chapter
- Section
- AIAnalysis
- Question
- PracticeSet
- TestAttempt
- Result
- Payment

Important modeling rules:

- one question can belong to multiple practice sets
- one concept can map to multiple questions
- practice sets should be versioned
- AI analysis should preserve historical revisions

### Question Model

Each question should support:

- question text
- question type
- difficulty
- options
- correct answer
- explanation
- marks
- expected time
- hints
- tags
- subject
- chapter
- concept
- premium flag

## 8. API Modules

Recommended service modules:

- Authentication
- Catalog
- Assessment
- Question
- Practice
- Attempt
- Result
- Payment
- Subscription
- Admin
- Analytics

## 9. Non-Functional Requirements

The MVP should be:

- mobile first
- responsive
- fast loading
- SEO friendly where applicable
- PWA ready
- accessible
- scalable
- modular

Performance expectations:

- primary student pages should load quickly on mid-range mobile devices
- test progress should autosave reliably
- premium access checks should be deterministic and fast

## 10. Security Requirements

- HTTPS everywhere
- JWT or secure token-based auth
- password hashing
- role-based access control
- rate limiting on auth and sensitive APIs
- auditability for admin and publishing actions

## 11. Payments and Subscription

The payment subsystem should support:

- subscription purchase
- payment record creation
- subscription validation
- transaction history
- premium lock and unlock behavior

## 12. Analytics

MVP analytics should track:

- most attempted chapters
- weak concepts
- strong concepts
- popular practice sets
- conversion to premium
- premium usage behavior

## 13. Recommended Technical Architecture

```text
Student Portal (mobile-first web)
Assessment Studio (internal)
Admin Portal
        |
API Layer
        |
------------------------------------------------
Authentication Service
Catalog Service
Assessment Studio Service
Question Bank Service
Practice Service
Test Engine Service
Analytics Service
Subscription Service
Payment Service
Admin Service
------------------------------------------------
        |
PostgreSQL
Redis
Object Storage
```

Recommendation:

- keep the three frontends separate from day one
- share backend services and a common domain model
- avoid combining student and admin workflows into one UI application

## 14. Future Extensions

- English grammar
- TOEFL
- CLAT
- other competitive exams
- adaptive AI practice
- automated question generation with review gates
- parent dashboard
- tutor integrations
- gamification
- leaderboards

## 15. Open Product Decisions

These decisions should be finalized before implementation begins:

- final branding system
- exact premium entitlements
- payment gateway provider
- OCR provider for Assessment Studio uploads
- moderation and academic review workflow
- attempt rules for free users
- explanation quality standards

## 16. MVP Release Criteria

The MVP is ready for release when:

- students can register, browse, attempt, and review at least one full subject flow
- premium locking and subscription validation work reliably
- internal teams can create and publish practice sets through Assessment Studio
- analytics capture student attempt outcomes
- admin users can manage content and subscriptions safely
