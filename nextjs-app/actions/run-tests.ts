'use server';

import { testData } from '@/lib/db/mock-leads';
import type { Classification } from '@/lib/types';

export interface TestResult {
  testCase: string;
  label: string;
  expectedClassification: Classification;
  leadId: string;
  submitted: boolean;
  error?: string;
}

export interface TestRunResult {
  success: boolean;
  results: TestResult[];
  error?: string;
}

/**
 * Run all test cases by submitting them as leads
 * Returns test results with lead IDs
 */
export async function runTests(): Promise<TestRunResult> {
  try {
    console.log('[Test Runner] Starting test run...');

    // Submit all test cases as leads
    const testResults: TestResult[] = [];
    const testCaseKeys = Object.keys(testData) as Array<keyof typeof testData>;

    for (const key of testCaseKeys) {
      const testCase = testData[key];
      console.log(`[Test Runner] Submitting test: ${testCase.label}`);

      try {
        const submitResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/leads/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...testCase.data,
            metadata: {
              isTestLead: true,
              testCase: key,
              expectedClassification: testCase.expectedClassification,
            },
          }),
        });

        if (!submitResponse.ok) {
          const errorData = await submitResponse.json();
          throw new Error(errorData.error || 'Failed to submit lead');
        }

        const submitResult = await submitResponse.json();

        testResults.push({
          testCase: key,
          label: testCase.label,
          expectedClassification: testCase.expectedClassification,
          leadId: submitResult.leadId,
          submitted: true,
        });

        console.log(`[Test Runner] Submitted test ${testCase.label}: lead ID ${submitResult.leadId}`);
      } catch (error) {
        console.error(`[Test Runner] Error submitting test ${testCase.label}:`, error);
        testResults.push({
          testCase: key,
          label: testCase.label,
          expectedClassification: testCase.expectedClassification,
          leadId: '',
          submitted: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[Test Runner] Test submission complete');
    console.log(`  Submitted: ${testResults.filter((r) => r.submitted).length}/${testResults.length}`);

    return {
      success: true,
      results: testResults,
    };
  } catch (error) {
    console.error('[Test Runner] Fatal error:', error);
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
