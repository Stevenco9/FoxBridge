import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './PrimaryButton.css'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export default function PrimaryButton({
  children,
  variant = 'primary',
  className = '',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      className={`primary-button primary-button--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
