import { Users, CheckCircle, UsersRound, TrendingUp } from 'lucide-react'

const stats = [
  { label: 'Total Clients', value: '12', icon: Users, color: 'text-blue-400' },
  { label: 'Active Tasks', value: '28', icon: CheckCircle, color: 'text-green-400' },
  { label: 'Team Members', value: '9', icon: UsersRound, color: 'text-purple-400' },
  { label: 'Completion Rate', value: '87%', icon: TrendingUp, color: 'text-indigo-400' },
]

const recentTasks = [
  { title: 'Q1 Social Strategy', client: 'TechFlow', assignee: 'Sarah M.', status: 'In Progress', priority: 'High' },
  { title: 'Instagram Content Calendar', client: 'GreenLeaf', assignee: 'Mike R.', status: 'Review', priority: 'Medium' },
  { title: 'LinkedIn Ad Campaign', client: 'UrbanFit', assignee: 'Emma L.', status: 'To Do', priority: 'High' },
  { title: 'Brand Guidelines Update', client: 'Nexus Tech', assignee: 'David K.', status: 'In Progress', priority: 'Low' },
  { title: 'Twitter Engagement Report', client: 'CloudSync', assignee: 'Lisa P.', status: 'Done', priority: 'Medium' },
]

const teams = [
  { name: 'Team Synergy', clients: 4, tasks: 12, members: 3, color: 'bg-blue-500/10 border-blue-500/20' },
  { name: 'Team Ignite', clients: 5, tasks: 10, members: 3, color: 'bg-orange-500/10 border-orange-500/20' },
  { name: 'Team Alliance', clients: 3, tasks: 6, members: 3, color: 'bg-purple-500/10 border-purple-500/20' },
]

export default function Dashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Welcome back to Air Social Mission Control</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-lg border border-border/20 bg-card p-6 hover:bg-muted/40 transition-colors duration-150"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-semibold text-foreground mt-2">{stat.value}</p>
                </div>
                <Icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Tasks */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-border/20 bg-card">
            <div className="border-b border-border/20 px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Recent Tasks</h2>
            </div>
            <div className="divide-y divide-border/20">
              {recentTasks.map((task, index) => (
                <div
                  key={index}
                  className="px-6 py-4 hover:bg-muted/40 transition-colors duration-150"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-[13px] font-medium text-foreground">{task.title}</h3>
                      <p className="text-[13px] text-muted-foreground mt-1">
                        {task.client} · {task.assignee}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          task.priority === 'High'
                            ? 'bg-red-500/10 text-red-400'
                            : task.priority === 'Medium'
                            ? 'bg-yellow-500/10 text-yellow-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          task.status === 'Done'
                            ? 'bg-green-500/10 text-green-400'
                            : task.status === 'In Progress'
                            ? 'bg-blue-500/10 text-blue-400'
                            : task.status === 'Review'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Overview */}
        <div>
          <div className="rounded-lg border border-border/20 bg-card">
            <div className="border-b border-border/20 px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">Team Overview</h2>
            </div>
            <div className="p-4 space-y-3">
              {teams.map((team, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-4 ${team.color} hover:bg-muted/40 transition-colors duration-150`}
                >
                  <h3 className="text-[13px] font-semibold text-foreground mb-3">{team.name}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Clients</span>
                      <span className="font-medium text-foreground">{team.clients}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Active Tasks</span>
                      <span className="font-medium text-foreground">{team.tasks}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium text-foreground">{team.members}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
