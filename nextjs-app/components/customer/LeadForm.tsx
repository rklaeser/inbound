'use client';

import { useForm } from '@tanstack/react-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FlaskConical, CheckCircle2, XCircle, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { runTests, type TestRunResult } from '@/actions/run-tests';
import { testData } from '@/lib/db/mock-leads';

interface LeadFormProps {
  onSuccess: (leadData: { company: string; message: string; leadId: string }) => void;
  devModeEnabled?: boolean;
}

// Common personal/free email domains to block
const personalEmailDomains = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'hey.com',
]);

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain ? personalEmailDomains.has(domain) : false;
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email')
    .refine((email) => !isPersonalEmail(email), {
      message: 'Please enter a valid work email',
    }),
  company: z.string().min(1, 'Company is required'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(500, 'Message must be at most 500 characters'),
});

// Helper to get test cases by classification
const getTestCasesForClassification = (classification: string) =>
  (Object.keys(testData) as (keyof typeof testData)[])
    .filter((key) => testData[key].expectedClassification === classification);

export default function LeadForm({ onSuccess, devModeEnabled = false }: LeadFormProps) {
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<TestRunResult | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      company: '',
      message: '',
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const response = await fetch('/api/leads/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });

        if (!response.ok) {
          throw new Error('Failed to submit lead');
        }

        const result = await response.json();

        // Pass lead data to parent (including leadId for real-time updates)
        onSuccess({
          company: value.company,
          message: value.message,
          leadId: result.leadId,
        });

        // Reset form
        form.reset();
      } catch (error) {
        console.error('Error submitting lead:', error);
        // You could add error handling here if needed
      }
    },
  });

  const fillTestData = async (type: keyof typeof testData) => {
    const testCase = testData[type];

    // Fill form fields for visual feedback
    form.setFieldValue('name', testCase.data.name);
    form.setFieldValue('email', testCase.data.email);
    form.setFieldValue('company', testCase.data.company);
    form.setFieldValue('message', testCase.data.message);

    // Submit directly to API with test metadata (same as runTests)
    try {
      const response = await fetch('/api/leads/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...testCase.data,
          metadata: {
            isTestLead: true,
            testCase: type,
            expectedClassification: testCase.expectedClassification,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit test lead');
      }

      const result = await response.json();

      // Pass lead data to parent (including leadId for real-time updates)
      onSuccess({
        company: testCase.data.company,
        message: testCase.data.message,
        leadId: result.leadId,
      });

      // Reset form
      form.reset();
    } catch (error) {
      console.error('Error submitting test lead:', error);
    }
  };

  const handleRunTests = async () => {
    setTestRunning(true);
    setTestResult(null);
    try {
      const result = await runTests();
      setTestResult(result);
    } catch (error) {
      console.error('Error running tests:', error);
      setTestResult({
        success: false,
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="space-y-8"
    >
      {/* Dev Mode Quick Test */}
      {devModeEnabled && (
        <div className="pb-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              <h3 className="text-sm font-medium">Quick Test</h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRunTests}
              disabled={testRunning}
            >
              {testRunning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Run All ({Object.keys(testData).length})
                </>
              )}
            </Button>
          </div>
          <div className="space-y-3">
            {/* High Quality */}
            <div className="rounded-lg bg-muted/30 p-3">
              <Badge variant="success" className="mb-2">High Quality</Badge>
              <div className="flex flex-wrap gap-2">
                {getTestCasesForClassification('high-quality').map((key) => (
                  <Button key={key} type="button" variant="outline" size="sm" onClick={() => fillTestData(key)} disabled={testRunning}>
                    {testData[key].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Low Quality */}
            <div className="rounded-lg bg-muted/30 p-3">
              <Badge variant="muted" className="mb-2">Low Quality</Badge>
              <div className="flex flex-wrap gap-2">
                {getTestCasesForClassification('low-quality').map((key) => (
                  <Button key={key} type="button" variant="outline" size="sm" onClick={() => fillTestData(key)} disabled={testRunning}>
                    {testData[key].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Support */}
            <div className="rounded-lg bg-muted/30 p-3">
              <Badge variant="info" className="mb-2">Support</Badge>
              <div className="flex flex-wrap gap-2">
                {getTestCasesForClassification('support').map((key) => (
                  <Button key={key} type="button" variant="outline" size="sm" onClick={() => fillTestData(key)} disabled={testRunning}>
                    {testData[key].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Existing */}
            <div className="rounded-lg bg-muted/30 p-3">
              <Badge variant="purple" className="mb-2">Existing</Badge>
              <div className="flex flex-wrap gap-2">
                {getTestCasesForClassification('existing').map((key) => (
                  <Button key={key} type="button" variant="outline" size="sm" onClick={() => fillTestData(key)} disabled={testRunning}>
                    {testData[key].label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Results Summary */}
          {testResult && !testRunning && (
            <div className="mt-4 space-y-2">
              {testResult.success ? (
                <>
                  <p className="text-xs text-muted-foreground">
                    {testResult.results.filter((r) => r.submitted).length} test leads submitted!
                    They will be processed through the workflow. Check the leads table below to see results as they complete.
                  </p>
                  <div className="space-y-1">
                    {testResult.results.map((result) => (
                      <div
                        key={result.testCase}
                        className="flex items-center gap-2 text-xs"
                      >
                        {result.submitted ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className={result.submitted ? 'text-green-600' : 'text-red-600'}>
                          {result.label}
                        </span>
                        {result.submitted ? (
                          <span className="text-muted-foreground">
                            (submitted)
                          </span>
                        ) : (
                          <span className="text-red-600 text-xs">
                            {result.error}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-red-600">
                  Test run failed: {testResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <FieldGroup>
        {/* Name Field */}
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="John Doe"
                  autoComplete="name"
                  disabled={form.state.isSubmitting}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />

        {/* Email Field */}
        <form.Field
          name="email"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Company Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="john@company.com"
                  autoComplete="email"
                  disabled={form.state.isSubmitting}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />

        {/* Company Field */}
        <form.Field
          name="company"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Company</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="Acme Inc."
                  autoComplete="organization"
                  disabled={form.state.isSubmitting}
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />

        {/* Message Field */}
        <form.Field
          name="message"
          children={(field) => {
            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>How can we help?</FieldLabel>
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  rows={6}
                  className="resize-none"
                  aria-invalid={isInvalid}
                  placeholder="Your company needs"
                  disabled={form.state.isSubmitting}
                />
                <FieldDescription>
                  {field.state.value.length}/500 characters
                </FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
      </FieldGroup>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="info"
        disabled={form.state.isSubmitting}
        className="w-full rounded-full"
      >
        {form.state.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          'Talk to Vercel'
        )}
      </Button>
    </form>
  );
}
