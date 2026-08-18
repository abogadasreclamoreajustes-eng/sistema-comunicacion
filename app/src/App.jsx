import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { getUsuarios, getConversaciones, getMensajes, unreadCount, generarTareasRecurrentesPendientes } from './lib/api'
import { requestNotificationPermission, notify } from './lib/notifications'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TasksView from './components/TasksView'
import RecurrentesView from './components/RecurrentesView'
import NewConversationModal from './components/NewConversationModal'

const STORAGE_KEY = 'ba_comunicacion_user'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })
  const [usuarios, setUsuarios] = useState([])
  const [conversaciones, setConversaciones] = useState([])
  const [mensajesUnread, setMensajesUnread] = useState({})
  const [mensajesPorConv, setMensajesPorConv] = useState({})
  const [activeConvId, setActiveConvId] = useState(null)
  const [view, setView] = useState('chat')
  const [verTodas, setVerTodas] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const esSocia = user?.rol === 'socia'
  const convosRef = useRef([])
  useEffect(() => { convosRef.current = conversaciones }, [conversaciones])

  function handleLogin(u) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    setUser(u)
  }
  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  useEffect(() => {
    if (!user) return
    getUsuarios().then(setUsuarios).catch(() => {})
    requestNotificationPermission()
    generarTareasRecurrentesPendientes().then(() => setRefreshTick(t => t + 1)).catch(() => {})
  }, [user])

  // Badge de no leídos en el título de la pestaña
  useEffect(() => {
    const total = Object.values(mensajesUnread).reduce((a, b) => a + b, 0)
    document.title = total > 0 ? `(${total}) Sistema de Comunicación` : 'Sistema de Comunicación — ABOGADAS'
  }, [mensajesUnread])

  const reload = useCallback(async () => {
    if (!user || usuarios.length === 0) return
    const convs = await getConversaciones(user.email, verTodas, usuarios)
    setConversaciones(convs)
    const entries = await Promise.all(convs.map(async c => {
      const msgs = await getMensajes(c.id)
      return [c.id, msgs]
    }))
    setMensajesPorConv(Object.fromEntries(entries))
    setMensajesUnread(Object.fromEntries(entries.map(([id, msgs]) => [id, unreadCount(msgs, user.email)])))
  }, [user, usuarios, verTodas])

  useEffect(() => { reload() }, [reload, refreshTick])

  // Realtime: refresca la lista cuando cambia cualquier mensaje o conversación
  useEffect(() => {
    if (!user) return
    const email = user.email.toLowerCase().trim()
    const channel = supabase.channel('realtime-comunicacion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_conv' }, (payload) => {
        setRefreshTick(t => t + 1)
        if (payload.eventType === 'INSERT') {
          const m = payload.new
          const autor = (m.autor || '').toLowerCase().trim()
          if (autor === email) return
          const conv = convosRef.current.find(c => c.id === m.conv_id)
          const urgente = String(m.urgente).toUpperCase() === 'SI'
          if (conv?.esMia && (urgente || document.hidden)) {
            notify(urgente ? '🚨 Mensaje urgente' : 'Nuevo mensaje', m.texto?.slice(0, 120) || '', m.conv_id)
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => setRefreshTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, (payload) => {
        setRefreshTick(t => t + 1)
        if (payload.eventType === 'INSERT') {
          const nt = payload.new
          const asignadoA = (nt.asignado_a || '').toLowerCase().trim()
          const asignadoPor = (nt.asignado_por || '').toLowerCase().trim()
          if (asignadoA === email && asignadoPor !== email) {
            notify('Nueva tarea asignada', nt.titulo || '', nt.id)
          }
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tarea_comentarios' }, async (payload) => {
        const c = payload.new
        const autor = (c.autor || '').toLowerCase().trim()
        if (autor === email) return
        const { data: t } = await supabase.from('tareas').select('asignado_a,asignado_por,titulo').eq('id', c.tarea_id).single()
        if (!t) return
        const asignadoA = (t.asignado_a || '').toLowerCase().trim()
        const asignadoPor = (t.asignado_por || '').toLowerCase().trim()
        if (email === asignadoA || email === asignadoPor) {
          notify(`Actualización en "${t.titulo || ''}"`, c.texto?.slice(0, 120) || '', c.tarea_id)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  if (!user) return <Login onLogin={handleLogin} />

  const activeConv = conversaciones.find(c => c.id === activeConvId) || null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        view={view} setView={setView}
        conversaciones={conversaciones} mensajesUnread={mensajesUnread} mensajesPorConv={mensajesPorConv}
        activeConvId={activeConvId} setActiveConvId={setActiveConvId}
        esSocia={esSocia} verTodas={verTodas} setVerTodas={setVerTodas}
        onNuevaConversacion={() => setShowNewConv(true)}
        user={user} onLogout={handleLogout}
      />
      {view === 'chat' && (
        <ChatView conv={activeConv} user={user} usuarios={usuarios} onChanged={() => setRefreshTick(t => t + 1)} />
      )}
      {view === 'tareas' && (
        <TasksView user={user} usuarios={usuarios} esSocia={esSocia} />
      )}
      {view === 'recurrentes' && (
        <RecurrentesView user={user} usuarios={usuarios} esSocia={esSocia} />
      )}
      {showNewConv && (
        <NewConversationModal
          user={user} usuarios={usuarios}
          onClose={() => setShowNewConv(false)}
          onCreated={(id) => { setShowNewConv(false); setActiveConvId(id); setRefreshTick(t => t + 1) }}
        />
      )}
    </div>
  )
}
