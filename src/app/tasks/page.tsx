import { Calendar, User } from 'lucide-react'

const columns = [
  { id: 'todo', title: 'To Do', color: 'border-slate-500/20' },
  { id: 'inprogress', title: 'In Progress', color: 'border-blue-500/20' },
  { id: 'review', title: 'Review', color: 'border-purple-500/20' },
  { id: 'done', title: 'Done', color: 'border-green-500/20' },
]

const tasks = [
  {
    column: 'todo',
    title: 'Q2 Content Strategy',
    client: 'TechFlow',
    assignee: 'Sarah M.',
    priority: 'High',
    dueDate: 'Feb 20',
  },
  {
    column: 'todo',
    title: 'LinkedIn Ad Campaign',
    client: 'UrbanFit',
    assignee: 'Emma L.',
    priority: 'High',
    dueDate: 'Feb 18',
  },
  {
    column: 'todo',
    title: 'TikTok Content Plan',
    client: 'TravelNow',
    assignee: 'Mike R.',
    priority: 'Medium',
    dueDate: 'Feb 22',
  },
  {
    column: 'todo',
    title: 'Brand Voice Guidelines',
    client: 'EcoHome',
    assignee: 'Lisa P.',
    priority: 'Low',
    dueDate: 'Feb 25',
  },
  {
    column: 'inprogress',
    title: 'Q1 Social Strategy',
    client: 'TechFlow',
    assignee: 'Sarah M.',
    priority: 'High',
    dueDate: 'Feb 17',
  },
  {
    column: 'inprogress',
    title: 'Brand Guidelines Update',
    client: 'Nexus Tech',
    assignee: 'David K.',
    priority: 'Medium',
    dueDate: 'Feb 19',
  },
  {
    column: 'inprogress',
    title: 'Pinterest Strategy',
    client: 'EcoHome',
    assignee: 'Emma L.',
    priority: 'Medium',
    dueDate: 'Feb 21',
  },
  {
    column: 'inprogress',
    title: 'Community Management',
    client: 'Nexus Tech',
    assignee: 'Mike R.',
    priority: 'Low',
    dueDate: 'Feb 23',
  },
  {
    column: 'review',
    title: 'Instagram Content Calendar',
    client: 'GreenLeaf',
    assignee: 'Mike R.',
    priority: 'High',
    dueDate: 'Feb 16',
  },
  {
    column: 'review',
    title: 'Facebook Ads Report',
    client: 'CloudSync',
    assignee: 'Lisa P.',
    priority: 'Medium',
    dueDate: 'Feb 17',
  },
  {
    column: 'review',
    title: 'Influencer Campaign',
    client: 'Wellness Co',
    assignee: 'Sarah M.',
    priority: 'High',
    dueDate: 'Feb 15',
  },
  {
    column: 'review',
    title: 'YouTube Strategy',
    client: 'TravelNow',
    assignee: 'David K.',
    priority: 'Medium',
    dueDate: 'Feb 18',
  },
  {
    column: 'done',
    title: 'Twitter Engagement Report',
    client: 'CloudSync',
    assignee: 'Lisa P.',
    priority: 'Medium',
    dueDate: 'Feb 14',
  },
  {
    column: 'done',
    title: 'Content Audit',
    client: 'FinanceHub',
    assignee: 'David K.',
    priority: 'Low',
    dueDate: 'Feb 13',
  },
  {
    column: 'done',
    title: 'Instagram Story Templates',
    client: 'GreenLeaf',
    assignee: 'Emma L.',
    priority: 'High',
    dueDate: 'Feb 12',
  },
  {
    column: 'done',
    title: 'LinkedIn Thought Leadership',
    client: 'FinanceHub',
    assignee: 'Sarah M.',
    priority: 'Medium',
    dueDate: 'Feb 11',
  },
]

export default function TasksPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Track and manage team tasks</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.column === column.id)
          return (
            <div key={column.id} className="flex flex-col">
              <div className={`mb-4 rounded-lg border ${column.color} bg-card px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-foreground">{column.title}</h2>
                  <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {columnTasks.map((task, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-border/20 bg-card p-4 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div className="mb-3">
                      <h3 className="text-[13px] font-medium text-foreground mb-1">{task.title}</h3>
                      <p className="text-[11px] text-muted-foreground">{task.client}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{task.assignee}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{task.dueDate}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/20">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          task.priority === 'High'
                            ? 'bg-red-500/10 text-red-400'
                            : task.priority === 'Medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
