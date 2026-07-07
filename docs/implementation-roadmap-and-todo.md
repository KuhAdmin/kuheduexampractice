# KUHEDU Practice

## Implementation Roadmap and TODO Tracker

Version: 1.0  
Status: Execution Planning

## Delivery Strategy

The recommended platform structure is:

- Student Portal
- Assessment Studio
- Admin Portal
- Shared backend services and database

This keeps learner-facing UX lightweight while preserving separation for internal authoring and operations.

## Suggested Technical Baseline

- Frontend: Next.js or React-based mobile-first web apps
- Backend: modular API services
- Database: PostgreSQL
- Cache and session support: Redis
- File storage: object storage for uploads and media
- Auth: token-based auth with RBAC

## Phase 0: Foundation

### Product and Delivery

- [ ] finalize product branding
- [ ] confirm domain and environment strategy
- [ ] create repositories or monorepo structure
- [ ] define branching, release, and CI/CD workflows

### Architecture

- [ ] define folder structure
- [ ] define coding conventions
- [ ] define environment variable strategy
- [ ] define shared domain model boundaries
- [ ] decide monolith-first vs modular service packaging

### Design and UX

- [ ] create mobile-first design foundations
- [ ] define typography, colors, spacing, and component rules
- [ ] create navigation patterns for student, studio, and admin apps

### Data and Infra

- [ ] draft ERD for core entities
- [ ] set up dev database
- [ ] set up storage bucket strategy
- [ ] define audit logging approach

## Phase 1: Core Platform MVP

### Authentication

- [ ] registration
- [ ] login
- [ ] logout
- [ ] forgot password
- [ ] reset password
- [ ] role setup for student, creator, admin

### Catalog

- [ ] board model
- [ ] class model
- [ ] subject model
- [ ] chapter model
- [ ] section model
- [ ] seeded sample academic content

### Student Portal

- [ ] landing page
- [ ] board and class selectors
- [ ] subject and chapter browsing
- [ ] practice set listing
- [ ] free and premium labeling
- [ ] search and filters
- [ ] mobile bottom navigation

### Definition of Done

- [ ] a student can browse from board to practice set on mobile
- [ ] basic auth and session flows work

## Phase 2: Assessment Studio

### Input and Analysis

- [ ] image upload
- [ ] OCR integration
- [ ] source material metadata capture
- [ ] AI context response storage
- [ ] AI memory strategy storage
- [ ] AI question pattern storage
- [ ] misconception capture

### Authoring Workflow

- [ ] draft mode
- [ ] editor for sections and concepts
- [ ] question builder
- [ ] explanation editor
- [ ] preview mode
- [ ] publish flow
- [ ] archive flow

### Quality Controls

- [ ] creator permissions
- [ ] reviewer approval checkpoints
- [ ] version tracking for AI analysis and practice sets

### Definition of Done

- [ ] internal users can upload content, author questions, and publish a practice set

## Phase 3: Question Bank System

### Question Types

- [ ] MCQ
- [ ] numerical
- [ ] assertion reason
- [ ] case study
- [ ] match the following
- [ ] fill in the blanks
- [ ] HOTS
- [ ] competency based

### Subject Features

- [ ] formula support for physics
- [ ] unit rendering support
- [ ] chemistry equation support
- [ ] mathematics LaTeX support
- [ ] graph support
- [ ] biology diagram and labeling support

### Data Model Rules

- [ ] many-to-many mapping between questions and practice sets
- [ ] concept tagging
- [ ] difficulty tagging
- [ ] premium flagging

### Definition of Done

- [ ] the platform can store and render the planned question formats reliably

## Phase 4: Test Engine

### Attempt Experience

- [ ] timer
- [ ] question palette
- [ ] previous and next navigation
- [ ] mark for review
- [ ] autosave
- [ ] submit and confirm flow

### Attempt Lifecycle

- [ ] resume incomplete attempt
- [ ] retake completed attempt
- [ ] bookmark question
- [ ] report incorrect question

### Results

- [ ] score generation
- [ ] percentage calculation
- [ ] strong concept detection
- [ ] weak concept detection
- [ ] suggested next practice

### Definition of Done

- [ ] students can complete and review a full attempt without losing progress

## Phase 5: Premium Module

### Subscription and Payments

- [ ] select subscription plan
- [ ] initiate payment
- [ ] validate transaction
- [ ] activate subscription
- [ ] store payment history

### Premium UX

- [ ] locked content UI
- [ ] premium banners
- [ ] entitlement checks in API and UI
- [ ] premium analytics visibility

### Definition of Done

- [ ] premium content gating works end to end

## Phase 6: Analytics

### Student Analytics

- [ ] attempted chapter history
- [ ] weak chapter detection
- [ ] strong chapter detection
- [ ] concept-level performance summary
- [ ] recommendation surfaces

### Business Analytics

- [ ] popular tests
- [ ] premium conversion rate
- [ ] premium usage
- [ ] chapter demand insights

### Definition of Done

- [ ] key student and business events are captured and queryable

## Phase 7: Admin Portal

### Operations

- [ ] user management
- [ ] subscription oversight
- [ ] catalog management
- [ ] question bank oversight
- [ ] practice set publish controls
- [ ] reporting dashboards

### Governance

- [ ] audit logs
- [ ] moderation tools
- [ ] access review workflow

### Definition of Done

- [ ] admins can safely operate and moderate the platform

## Cross-Cutting Technical TODOs

- [ ] API contract definitions
- [ ] validation and error handling standards
- [ ] logging and observability
- [ ] caching strategy
- [ ] backup and restore approach
- [ ] automated test strategy
- [ ] accessibility audit
- [ ] SEO plan for public pages
- [ ] PWA readiness review

## Recommended Backend Modules

- [ ] Authentication Service
- [ ] Catalog Service
- [ ] Assessment Studio Service
- [ ] Question Bank Service
- [ ] Practice Service
- [ ] Attempt Service
- [ ] Result Service
- [ ] Subscription Service
- [ ] Payment Service
- [ ] Analytics Service
- [ ] Admin Service

## Milestone Sequence

1. Foundation and domain model
2. Student browsing and authentication
3. Assessment Studio and question bank
4. Test engine and results
5. Premium subscriptions
6. Analytics
7. Admin governance

## Early Risks to Manage

- unclear question rendering requirements across subjects
- weak version control for academic content
- AI analysis overwrite without audit history
- under-scoped mobile UX for long test sessions
- payment integration complexity
- content moderation load as the bank grows

## Immediate Next Actions

- [ ] confirm product naming and brand direction
- [ ] choose app architecture and repo layout
- [ ] finalize MVP subject and chapter seed scope
- [ ] select auth, database, and payment stack
- [ ] convert this roadmap into tickets and sprint milestones
