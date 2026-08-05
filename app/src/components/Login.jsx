import { useState } from 'react'
import { login } from '../lib/api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      if (!res.ok) {
        setError(res.error || 'No se pudo iniciar sesión.')
      } else {
        onLogin(res.user)
      }
    } catch (err) {
      setError('Error de conexión. Probá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, var(--violeta-profundo), var(--violeta-oscuro))'
    }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 380, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'var(--violeta-oscuro)', color: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20
          }}>BA</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Estudio Jurídico Alonso</h1>
          <p style={{ color: 'var(--gris-texto)', fontSize: 13, marginTop: 4 }}>Sistema de comunicación interna</p>
        </div>

        <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          placeholder="tu@email.com" style={{ marginBottom: 16 }} />

        <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Contraseña</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
          placeholder="••••••••" style={{ marginBottom: 20 }} />

        {error && (
          <div style={{ background: 'var(--rojo-urgente-bg)', color: 'var(--rojo-urgente)', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: 13 }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
