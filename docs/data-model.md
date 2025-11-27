classification enum [high-quality, low-quality, support, duplicate, irrelevant]

status enum [review, done]

submission Returned and Stored
{
  leadName: string
  email: string
  message: string
  company: string
}

bot_research Returned and Stored
{
  timestamp: datetime
  confidence: float 0-1
  classification: classification enum
  reasoning: string
}

bot_text Returned and Stored
{
  lowQualityText: string
  highQualityText: string
}

bot_rollout $note will show data of botRollout values that were approved without reclassification (classifications array has length 1)
{
  rollOut: float 0-1  $note percentage chance of auto-send
  useBot: boolean
}

human_edits: null | object $note If human edits, add newest version to front of array. Don't keep classification in here or copy ai versions because that adds complications.
{
  note: null | string  $note can be used to give context on tone or word choices that caused a rewrite
  versions: [
    {
      text: string
      timestamp: datetime
    }
  ]
}

status (root level on lead document)
{
  status: status enum
  received_at: datetime
  sent_at: datetime | null
}

classifications $note array with most recent first. Example shows human reclassification followed by original bot classification.
[
  {
    author: "human"
    classification: low-quality
    timestamp: datetime
  },
  {
    author: "bot"
    classification: high-quality
    timestamp: datetime
    needs_review: boolean  $note if confidence < applied_threshold then true, else false
    applied_threshold: float 0-1  $note threshold from settings based on classification type at processing time
  }
]