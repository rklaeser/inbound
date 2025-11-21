export interface DocSection {
  title: string;
  content: string | DocSection[];
}

export interface Doc {
  title: string;
  description: string;
  sections: DocSection[];
}

export const docs = {
  requirements: {
    title: "Requirements",
    description: "Automated lead qualification and response system",
    sections: [
      {
        title: "Overview",
        content: "Automated lead qualification and response system that filters incoming leads, generates appropriate email responses, and routes uncertain cases to human review."
      },
      {
        title: "Success Metrics",
        content: [
          { title: "Time to lead", content: "Reduce response time for qualified leads" },
          { title: "Labor savings", content: "Minimize manual lead processing effort" }
        ]
      },
      {
        title: "Lead Classification & Routing",
        content: [
          { title: "", content: "Quality leads receive automated email responses" },
          { title: "", content: "Bias towards human handling: Route potentially good leads to human review when uncertain" },
          { title: "", content: "Low certainty leads require human handling" },
          { title: "", content: "Support/CRM requests get forwarded to appropriate channels" }
        ]
      },
      {
        title: "Email Generation",
        content: [
          { title: "", content: "Generate brief, professional responses" },
          { title: "", content: "Avoid overly positive or enthusiastic tone" },
          { title: "", content: "Maintain clear, concise communication" }
        ]
      }
    ]
  },

  design: {
    title: "Design",
    description: "Technical architecture and implementation details",
    sections: [
      {
        title: "Tech Stack",
        content: [
          { title: "Frontend", content: "Next.js 15.5 (App Router), React, TypeScript" },
          { title: "Styling", content: "Tailwind CSS" },
          { title: "Database", content: "Firestore (flexible schema, real-time updates)" },
          { title: "AI/LLM", content: "Vercel AI SDK for lead classification and email generation" }
        ]
      },
      {
        title: "Data Model",
        content: "Firestore collections store leads with classification, status, and generated responses"
      }
    ]
  },

  plan: {
    title: "Plan",
    description: "Implementation roadmap and phases",
    sections: [
      {
        title: "Phase 1: Foundation",
        content: [
          { title: "", content: "Set up Next.js project structure" },
          { title: "", content: "Configure Firestore database" },
          { title: "", content: "Implement basic authentication" }
        ]
      },
      {
        title: "Phase 2: Core Features",
        content: [
          { title: "", content: "Build lead submission form" },
          { title: "", content: "Implement AI classification" },
          { title: "", content: "Create email generation system" },
          { title: "", content: "Build review queue interface" }
        ]
      }
    ]
  },

  configuration: {
    title: "Configuration",
    description: "How to tune the Inbound sales process using versioned configurations",
    sections: [
      {
        title: "Overview",
        content: "The Inbound system uses versioned configurations to control how leads are processed. Each configuration represents a specific set of rules and thresholds that determine how the AI qualifies and responds to incoming leads."
      },
      {
        title: "Why Configurations Matter",
        content: [
          { title: "Tune AI behavior", content: "Adjust how the system works without changing code" },
          { title: "Test strategies", content: "Compare different approaches side-by-side with live data" },
          { title: "Measure impact", content: "Built-in analytics show performance metrics" },
          { title: "Roll back changes", content: "Revert to previous configurations if needed" },
          { title: "Iterate quickly", content: "Fast experimentation on lead qualification" }
        ]
      },
      {
        title: "Configuration Lifecycle",
        content: [
          { title: "Draft", content: "Create and experiment with new threshold values" },
          { title: "Active", content: "One configuration handles all new incoming leads" },
          { title: "Archived", content: "Retired configurations remain viewable for analysis" }
        ]
      },
      {
        title: "Key Settings",
        content: [
          {
            title: "Auto-Reject Confidence Threshold (0.00 - 1.00)",
            content: "Automatically reject low-value leads when confidence is high enough. Example: 0.90 means leads classified as low-value with 90%+ confidence are auto-rejected. Higher values = more conservative, lower values = more aggressive."
          },
          {
            title: "Quality Lead Confidence Threshold (0.00 - 1.00)",
            content: "Automatically generate email drafts when lead quality confidence is high enough. Example: 0.70 means quality leads with 70%+ confidence get automatic email generation. Higher values = stricter filtering, lower values = more leads get responses."
          }
        ]
      },
      {
        title: "Creating a Configuration",
        content: [
          {
            title: "New Configuration",
            content: "Navigate to Deployments tab → Click + New Configuration → Adjust thresholds → Save Draft or Activate Now"
          },
          {
            title: "Clone Existing",
            content: "Find a configuration → Click Clone → Modify thresholds → Save as draft or activate"
          }
        ]
      },
      {
        title: "Metrics to Watch",
        content: [
          {
            title: "Approval Rate",
            content: "Percentage of generated emails that humans approve and send. Low rate means AI is generating poor emails (increase quality threshold). High rate means AI might be too conservative."
          },
          {
            title: "Edit Rate",
            content: "Percentage of emails humans modify before sending. High rate indicates email quality needs improvement or thresholds need adjustment."
          },
          {
            title: "Classification Distribution",
            content: "How leads are being categorized. Too many 'uncertain'? Thresholds might be poorly positioned. Too many 'quality' but low approval rate? Quality threshold too low."
          }
        ]
      },
      {
        title: "Best Practices",
        content: [
          {
            title: "Start Conservative",
            content: "Set Quality Threshold higher (0.75-0.85) and Auto-Reject Threshold higher (0.90-0.95). Monitor for a week, then adjust if too conservative."
          },
          {
            title: "Iterate Gradually",
            content: "Make small adjustments (0.05-0.10 changes). Let each configuration run for 1-2 weeks minimum. Compare against baseline metrics."
          },
          {
            title: "Monitor Continuously",
            content: "Check Overview tab regularly. Review actual Leads processed. Look for patterns in classifications and human overrides."
          }
        ]
      },
      {
        title: "Common Scenarios",
        content: [
          {
            title: "Too many leads going to human review",
            content: "Problem: High volume of 'uncertain' classifications. Solution: Lower quality threshold slightly (by 0.05) to give more leads automatic processing. Monitor approval rate to ensure quality remains high."
          },
          {
            title: "AI is auto-rejecting good leads",
            content: "Problem: Auto-reject threshold too aggressive. Solution: Increase auto-reject threshold (towards 0.95 or higher). Review rejected leads in the system."
          },
          {
            title: "Generated emails need too much editing",
            content: "Problem: High edit rate. Solution: Increase quality threshold to be more selective. Focus on higher-confidence leads only."
          }
        ]
      },
      {
        title: "Technical Notes",
        content: [
          {
            title: "AI Prompts",
            content: "AI prompts for classification and email generation are version-controlled in code (app/lib/prompts.ts). To modify prompts, update the code and deploy."
          },
          {
            title: "Data Collection",
            content: "Every lead tracks which configuration processed it. This enables historical analysis, configuration comparison, performance metrics per configuration, and rollback capability."
          }
        ]
      }
    ]
  }
} as const;

export type DocType = keyof typeof docs;
