# Work Log — FlowFocus Project

Xinyue Xu

- **Project:** FlowFocus (AI-Assisted Time Management Web Application)
- **Duration:** 7 Weeks
- **Role:** Product Designer & Frontend Developer (React)

This work log documents the iterative design and development of FlowFocus, an AI-assisted time management web application designed for college and graduate students.
Each entry includes clear timestamps, technical decisions, design rationale, and debugging work, reflecting steady progress and deep engagement with both product thinking and implementation.

---

## Week 1 — Project Framing & Core Concept Design

- **Date:** Week 1
- **Total Time Spent:** ~9.5 hours

### Key Objectives

- Identify a real, unmet problem space in student productivity
- Define a clear product vision and system structure
- Establish technical direction for the prototype

### Work Completed

- Clearly defined the core user problems FlowFocus aims to address:
	- Chronic procrastination
	- Planning paralysis caused by over-complex task lists
	- Low motivation and emotional resistance toward starting work
- Conducted a comparative analysis of existing productivity tools:
	- Google Calendar: strong scheduling, weak guidance and reflection
	- ClickUp / Notion: powerful but cognitively heavy and overwhelming
	- 3x3 / simple task apps: lightweight but lack structure and scalability
	- Identified a major gap in guidance, emotional support, and decision-making assistance
- Wrote a complete Product Requirements Document (PRD) outlining:
	- Target users (college & graduate students juggling multiple commitments)
	- Core design principles: clarity, flexibility, emotional friendliness
	- High-level feature roadmap
- Defined the core system logic:
	- Goals → Tasks → Time Blocks → Gantt → Calendar
	- Ensuring that abstract goals eventually translate into concrete, schedulable time
- Designed initial feature modules:
	- Goals & Tasks management
	- Daily Gantt view
	- Calendar view
	- (Explored but deprioritized) Focus timer mode
- Created early UI wireframe sketches for:
	- Tasks page
	- Daily Gantt layout
	- Calendar layout
- Made a foundational technical decision:
	- Build a web-based prototype using React
	- Prioritize rapid iteration and component reuse

---

## Week 2 — Data Modeling & Task System Foundations

- **Date:** Week 2
- **Total Time Spent:** ~10.5 hours

### Key Objectives

- Build a stable task system foundation
- Begin translating abstract plans into schedulable structures

### Work Completed

- Designed the initial Task data model, including:
	- Title
	- Description
	- Priority
	- Status
	- Tags
	- Estimated duration
- Introduced the concept of Work Time Blocks:
	- A concrete representation of “when work actually happens”
	- Designed to bridge Tasks, Gantt, and Calendar views
- Explored how Tasks, Gantt, and Calendar could:
	- Share the same scheduling logic
	- Avoid duplicated or conflicting data sources
- Implemented the basic Tasks page UI:
	- Task creation
	- Task editing
	- Task deletion
- Began experimenting with:
	- Associating tasks with specific dates
	- Grouping tasks by day rather than by long lists
- Prototyped early ideas for:
	- Task time logging
	- Focus mode
	- (These were exploratory and not yet fully committed)

---

## Week 3 — Scheduling Logic & Daily Gantt Prototype

- **Date:** Week 3
- **Total Time Spent:** ~11 hours

### Key Objectives

- Establish core scheduling behavior
- Identify architectural weaknesses early

### Work Completed

- Redesigned the overall UI:
	- Updated visual layout
	- Improved spacing, hierarchy, and readability
	- Rebuilt tab navigation for clearer mental models
- Reconstructed all main tabs to align with the new structure:
	- Tasks
	- Daily Gantt
	- Calendar
	- Kanban (early stage)
- Made a critical product decision:
	- Fully abandoned task time-tracking and focus timer features
	- **Reasoning:**
		- Time tracking is technically complex
		- Users already have alternatives
		- It does not address FlowFocus’s core pain points
- Integrated Clerk (authentication) and Neon (database)
- Built the first usable version of the Daily Gantt view
- Discovered major usability issues in early interactions:
	- “Add time block” flow was unintuitive
	- Multiple representations of time caused conflicts
- Debugged data synchronization issues between Tasks and Daily Gantt
- Identified a fundamental architecture flaw:
	- Multiple sources of truth for time data
- Made a key architectural decision:
	- Adopt a Single Source of Truth
	- All time-related information would be derived from Work Time Blocks

---

## Week 4 — Calendar View Integration & Drag / Resize Debugging

- **Date:** Week 4
- **Total Time Spent:** ~9.5 hours

### Key Objectives

- Enable visual scheduling at a higher level
- Improve interaction precision

### Work Completed

- Implemented a Google Calendar–inspired calendar view:
	- Day / Week / Month / Agenda modes
	- Visualized Work Time Blocks as calendar events
- Adjusted page layout to:
	- Extend vertical length
	- Display more content without visual compression
- Fixed layout bugs caused by:
	- Incorrect container heights
	- Overflow and scroll handling issues
- Debugged complex drag-and-drop interactions:
	- Moving entire events
	- Resizing events from the bottom edge
- Investigated and documented a bug:
	- Dragging from the top edge incorrectly moved the event instead of adjusting the start time
- Refined visual language:
	- Softer, more harmonious colors
	- Time block colors mapped to task priority levels

---

## Week 5 — Work Time Block Refactor & System Cleanup

- **Date:** Week 5
- **Total Time Spent:** ~16 hours

### Key Objectives

- Simplify system logic
- Eliminate data inconsistency

### Work Completed

- Rethought how tasks should appear across different views:
	- Tasks tab → organized by day
	- Kanban → switchable between day / week
	- Avoided monthly task overload
- Fully refactored the scheduling system:
	- Work Time Blocks became the only source of truth
- Removed:
	- Redundant database tables
	- Legacy logic that caused stale or duplicated data
- Ensured Tasks, Daily Gantt, Calendar, and Kanban:
	- All read from the same Work Time Block dataset
- Fixed a critical bug:
	- Newly created time blocks failing to save correctly
- Implemented default scheduling rules:
	- Auto-snap to nearest full hour
	- Default duration: 1 hour
- Verified that “Scheduled Time” is now:
	- Fully dynamic
	- Computed directly from Work Time Blocks

---

## Week 6 — Interaction Polishing & AI Architecture Preparation

- **Date:** Week 6
- **Total Time Spent:** ~22 hours

### Key Objectives

- Polish user interactions
- Prepare for AI feature integration

### Work Completed

- Refined drag and resize behavior:
	- Drag event body → move entire time block
	- Drag top / bottom edges → adjust start / end times
- Implemented 15-minute snapping across all interactions
- Enforced time boundaries:
	- Events constrained within 0–24 hours
- Unified task editing modals across:
	- Tasks
	- Calendar
	- Daily Gantt
	- Kanban
- Removed experimental drag logic that caused:
	- UI lag
	- Occasional freezing
- Designed and documented AI system architecture, including:
	- AI Planning Assistant
	- AI Task Breakdown
	- AI Companion (reflection & emotional support)

---

## Week 7 — Deployment, Debugging & System Integration

- **Date:** Week 7
- **Total Time Spent:** ~19 hours

### Key Objectives

- Make the system fully deployable
- Resolve real-world integration issues

### Work Completed

- Migrated code from Cursor to GitHub
- Resolved .env configuration issues
- Registered and deployed frontend and backend using Render
- Carefully audited environment variables across:
	- Clerk
	- Neon
	- AI services
	- Google Calendar API
	- Render frontend & backend
- Debugged backend connection failures
- Fixed a critical issue:
	- Calendar events persisting after task deletion
- Fixed Daily Gantt bugs:
	- Time block movement failures
	- Resize failures
- Resolved post-login white screen issue
- Fixed AI connection failures
- Improved AI Planning Assistant output quality
- Fixed issue where AI-generated tasks could not be added to the system
- Debugged Google Calendar authentication:
	- Login successful
	- Calendar sync currently incompatible and marked for future work

---

## Overall Reflection

Over seven weeks, FlowFocus evolved from an abstract idea into a functional, multi-view time management system with unified scheduling logic and complex interactive behaviors.

This process involved:

- Continuous iteration
- Repeated architectural refactoring
- Deep debugging across UI, state management, backend integration, and deployment

The project reflects not only technical implementation, but also product judgment, scope control, and user-centered decision-making.

