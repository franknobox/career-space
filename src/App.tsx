import {
  Archive,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Database,
  Download,
  GripVertical,
  Home,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMPTY_APPLICATION,
  EMPTY_INTERVIEW,
  PIPELINE_STATUSES,
  RESULT_META,
  STATUS_META,
} from './constants'
import {
  downloadWorkspace,
  EMPTY_DATA,
  loadWorkspace,
  loadWorkspaceFromDisk,
  parseWorkspaceFile,
  saveWorkspace,
  saveWorkspaceToDisk,
} from './storage'
import type {
  Application,
  ApplicationDraft,
  ApplicationStatus,
  Company,
  Interview,
  InterviewCategory,
  InterviewDraft,
  InterviewResult,
  InterviewRound,
  Page,
  ScheduleEvent,
  ScheduleEventType,
  WorkspaceData,
} from './types'

type Toast = { id: number; message: string }
type ProcessInterviewDraft = { company: string; applicationId: string }
type ScheduleDraft = Omit<ScheduleEvent, 'id' | 'createdAt' | 'updatedAt'>

const ALL_STATUSES = Object.keys(STATUS_META) as ApplicationStatus[]

const NAV_ITEMS: Array<{
  id: Page
  label: string
  icon: typeof Home
}> = [
  { id: 'overview', label: '今日概览', icon: Home },
  { id: 'applications', label: '校招进程', icon: BriefcaseBusiness },
  { id: 'schedule', label: '求职日程', icon: CalendarDays },
  { id: 'interviews', label: '面试记录', icon: MessageSquareText },
  { id: 'data', label: '数据管理', icon: Database },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

function scheduleColorIndex(id: string) {
  let hash = 0
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash) % 8
}

const SCHEDULE_COLOR_FAMILIES = ['green', 'purple', 'warm', 'yellow', 'red', 'warm', 'blue', 'green'] as const

function todayLabel() {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
}

function isFutureOrToday(value: string) {
  if (!value) return false
  const target = new Date(value)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return target >= start
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function hasWorkspaceRecords(value: WorkspaceData) {
  return value.companies.length > 0 || value.applications.length > 0 || value.interviews.length > 0 || value.scheduleEvents.length > 0
}

function App() {
  const [data, setData] = useState<WorkspaceData>(loadWorkspace)
  const initialData = useRef(data)
  const [storageReady, setStorageReady] = useState(false)
  const [page, setPage] = useState<Page>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [showArchivedCompanies, setShowArchivedCompanies] = useState(false)
  const [expandedCompanies, setExpandedCompanies] = useState<string[]>([])
  const [draggingCompanyId, setDraggingCompanyId] = useState<string | null>(null)
  const [dragOverCompanyId, setDragOverCompanyId] = useState<string | null>(null)
  const [companyDraft, setCompanyDraft] = useState<string | null>(null)
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null)
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft | null>(null)
  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null)
  const [interviewDraft, setInterviewDraft] = useState<InterviewDraft | null>(null)
  const [processInterviewDraft, setProcessInterviewDraft] = useState<ProcessInterviewDraft | null>(null)
  const [editingInterviewId, setEditingInterviewId] = useState<string | null>(null)
  const [interviewFocusId, setInterviewFocusId] = useState<string | null>(null)
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [scheduleMonth, setScheduleMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => {
    let mounted = true
    loadWorkspaceFromDisk().then((diskData) => {
      if (!mounted) return
      if (diskData && (hasWorkspaceRecords(diskData) || !hasWorkspaceRecords(initialData.current))) {
        setData(diskData)
      }
      setStorageReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    saveWorkspace(data)
    void saveWorkspaceToDisk(data)
  }, [data, storageReady])

  function notify(message: string) {
    const id = ++toastId.current
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 2600)
  }

  function navigate(nextPage: Page) {
    setPage(nextPage)
    setSidebarOpen(false)
  }

  function openNewSchedule(type: ScheduleEventType = 'interview', date = today()) {
    setEditingScheduleId(null)
    setScheduleDraft({
      type,
      title: type === 'interview' ? '面试' : '测试 / 任务',
      company: '',
      role: '',
      date,
      startDate: date,
      endDate: date,
      startTime: type === 'interview' ? '10:00' : '',
      endTime: type === 'interview' ? '11:00' : '',
      notes: '',
    })
  }

  function openEditSchedule(event: ScheduleEvent) {
    setEditingScheduleId(event.id)
    setScheduleDraft({ ...event })
  }

  function saveSchedule() {
    if (!scheduleDraft?.title.trim()) {
      notify('请填写日程标题')
      return
    }
    const timestamp = new Date().toISOString()
    const normalized: ScheduleEvent = {
      ...scheduleDraft,
      title: scheduleDraft.title.trim(),
      company: scheduleDraft.company.trim(),
      role: scheduleDraft.role.trim(),
      date: scheduleDraft.type === 'interview' ? scheduleDraft.date : scheduleDraft.startDate,
      endDate: scheduleDraft.type === 'interview' ? scheduleDraft.date : (scheduleDraft.endDate || scheduleDraft.startDate),
      id: editingScheduleId ?? crypto.randomUUID(),
      createdAt: editingScheduleId ? data.scheduleEvents.find((item) => item.id === editingScheduleId)?.createdAt ?? timestamp : timestamp,
      updatedAt: timestamp,
    }
    setData((current) => ({
      ...current,
      scheduleEvents: editingScheduleId
        ? current.scheduleEvents.map((item) => item.id === editingScheduleId ? normalized : item)
        : [...current.scheduleEvents, normalized],
    }))
    setScheduleDraft(null)
    notify(editingScheduleId ? '日程已更新' : '日程已添加')
  }

  function deleteSchedule(id: string) {
    if (!window.confirm('确定删除这条日程吗？')) return
    setData((current) => ({ ...current, scheduleEvents: current.scheduleEvents.filter((item) => item.id !== id) }))
    setScheduleDraft(null)
    notify('日程已删除')
  }

  function openNewCompany() {
    setEditingCompanyId(null)
    setCompanyDraft('')
  }

  function openEditCompany(company: Company) {
    setEditingCompanyId(company.id)
    setCompanyDraft(company.name)
  }

  function toggleCompanyArchive(companyId: string) {
    setData((current) => ({
      ...current,
      companies: current.companies.map((company) =>
        company.id === companyId ? { ...company, archived: !company.archived, updatedAt: new Date().toISOString() } : company,
      ),
    }))
    setCompanyDraft(null)
    notify('已更新公司的归档状态')
  }

  function saveCompany() {
    const name = companyDraft?.trim()
    if (!name) {
      notify('请填写公司名称')
      return
    }
    const duplicate = data.companies.some(
      (company) => company.name.toLowerCase() === name.toLowerCase() && company.id !== editingCompanyId,
    )
    if (duplicate) {
      notify('这家公司已经存在')
      return
    }
    const timestamp = new Date().toISOString()
    const newCompanyId = editingCompanyId ? null : crypto.randomUUID()
    setData((current) => {
      if (editingCompanyId) {
        const previous = current.companies.find((company) => company.id === editingCompanyId)
        return {
          ...current,
          companies: current.companies.map((company) =>
            company.id === editingCompanyId
              ? { ...company, name, updatedAt: timestamp }
              : company,
          ),
          applications: current.applications.map((application) =>
            application.company === previous?.name
              ? { ...application, company: name, updatedAt: timestamp }
              : application,
          ),
        }
      }
      const company: Company = {
        id: newCompanyId!,
        name,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      return { ...current, companies: [company, ...current.companies] }
    })
    if (newCompanyId) {
      setExpandedCompanies((currentExpanded) => [...currentExpanded, newCompanyId])
    }
    setCompanyDraft(null)
    notify(editingCompanyId ? '公司名称已更新' : '公司已添加')
  }

  function deleteCompany(company: Company) {
    const count = data.applications.filter((item) => item.company === company.name).length
    const message = count
      ? `确定删除“${company.name}”及其 ${count} 个岗位吗？`
      : `确定删除“${company.name}”吗？`
    if (!window.confirm(message)) return
    setData((current) => ({
      ...current,
      companies: current.companies.filter((item) => item.id !== company.id),
      applications: current.applications.filter((item) => item.company !== company.name),
    }))
    setCompanyDraft(null)
    notify('公司及其岗位已删除')
  }

  function toggleCompany(id: string) {
    setExpandedCompanies((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function reorderCompanies(sourceId: string, targetId: string) {
    if (sourceId === targetId) return
    setData((current) => {
      const sourceIndex = current.companies.findIndex((company) => company.id === sourceId)
      const targetIndex = current.companies.findIndex((company) => company.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const companies = [...current.companies]
      const [moved] = companies.splice(sourceIndex, 1)
      companies.splice(targetIndex, 0, moved)
      return { ...current, companies }
    })
  }

  function openNewApplication(company: string) {
    setEditingApplicationId(null)
    setApplicationDraft({ ...EMPTY_APPLICATION, company })
  }

  function openEditApplication(application: Application) {
    setEditingApplicationId(application.id)
    setApplicationDraft({
      company: application.company,
      role: application.role,
      location: application.location,
      status: application.status,
      project: application.project,
      salary: application.salary,
      url: application.url,
      notes: application.notes ?? application.legacy?.notes ?? '',
    })
  }

  function saveApplication() {
    if (!applicationDraft?.company.trim() || !applicationDraft.role.trim()) {
      notify('请先填写公司和岗位')
      return
    }
    const timestamp = new Date().toISOString()
    const normalized: ApplicationDraft = {
      ...applicationDraft,
      company: applicationDraft.company.trim(),
      role: applicationDraft.role.trim(),
    }

    setData((current) => {
      if (editingApplicationId) {
        return {
          ...current,
          applications: current.applications.map((item) =>
            item.id === editingApplicationId
              ? { ...item, ...normalized, updatedAt: timestamp }
              : item,
          ),
        }
      }
      return {
        ...current,
        applications: [
          {
            ...normalized,
            id: crypto.randomUUID(),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...current.applications,
        ],
      }
    })
    setApplicationDraft(null)
    notify(editingApplicationId ? '岗位已更新' : '岗位已添加')
  }

  function deleteApplication(id: string) {
    if (!window.confirm('确定删除这个岗位吗？')) return
    setData((current) => ({
      ...current,
      applications: current.applications.filter((item) => item.id !== id),
    }))
    setApplicationDraft(null)
    notify('岗位已删除')
  }

  function updateApplicationNotes(id: string, notes: string) {
    const timestamp = new Date().toISOString()
    setData((current) => ({
      ...current,
      applications: current.applications.map((item) =>
        item.id === id ? { ...item, notes, updatedAt: timestamp } : item,
      ),
    }))
  }

  function quickStatus(id: string, status: ApplicationStatus) {
    const timestamp = new Date().toISOString()
    setData((current) => ({
      ...current,
      applications: current.applications.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              updatedAt: timestamp,
            }
          : item,
      ),
    }))
    notify(`已移至“${STATUS_META[status].label}”`)
  }

  function openNewInterview() {
    setEditingInterviewId(null)
    setInterviewDraft({ ...EMPTY_INTERVIEW, date: today() })
  }

  function openNewInterviewFromProcess() {
    const firstApplication = data.applications[0]
    setProcessInterviewDraft({
      company: firstApplication?.company ?? '',
      applicationId: firstApplication?.id ?? '',
    })
  }

  function saveProcessInterview() {
    if (!processInterviewDraft?.applicationId) return
    const application = data.applications.find((item) => item.id === processInterviewDraft.applicationId)
    if (!application) return
    const timestamp = new Date().toISOString()
    const interviewId = crypto.randomUUID()
    const interview: Interview = {
      id: interviewId,
      applicationId: application.id,
      company: application.company,
      role: application.role,
      project: application.project,
      category: 'class27',
      rounds: [{ id: crypto.randomUUID(), date: today(), result: 'pending', content: '' }],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    setData((current) => ({ ...current, interviews: [interview, ...current.interviews] }))
    setProcessInterviewDraft(null)
    setInterviewFocusId(interviewId)
    navigate('interviews')
    notify('已基于岗位创建面试记录')
  }

  function openEditInterview(interview: Interview) {
    const firstRound = interview.rounds[0]
    setEditingInterviewId(interview.id)
    setInterviewDraft({
      company: interview.company,
      role: interview.role,
      project: interview.project,
      applicationId: interview.applicationId,
      category: interview.category,
      date: firstRound?.date ?? today(),
      result: firstRound?.result ?? 'pending',
    })
  }

  function saveInterview() {
    if (!interviewDraft?.company.trim() || !interviewDraft.role.trim()) {
      notify('请先填写公司和岗位')
      return
    }
    if (!interviewDraft.date) {
      notify('请设置面试时间')
      return
    }
    const timestamp = new Date().toISOString()
    const normalized = {
      company: interviewDraft.company.trim(),
      role: interviewDraft.role.trim(),
      project: interviewDraft.project.trim(),
    }
    setData((current) => {
      const interviews = editingInterviewId
        ? current.interviews.map((item) =>
            item.id === editingInterviewId
              ? {
                  ...item,
                  ...normalized,
                  category: interviewDraft.category,
                  rounds: item.rounds.map((round, index) =>
                    index === 0
                      ? { ...round, date: interviewDraft.date, result: interviewDraft.result }
                      : round,
                  ),
                  updatedAt: timestamp,
                }
              : item,
          )
        : [
            {
              ...normalized,
              category: interviewDraft.category,
              id: crypto.randomUUID(),
              rounds: [
                {
                  id: crypto.randomUUID(),
                  date: interviewDraft.date,
                  result: interviewDraft.result,
                  content: '',
                },
              ],
              createdAt: timestamp,
              updatedAt: timestamp,
            },
            ...current.interviews,
          ]
      return { ...current, interviews }
    })
    setInterviewDraft(null)
    notify(editingInterviewId ? '面试记录已更新' : '面试记录已添加')
  }

  function deleteInterview(id: string) {
    if (!window.confirm('确定删除这条面试记录吗？')) return
    setData((current) => ({
      ...current,
      interviews: current.interviews.filter((item) => item.id !== id),
    }))
    setInterviewDraft(null)
    notify('面试记录已删除')
  }

  function openLinkedInterview(applicationId: string) {
    const interview = data.interviews.find((item) => item.applicationId === applicationId)
    if (!interview) return
    setInterviewFocusId(interview.id)
    navigate('interviews')
  }

  function updateInterviewRound(
    interviewId: string,
    roundId: string,
    patch: Partial<InterviewRound>,
  ) {
    const timestamp = new Date().toISOString()
    setData((current) => ({
      ...current,
      interviews: current.interviews.map((interview) =>
        interview.id === interviewId
          ? {
              ...interview,
              rounds: interview.rounds.map((round) =>
                round.id === roundId ? { ...round, ...patch } : round,
              ),
              updatedAt: timestamp,
            }
          : interview,
      ),
    }))
  }

  function addInterviewRound(interviewId: string) {
    const timestamp = new Date().toISOString()
    setData((current) => ({
      ...current,
      interviews: current.interviews.map((interview) =>
        interview.id === interviewId
          ? {
              ...interview,
              rounds: [
                ...interview.rounds,
                { id: crypto.randomUUID(), date: today(), result: 'pending', content: '' },
              ],
              updatedAt: timestamp,
            }
          : interview,
      ),
    }))
    notify('已新增一轮面试')
  }

  function deleteInterviewRound(interviewId: string, roundId: string) {
    const interview = data.interviews.find((item) => item.id === interviewId)
    if (!interview || interview.rounds.length <= 1) return
    if (!window.confirm('确定删除这一轮面试吗？')) return
    setData((current) => ({
      ...current,
      interviews: current.interviews.map((item) =>
        item.id === interviewId
          ? { ...item, rounds: item.rounds.filter((round) => round.id !== roundId) }
          : item,
      ),
    }))
    notify('本轮面试已删除')
  }

  function importData(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = parseWorkspaceFile(String(reader.result))
        setData(imported)
        notify('备份已导入')
      } catch (error) {
        notify(error instanceof Error ? error.message : '导入失败')
      }
    }
    reader.readAsText(file)
  }

  function clearData() {
    if (!window.confirm('确定清空全部公司、投递和面试记录吗？此操作无法撤销。')) return
    setData(EMPTY_DATA)
    notify('全部数据已清空')
  }

  const filteredCompanies = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return data.companies.filter((company) => {
      if (company.archived === true !== showArchivedCompanies) return false
      const companyApplications = data.applications.filter(
        (application) => application.company === company.name,
      )
      const matchesStatus =
        statusFilter === 'all' ||
        companyApplications.some((application) => application.status === statusFilter)
      const matchesQuery =
        !keyword ||
        company.name.toLowerCase().includes(keyword) ||
        companyApplications.some((application) =>
          [application.role, application.location, application.project].some((value) =>
            value.toLowerCase().includes(keyword),
          ),
        )
      return matchesStatus && matchesQuery
    })
  }, [data.applications, data.companies, query, showArchivedCompanies, statusFilter])

  const recentApplications = useMemo(
    () =>
      [...data.applications]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [data.applications],
  )

  const sortedInterviews = useMemo(
    () =>
      [...data.interviews].sort(
        (a, b) => {
          const latestA = a.rounds.at(-1)?.date ?? ''
          const latestB = b.rounds.at(-1)?.date ?? ''
          return new Date(latestB).getTime() - new Date(latestA).getTime()
        },
      ),
    [data.interviews],
  )

  const upcomingInterviews = data.interviews.reduce(
    (count, item) =>
      count +
      item.rounds.filter(
        (round) => round.result === 'pending' && isFutureOrToday(round.date),
      ).length,
    0,
  )
  const activeApplications = data.applications.filter((item) =>
    ['applied', 'assessment', 'interview'].includes(item.status),
  ).length
  const offers = data.applications.filter((item) => item.status === 'offer').length

  const pageTitles: Record<Page, { eyebrow: string; title: string }> = {
    overview: { eyebrow: 'CAREER WORKSPACE', title: '今日概览' },
    applications: { eyebrow: 'APPLICATIONS', title: '校招进程' },
    schedule: { eyebrow: 'JOB SCHEDULE', title: '求职日程' },
    interviews: { eyebrow: 'INTERVIEW NOTES', title: '面试记录' },
    data: { eyebrow: 'LOCAL DATA', title: '数据管理' },
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="brand">
          <div>
            <strong>求职空间</strong>
            <span>MY CAREER NEST</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="主导航">
          {NAV_ITEMS.filter((item) => item.id !== 'data').map((item) => {
            const Icon = item.icon
            return (
              <button
                className={page === item.id ? 'active' : ''}
                key={item.id}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.id === 'applications' && data.applications.length > 0 && (
                  <em>{data.applications.length}</em>
                )}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-note">
          <LockKeyhole size={17} />
          <div>
            <strong>仅存储在本机</strong>
            <span>记得定期导出备份</span>
          </div>
        </div>
        <nav className="primary-nav sidebar-bottom-nav" aria-label="数据导航">
          <button
            className={page === 'data' ? 'active' : ''}
            onClick={() => navigate('data')}
          >
            <Database size={19} strokeWidth={1.8} />
            <span>数据管理</span>
          </button>
        </nav>
        <div className="sidebar-footer">2026 · 为下一程认真准备</div>
      </aside>

      {sidebarOpen && <button className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)}>
            <Menu size={21} />
          </button>
          <div className="page-heading">
            <span>{pageTitles[page].eyebrow}</span>
            <h1>{pageTitles[page].title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="date-display">{todayLabel()}</div>
          </div>
        </header>

        <div className="page-content">
          {page === 'overview' && (
            <Overview
              applications={data.applications}
              interviews={sortedInterviews}
              recentApplications={recentApplications}
              activeApplications={activeApplications}
              upcomingInterviews={upcomingInterviews}
              offers={offers}
              onNavigate={navigate}
              onEditApplication={openEditApplication}
            />
          )}

          {page === 'applications' && (
            <ApplicationsPage
              companies={filteredCompanies}
              allCompanies={data.companies}
              applications={data.applications}
              interviews={data.interviews}
              query={query}
              setQuery={setQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              showArchived={showArchivedCompanies}
              onToggleArchived={() => {
                setShowArchivedCompanies((value) => !value)
                setStatusFilter('all')
              }}
              draggingCompanyId={draggingCompanyId}
              dragOverCompanyId={dragOverCompanyId}
              setDraggingCompanyId={setDraggingCompanyId}
              setDragOverCompanyId={setDragOverCompanyId}
              onReorderCompanies={reorderCompanies}
              expandedCompanies={expandedCompanies}
              onToggleCompany={toggleCompany}
              onEditCompany={openEditCompany}
              onEdit={openEditApplication}
              onStatusChange={quickStatus}
              onNotesChange={updateApplicationNotes}
              onOpenInterview={openLinkedInterview}
              onNewCompany={openNewCompany}
              onNewApplication={openNewApplication}
            />
          )}

          {page === 'schedule' && (
            <SchedulePage
              events={data.scheduleEvents}
              month={scheduleMonth}
              onMonthChange={setScheduleMonth}
              onNew={() => openNewSchedule('interview')}
              onNewAtDate={(date) => openNewSchedule('interview', date)}
              onNewPeriod={() => openNewSchedule('period')}
              onEdit={openEditSchedule}
            />
          )}

          {page === 'interviews' && (
            <InterviewsPage
              interviews={sortedInterviews}
              onEdit={openEditInterview}
              onNew={openNewInterview}
              onNewFromProcess={openNewInterviewFromProcess}
              onDelete={deleteInterview}
              onUpdateRound={updateInterviewRound}
              onAddRound={addInterviewRound}
              onDeleteRound={deleteInterviewRound}
              focusInterviewId={interviewFocusId}
            />
          )}

          {page === 'data' && (
            <DataPage
              data={data}
              onExport={() => {
                downloadWorkspace(data)
                notify('备份文件已导出')
              }}
              onImport={importData}
              onClear={clearData}
            />
          )}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="移动端导航">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={page === item.id ? 'active' : ''}
              key={item.id}
              onClick={() => navigate(item.id)}
            >
              <Icon size={19} />
              <span>{item.label.slice(0, 2)}</span>
            </button>
          )
        })}
      </nav>

      {companyDraft !== null && (
        <CompanyModal
          value={companyDraft}
          setValue={setCompanyDraft}
          editing={Boolean(editingCompanyId)}
          onSave={saveCompany}
          onDelete={
            editingCompanyId
              ? () => {
                  const company = data.companies.find((item) => item.id === editingCompanyId)
                  if (company) deleteCompany(company)
              }
            : undefined
          }
          onArchive={
            editingCompanyId
              ? () => toggleCompanyArchive(editingCompanyId)
              : undefined
          }
          archived={Boolean(editingCompanyId && data.companies.find((item) => item.id === editingCompanyId)?.archived)}
          onClose={() => setCompanyDraft(null)}
        />
      )}

      {scheduleDraft && (
        <ScheduleModal
          draft={scheduleDraft}
          setDraft={setScheduleDraft}
          editing={Boolean(editingScheduleId)}
          onSave={saveSchedule}
          onDelete={editingScheduleId ? () => deleteSchedule(editingScheduleId) : undefined}
          onClose={() => setScheduleDraft(null)}
        />
      )}

      {applicationDraft && (
        <ApplicationModal
          draft={applicationDraft}
          setDraft={setApplicationDraft}
          editing={Boolean(editingApplicationId)}
          onSave={saveApplication}
          onDelete={
            editingApplicationId ? () => deleteApplication(editingApplicationId) : undefined
          }
          onClose={() => setApplicationDraft(null)}
        />
      )}

      {interviewDraft && (
        <InterviewModal
          draft={interviewDraft}
          setDraft={setInterviewDraft}
          editing={Boolean(editingInterviewId)}
          onSave={saveInterview}
          onClose={() => setInterviewDraft(null)}
        />
      )}

      {processInterviewDraft && (
        <ProcessInterviewModal
          draft={processInterviewDraft}
          applications={data.applications}
          setDraft={setProcessInterviewDraft}
          onSave={saveProcessInterview}
          onClose={() => setProcessInterviewDraft(null)}
        />
      )}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}><Check size={17} /> {toast.message}</div>
        ))}
      </div>
    </div>
  )
}

interface OverviewProps {
  applications: Application[]
  interviews: Interview[]
  recentApplications: Application[]
  activeApplications: number
  upcomingInterviews: number
  offers: number
  onNavigate: (page: Page) => void
  onEditApplication: (application: Application) => void
}

function Overview({
  applications,
  interviews,
  recentApplications,
  activeApplications,
  upcomingInterviews,
  offers,
  onNavigate,
  onEditApplication,
}: OverviewProps) {
  const pipelineTotal = Math.max(applications.length, 1)
  return (
    <div className="overview-page">
      <section className="welcome-row">
        <div>
          <p>{getGreeting()}，保持自己的节奏。</p>
          <h2>每一次准备，都在靠近更合适的位置。</h2>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={BriefcaseBusiness}
          tone="blue"
          label="进行中的投递"
          value={activeApplications}
          note={`全部 ${applications.length} 条记录`}
        />
        <StatCard
          icon={CalendarClock}
          tone="orange"
          label="待进行的面试"
          value={upcomingInterviews}
          note="提前准备，准时赴约"
        />
        <StatCard
          icon={Star}
          tone="green"
          label="收到的 Offer"
          value={offers}
          note={offers ? '认真比较，再做决定' : '好消息正在路上'}
        />
        <StatCard
          icon={ClipboardList}
          tone="purple"
          label="面试复盘"
          value={interviews.length}
          note="记录会变成经验"
        />
      </section>

      {applications.length === 0 && interviews.length === 0 ? (
        <section className="starter-card">
          <div className="starter-illustration">
            <BriefcaseBusiness size={34} />
          </div>
          <div>
            <span className="eyebrow">从这里开始</span>
            <h3>建立你的第一条求职记录</h3>
            <p>先把感兴趣或已经投递的岗位记下来。以后每一次状态变化、面试准备和复盘都会有迹可循。</p>
          </div>
        </section>
      ) : (
        <div className="dashboard-grid">
          <section className="panel pipeline-panel">
            <PanelHeader
              eyebrow="PROGRESS"
              title="投递漏斗"
              action="查看全部"
              onAction={() => onNavigate('applications')}
            />
            <div className="pipeline-list">
              {PIPELINE_STATUSES.map((status) => {
                const count = applications.filter((item) => item.status === status).length
                const width = `${Math.max((count / pipelineTotal) * 100, count ? 8 : 0)}%`
                return (
                  <div className="pipeline-row" key={status}>
                    <div className="pipeline-label">
                      <span>{STATUS_META[status].label}</span><strong>{count}</strong>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width, backgroundColor: STATUS_META[status].color }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="panel action-panel">
            <PanelHeader
              eyebrow="RECENTLY UPDATED"
              title="最近再看"
              action="管理投递"
              onAction={() => onNavigate('applications')}
            />
            {recentApplications.length ? (
              <div className="action-list">
                {recentApplications.map((application) => (
                  <button
                    className="action-item"
                    key={application.id}
                    onClick={() => onEditApplication(application)}
                  >
                    <div className="date-tile">
                      <strong>{new Date(application.updatedAt).getDate()}</strong>
                      <span>{new Date(application.updatedAt).getMonth() + 1}月</span>
                    </div>
                    <div className="action-copy">
                      <strong>{STATUS_META[application.status].label}</strong>
                      <span>{application.company} · {application.role}</span>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <SmallEmpty icon={Clock3} text="还没有岗位" hint="在公司列表中添加岗位" />
            )}
          </section>

        </div>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  note,
}: {
  icon: typeof Home
  tone: string
  label: string
  value: number
  note: string
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
      <div className="stat-main"><span>{label}</span><strong>{value}</strong></div>
      <div className="stat-note">{note}</div>
    </article>
  )
}

function PanelHeader({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string
  title: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="panel-header">
      <div><span>{eyebrow}</span><h3>{title}</h3></div>
      <button onClick={onAction}>{action} <ArrowRight size={14} /></button>
    </div>
  )
}

function SmallEmpty({
  icon: Icon,
  text,
  hint,
}: {
  icon: typeof Home
  text: string
  hint: string
}) {
  return (
    <div className="small-empty"><Icon size={24} /><strong>{text}</strong><span>{hint}</span></div>
  )
}

interface ApplicationsPageProps {
  companies: Company[]
  allCompanies: Company[]
  applications: Application[]
  interviews: Interview[]
  query: string
  setQuery: (value: string) => void
  statusFilter: ApplicationStatus | 'all'
  setStatusFilter: (value: ApplicationStatus | 'all') => void
  showArchived: boolean
  onToggleArchived: () => void
  draggingCompanyId: string | null
  dragOverCompanyId: string | null
  setDraggingCompanyId: (value: string | null) => void
  setDragOverCompanyId: (value: string | null) => void
  onReorderCompanies: (sourceId: string, targetId: string) => void
  expandedCompanies: string[]
  onToggleCompany: (id: string) => void
  onEditCompany: (company: Company) => void
  onEdit: (application: Application) => void
  onStatusChange: (id: string, status: ApplicationStatus) => void
  onNotesChange: (id: string, notes: string) => void
  onOpenInterview: (applicationId: string) => void
  onNewCompany: () => void
  onNewApplication: (company: string) => void
}

function ApplicationsPage({
  companies,
  allCompanies,
  applications,
  interviews,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  showArchived,
  onToggleArchived,
  draggingCompanyId,
  dragOverCompanyId,
  setDraggingCompanyId,
  setDragOverCompanyId,
  onReorderCompanies,
  expandedCompanies,
  onToggleCompany,
  onEditCompany,
  onEdit,
  onStatusChange,
  onNotesChange,
  onOpenInterview,
  onNewCompany,
  onNewApplication,
}: ApplicationsPageProps) {
  const [expandedPositions, setExpandedPositions] = useState<string[]>([])

  function togglePosition(id: string) {
    setExpandedPositions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <div className="applications-page">
      <div className="filterbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索公司、岗位、项目、地点…"
          />
          {query && <button onClick={() => setQuery('')}><X size={15} /></button>}
        </label>
        <label className="select-field compact">
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ApplicationStatus | 'all')
            }
          >
            <option value="all">全部状态</option>
            {ALL_STATUSES.map((status) => (
              <option value={status} key={status}>{STATUS_META[status].label}</option>
            ))}
          </select>
          <ChevronDown size={15} />
        </label>
        <button className="button secondary archive-filter-button" onClick={onToggleArchived}>
          <Archive size={16} /> {showArchived ? '返回校招进程' : '已归档'}
        </button>
        {!showArchived && <button className="button primary filter-add-button" onClick={onNewCompany}>
          <Plus size={17} /> 新增公司
        </button>}
      </div>

      <div className="filter-summary">
        <span>共 <strong>{companies.length}</strong> 家公司 · <strong>{applications.length}</strong> 个岗位</span>
        {statusFilter !== 'all' && (
          <button onClick={() => setStatusFilter('all')}>
            {STATUS_META[statusFilter].label} <X size={13} />
          </button>
        )}
      </div>

      {allCompanies.length === 0 ? (
        <div className="full-empty company-empty">
          <div><BriefcaseBusiness size={28} /></div>
          <h2>还没有公司</h2>
          <p>使用上方右侧的“新增公司”建立第一家公司，再在公司内部添加岗位。</p>
        </div>
      ) : companies.length === 0 ? (
        <FullEmpty
          icon={Search}
          title="没有找到匹配的公司或岗位"
          description="换个关键词或清除状态筛选再试试。"
          action="清除筛选"
          onAction={() => {
            setQuery('')
            setStatusFilter('all')
          }}
        />
      ) : (
        <div className="company-list">
          {companies.map((company) => {
            const allCompanyApplications = applications.filter(
              (application) => application.company === company.name,
            )
            const visibleApplications = allCompanyApplications.filter(
              (application) =>
                statusFilter === 'all' || application.status === statusFilter,
            )
            const expanded = expandedCompanies.includes(company.id)
            const activeCount = allCompanyApplications.filter((application) =>
              ['applied', 'assessment', 'interview'].includes(application.status),
            ).length
            const companyLocations = [...new Set(
              allCompanyApplications
                .map((application) => application.location.trim())
                .filter(Boolean),
            )].join(' · ')
            return (
              <section
                className={`company-group ${expanded ? 'expanded' : ''} ${draggingCompanyId === company.id ? 'is-dragging' : ''} ${dragOverCompanyId === company.id ? 'is-drag-target' : ''}`}
                key={company.id}
                draggable={!expanded}
                onDragStart={(event) => {
                  if (expanded) {
                    event.preventDefault()
                    return
                  }
                  event.dataTransfer.effectAllowed = 'move'
                  setDraggingCompanyId(company.id)
                }}
                onDragEnter={(event) => {
                  if (!expanded && draggingCompanyId && draggingCompanyId !== company.id) {
                    event.preventDefault()
                    setDragOverCompanyId(company.id)
                  }
                }}
                onDragOver={(event) => {
                  if (!expanded && draggingCompanyId && draggingCompanyId !== company.id) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (!expanded && draggingCompanyId) {
                    onReorderCompanies(draggingCompanyId, company.id)
                  }
                  setDraggingCompanyId(null)
                  setDragOverCompanyId(null)
                }}
                onDragEnd={() => {
                  setDraggingCompanyId(null)
                  setDragOverCompanyId(null)
                }}
              >
                <header className="company-group-header">
                  <button
                    className="company-accordion-trigger"
                    onClick={() => onToggleCompany(company.id)}
                    aria-expanded={expanded}
                  >
                    {!expanded && <GripVertical className="company-drag-handle" size={16} />}
                    <span className={`company-chevron ${expanded ? 'expanded' : ''}`}><ChevronDown size={18} /></span>
                    <span className="company-group-title">
                      <strong style={{ color: companyColor(company.name) }}>{company.name}</strong>
                      <small>{allCompanyApplications.length} 个岗位{activeCount ? ` · ${activeCount} 个进行中` : ''}</small>
                    </span>
                    {companyLocations && <span className="company-base-locations" title={companyLocations}>{companyLocations}</span>}
                    <span className="company-status-dots">
                      {ALL_STATUSES.map((status) => {
                        const count = allCompanyApplications.filter((item) => item.status === status).length
                        return count ? <i key={status} title={`${STATUS_META[status].label} ${count}`} style={{ backgroundColor: STATUS_META[status].color }} /> : null
                      })}
                    </span>
                  </button>
                  <div className="company-group-actions">
                    <button className="icon-button subtle" onClick={() => onEditCompany(company)} title="编辑公司"><Pencil size={16} /></button>
                  </div>
                </header>

                {expanded && (
                  <div className="company-group-body">
                    {visibleApplications.length ? (
                      <div className="position-list">
                        <div className="position-list-head">
                          <span>岗位 / 项目</span><span>地点</span><span>薪资范围</span><span>状态</span><span>链接</span><span />
                        </div>
                        {visibleApplications.map((application) => {
                          const expandedPosition = expandedPositions.includes(application.id)
                          const linkedInterview = interviews.find((item) => item.applicationId === application.id)
                          const notes = application.notes ?? application.legacy?.notes ?? ''
                          return (
                            <div className={`position-entry ${expandedPosition ? 'expanded' : ''}`} key={application.id}>
                              <div
                                className="position-row"
                                role="button"
                                tabIndex={0}
                                onClick={() => togglePosition(application.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    togglePosition(application.id)
                                  }
                                }}
                              >
                                <div className="position-name">
                                  <span className="position-expand-mark"><ChevronDown size={15} /></span>
                                  {linkedInterview && (
                                    <button
                                      className="position-interview-link"
                                      onClick={(event) => { event.stopPropagation(); onOpenInterview(application.id) }}
                                      title="进入面试记录"
                                      aria-label="进入面试记录"
                                    ><MessageSquareText size={14} /></button>
                                  )}
                                  <div className="position-name-copy"><strong>{application.role}</strong><span>{application.project || '未填写项目'}</span></div>
                                </div>
                                <span className="position-location"><MapPin size={13} /> {application.location || '—'}</span>
                                <span>{application.salary || '—'}</span>
                                <div className="select-field position-status-select" onClick={(event) => event.stopPropagation()}>
                                  <select value={application.status} onChange={(event) => onStatusChange(application.id, event.target.value as ApplicationStatus)} aria-label={`${application.role}岗位状态`}>
                                    {ALL_STATUSES.map((status) => <option value={status} key={status}>{STATUS_META[status].label}</option>)}
                                  </select>
                                  <ChevronDown size={13} />
                                </div>
                                <span>{application.url ? <a href={application.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>打开职位 <ArrowRight size={13} /></a> : '—'}</span>
                                <button className="icon-button subtle" onClick={(event) => { event.stopPropagation(); onEdit(application) }} title="编辑岗位"><Pencil size={15} /></button>
                              </div>
                              {expandedPosition && (
                                <div className="position-notes-panel" onClick={(event) => event.stopPropagation()}>
                                  <label>
                                    <AutoGrowTextarea
                                      value={notes}
                                      onChange={(value) => onNotesChange(application.id, value)}
                                      placeholder="记录关注理由、JD 要点、匹配度、跟进计划……"
                                      rows={3}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="company-position-empty">{statusFilter === 'all' ? '这家公司还没有岗位记录' : '没有该状态的岗位'}</div>
                    )}
                    <div className="company-add-position">
                      <button onClick={() => onNewApplication(company.name)}><Plus size={16} /> 添加岗位</button>
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

const COMPANY_COLORS = [
  '#75638c',
  '#986f59',
  '#4f8072',
  '#5d7b8a',
  '#956f7d',
  '#75836b',
  '#647381',
  '#866f8e',
  '#8b6670',
  '#6f8477',
  '#955e64',
  '#b07855',
  '#a08b58',
]

function companyColor(name: string) {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return COMPANY_COLORS[hash % COMPANY_COLORS.length]
}

function InterviewsPage({
  interviews,
  onEdit,
  onNew,
  onNewFromProcess,
  onDelete,
  onUpdateRound,
  onAddRound,
  onDeleteRound,
  focusInterviewId,
}: {
  interviews: Interview[]
  onEdit: (interview: Interview) => void
  onNew: () => void
  onNewFromProcess: () => void
  onDelete: (id: string) => void
  onUpdateRound: (interviewId: string, roundId: string, patch: Partial<InterviewRound>) => void
  onAddRound: (interviewId: string) => void
  onDeleteRound: (interviewId: string, roundId: string) => void
  focusInterviewId: string | null
}) {
  const [expandedRecords, setExpandedRecords] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<InterviewCategory[]>(['class27', 'past'])

  const filteredInterviews = interviews.filter((interview) => selectedCategories.includes(interview.category))

  useEffect(() => {
    if (!focusInterviewId) return
    const target = interviews.find((interview) => interview.id === focusInterviewId)
    if (!target) return
    if (!selectedCategories.includes(target.category)) {
      setSelectedCategories((current) => [...current, target.category])
    }
    setExpandedRecords((current) => current.includes(target.id) ? current : [...current, target.id])
  }, [focusInterviewId, interviews, selectedCategories])

  function toggleCategory(category: InterviewCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    )
  }

  function toggleRecord(id: string) {
    setExpandedRecords((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  if (!interviews.length) {
    return (
      <div className="interviews-page">
        <InterviewPageToolbar selectedCategories={selectedCategories} onToggleCategory={toggleCategory} onNewFromProcess={onNewFromProcess} onNew={onNew} />
        <div className="full-empty interview-empty">
          <div><MessageSquareText size={28} /></div>
          <h2>还没有面试记录</h2>
          <p>使用上方右侧的“新增面试记录”建立第一个岗位，之后可以在记录中继续追加每一轮面试。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="interviews-page">
      <InterviewPageToolbar selectedCategories={selectedCategories} onToggleCategory={toggleCategory} onNewFromProcess={onNewFromProcess} onNew={onNew} />
      {!filteredInterviews.length ? (
        <div className="full-empty interview-empty">
          <div><MessageSquareText size={28} /></div>
          <h2>没有符合筛选的面试</h2>
          <p>勾选上方分类，查看对应的面试记录。</p>
        </div>
      ) : (
      <div className="interview-record-list">
        {filteredInterviews.map((interview) => {
          const expanded = expandedRecords.includes(interview.id)
          return (
          <article className={`interview-record ${expanded ? 'expanded' : ''}`} key={interview.id}>
            <header className="interview-record-header" onClick={() => toggleRecord(interview.id)}>
              <span className={`interview-record-chevron ${expanded ? 'expanded' : ''}`}><ChevronDown size={18} /></span>
              <div className="company-title">
                <div>
                  <h3 style={{ color: companyColor(interview.company) }}>{interview.company}</h3>
                  <p>{interview.role}{interview.project ? ` · ${interview.project}` : ''}</p>
                </div>
              </div>
              <div className="interview-record-actions">
                <span>共 {interview.rounds.length} 轮</span>
                <button className="icon-button subtle" onClick={(event) => { event.stopPropagation(); onEdit(interview) }} title="编辑基本信息"><Pencil size={16} /></button>
                <button className="icon-button subtle danger-text" onClick={(event) => { event.stopPropagation(); onDelete(interview.id) }} title="删除岗位记录"><Trash2 size={16} /></button>
              </div>
            </header>

            {expanded && <>
            <div className="round-list">
              {interview.rounds.map((round, index) => (
                <section className="round-entry" key={round.id}>
                  <div className="round-rail">
                    <span>{index + 1}</span>
                    {index < interview.rounds.length - 1 && <i />}
                  </div>
                  <div className="round-content">
                    <div className="round-toolbar">
                      <strong>第 {index + 1} 轮面试</strong>
                      <div className="round-fields">
                        <input
                          type="date"
                          value={round.date}
                          aria-label={`第 ${index + 1} 轮面试日期`}
                          onChange={(event) =>
                            onUpdateRound(interview.id, round.id, { date: event.target.value })
                          }
                        />
                        <div className="select-field round-result-select">
                          <select
                            value={round.result}
                            aria-label={`第 ${index + 1} 轮面试结果`}
                            onChange={(event) =>
                              onUpdateRound(interview.id, round.id, {
                                result: event.target.value as InterviewResult,
                              })
                            }
                          >
                            {(Object.keys(RESULT_META) as InterviewResult[]).map((result) => (
                              <option value={result} key={result}>{RESULT_META[result]}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} />
                        </div>
                        {interview.rounds.length > 1 && (
                          <button
                            className="round-delete"
                            onClick={() => onDeleteRound(interview.id, round.id)}
                            title="删除本轮"
                          ><Trash2 size={15} /></button>
                        )}
                      </div>
                    </div>
                    <AutoGrowTextarea
                      value={round.content}
                      onChange={(value) =>
                        onUpdateRound(interview.id, round.id, { content: value })
                      }
                      rows={6}
                      placeholder="自由记录这一轮的面试问题、回答思路、面试官反馈、感受或复盘……"
                    />
                  </div>
                </section>
              ))}
            </div>

            <footer className="interview-record-footer">
              <button className="add-round-button" onClick={() => onAddRound(interview.id)}>
                <Plus size={17} />
              </button>
            </footer>
            </>}
          </article>
          )
        })}
      </div>
      )}
    </div>
  )
}

function InterviewPageToolbar({
  selectedCategories,
  onToggleCategory,
  onNewFromProcess,
  onNew,
}: {
  selectedCategories: InterviewCategory[]
  onToggleCategory: (category: InterviewCategory) => void
  onNewFromProcess: () => void
  onNew: () => void
}) {
  return (
    <div className="page-actionbar">
      <div className="interview-toolbar-left">
      <button className="button secondary process-interview-button" onClick={onNewFromProcess}><Plus size={17} /> 基于进程新增</button>
      <div className="interview-category-filters" aria-label="面试分类筛选">
        {([['class27', '27届'], ['past', '过往面试']] as Array<[InterviewCategory, string]>).map(([category, label]) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(category)}
              onChange={() => onToggleCategory(category)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      </div>
      <button className="button primary" onClick={onNew}><Plus size={17} /> 新增面试记录</button>
    </div>
  )
}

function SchedulePage({
  events,
  month,
  onMonthChange,
  onNew,
  onNewAtDate,
  onNewPeriod,
  onEdit,
}: {
  events: ScheduleEvent[]
  month: Date
  onMonthChange: (month: Date) => void
  onNew: () => void
  onNewAtDate: (date: string) => void
  onNewPeriod: () => void
  onEdit: (event: ScheduleEvent) => void
}) {
  const [scrolledDays, setScrolledDays] = useState<Record<string, boolean>>({})
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.schedule-day-events.has-many-interviews').forEach((element) => {
      element.scrollTop = 0
    })
    setScrolledDays({})
  }, [events, month])
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1)
  const gridStart = new Date(year, monthIndex, 1 - ((firstDay.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index))
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(month)
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  const keyOf = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const todayKey = keyOf(new Date())
  const eventsFor = (date: Date) => {
    const key = keyOf(date)
    return events.filter((event) => {
      const start = event.type === 'period' ? event.startDate : event.date
      const end = event.type === 'period' ? event.endDate : event.date
      return key >= start && key <= end
    }).sort((a, b) => {
      const aTime = a.type === 'interview' && a.startTime ? a.startTime : '99:99'
      const bTime = b.type === 'interview' && b.startTime ? b.startTime : '99:99'
      return aTime.localeCompare(bTime)
    })
  }
  const allPeriodEvents = events.filter((event) => event.type === 'period')
  const periodColorIndexes = new Map(allPeriodEvents.map((event) => [event.id, scheduleColorIndex(event.id)]))
  const periodEndpointDates = [...new Set(allPeriodEvents.flatMap((event) => [event.startDate, event.endDate]))].sort()
  periodEndpointDates.forEach((dateKey) => {
    const endingPeriods = allPeriodEvents.filter((event) => event.endDate === dateKey && event.startDate !== dateKey)
    const startingPeriods = allPeriodEvents.filter((event) => event.startDate === dateKey && event.endDate !== dateKey)
    if (!endingPeriods.length || !startingPeriods.length) return

    const usedColors = new Set(endingPeriods.map((event) => periodColorIndexes.get(event.id) ?? scheduleColorIndex(event.id)))
    const usedColorFamilies = new Set([...usedColors].map((colorIndex) => SCHEDULE_COLOR_FAMILIES[colorIndex]))
    startingPeriods.forEach((event) => {
      const baseColorIndex = periodColorIndexes.get(event.id) ?? scheduleColorIndex(event.id)
      const colorCandidates = Array.from({ length: 8 }, (_, offset) => (baseColorIndex + offset) % 8)
      const colorIndex = colorCandidates.find((candidate) => (
        !usedColors.has(candidate)
        && !usedColorFamilies.has(SCHEDULE_COLOR_FAMILIES[candidate])
      )) ?? colorCandidates.find((candidate) => !usedColors.has(candidate)) ?? baseColorIndex
      periodColorIndexes.set(event.id, colorIndex)
      usedColors.add(colorIndex)
      usedColorFamilies.add(SCHEDULE_COLOR_FAMILIES[colorIndex])
    })
  })

  return (
    <div className="schedule-page">
      <section className="schedule-calendar">
        <header className="schedule-calendar-header">
          <div className="schedule-month-nav">
            <button className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))} aria-label="上个月"><ChevronLeft size={18} /></button>
            <h2>{monthLabel}</h2>
            <button className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))} aria-label="下个月"><ChevronRight size={18} /></button>
          </div>
          <div className="schedule-header-actions">
            <button className="text-button" onClick={() => onMonthChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>回到今天</button>
            <button className="button secondary" onClick={onNewPeriod}><Plus size={16} /> 添加时间段</button>
            <button className="button primary" onClick={onNew}><Plus size={16} /> 添加面试</button>
          </div>
        </header>
        <div className="schedule-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="schedule-grid">
          {days.map((date) => {
            const dateKey = keyOf(date)
            const dayEvents = eventsFor(date)
            const periodEvents = dayEvents.filter((event) => event.type === 'period')
            const interviewEvents = dayEvents.filter((event) => event.type === 'interview')
            const endingPeriods = periodEvents.filter((event) => event.endDate === dateKey && event.startDate !== dateKey)
            const startingPeriods = periodEvents.filter((event) => event.startDate === dateKey && event.endDate !== dateKey)
            const hasSplitPeriodEndpoints = endingPeriods.length > 0 && startingPeriods.length > 0
            const interviewCount = interviewEvents.length
            const hasManyInterviews = interviewCount > 2
            const isDayScrolled = scrolledDays[dateKey] === true
            const isCurrentMonth = date.getMonth() === monthIndex
            return (
              <div className={`schedule-day ${isCurrentMonth ? '' : 'outside-month'} ${dateKey === todayKey ? 'today' : ''} ${periodEvents.length ? 'has-period' : ''} ${hasSplitPeriodEndpoints ? 'split-period-endpoints' : ''}`} key={dateKey}>
                <button className="schedule-day-number" onClick={() => onNewAtDate(dateKey)}>{date.getDate()}</button>
                {periodEvents.map((event, periodIndex) => {
                  const isConnector = dateKey !== event.startDate && dateKey !== event.endDate
                  const connectorIndex = periodEvents.slice(0, periodIndex).filter((item) => dateKey !== item.startDate && dateKey !== item.endDate).length
                  return isConnector ? (
                    <button className={`schedule-period-connector schedule-color-${periodColorIndexes.get(event.id) ?? scheduleColorIndex(event.id)}`} style={{ top: `${22 + connectorIndex * 8}px` }} key={event.id} onClick={() => onEdit(event)} title={event.title} aria-label={event.title} />
                  ) : (
                    <button className={`schedule-event period schedule-color-${periodColorIndexes.get(event.id) ?? scheduleColorIndex(event.id)} ${dateKey === event.startDate ? 'period-start' : ''} ${dateKey === event.endDate ? 'period-end' : ''}`} key={event.id} onClick={() => onEdit(event)} title={event.title}>
                      <span className="schedule-period-marker">{dateKey === event.startDate ? '开始' : '结束'}</span>{event.title}
                    </button>
                  )
                })}
                <div className={`schedule-day-events ${hasManyInterviews ? 'has-many-interviews' : ''} ${isDayScrolled ? 'is-scrolled' : ''}`} onScroll={(event) => {
                  const nextScrolled = event.currentTarget.scrollTop > 2
                  if (nextScrolled !== isDayScrolled) setScrolledDays((current) => ({ ...current, [dateKey]: nextScrolled }))
                }} onWheel={(event) => {
                  if (!hasManyInterviews) return
                  event.currentTarget.scrollBy({ top: event.deltaY > 0 ? 35 : -35 })
                }}>
                  {interviewEvents.map((event, interviewIndex) => {
                    const isOverflowAnchor = hasManyInterviews && interviewIndex === 1
                    const overflowCount = interviewCount - 2
                    const eventButton = <button className={`schedule-event interview schedule-color-${scheduleColorIndex(event.id)}`} key={event.id} onClick={() => onEdit(event)} title={event.title}>
                      {event.startTime ? <span>{event.startTime}</span> : null}{event.title}
                    </button>
                    return isOverflowAnchor ? <div className="schedule-event-overflow-row" key={`overflow-${event.id}`}>{eventButton}{!isDayScrolled && <span className="schedule-event-overflow">+{overflowCount}</span>}</div> : eventButton
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function DataPage({
  data,
  onExport,
  onImport,
  onClear,
}: {
  data: WorkspaceData
  onExport: () => void
  onImport: (file: File | undefined) => void
  onClear: () => void
}) {
  return (
    <div className="data-page">
      <section className="data-hero">
        <div className="data-hero-icon"><LockKeyhole size={28} /></div>
        <div>
          <span>你的数据属于你</span>
          <h2>所有记录仅保存在当前浏览器中。</h2>
          <p>应用不会上传任何信息。更换浏览器、清理浏览器数据或重装系统前，请先导出备份。</p>
        </div>
      </section>

      <div className="data-grid">
        <section className="data-card featured">
          <div className="data-card-icon"><Download size={22} /></div>
          <div><span>推荐定期操作</span><h3>导出完整备份</h3><p>将 {data.companies.length} 家公司、{data.applications.length} 条投递和 {data.interviews.length} 条面试记录保存为 JSON 文件。</p></div>
          <button className="button primary" onClick={onExport}><Download size={17} /> 导出备份</button>
        </section>
        <section className="data-card">
          <div className="data-card-icon"><Upload size={22} /></div>
          <div><span>恢复或迁移</span><h3>导入已有备份</h3><p>导入会替换当前浏览器中的全部数据，建议先导出现有记录。</p></div>
          <label className="button secondary file-button"><Upload size={17} /> 选择文件<input type="file" accept="application/json,.json" onChange={(event) => onImport(event.target.files?.[0])} /></label>
        </section>
      </div>

      <section className="storage-summary">
        <div className="summary-title"><Database size={20} /><div><h3>当前数据概况</h3><p>本地文件 workspace-data.json + 浏览器缓存</p></div></div>
        <div className="summary-numbers">
          <div><strong>{data.companies.length}</strong><span>公司</span></div>
          <div><strong>{data.applications.length}</strong><span>岗位</span></div>
          <div><strong>{data.interviews.length}</strong><span>面试记录</span></div>
          <div><strong>{Math.ceil(new Blob([JSON.stringify(data)]).size / 1024)}</strong><span>占用 KB</span></div>
        </div>
      </section>

      <section className="danger-zone">
        <div><Archive size={20} /><div><h3>清空本地数据</h3><p>删除全部记录，操作后无法恢复。</p></div></div>
        <button className="button danger" onClick={onClear}><Trash2 size={16} /> 清空全部</button>
      </section>
    </div>
  )
}

function FullEmpty({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Home
  title: string
  description: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="full-empty">
      <div><Icon size={28} /></div><h2>{title}</h2><p>{description}</p>
      <button className="button primary" onClick={onAction}><Plus size={17} /> {action}</button>
    </div>
  )
}

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  footer,
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <div><span>{eyebrow}</span><h2>{title}</h2></div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
        <footer className="modal-footer">{footer}</footer>
      </section>
    </div>
  )
}

function CompanyModal({
  value,
  setValue,
  editing,
  onSave,
  onDelete,
  onArchive,
  archived,
  onClose,
}: {
  value: string
  setValue: (value: string | null) => void
  editing: boolean
  onSave: () => void
  onDelete?: () => void
  onArchive?: () => void
  archived?: boolean
  onClose: () => void
}) {
  return (
    <ModalShell
      title={editing ? '编辑公司' : '新增公司'}
      eyebrow={editing ? 'EDIT COMPANY' : 'NEW COMPANY'}
      onClose={onClose}
      footer={
        <>
          {onArchive && <button className="text-button archive-text" onClick={onArchive}><Archive size={16} /> {archived ? '取消归档' : '归档公司'}</button>}
          <div>{onDelete && <button className="text-button danger-text" onClick={onDelete}><Trash2 size={16} /> 删除公司</button>}</div>
          <div className="footer-right"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={onSave}>{editing ? '保存修改' : '创建公司'}</button></div>
        </>
      }
    >
      <div className="form-grid single-field-form">
        <Field label="公司名称" required wide><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} placeholder="例如：腾讯游戏、字节跳动" /></Field>
      </div>
    </ModalShell>
  )
}

function ApplicationModal({
  draft,
  setDraft,
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  draft: ApplicationDraft
  setDraft: (draft: ApplicationDraft | null) => void
  editing: boolean
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  const update = <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) =>
    setDraft({ ...draft, [key]: value })
  return (
    <ModalShell
      title={editing ? '编辑岗位' : `添加岗位 · ${draft.company}`}
      eyebrow={editing ? 'EDIT POSITION' : 'NEW POSITION'}
      onClose={onClose}
      footer={
        <>
          <div className="footer-left">
            {onDelete && <button className="text-button danger-text" onClick={onDelete}><Trash2 size={16} /> 删除</button>}
          </div>
          <div className="footer-right"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={onSave}>保存岗位</button></div>
        </>
      }
    >
      <div className="form-grid">
        <Field label="岗位" required><input autoFocus value={draft.role} onChange={(e) => update('role', e.target.value)} placeholder="例如：游戏策划、AI 产品经理" /></Field>
        <Field label="地点"><input value={draft.location} onChange={(e) => update('location', e.target.value)} placeholder="例如：深圳、上海" /></Field>
        <Field label="当前状态"><div className="select-field"><select value={draft.status} onChange={(e) => update('status', e.target.value as ApplicationStatus)}>{ALL_STATUSES.map((status) => <option value={status} key={status}>{STATUS_META[status].label}</option>)}</select><ChevronDown size={15} /></div></Field>
        <Field label="项目"><input value={draft.project} onChange={(e) => update('project', e.target.value)} placeholder="选填，例如：王者荣耀、AI 平台" /></Field>
        <Field label="薪资范围"><input value={draft.salary} onChange={(e) => update('salary', e.target.value)} placeholder="选填" /></Field>
        <Field label="职位链接" wide><input type="url" value={draft.url} onChange={(e) => update('url', e.target.value)} placeholder="https://…" /></Field>
        <Field label="岗位备注" wide><textarea value={draft.notes ?? ''} onChange={(e) => update('notes', e.target.value)} placeholder="记录关注理由、JD 要点、匹配度、跟进计划……" rows={5} /></Field>
      </div>
    </ModalShell>
  )
}

function ProcessInterviewModal({
  draft,
  applications,
  setDraft,
  onSave,
  onClose,
}: {
  draft: ProcessInterviewDraft
  applications: Application[]
  setDraft: (draft: ProcessInterviewDraft | null) => void
  onSave: () => void
  onClose: () => void
}) {
  const companies = [...new Set(applications.map((application) => application.company))]
  const companyApplications = applications.filter((application) => application.company === draft.company)

  return (
    <ModalShell
      title="基于校招进程新增"
      eyebrow="FROM APPLICATIONS"
      onClose={onClose}
      footer={<div className="footer-right"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={onSave} disabled={!draft.applicationId}>创建面试记录</button></div>}
    >
      <div className="form-grid single-field-form">
        <Field label="公司" required>
          <div className="select-field">
            <select
              value={draft.company}
              onChange={(event) => {
                const company = event.target.value
                const first = applications.find((application) => application.company === company)
                setDraft({ company, applicationId: first?.id ?? '' })
              }}
            >
              {companies.map((company) => <option value={company} key={company}>{company}</option>)}
            </select>
            <ChevronDown size={15} />
          </div>
        </Field>
        <Field label="岗位" required>
          <div className="select-field">
            <select
              value={draft.applicationId}
              onChange={(event) => setDraft({ ...draft, applicationId: event.target.value })}
            >
              {companyApplications.map((application) => <option value={application.id} key={application.id}>{application.role}</option>)}
            </select>
            <ChevronDown size={15} />
          </div>
        </Field>
      </div>
    </ModalShell>
  )
}

function InterviewModal({
  draft,
  setDraft,
  editing,
  onSave,
  onClose,
}: {
  draft: InterviewDraft
  setDraft: (draft: InterviewDraft | null) => void
  editing: boolean
  onSave: () => void
  onClose: () => void
}) {
  const update = <K extends keyof InterviewDraft>(key: K, value: InterviewDraft[K]) =>
    setDraft({ ...draft, [key]: value })
  return (
    <ModalShell
      title={editing ? '编辑面试岗位' : '新增面试记录'}
      eyebrow={editing ? 'EDIT INTERVIEW' : 'NEW INTERVIEW'}
      onClose={onClose}
      footer={
        <>
          <div />
          <div className="footer-right"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={onSave}>{editing ? '保存修改' : '创建记录'}</button></div>
        </>
      }
    >
      <div className="form-grid interview-create-form">
        <Field label="公司名称" required><input autoFocus value={draft.company} onChange={(e) => update('company', e.target.value)} placeholder="例如：字节跳动" /></Field>
        <Field label="岗位名称" required><input value={draft.role} onChange={(e) => update('role', e.target.value)} placeholder="例如：前端开发工程师" /></Field>
        <Field label="面试分类"><div className="select-field"><select value={draft.category} onChange={(e) => update('category', e.target.value as InterviewCategory)}><option value="class27">27届</option><option value="past">过往面试</option></select><ChevronDown size={15} /></div></Field>
        <Field label="项目" wide><input value={draft.project} onChange={(e) => update('project', e.target.value)} placeholder="选填，例如：商业化产品、抖音电商" /></Field>
        <Field label="日期" required><input type="date" value={draft.date} onChange={(e) => update('date', e.target.value)} /></Field>
        <Field label="结果" required><div className="select-field"><select value={draft.result} onChange={(e) => update('result', e.target.value as InterviewResult)}>{(Object.keys(RESULT_META) as InterviewResult[]).map((result) => <option value={result} key={result}>{RESULT_META[result]}</option>)}</select><ChevronDown size={15} /></div></Field>
      </div>
    </ModalShell>
  )
}

function ScheduleModal({
  draft,
  setDraft,
  editing,
  onSave,
  onDelete,
  onClose,
}: {
  draft: ScheduleDraft
  setDraft: (draft: ScheduleDraft | null) => void
  editing: boolean
  onSave: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  const update = <K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) =>
    setDraft({ ...draft, [key]: value })
  function updateStartTime(value: string) {
    if (!value) {
      setDraft({ ...draft, startTime: '', endTime: '' })
      return
    }
    const [hours, minutes] = value.split(':').map(Number)
    const endMinutes = (hours * 60 + minutes + 60) % (24 * 60)
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    setDraft({ ...draft, startTime: value, endTime })
  }
  const isPeriod = draft.type === 'period'
  return (
    <ModalShell
      title={editing ? '编辑求职日程' : isPeriod ? '添加时间段' : '添加面试'}
      eyebrow={editing ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}
      onClose={onClose}
      footer={
        <>
          <div>{onDelete && <button className="text-button danger-text" onClick={onDelete}><Trash2 size={16} /> 删除日程</button>}</div>
          <div className="footer-right"><button className="button secondary" onClick={onClose}>取消</button><button className="button primary" onClick={onSave}>保存日程</button></div>
        </>
      }
    >
      <div className="form-grid schedule-form">
        <Field label="类型" required>
          <div className="select-field"><select value={draft.type} onChange={(event) => update('type', event.target.value as ScheduleEventType)}><option value="interview">面试（具体时间）</option><option value="period">时间段（持续多天）</option></select><ChevronDown size={15} /></div>
        </Field>
        <Field label="标题" required><input autoFocus value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder={isPeriod ? '例如：笔试 / 测试任务' : '例如：米哈游一面'} /></Field>
        {isPeriod ? <>
          <Field label="开始日期" required><input type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} /></Field>
          <Field label="结束日期" required><input type="date" value={draft.endDate} onChange={(event) => update('endDate', event.target.value)} /></Field>
        </> : <>
          <Field label="日期" required><input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} /></Field>
          <Field label="时间"><div className="schedule-time-fields"><input type="time" value={draft.startTime} onChange={(event) => updateStartTime(event.target.value)} /><span>至</span><input type="time" value={draft.endTime} onChange={(event) => update('endTime', event.target.value)} /></div></Field>
        </>}
        <Field label="备注" wide><textarea rows={4} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="记录准备事项、链接或提醒……" /></Field>
      </div>
    </ModalShell>
  )
}

function Field({
  label,
  required,
  wide,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`form-field ${wide ? 'wide' : ''}`}>
      <span>{label}{required && <em>*</em>}</span>
      {children}
    </label>
  )
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  rows = 1,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, rows * 24)}px`
  }, [value, rows])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export default App
