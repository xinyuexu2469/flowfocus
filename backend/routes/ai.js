import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const router = express.Router();

// Initialize OpenAI client (shared)
const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
export const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Build a warm, non-intrusive response when context is insufficient or OpenAI is not configured
function buildNeedsContextResponse(lastUserContent = '') {
  const preview = lastUserContent ? `(I saw you wrote: “${lastUserContent.slice(0, 40)}”) ` : '';
  return {
    summary: "I'd love to hear more from you before planning.",
    notesForUser:
      `${preview}Tell me what you want to do today/this week, deadlines, available hours, fixed events, and priorities. ` +
      "If you're unsure, I can give a tiny example to spark ideas—it's just an example, so share your own details and I'll tailor the plan to you.",
    tasks: [],
  };
}

/**
 * Shared helper function for planning logic
 */
async function handlePlanningRequest(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required');
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');

  // If the user only greets or provides too little context, return gentle guidance instead of forcing a plan
  if (!lastUser || !lastUser.content || lastUser.content.trim().length < 10) {
    return buildNeedsContextResponse(lastUser?.content);
  }

  // Check if OpenAI API key is configured
  if (!openai) {
    console.warn('⚠️  OpenAI API key not configured. Returning gentle guidance instead of mock tasks.');
    return buildNeedsContextResponse(lastUser?.content);
  }

  // Build system prompt (include current date/time to anchor schedules)
  // Use user's timezone if provided, otherwise default to UTC
  const userTimezone = messages[0]?.timezone || 'UTC';
  const nowUtc = new Date();
  const nowUserLocal = new Date(nowUtc.toLocaleString('en-US', { timeZone: userTimezone }));
  const currentDate = nowUserLocal.toISOString().split('T')[0];
  const currentTime = nowUserLocal.toTimeString().slice(0, 5);
  const currentHour = parseInt(currentTime.split(':')[0], 10);
  const dayOfWeek = nowUserLocal.toLocaleDateString('en-US', { weekday: 'long', timeZone: userTimezone });

  const systemPrompt = `You are an expert time-management and scheduling assistant inside an app called FlowFocus.
Always respond in English, warm and conversational like a caring older sister (gentle, not pushy).
Always base your planning on what the user said in this conversation.

**CRITICAL - Current Time Context:**
User's timezone: ${userTimezone}
User's current local date: ${currentDate}
User's current local time (24h): ${currentTime}
Current day of week: ${dayOfWeek}

**IMPORTANT**: When the user says "today", they mean ${currentDate} (${dayOfWeek}) in their timezone.
When scheduling tasks:
- Start time blocks from the current time (${currentTime}) onwards
- If it's late evening (after 20:00) and deadline is today, fit urgent tasks in remaining hours tonight
- If deadline is "today" or "tonight", schedule on ${currentDate}, NOT the next day
- Respect the user's current time context - don't schedule tasks in the past

**IMPORTANT - Example Request Handling:**
If the user asks for an "example" or says they need to see an example (words like "example", "show me", "demo", etc.), provide a COMPLETE illustrative example with:
- 3-5 sample tasks (e.g., "Study for CS101 Exam", "Complete Math Homework", "Group Project Meeting")
- Realistic time blocks spread across 2-3 days
- Clear deadlines and priorities
- A friendly summary explaining this is just an example to inspire them

If details are insufficient and they are NOT asking for an example, ask for their tasks, deadlines, class/meeting times, working hours, and constraints. Be soft and encouraging, never pushy.
Only produce a task list and time-blocked schedule when enough details are present OR when user explicitly requests an example.

Unless the user specifies otherwise, assume they are planning starting from the current time and the next few days.
Keep suggested time blocks aligned to the current date/time context.

For each task, extract:
- title: Clear, concise task title
- description: Optional detailed description
- priority: "high" | "medium" | "low"
- status: "todo" | "in_progress" | "done"
- estimatedMinutes: number
- deadline: Optional ISO date string or null
- linkToGoalId: Optional goal ID or null
- workTimeBlocks: Array of { date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm) }

Respect all constraints (deadlines, no work after certain hours, class times, etc.).
Time blocks should not overlap and should be within reasonable hours.
Always output JSON that exactly matches the PlanningResponse schema.`;

  let planData;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'planning_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              notesForUser: { type: 'string' },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                    status: { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                    estimatedMinutes: { type: 'number' },
                    deadline: {
                      anyOf: [{ type: 'string' }, { type: 'null' }],
                    },
                    linkToGoalId: {
                      anyOf: [{ type: 'string' }, { type: 'null' }],
                    },
                    workTimeBlocks: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                          startTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                          endTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
                        },
                        required: ['date', 'startTime', 'endTime'],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: [
                    'title',
                    'description',
                    'priority',
                    'status',
                    'estimatedMinutes',
                    'deadline',
                    'linkToGoalId',
                    'workTimeBlocks',
                  ],
                  additionalProperties: false,
                },
              },
            },
            required: ['summary', 'notesForUser', 'tasks'],
            additionalProperties: false,
          },
        },
      },
    });
    const responseText = completion.choices[0].message.content;
    planData = JSON.parse(responseText);
  } catch (apiError) {
    console.error('❌ [AI Planning] API Error:', apiError.message);
    throw apiError;
  }

  console.log(`✅ [AI Planning] Generated ${planData.tasks?.length || 0} tasks`);
  return planData;
}

/**
 * POST /api/ai/chat
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (!openai) {
      console.warn('⚠️  OpenAI API key not configured. Returning mock response.');
      return res.json({
        reply: 'AI chat is not configured. Please add OPENAI_API_KEY to backend/.env',
      });
    }
    const messages = [];
    if (context?.tasks && context.tasks.length > 0) {
      const taskSummary = context.tasks.map((t) => `- ${t.title} (${t.status})`).join('\n');
      messages.push({
        role: 'system',
        content:
          'You are a warm, gentle, big-sister-like assistant in FlowFocus. Always respond in English. Current tasks:\n' +
          taskSummary,
      });
    } else {
      messages.push({
        role: 'system',
        content:
          'You are a warm, gentle, big-sister-like assistant in FlowFocus. Always respond in English.',
      });
    }
    messages.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });
    const reply = completion.choices[0].message.content || 'Sorry, I could not generate a response.';
    res.json({ reply });
  } catch (error) {
    console.error('❌ [AI Chat] Error:', error);
    res.status(500).json({
      error: 'Failed to get chat response',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/ai/planning
 */
router.post('/planning', async (req, res) => {
  try {
    const { messages, timezone } = req.body;
    // Attach timezone to messages for handlePlanningRequest
    const messagesWithTimezone = messages.map((m, i) => 
      i === 0 ? { ...m, timezone } : m
    );
    const planData = await handlePlanningRequest(messagesWithTimezone);
    res.json(planData);
  } catch (error) {
    console.error('❌ [AI Planning] Error:', error);
    if (error.status === 400 || error.message === 'INSUFFICIENT_CONTEXT') {
      return res.status(400).json({
        error: 'insufficient_context',
        message: error.hint || 'Please share tasks, deadlines, constraints, and available time, then try again.',
      });
    }
    if (error.message === 'Messages array is required') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to generate plan',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/ai/task-breakdown
 */
router.post('/task-breakdown', async (req, res) => {
  try {
    const { taskTitle, baseDescription, extraContext } = req.body;
    if (!taskTitle || taskTitle.trim() === '') {
      return res.status(400).json({ error: 'Task title is required' });
    }
    if (!openai) {
      console.warn('⚠️  OpenAI API key not configured. Returning mock breakdown.');
      return res.json(generateMockTaskBreakdown(taskTitle));
    }

    const systemPrompt = `You are an assistant that breaks one task into 3–10 clear, actionable steps.
For each step, provide a concise title, a short optional description, and an estimated duration in minutes.
The user may speak Chinese or English; respond in the same language.
Output must strictly follow the TaskBreakdownResponse JSON schema.`;

    const fullDescription = [baseDescription, extraContext].filter(Boolean).join('\n\n');
    const userPrompt = `Task Title: ${taskTitle}
${fullDescription ? `Description:\n${fullDescription}` : ''}

Break this task down into 3-10 clear, actionable steps.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'task_breakdown_response',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    estimatedMinutes: { type: 'number' },
                  },
                  required: ['title', 'description', 'estimatedMinutes'],
                  additionalProperties: false,
                },
              },
              notesForUser: { type: 'string' },
            },
            required: ['steps', 'notesForUser'],
            additionalProperties: false,
          },
        },
      },
    });
    const responseText = completion.choices[0].message.content;
    const breakdownData = JSON.parse(responseText);
    res.json(breakdownData);
  } catch (error) {
    console.error('❌ [AI] Error:', error);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'OpenAI API error',
        message: error.response.data?.error?.message || error.message,
      });
    }
    res.status(500).json({
      error: 'Failed to break down task',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/ai/companion
 */
router.post('/companion', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }
    if (!openai) {
      console.warn('⚠️  OpenAI API key not configured. Returning mock response.');
      return res.json({
        reply:
          "I'm here to help you reflect on your day and manage your time better. (Mock response - OpenAI not configured)",
      });
    }
    const systemPrompt = `You are an AI companion inside a time-management app called FlowFocus.
You are warm, encouraging, and non-judgmental (big-sister vibe). Always respond in English, even if the user writes in another language.
Use insights from time-management, prioritization, Pomodoro, planning vs. review.
Ask gentle follow-up questions, give small realistic suggestions.
Do not give clinical/medical advice.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });
    const reply =
      completion.choices[0].message.content ||
      'I apologize, but I could not generate a response. Please try again.';
    res.json({ reply });
  } catch (error) {
    console.error('❌ [AI Companion] Error:', error);
    res.status(500).json({
      error: 'Failed to get companion response',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * Generate mock planning response for development/testing
 */
function generateMockPlanningResponse(messages) {
  // 继续返回“需要更多上下文”的温柔提示，避免给出示例任务
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  return buildNeedsContextResponse(lastUser?.content);
}

/**
 * Generate mock task breakdown for development/testing
 */
function generateMockTaskBreakdown(taskTitle) {
  return {
    steps: [
      {
        title: 'Plan and research',
        description: `Gather information and plan approach for: ${taskTitle}`,
        estimatedMinutes: 45,
      },
      {
        title: 'Start implementation',
        description: 'Begin working on the main task',
        estimatedMinutes: 60,
      },
      {
        title: 'Review and refine',
        description: 'Check work quality and make improvements',
        estimatedMinutes: 30,
      },
    ],
    notesForUser: 'This is mock data. Configure OPENAI_API_KEY to use real AI.',
  };
}

// Legacy endpoint: /plan
router.post('/plan', async (req, res) => {
  try {
    const { userInput, existingTasks = [], conversationHistory = [] } = req.body;
    if (!userInput || userInput.trim() === '') {
      return res.status(400).json({ error: 'User input is required' });
    }
    const messages = [
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userInput },
    ];
    const planData = await handlePlanningRequest(messages);
    res.json({
      message: planData.summary || 'Plan generated',
      tasks: planData.tasks || [],
    });
  } catch (error) {
    console.error('❌ [AI Plan Legacy] Error:', error);
    res.status(500).json({
      error: 'Failed to generate plan',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

export default router;