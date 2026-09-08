import type {
  ApplicationDraft,
  ApplicationStatus,
  InterviewDraft,
  InterviewResult,
} from './types'

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; shortLabel: string; color: string }
> = {
  wishlist: { label: '关注中', shortLabel: '关注', color: '#806b9b' },
  applied: { label: '已投递', shortLabel: '投递', color: '#668f83' },
  assessment: { label: '笔试中', shortLabel: '笔试中', color: '#9a8bb1' },
  interview: { label: '面试中', shortLabel: '面试', color: '#a47c64' },
  offer: { label: '已录用', shortLabel: 'Offer', color: '#5e897b' },
  rejected: { label: '未通过', shortLabel: '未通过', color: '#a47776' },
  withdrawn: { label: '已结束', shortLabel: '结束', color: '#777b7d' },
}

export const ACTIVE_STATUSES: ApplicationStatus[] = [
  'applied',
  'assessment',
  'interview',
  'offer',
]

export const PIPELINE_STATUSES: ApplicationStatus[] = [
  'wishlist',
  ...ACTIVE_STATUSES,
]

export const RESULT_META: Record<InterviewResult, string> = {
  pending: '待反馈',
  passed: '已通过',
  failed: '未通过',
  cancelled: '已取消',
}

export const EMPTY_APPLICATION: ApplicationDraft = {
  company: '',
  role: '',
  location: '',
  status: 'wishlist',
  project: '',
  salary: '',
  url: '',
  notes: '',
}

export const EMPTY_INTERVIEW: InterviewDraft = {
  company: '',
  role: '',
  project: '',
  category: 'class27',
  date: '',
  result: 'pending',
}
