import { Building2 } from 'lucide-react'

const clients = [
  {
    name: 'TechFlow',
    team: 'Team Synergy',
    teamColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    services: ['Social Media', 'Content', 'Strategy'],
    retainer: '$5,000/mo',
  },
  {
    name: 'GreenLeaf',
    team: 'Team Ignite',
    teamColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    services: ['Instagram', 'Photography', 'Influencer'],
    retainer: '$3,500/mo',
  },
  {
    name: 'UrbanFit',
    team: 'Team Alliance',
    teamColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    services: ['LinkedIn', 'Ads', 'Analytics'],
    retainer: '$4,200/mo',
  },
  {
    name: 'Nexus Tech',
    team: 'Team Synergy',
    teamColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    services: ['Twitter', 'Community', 'Strategy'],
    retainer: '$6,000/mo',
  },
  {
    name: 'CloudSync',
    team: 'Team Ignite',
    teamColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    services: ['Facebook', 'Content', 'Video'],
    retainer: '$4,500/mo',
  },
  {
    name: 'Wellness Co',
    team: 'Team Alliance',
    teamColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    services: ['Instagram', 'TikTok', 'Influencer'],
    retainer: '$3,800/mo',
  },
  {
    name: 'FinanceHub',
    team: 'Team Synergy',
    teamColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    services: ['LinkedIn', 'Twitter', 'Thought Leadership'],
    retainer: '$5,500/mo',
  },
  {
    name: 'EcoHome',
    team: 'Team Ignite',
    teamColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    services: ['Pinterest', 'Instagram', 'Content'],
    retainer: '$3,200/mo',
  },
  {
    name: 'TravelNow',
    team: 'Team Alliance',
    teamColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    services: ['TikTok', 'YouTube', 'Influencer'],
    retainer: '$4,800/mo',
  },
]

export default function ClientsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Manage your client portfolio</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client, index) => (
          <div
            key={index}
            className="rounded-lg border border-border/20 bg-card p-6 hover:bg-muted/40 transition-colors duration-150"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Building2 className="h-6 w-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">{client.name}</h3>
                  <span className={`inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${client.teamColor}`}>
                    {client.team}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {client.services.map((service, idx) => (
                    <span
                      key={idx}
                      className="rounded-full bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Retainer</span>
                  <span className="text-[13px] font-semibold text-foreground">{client.retainer}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
