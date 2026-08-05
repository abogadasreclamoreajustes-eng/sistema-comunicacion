import { useEffect, useState, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { getUsuarios, getConversaciones, getMensajes, unreadCount } from './lib/api'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TasksView from './components/TasksView'
import NewConversationModal from './components/NewConversationModal'

const STORAGE_KEY = 'ba_comunicacion_user'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
  })
  const [usuarios, setUsuarios] = useState([])
  const [conversaciones, setConversaciones] = useState([])
  const [mensajesUnread, setMensajesUnread] = useState({})
  const [activeConvId, setActiveConvId] = useState(null)
  const [view, setView] = useState('chat')
  const [verTodas, setVerTodas] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const esSocia = user?.rol === 'socia'

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
  }, [user])

  const reload = useCallback(async () => {
    if (!user || usuarios.length === 0) return
    const convs = await getConversaciones(user.email, verTodas, usuarios)
    setConversaciones(convs)
    const unreadEntries = await Promise.all(convs.map(async c => {
      const msgs = await getMensajes(c.id)
      return [c.id, unreadCount(msgs, user.email)]
    }))
    setMensajesUnread(Object.fromEntries(unreadEntries))
  }, [user, usuarios, verTodas])

  useEffect(() => { reload() }, [reload, refreshTick])

  // Realtime: refresca la lista cuando cambia cualquier mensaje o conversación
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('realtime-comunicacion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_conv' }, () => setRefreshTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversaciones' }, () => setRefreshTick(t => t + 1))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => setRefreshTick(t => t + 1))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  if (!user) return <Login onLogin={handleLogin} />

  const activeConv = conversaciones.find(c => c.id === activeConvId) || null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        view={view} setView={setView}
        conversaciones={conversaciones} mensajesUnread={mensajesUnread}
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
