'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // In local-only mode, redirect directly to settings
    router.push('/settings')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Glass</h1>
        <p className="text-gray-600 mt-2">Redirecting...</p>
      </div>
    </div>
  )
}
