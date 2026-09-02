import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './lib/supabase'
import { getUsuarios, getConversaciones, getUnreadCounts, restaurarSesion, logout as logoutApi } from './lib/api'
import { requestNotificationPermission, notify } from './lib/notifications'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TasksView from './components/TasksView'
import RecurrentesView from './components/RecurrentesView'
import NewConversationModal from './components/NewConversationModal'

export default function App() {
  const [user, setUser] = useState(null)
  const [bootLoading, setBootLoading] = useState(true)
  const [usuarios, setUsuarios] = useState([])
  const [conversaciones, setConversaciones] = useState([])
  const [conversacionesEquipo, setConversacionesEquipo] = useState([])
  const [mensajesUnread, setMensajesUnread] = useState({})
  const [activeConvId, setActiveConvId] = useState(null)
  const [view, setView] = useState('chat')
  const [tabMensajes, setTabMensajes] = useState('propias')
  const [showNewConv, setShowNewConv] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  const esSocia = user?.rol === 'socia'
  const convosRef = useRef([])
  useEffect(() => { convosRef.current = conversaciones }, [conversaciones])

  // La sesión ya no se guarda a mano: la maneja Supabase Auth sola (persiste entre visitas).
  // Al abrir la app solo hay que preguntarle si hay una sesión vigente y traer el perfil.
  useEffect(() => {
    let activo = true
    restaurarSesion().then(u => { if (activo) { setUser(u); setBootLoading(false) } })
    return () => { activo = false }
  }, [])

  function handleLogin(u) {
    setUser(u)
  }
  function handleLogout() {
    logoutApi().then(() => setUser(null))
  }

  useEffect(() => {
    if (!user) return
    getUsuarios().then(setUsuarios).catch(() => {})
    requestNotificationPermission()
    // La generación de tareas recurrentes ahora corre sola por cron en el servidor
    // (app_generar_tareas_recurrentes, todos los días a las 09:00 UTC) — ya no depende de que
    // alguien tenga la app abierta, y evita que una sesión tenga que insertar tareas "a nombre"
    // de otra persona (rompía con los permisos reales de la base).
  }, [user])

  // Badge de no leídos en el título de la pestaña
  useEffect(() => {
    const total = Object.values(mensajesUnread).reduce((a, b) => a + b, 0)
    document.title = total > 0 ? `(${total}) Sistema de Comunicación` : 'Sistema de Comunicación — ABOGADAS'
  }, [mensajesUnread])

  const reload = useCallback(async () => {
    if (!user || usuarios.length === 0) return
    const convs = await getConversaciones(user.email, 'propias', usuarios)
    setConversaciones(convs)
    // Liviano a propósito: solo cuenta no leídos, no trae el texto de cada mensaje de cada
    // conversación en cada recarga (eso escalaba mal con el volumen del estudio con el tiempo).
    // Solo las conversaciones propias suman acá — las del equipo son solo para consultar, no
    // generan contador de no leídos ni notificaciones.
    const counts = await getUnreadCounts(convs.map(c => c.id), user.email)
    setMensajesUnread(counts)
  }, [user, usuarios])

  useEffect(() => { reload() }, [reload, refreshTick])

  // Las conversaciones del equipo (ajenas) se cargan aparte, solo cuando la pestaña está activa
  // — no se mezclan con las propias ni afectan no leídos/notificaciones.
  useEffect(() => {
    if (!user || !esSocia || tabMensajes !== 'equipo') return
    getConversaciones(user.email, 'equipo', usuarios).then(setConversacionesEquipo).catch(() => {})
  }, [user, esSocia, tabMensajes, usuarios, refreshTick])

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

  if (bootLoading) return null
  if (!user) return <Login onLogin={handleLogin} />

  const activeConv = conversaciones.find(c => c.id === activeConvId) || conversacionesEquipo.find(c => c.id === activeConvId) || null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        view={view} setView={setView}
        conversaciones={conversaciones} conversacionesEquipo={conversacionesEquipo} mensajesUnread={mensajesUnread}
        activeConvId={activeConvId} setActiveConvId={setActiveConvId}
        esSocia={esSocia} tabMensajes={tabMensajes} setTabMensajes={setTabMensajes}
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
