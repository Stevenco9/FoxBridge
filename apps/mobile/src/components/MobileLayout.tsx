import type { ReactNode } from 'react'
import './MobileLayout.css'

interface MobileLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export default function MobileLayout({ title, subtitle, children, footer }: MobileLayoutProps) {
  return (
    <div className="mobile-layout">
      <header className="mobile-layout__header">
        <p className="mobile-layout__brand">FoxBridge</p>
        <h1 className="mobile-layout__title">{title}</h1>
        {subtitle && <p className="mobile-layout__subtitle">{subtitle}</p>}
      </header>

      <main className="mobile-layout__main">{children}</main>

      {footer && <footer className="mobile-layout__footer">{footer}</footer>}
    </div>
  )
}
