export function PropertyRow({ 
  icon, 
  label, 
  children, 
  hoverable = true, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  children: React.ReactNode; 
  hoverable?: boolean; 
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 py-[6px] -mx-2 px-2 rounded-md ${hoverable ? 'hover:bg-muted/40 cursor-pointer' : ''} group transition-colors duration-150`}
    >
      <span className="text-muted-foreground/30 w-3.5 flex-shrink-0">{icon}</span>
      <span className="text-[11px] text-muted-foreground/60 w-[58px] flex-shrink-0">{label}</span>
      <div className="flex-1 text-foreground min-w-0">{children}</div>
    </div>
  );
}
