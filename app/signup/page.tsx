'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Creating account...')

    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Account created! Check your email to confirm your account. 📧')
  }

  return (
    <main style={{ maxWidth: '420px', margin: '80px auto', padding: '20px' }}>
      <h1>RetailPilot AI</h1>
      <h2>Create Account</h2>

      <form onSubmit={handleSignup}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
        />

        <button
          type="submit"
          style={{ width: '100%', padding: '12px' }}
        >
          Create Account
        </button>
      </form>

      {message && <p>{message}</p>}
    </main>
  )
}