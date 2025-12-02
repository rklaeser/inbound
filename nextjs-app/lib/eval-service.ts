import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getConfiguration } from './configuration-helpers';
import type { BotResearch } from './types';

const EVAL_MODEL = 'gpt-4o'; // Different from action model to avoid "teaching to the test"

// Zod schemas for structured output
const classificationEvalSchema = z.object({
  score: z.number().min(1).max(5).describe('Score from 1 to 5 (1=worst, 5=best)'),
  pass: z.boolean().describe('True if score >= 4'),
  reasoning: z.string().describe('Brief explanation for the score'),
});

const emailEvalSchema = z.object({
  relevant: z.object({
    score: z.number().min(1).max(5).describe('Score from 1-5: Does it address their specific stated need?'),
    note: z.string()
  }),
  direct: z.object({
    score: z.number().min(1).max(5).describe('Score from 1-5: Is it concise and to the point?'),
    note: z.string()
  }),
  active: z.object({
    score: z.number().min(1).max(5).describe('Score from 1-5: Does it use action-oriented language?'),
    note: z.string()
  }),
  overall: z.number().min(1).max(5).describe('Overall score from 1-5'),
  pass: z.boolean().describe('True if overall >= 3'),
  summary: z.string().describe('One sentence summary'),
});

export interface ClassificationEvalResult {
  score: number;
  pass: boolean;
  reasoning: string;
  evaluated_at: Date;
  model: string;
}

export interface EmailEvalResult {
  scores: {
    relevant: number;
    direct: number;
    active: number;
  };
  overall: number;
  pass: boolean;
  summary: string;
  evaluated_at: Date;
  model: string;
}

export interface EvalResults {
  classification: ClassificationEvalResult;
  email?: EmailEvalResult;
}

/**
 * Minimal input for eval functions - can be constructed from workflow context
 */
export interface EvalInput {
  submission: {
    leadName: string;
    email: string;
    company: string;
    message: string;
  };
  bot_research: BotResearch;
  emailText?: string; // The assembled email HTML (only for high-quality)
}

export async function evaluateClassification(input: EvalInput): Promise<ClassificationEvalResult> {
  const config = await getConfiguration();

  const { object } = await generateObject({
    model: openai(EVAL_MODEL),
    schema: classificationEvalSchema,
    system: config.prompts.classificationEval,
    prompt: `
Lead Form Submission:
- Name: ${input.submission.leadName}
- Email: ${input.submission.email}
- Company: ${input.submission.company || 'Not provided'}
- Message: ${input.submission.message}

AI Classification: ${input.bot_research.classification}
AI Confidence: ${input.bot_research.confidence}
AI Reasoning: ${input.bot_research.reasoning}
`,
  });

  return {
    score: object.score,
    pass: object.pass,
    reasoning: object.reasoning,
    evaluated_at: new Date(),
    model: EVAL_MODEL,
  };
}

export async function evaluateEmail(input: EvalInput): Promise<EmailEvalResult | null> {
  // Only evaluate emails for high-quality leads
  if (input.bot_research.classification !== 'high-quality') {
    return null;
  }

  // Need email content to evaluate
  if (!input.emailText) {
    return null;
  }

  const config = await getConfiguration();

  const { object } = await generateObject({
    model: openai(EVAL_MODEL),
    schema: emailEvalSchema,
    system: config.prompts.emailHighQualityEval,
    prompt: `
Lead's original message:
${input.submission.message}

Company: ${input.submission.company || 'Not provided'}

Generated email:
${input.emailText}
`,
  });

  return {
    scores: {
      relevant: object.relevant.score,
      direct: object.direct.score,
      active: object.active.score,
    },
    overall: object.overall,
    pass: object.pass,
    summary: object.summary,
    evaluated_at: new Date(),
    model: EVAL_MODEL,
  };
}

export async function evaluateLead(input: EvalInput): Promise<EvalResults> {
  const [classification, email] = await Promise.all([
    evaluateClassification(input),
    evaluateEmail(input),
  ]);

  return {
    classification,
    ...(email && { email }),
  };
}
