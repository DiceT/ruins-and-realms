import { ReactNode } from 'react'
import styles from './AppLayout.module.css'

interface AppLayoutProps {
  children: ReactNode
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className={styles.layout}>
      {/* Top Bar / Toolbar Placeholder */}
      {/* Header Removed by Request */}

      {/* Main Content Area */}
      <main className={styles.main}>{children}</main>
    </div>
  )
}
