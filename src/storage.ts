import type {
  Application,
  ApplicationStatus,
  Company,
  Interview,
  InterviewCategory,
  InterviewResult,
  WorkspaceData,
} from './types'

export const STORAGE_KEY = 'career-nest.workspace.v1'
const RECOVERY_KEY = `${STORAGE_KEY}.recovery`

export const EMPTY_DATA: WorkspaceData = {
  version: 3,
  companies: [],
  applications: [],
  interviews: [],
  scheduleEvents: [],
}

const APPLICATION_STATUSES: ApplicationStatus[] = [
  'wishlist',
  'applied',
  'assessment',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]

const INTERVIEW_RESULTS: InterviewResult[] = ['pending', 'passed', 'failed', 'cancelled']

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WorkspaceData>
  return (
    candidate.version === 3 &&
    Array.isArray(candidate.companies) &&
    Array.isArray(candidate.applications) &&
    Array.isArray(candidate.interviews)
  )
}

interface LegacyApplication {
  id?: string
  company?: string
  role?: string
  location?: string
  status?: ApplicationStatus
  project?: string
  salary?: string
  url?: string
  source?: string
  appliedAt?: string
  nextAction?: string
  nextActionAt?: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

interface LegacyInterview {
  id?: string
  applicationId?: string
  company?: string
  role?: string
  project?: string
  category?: InterviewCategory
  rounds?: Array<{
    id?: string
    date?: string
    result?: InterviewResult
    content?: string
  }>
  date?: string
  result?: InterviewResult
  questions?: string
  notes?: string
  reflection?: string
  createdAt?: string
  updatedAt?: string
}

function migrateWorkspace(value: unknown): WorkspaceData | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as {
    version?: number
    companies?: Company[]
    applications?: LegacyApplication[]
    interviews?: LegacyInterview[]
  }
  if (
    ![1, 2].includes(candidate.version ?? 0) ||
    !Array.isArray(candidate.applications) ||
    !Array.isArray(candidate.interviews)
  ) {
    return null
  }

  const timestamp = new Date().toISOString()
  const applications: Application[] = candidate.applications.map((item) => ({
    id: item.id || crypto.randomUUID(),
    company: item.company?.trim() || '未命名公司',
    role: item.role || '未命名岗位',
    location: item.location || '',
    status: APPLICATION_STATUSES.includes(item.status as ApplicationStatus)
      ? (item.status as ApplicationStatus)
      : 'applied',
    project: item.project || '',
    salary: item.salary || '',
    url: item.url || '',
    notes: item.notes || '',
    legacy: {
      source: item.source,
      appliedAt: item.appliedAt,
      nextAction: item.nextAction,
      nextActionAt: item.nextActionAt,
      notes: item.notes,
    },
    createdAt: item.createdAt || timestamp,
    updatedAt: item.updatedAt || timestamp,
  }))

  const companyNames = new Set<string>()
  candidate.companies?.forEach((company) => company.name && companyNames.add(company.name))
  applications.forEach((application) => companyNames.add(application.company))
  const companies: Company[] = [...companyNames].map((name) => {
    const existing = candidate.companies?.find((company) => company.name === name)
    return {
      id: existing?.id || crypto.randomUUID(),
      name,
      archived: existing?.archived === true,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: existing?.updatedAt || timestamp,
    }
  })

  const interviews: Interview[] = candidate.interviews.map((item) => {
    const migratedRounds = item.rounds?.length
      ? item.rounds.map((round) => ({
          id: round.id || crypto.randomUUID(),
          date: round.date || timestamp.slice(0, 10),
          result: INTERVIEW_RESULTS.includes(round.result as InterviewResult)
            ? (round.result as InterviewResult)
            : 'pending',
          content: round.content || '',
        }))
      : [
          {
            id: crypto.randomUUID(),
            date: item.date || timestamp.slice(0, 10),
            result: INTERVIEW_RESULTS.includes(item.result as InterviewResult)
              ? (item.result as InterviewResult)
              : ('pending' as const),
            content: [item.questions, item.notes, item.reflection]
              .filter(Boolean)
              .join('\n\n'),
          },
        ]
    return {
      id: item.id || crypto.randomUUID(),
      applicationId: item.applicationId,
      company: item.company || '未命名公司',
      role: item.role || '未命名岗位',
      project: item.project || '',
      category: item.category === 'past' ? 'past' : 'class27',
      rounds: migratedRounds,
      createdAt: item.createdAt || timestamp,
      updatedAt: item.updatedAt || timestamp,
    }
  })

  return { version: 3, companies, applications, interviews, scheduleEvents: [] }
}

function normalizeWorkspace(data: WorkspaceData): WorkspaceData {
  return {
    ...data,
    scheduleEvents: Array.isArray(data.scheduleEvents) ? data.scheduleEvents : [],
    companies: data.companies.map((company) => ({ ...company, archived: company.archived === true })),
    applications: data.applications.map((application) => ({
      ...application,
      status: APPLICATION_STATUSES.includes(String(application.status) as ApplicationStatus)
        ? (String(application.status) as ApplicationStatus)
        : 'applied',
      notes: application.notes ?? application.legacy?.notes ?? '',
    })),
    interviews: data.interviews.map((interview) => ({
      ...interview,
      category: interview.category === 'past' ? 'past' : 'class27',
    })),
  }
}

function parseWorkspaceValue(raw: string): WorkspaceData | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isWorkspaceData(parsed) ? normalizeWorkspace(parsed) : migrateWorkspace(parsed)
  } catch {
    return null
  }
}

export function loadWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const workspace = parseWorkspaceValue(raw)
      if (workspace) return workspace
    }

    // Recover data saved under an older storage key on this same browser origin.
    const fallbackKeys = Object.keys(localStorage).filter(
      (key) => key !== STORAGE_KEY && /career|workspace|job/i.test(key),
    )
    for (const key of fallbackKeys) {
      const fallback = localStorage.getItem(key)
      if (!fallback) continue
      const workspace = parseWorkspaceValue(fallback)
      if (workspace && (workspace.companies.length || workspace.applications.length || workspace.interviews.length)) {
        return workspace
      }
    }

    return EMPTY_DATA
  } catch {
    return EMPTY_DATA
  }
}

export function saveWorkspace(data: WorkspaceData) {
  const serialized = JSON.stringify(data)
  const previous = localStorage.getItem(STORAGE_KEY)
  if (previous && previous !== serialized) {
    localStorage.setItem(RECOVERY_KEY, previous)
  }
  localStorage.setItem(STORAGE_KEY, serialized)
}

export async function loadWorkspaceFromDisk(): Promise<WorkspaceData | null> {
  try {
    const response = await fetch('/api/workspace', { cache: 'no-store' })
    if (response.status === 404) return null
    if (!response.ok) return null
    return parseWorkspaceFile(await response.text())
  } catch {
    return null
  }
}

export async function saveWorkspaceToDisk(data: WorkspaceData): Promise<boolean> {
  try {
    const response = await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    })
    return response.ok
  } catch {
    return false
  }
}

export function parseWorkspaceFile(text: string): WorkspaceData {
  const parsed: unknown = JSON.parse(text)
  const workspace = isWorkspaceData(parsed) ? normalizeWorkspace(parsed) : migrateWorkspace(parsed)
  if (!workspace) {
    throw new Error('文件格式不正确，请选择由本应用导出的 JSON 文件。')
  }
  return workspace
}

export function downloadWorkspace(data: WorkspaceData) {
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `求职空间备份-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
