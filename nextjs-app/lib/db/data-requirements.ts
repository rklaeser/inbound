export interface RequirementSection {
  title: string;
  content: string | RequirementSection[];
}

export interface Requirements {
  title: string;
  description: string;
  sections: RequirementSection[];
}

export const requirements: Requirements = {
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
};
