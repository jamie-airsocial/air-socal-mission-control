import { User } from 'lucide-react'

const teams = [
  {
    name: 'Team Synergy',
    color: 'bg-blue-500/10 border-blue-500/20',
    accentColor: 'text-blue-400',
    clients: 4,
    activeTasks: 12,
    completedTasks: 38,
    members: [
      { name: 'Sarah Martinez', role: 'Team Lead', avatar: 'SM' },
      { name: 'David Kim', role: 'Content Strategist', avatar: 'DK' },
      { name: 'Alex Chen', role: 'Social Media Manager', avatar: 'AC' },
    ],
  },
  {
    name: 'Team Ignite',
    color: 'bg-orange-500/10 border-orange-500/20',
    accentColor: 'text-orange-400',
    clients: 5,
    activeTasks: 10,
    completedTasks: 45,
    members: [
      { name: 'Mike Rodriguez', role: 'Team Lead', avatar: 'MR' },
      { name: 'Emma Lopez', role: 'Creative Director', avatar: 'EL' },
      { name: 'James Wilson', role: 'Video Producer', avatar: 'JW' },
    ],
  },
  {
    name: 'Team Alliance',
    color: 'bg-purple-500/10 border-purple-500/20',
    accentColor: 'text-purple-400',
    clients: 3,
    activeTasks: 6,
    completedTasks: 29,
    members: [
      { name: 'Lisa Parker', role: 'Team Lead', avatar: 'LP' },
      { name: 'Tom Anderson', role: 'Analytics Specialist', avatar: 'TA' },
      { name: 'Nina Patel', role: 'Community Manager', avatar: 'NP' },
    ],
  },
]

export default function TeamsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Manage your team structure and members</p>
      </div>

      <div className="space-y-8">
        {teams.map((team, teamIndex) => (
          <div
            key={teamIndex}
            className={`rounded-lg border ${team.color} p-6`}
          >
            <div className="mb-6">
              <h2 className={`text-xl font-semibold ${team.accentColor} mb-4`}>{team.name}</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-border/20 bg-card/50 p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Clients</p>
                  <p className="text-2xl font-semibold text-foreground">{team.clients}</p>
                </div>
                <div className="rounded-lg border border-border/20 bg-card/50 p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Active Tasks</p>
                  <p className="text-2xl font-semibold text-foreground">{team.activeTasks}</p>
                </div>
                <div className="rounded-lg border border-border/20 bg-card/50 p-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Completed</p>
                  <p className="text-2xl font-semibold text-foreground">{team.completedTasks}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[13px] font-semibold text-foreground mb-4">Team Members</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {team.members.map((member, memberIndex) => (
                  <div
                    key={memberIndex}
                    className="rounded-lg border border-border/20 bg-card p-4 hover:bg-muted/40 transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${team.color}`}>
                        <span className={`text-sm font-semibold ${team.accentColor}`}>{member.avatar}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[13px] font-medium text-foreground">{member.name}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{member.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
