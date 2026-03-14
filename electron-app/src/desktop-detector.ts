export interface DesktopDetectionResult {
  platform?: string
  detectedParticipantNames: string[]
  detectionMethod?: 'source-title' | 'window-metadata'
}

export interface DesktopMeetingContextInput {
  sourceName?: string
  windowTitle?: string
  windowClass?: string
  processName?: string
}

interface PlatformRule {
  platform: string
  markers: string[]
  extractors: Array<(title: string) => string[]>
}

const GENERIC_TITLE_PATTERNS = [
  /\bmeeting\b/i,
  /\bcall\b/i,
  /\bvideo call\b/i,
  /\bchat\b/i,
  /\bconversation\b/i,
  /\bhome\b/i,
  /\bcalendar\b/i,
  /\bnotifications?\b/i,
  /\bsharing\b/i,
  /\bscreen share\b/i,
  /\bwindow\b/i,
  /\bmini\b/i,
  /\bcontrols\b/i,
  /\bin call\b/i,
  /\bworkspace\b/i,
]

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(normalizeWhitespace).filter(Boolean)))
}

function cleanCandidate(candidate: string) {
  let value = normalizeWhitespace(candidate)
  value = value.replace(/\([^)]*\)/g, ' ')
  value = value.replace(/\b(video call|audio call|meeting|call|conversation|chat)\b/gi, ' ')
  value = value.replace(/\b(zoom|skype|whatsapp|microsoft teams|teams|google meet|meet)\b/gi, ' ')
  value = value.replace(/\s+\d+\s+others?\b/gi, '')
  value = value.replace(/\s+\d+\s+participants?\b/gi, '')
  value = value.replace(/[|:\-–—]+$/g, '')
  value = normalizeWhitespace(value)

  if (!value) return null
  if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(value))) return null
  if (!/[A-Za-z]/.test(value)) return null
  if (value.length < 2) return null

  return value
}

function extractDelimitedTitle(title: string, appLabel: string) {
  const escaped = appLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`^(.+?)\\s*[-|:]\\s*${escaped}$`, 'i'),
    new RegExp(`^${escaped}\\s*[-|:]\\s*(.+)$`, 'i'),
    new RegExp(`^(.+?)\\s+[|·]\\s+${escaped}$`, 'i'),
  ]

  const matches = patterns
    .map((pattern) => title.match(pattern)?.[1] ?? title.match(pattern)?.[0] ?? '')
    .filter(Boolean)

  return unique(matches.map((match) => cleanCandidate(match)).filter((value): value is string => !!value))
}

function extractFromPhrase(title: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = title.match(new RegExp(`${escaped}\\s+(.+?)(?:\\s*[-|]|$)`, 'i'))
  if (!match?.[1]) return []
  const candidate = cleanCandidate(match[1])
  return candidate ? [candidate] : []
}

function extractList(title: string) {
  const cleaned = cleanCandidate(title)
  if (!cleaned) return []

  const base = cleaned.replace(/\s+and\s+\d+\s+others?\b/gi, '')
  const parts = base
    .split(/\s*(?:,|&|\band\b)\s*/i)
    .map((part) => cleanCandidate(part))
    .filter((value): value is string => !!value)

  return unique(parts)
}

const PLATFORM_RULES: PlatformRule[] = [
  {
    platform: 'Skype',
    markers: ['skype'],
    extractors: [
      (title) => extractFromPhrase(title, 'Conversation with'),
      (title) => extractDelimitedTitle(title, 'Skype'),
      (title) => extractList(title.replace(/\bSkype\b/gi, '')),
    ],
  },
  {
    platform: 'WhatsApp',
    markers: ['whatsapp'],
    extractors: [
      (title) => extractFromPhrase(title, 'Call with'),
      (title) => extractFromPhrase(title, 'Video call with'),
      (title) => extractDelimitedTitle(title, 'WhatsApp'),
      (title) => extractList(title.replace(/\bWhatsApp\b/gi, '')),
    ],
  },
  {
    platform: 'Zoom',
    markers: ['zoom'],
    extractors: [
      (title) => extractFromPhrase(title, 'Meeting with'),
      (title) => extractDelimitedTitle(title, 'Zoom'),
      (title) => extractDelimitedTitle(title, 'Zoom Workplace'),
      (title) => extractList(title.replace(/\bZoom Workplace\b/gi, '').replace(/\bZoom\b/gi, '')),
    ],
  },
  {
    platform: 'Microsoft Teams',
    markers: ['teams', 'microsoft teams'],
    extractors: [
      (title) => extractFromPhrase(title, 'Meeting with'),
      (title) => extractDelimitedTitle(title, 'Microsoft Teams'),
      (title) => extractDelimitedTitle(title, 'Teams'),
      (title) => extractList(title.replace(/\bMicrosoft Teams\b/gi, '').replace(/\bTeams\b/gi, '')),
    ],
  },
  {
    platform: 'Google Meet',
    markers: ['google meet', 'meet'],
    extractors: [
      (title) => extractFromPhrase(title, 'Meeting with'),
      (title) => extractDelimitedTitle(title, 'Google Meet'),
      (title) => extractList(title.replace(/\bGoogle Meet\b/gi, '').replace(/\bMeet\b/gi, '')),
    ],
  },
]

function buildSearchHaystack(input: DesktopMeetingContextInput) {
  return [
    normalizeWhitespace(input.processName ?? ''),
    normalizeWhitespace(input.windowClass ?? ''),
    normalizeWhitespace(input.windowTitle ?? ''),
    normalizeWhitespace(input.sourceName ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getDetectionMethod(input: DesktopMeetingContextInput) {
  return input.windowClass || input.windowTitle ? 'window-metadata' : 'source-title'
}

function getTitleCandidates(input: DesktopMeetingContextInput) {
  return unique([
    normalizeWhitespace(input.windowTitle ?? ''),
    normalizeWhitespace(input.sourceName ?? ''),
  ].filter(Boolean))
}

export function detectDesktopMeetingContext(input: DesktopMeetingContextInput | string | undefined): DesktopDetectionResult {
  const context = typeof input === 'string'
    ? { sourceName: input }
    : (input ?? {})

  const haystack = buildSearchHaystack(context)
  if (!haystack) {
    return { detectedParticipantNames: [] }
  }

  const rule = PLATFORM_RULES.find((entry) => entry.markers.some((marker) => haystack.includes(marker)))
  if (!rule) {
    return { detectedParticipantNames: [] }
  }

  const detectedParticipantNames = unique(
    getTitleCandidates(context).flatMap((title) => rule.extractors.flatMap((extract) => extract(title)))
  )

  return {
    platform: rule.platform,
    detectedParticipantNames,
    detectionMethod: getDetectionMethod(context),
  }
}
