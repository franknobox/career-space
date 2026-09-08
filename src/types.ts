export type Page = 'overview' | 'applications' | 'schedule' | 'interviews' | 'data'

export type ApplicationStatus =
  | 'wishlist'
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn'

export type InterviewResult = 'pending' | 'passed' | 'failed' | 'cancelled'
export type InterviewCategory = 'class27' | 'past'

export interface Company {
  id: string
  name: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  company: string
  role: string
  location: string
  status: ApplicationStatus
  project: string
  salary: string
  url: string
  notes?: string
  legacy?: {
    source?: string
    appliedAt?: string
    nextAction?: string
    nextActionAt?: string
    notes?: string
  }
  createdAt: string
  updatedAt: string
}

export interface InterviewRound {
  id: string
  date: string
  result: InterviewResult
  content: string
}

export interface Interview {
  id: string
  applicationId?: string
  company: string
  role: string
  project: string
  category: InterviewCategory
  rounds: InterviewRound[]
  createdAt: string
  updatedAt: string
}

export type ScheduleEventType = 'interview' | 'period'

export interface ScheduleEvent {
  id: string
  type: ScheduleEventType
  title: string
  company: string
  role: string
  date: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceData {
  version: 3
  companies: Company[]
  applications: Application[]
  interviews: Interview[]
  scheduleEvents: ScheduleEvent[]
}

export type ApplicationDraft = Omit<Application, 'id' | 'createdAt' | 'updatedAt'>
export interface InterviewDraft {
  applicationId?: string
  company: string
  role: string
  project: string
  category: InterviewCategory
  date: string
  result: InterviewResult
}
