import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, setUserInfo } from './api'

const defaultLocalUser: UserProfile = {
  uid: 'default_user',
  display_name: 'Local User',
  email: '',
};

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mode] = useState<'local'>('local')

  useEffect(() => {
    setUser(defaultLocalUser);
    setUserInfo(defaultLocalUser);
    setIsLoading(false);
  }, [])

  return { user, isLoading, mode }
}

export const useRedirectIfNotAuth = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Local-only mode: no redirect needed
  }, [user, isLoading, router])

  return user
}
