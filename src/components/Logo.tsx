type LogoTone = "gradient" | "light" | "dark";
interface LogoProps { size?: number; tone?: LogoTone; wordmarkColor?: string; className?: string; }
export function LogoMark({ size = 44, className }: Omit<LogoProps, "wordmarkColor">) {
  return <svg width={size * 1.5} height={size} viewBox="0 0 72 40" fill="none" aria-hidden="true" className={className}><path d="M15 28C31 30 36 10 57 12" stroke="var(--color-accent-500)" strokeWidth="5" strokeLinecap="round"/><circle cx="10" cy="28" r="7" fill="var(--color-bg-page)" stroke="var(--color-accent-500)" strokeWidth="5"/><circle cx="62" cy="12" r="7" fill="var(--color-bg-page)" stroke="var(--color-accent-500)" strokeWidth="5"/></svg>;
}
export function Logo({ size = 32, wordmarkColor = "var(--color-text-on-dark)", className }: LogoProps) {
 return <span aria-label="Vamo" className={`inline-flex items-center gap-1 ${className ?? ""}`}><span style={{color:wordmarkColor,fontSize:size * 1.25,lineHeight:1,fontWeight:800,letterSpacing:"-0.055em"}}>vamo</span><LogoMark size={size}/></span>;
}
