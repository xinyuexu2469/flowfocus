import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Initialize OpenAI client (shared)
export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * Shared helper function for planning logic
 */
async function handlePlanningRequest(messages) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required');
  }

  // Check if OpenAI API key is configured
  if (!openai) {
    console.warn('⚠️  OpenAI API key not configured. Returning mock plan.');
    return generateMockPlanningResponse(messages);
  }

  // Build system prompt (include current date/time to anchor schedules)
  const nowIso = new Date().toISOString();
  const currentDate = nowIso.split('T')[0];
  const currentTime = nowIso.split('T')[1].slice(0,5);

  const systemPrompt = `You are an expert time-management and scheduling assistant inside an app called FlowFocus.
The user may speak Chinese or English; always respond in the same language.
Read the full conversation and produce a **list of tasks and a time-blocked schedule**.
Current date: ${currentDate}
Current time (24h): ${currentTime}
Unless the user specifies otherwise, assume they are planning for today (${currentDate}) and the next few days.
Keep suggested time blocks aligned to the current date/time context.

For each task, extract:
- title: Clear, concise task title
- description: Optional detailed description
- priority: "high" | "medium" | "low" based on urgency and importance
- status: "todo" | "in_progress" | "done" based on conversation
- estimatedMinutes: Reasonable time estimate in minutes
- deadline: Optional ISO date string if mentioned
- linkToGoalId: Optional goal ID if relevant (can be null)
- workTimeBlocks: Array of schedule suggestions with date (YYYY-MM-DD), startTime (HH:mm), endTime (HH:mm)

Respect constraints from the conversation (deadlines, "I can't work after 11pm", class times, etc.).
Time blocks should not overlap and should be within reasonable hours.
Always output JSON that exactly matches the PlanningResponse schema.`;

  // Use chat.completions.create with structured output
  // Note: Using gpt-4o as gpt-5.1 may not be available yet
  let planData;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
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
                        anyOf: [
                          { type: 'string' },
                          { type: 'null' }
                        ]
                      },
                      linkToGoalId: { 
                        anyOf: [
                          { type: 'string' },
                          { type: 'null' }
                        ]
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
                  required: ['title', 'description', 'priority', 'status', 'estimatedMinutes', 'deadline', 'linkToGoalId', 'workTimeBlocks'],
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
 * POST /api/ai/planning
 * Generate a complete plan with tasks and time scheduling based on multi-turn conversation
 */
router.post('/planning', async (req, res) => {
  try {
    const { messages } = req.body;
    const planData = await handlePlanningRequest(messages);
    res.json(planData);
  } catch (error) {
    console.error('❌ [AI Planning] Error:', error);
    if (error.message === 'Messages array is required') {
      return res.status(400).json({
        error: error.message,
      });
    }
    res.status(500).json({
      error: 'Failed to generate plan',
      message: error.message || 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/ai/task-breakdown
 * Use AI to break down a complex task into manageable subtasks
 */
router.post('/task-breakdown', async (req, res) => {
  try {
    const { taskTitle, baseDescription, extraContext } = req.body;

    if (!taskTitle || taskTitle.trim() === '') {
      return res.status(400).json({
        error: 'Task title is required',
      });
    }

    // Check if OpenAI API key is configured
    if (!openai) {
      console.warn('⚠️  OpenAI API key not configured. Returning mock breakdown.');
      const mockBreakdown = generateMockTaskBreakdown(taskTitle);
      return res.json(mockBreakdown);
    }

    // Build system prompt
    const systemPrompt = `You are an assistant that breaks one task into 3–10 clear, actionable steps.
For each step, provide a concise title, a short optional description, and an estimated duration in minutes.
The user may speak Chinese or English; respond in the same language.
Output must strictly follow the TaskBreakdownResponse JSON schema.`;

    const fullDescription = [baseDescription, extraContext].filter(Boolean).join('\n\n');
    const userPrompt = `Task Title: ${taskTitle}
${fullDescription ? `Description:\n${fullDescription}` : ''}

Break this task down into 3-10 clear, actionable steps.`;

    console.log('🤖 [AI Task Breakdown] Breaking down:', taskTitle);

    // Use chat.completions.create with structured output
    let breakdownData;
    try {
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
      breakdownData = JSON.parse(responseText);
    } catch (apiError) {
      console.error('❌ [AI Task Breakdown] API Error:', apiError.message);
      throw apiError;
    }

    console.log(`✅ [AI Task Breakdown] Generated ${breakdownData.steps?.length || 0} steps`);

    res.json(breakdownData);
  } catch (error) {
    console.error('❌ [AI] Error:', error);

    // Check if it's an OpenAI API error
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
 * AI companion for reflection, emotional support, and time-management coaching
 */
router.post('/companion', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Messages array is required',
      });
    }

    // Check if OpenAI API key is configured
    if (!openai) {
      console.warn('⚠️  OpenAI API key not configured. Returning mock response.');
      return res.json({
        reply: "I'm here to help you reflect on your day and manage your time better. (Mock response - OpenAI not configured)",
      });
    }

    // Build system prompt
    const systemPrompt = `You are an AI companion inside a time-management app called FlowFocus.
You are warm, encouraging, and non-judgmental.
Use insights from time-management (time blocking, prioritization, Pomodoro, planning vs. review), self-determination theory, and humanistic psychology.
Help the user reflect on their day, emotions, wins and struggles.
Ask gentle follow-up questions, and give small, realistic suggestions.
The user may speak Chinese or English; respond in the same language.
You are **not** a therapist; do not give clinical/medical advice. If the user expresses extreme distress or self-harm thoughts, gently encourage them to seek professional help and talk to trusted friends/family.`;

    // Call OpenAI API using chat.completions.create (plain text response, no JSON schema)
    let reply;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ],
        temperature: 0.8,
        max_tokens: 1000,
      });
      reply = completion.choices[0].message.content || 'I apologize, but I could not generate a response. Please try again.';
    } catch (apiError) {
      console.error('❌ [AI Companion] API Error:', apiError.message);
      throw apiError;
    }

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
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    summary: 'Generated a plan with 3 tasks (mock data)',
    notesForUser: 'This is mock data. Configure OPENAI_API_KEY to use real AI.',
    tasks: [
      {
        title: 'Sample Task 1',
        description: 'Sample task description',
        priority: 'high',
        status: 'todo',
        estimatedMinutes: 120,
        deadline: null,
        linkToGoalId: null,
        workTimeBlocks: [
          {
            date: tomorrow.toISOString().split('T')[0],
            startTime: '09:00',
            endTime: '11:00',
          },
        ],
      },
    ],
  };
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

// Legacy endpoint: Keep /plan for backward compatibility, but it's deprecated
// New code should use /planning
router.post('/plan', async (req, res) => {
  try {
    // Transform legacy request format to new format
    const { userInput, existingTasks = [], conversationHistory = [] } = req.body;

    if (!userInput || userInput.trim() === '') {
      return res.status(400).json({
        error: 'User input is required',
      });
    }

    // Convert to new format - create messages array
    const messages = [
      ...conversationHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userInput },
    ];
    
    // Call shared planning logic
    const planData = await handlePlanningRequest(messages);
    
    // Transform response to legacy format for backward compatibility
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

