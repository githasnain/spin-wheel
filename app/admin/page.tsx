import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import AdminPanel from './AdminPanel'

// Mark page as dynamic (uses server-side authentication)
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const authenticated = await isAuthenticated()

  if (!authenticated) {
    redirect('/admin/login')
  }

  return <AdminPanel />
}

