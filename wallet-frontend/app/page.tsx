import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Root() {
  const cookieStore = await cookies()
  const token = cookieStore.get('wallet_token')?.value
  redirect(token ? '/dashboard' : '/login')
}
