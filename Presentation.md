FlowFocus - Presentations

## Week 1: Project Framing

**Project Overview**

FlowFocus is an AI-assisted time management web application designed for college and graduate students. It addresses common productivity challenges:

- Procrastination
- Planning paralysis
- Low motivation from overly complex tools

**Goal**

Help users translate abstract goals into concrete, schedulable time blocks in a flexible and emotionally supportive way.

**Topics to Learn**

- React basics and component structure
- Frontend state management
- Task and scheduling system design
- Gantt-style visualization
- Full-stack web app architecture
- Using LLMs for planning support

**Week 2 Plans**

- Build basic React app structure
- Implement task creation with core fields
- Connect tasks to time/dates
- Design initial UI for tasks and daily planning

**Challenges**

- Learning multiple new technologies at once
- Creating a flexible but understandable scheduling model
- Avoiding scope creep

## Week 2: Task System Foundations

**Progress Summary**

Building the foundation of the task system to support future scheduling and visualization features.

**Topics to Learn**

- Data modeling for tasks
- Managing shared state across components
- UI patterns for task creation and editing
- Designing scalable systems

**Week 3 Plans**

- Finalize stable task data model
- Enable task creation, editing, and deletion
- Group tasks by day (not just long lists)
- Introduce Work Time Blocks concept

**Challenges**

- Preventing data duplication and conflicts
- Ensuring task model supports future features
- Keeping system simple while planning for growth

## Week 3: Scheduling & Gantt Prototype

**Progress Summary**

Evolving from task management to actual scheduling. Translating tasks into time blocks on a daily schedule.

**Topics to Learn**

- Gantt chart design and interaction
- Time-based data modeling
- Drag-and-drop UI patterns
- Single source of truth architecture

**Week 4 Plans**

- Build usable Daily Gantt view
- Enable time block creation and adjustment
- Show clear relationship between tasks and scheduled time

**Challenges**

- Multiple time representations causing confusion
- Error-prone complex UI interactions
- Potential need for future refactoring

## Week 4: Calendar Integration

**Progress Summary**

Adding multiple views of the same scheduling data. Implementing higher-level calendar visualization.

**Topics to Learn**

- Calendar UI patterns (day/week/month views)
- Synchronizing views with shared data
- Handling layout, overflow, and scrolling

**Week 5 Plans**

- Display scheduled time blocks in Calendar view
- Ensure consistent behavior between Gantt and Calendar
- Improve visual hierarchy and layout stability

**Challenges**

- Complex drag and resize behavior
- Maintaining consistency across views
- Performance issues from interaction-heavy UI

## Week 5: System Refactor & Cleanup

**Progress Summary**

As complexity increased, architectural cleanup became critical. Focused on refactoring for maintainability.

**Topics to Learn**

- Single Source of Truth architecture
- Refactoring strategies
- Preventing stale or duplicated state
- Long-term system maintainability

**Week 6 Plans**

- Unify scheduling logic completely
- Ensure Tasks, Gantt, Calendar, and Kanban use the same data source
- Make time block creation and persistence reliable

**Challenges**

- Risk of breaking existing features during refactor
- Time cost of architectural changes
- Debugging deeply interconnected systems

## Week 6: Interaction Polishing & AI Prep

**Progress Summary**

Core system stabilized. Focus shifted to interaction quality and AI integration planning.

**Topics to Learn**

- Advanced drag-and-resize UX patterns
- Interaction constraints and snapping logic
- AI system architecture and prompt design
- Designing supportive, non-intrusive AI features

**Week 7 Plans**

- Polish drag and resize interactions
- Unify task editing across all views
- Integrate early AI planning assistant

**Challenges**

- UI lag or performance issues
- Overcomplicating AI features
- Ensuring AI output integrates smoothly

## Week 7: Deployment & Integration

**Progress Summary**

FlowFocus evolved into a deployable prototype with unified scheduling logic and AI-assisted planning. Final focus on deployment and real-world integration.

**Topics to Learn**

- Environment variable management
- Full-stack deployment workflows
- Authentication and API integration
- Production-level bug handling

**Final Demo**

- Live deployed application
- End-to-end workflow demonstration
- AI-assisted planning features overview

**Challenges**

- Deployment-specific bugs
- Third-party API limitations
- Performance and stability under real usage