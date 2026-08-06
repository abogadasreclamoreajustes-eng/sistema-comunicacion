import { supabase } from './supabase'

function newId() {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()
}

// Parses either "d/m/yyyy H:mm:ss" (legacy) or ISO strings. Returns a Date or null.
export function parseFlexibleDate(s) {
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T]?(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/)
  if (m) {
    const [, dd, mm, yyyy, HH = '0', MM = '0', SS = '0'] = m
    return new Date(+yyyy, +mm - 1, +dd, +HH, +MM, +SS)
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

export function fmtFecha(s) {
  const d = parseFlexibleDate(s)
  if (!d) return ''
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function fmtHora(s) {
  const d = parseFlexibleDate(s)
  if (!d) return ''
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

// ─── Auth ────────────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.rpc('login_usuario', {
    p_email: email.toLowerCase().trim(),
    p_password: password
  })
  if (error) return { ok: false, error: error.message }
  if (!data || !data.ok) return { ok: false, error: (data && data.error) || 'No se pudo iniciar sesión.' }
  return data
}

// ─── Usuarios ────────────────────────────────────────────
export async function getUsuarios() {
  const { data, error } = await supabase.from('usuarios_public').select('id,nombre,email,rol,color,activo').eq('activo', 'SI')
  if (error) throw error
  return data
}

// ─── Conversaciones ──────────────────────────────────────
export async function getConversaciones(userEmail, todas, usuarios) {
  const email = userEmail.toLowerCase().trim()
  let query = supabase.from('conversaciones').select('*')
  const { data, error } = await query
  if (error) throw error
  const userMap = {}
  usuarios.forEach(u => { userMap[u.email] = u })
  const solicitante = userMap[email]
  const puedeVerTodas = !!(solicitante && solicitante.rol === 'socia')
  const todasEfectivo = !!todas && puedeVerTodas

  const filtered = data.filter(row => {
    const p1 = (row.participante1 || '').toLowerCase().trim()
    const p2 = (row.participante2 || '').toLowerCase().trim()
    const esMia = p1 === email || p2 === email
    return todasEfectivo || esMia
  })

  const withMeta = filtered.map(row => {
    const p1 = (row.participante1 || '').toLowerCase().trim()
    const p2 = (row.participante2 || '').toLowerCase().trim()
    const esMia = p1 === email || p2 === email
    const otroEmail = esMia ? (p1 === email ? p2 : p1) : p1
    const otro = userMap[otroEmail] || {}
    return {
      ...row,
      otroEmail,
      otroNombre: otro.nombre || otroEmail,
      otroColor: otro.color || '#7B6BA0',
      esMia,
      fijadaBool: String(row.fijada || '').toUpperCase() === 'SI',
      ultimaActTs: (parseFlexibleDate(row.ultima_actividad) || parseFlexibleDate(row.fecha_creacion) || new Date(0)).getTime()
    }
  })

  withMeta.sort((a, b) => {
    if (a.fijadaBool !== b.fijadaBool) return a.fijadaBool ? -1 : 1
    return b.ultimaActTs - a.ultimaActTs
  })
  return withMeta
}

export async function crearConversacion(p1Email, p2Email, nombreConv, primerMensaje, autorEmail) {
  const id = newId()
  const now = new Date().toISOString()
  const { error } = await supabase.from('conversaciones').insert({
    id, participante1: p1Email.toLowerCase().trim(), participante2: p2Email.toLowerCase().trim(),
    fecha_creacion: now, ultima_actividad: now, nombre_conv: nombreConv || '', fijada: 'NO'
  })
  if (error) throw error
  if (primerMensaje && primerMensaje.trim()) {
    await enviarMensaje(id, autorEmail, primerMensaje.trim(), false)
  }
  return { ok: true, id }
}

export async function fijarConversacion(convId, fijar) {
  const { error } = await supabase.from('conversaciones').update({ fijada: fijar ? 'SI' : 'NO' }).eq('id', convId)
  if (error) throw error
}

export async function renombrarConversacion(convId, nombre) {
  const { error } = await supabase.from('conversaciones').update({ nombre_conv: nombre }).eq('id', convId)
  if (error) throw error
}

// ─── Mensajes ────────────────────────────────────────────
export async function getMensajes(convId) {
  const { data, error } = await supabase.from('mensajes_conv').select('*').eq('conv_id', convId)
  if (error) throw error
  data.sort((a, b) => (parseFlexibleDate(a.fecha) - parseFlexibleDate(b.fecha)))
  return data
}

export async function enviarMensaje(convId, autorEmail, texto, urgente, replyToId) {
  if (!texto || !texto.trim()) return { ok: false }
  const autor = autorEmail.toLowerCase().trim()
  const id = newId()
  const now = new Date().toISOString()
  const { error } = await supabase.from('mensajes_conv').insert({
    id, conv_id: convId, fecha: now, autor, texto: texto.trim(),
    urgente: urgente ? 'SI' : 'NO', leido_por: autor, reply_to_id: replyToId || null,
    leido_ts: JSON.stringify({ [autor]: Date.now() })
  })
  if (error) throw error
  await supabase.from('conversaciones').update({
    ultima_actividad: now, ultimo_mensaje: texto.trim().substring(0, 120), ultimo_autor: autor
  }).eq('id', convId)
  return { ok: true, id }
}

export async function eliminarMensaje(mensajeId) {
  const { error } = await supabase.from('mensajes_conv').update({ eliminado: 'SI' }).eq('id', mensajeId)
  if (error) throw error
}

export async function marcarMensajesLeidos(convId, userEmail) {
  const email = userEmail.toLowerCase().trim()
  const { data, error } = await supabase.from('mensajes_conv').select('id,leido_por,autor').eq('conv_id', convId)
  if (error) throw error
  const toUpdate = data.filter(m => {
    const autor = (m.autor || '').toLowerCase().trim()
    if (autor === email) return false
    const leidos = String(m.leido_por || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
    return !leidos.includes(email)
  })
  for (const m of toUpdate) {
    const leidos = String(m.leido_por || '').split(',').map(x => x.trim()).filter(Boolean)
    leidos.push(email)
    await supabase.from('mensajes_conv').update({ leido_por: leidos.join(',') }).eq('id', m.id)
  }
}

export function unreadCount(mensajes, userEmail) {
  const email = userEmail.toLowerCase().trim()
  return mensajes.filter(m => {
    const autor = (m.autor || '').toLowerCase().trim()
    if (autor === email) return false
    const leidos = String(m.leido_por || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
    return !leidos.includes(email)
  }).length
}

// ─── Tareas ──────────────────────────────────────────────
export async function getTareas(userEmail, modo, esSocia) {
  const email = userEmail.toLowerCase().trim()
  const { data, error } = await supabase.from('tareas').select('*')
  if (error) throw error
  let modoEfectivo = 'propias'
  if (esSocia && (modo === 'ajenas' || modo === 'asignadas')) modoEfectivo = modo

  const filtered = data.filter(t => {
    const asignadoA = (t.asignado_a || '').toLowerCase().trim()
    const asignadoPor = (t.asignado_por || '').toLowerCase().trim()
    if (modoEfectivo === 'propias') return asignadoA === email
    if (modoEfectivo === 'asignadas') return asignadoPor === email
    if (modoEfectivo === 'ajenas') return asignadoA !== email && asignadoPor !== email
    return true
  })

  const ahora = Date.now()
  const pesoEstado = { pendiente: 1, 'en progreso': 1, reprogramada: 1, completada: 2 }
  const pesoPrioridad = { Urgente: 0, Alta: 1, Normal: 2, Baja: 3 }
  const withMeta = filtered.map(t => {
    const vencTs = (parseFlexibleDate(t.fecha_vencimiento) || null)?.getTime() || 0
    const estado = t.estado || 'pendiente'
    return { ...t, vencTs, vencida: vencTs > 0 && vencTs < ahora && estado !== 'completada', estado }
  })
  withMeta.sort((a, b) => {
    if (a.vencida !== b.vencida) return a.vencida ? -1 : 1
    const ea = pesoEstado[a.estado] ?? 1, eb = pesoEstado[b.estado] ?? 1
    if (ea !== eb) return ea - eb
    const pa = pesoPrioridad[a.prioridad] ?? 2, pb = pesoPrioridad[b.prioridad] ?? 2
    if (pa !== pb) return pa - pb
    return (a.vencTs || 9e15) - (b.vencTs || 9e15)
  })
  return withMeta
}

export async function crearTarea({ titulo, descripcion, asignadoPor, asignadoA, fechaVenc, prioridad, notas, convId }) {
  const id = newId()
  const now = new Date().toISOString()
  const { error } = await supabase.from('tareas').insert({
    id, titulo, descripcion: descripcion || '', asignado_por: asignadoPor.toLowerCase().trim(),
    asignado_a: asignadoA.toLowerCase().trim(), fecha_creacion: now, fecha_vencimiento: fechaVenc || null,
    estado: 'pendiente', urgente: prioridad === 'Urgente' ? 'SI' : 'NO', notas: notas || '',
    conv_id: convId || null, prioridad: prioridad || 'Normal'
  })
  if (error) throw error
  return { ok: true, id }
}

export async function actualizarTarea(tareaId, campos) {
  const { error } = await supabase.from('tareas').update(campos).eq('id', tareaId)
  if (error) throw error
}

// ─── Tareas recurrentes ──────────────────────────────────
function fmtDDMMYYYY(d) {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}
function fmtISODate(d) {
  return d.toISOString().substring(0, 10)
}

// "YYYY-MM-DD" (de un <input type=date>) parseado en hora LOCAL, no UTC — new Date(str) con ese
// formato lo toma como UTC medianoche y en timezones negativos (Argentina) resta un día.
function parseLocalDateInput(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function calcularProximaFecha(tipoFrecuencia, frecuenciaConfig, desde) {
  const d = new Date(desde)
  d.setHours(0, 0, 0, 0)
  if (tipoFrecuencia === 'diaria') {
    d.setDate(d.getDate() + 1)
    return d
  }
  if (tipoFrecuencia === 'semanal') {
    const dias = (frecuenciaConfig?.diasSemana || []).slice().sort((a, b) => a - b)
    if (dias.length === 0) { d.setDate(d.getDate() + 7); return d }
    for (let i = 1; i <= 7; i++) {
      const cand = new Date(d)
      cand.setDate(cand.getDate() + i)
      if (dias.includes(cand.getDay())) return cand
    }
    d.setDate(d.getDate() + 7)
    return d
  }
  if (tipoFrecuencia === 'mensual') {
    const diaMes = frecuenciaConfig?.diaMes || d.getDate()
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    const ultimoDiaMes = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(diaMes, ultimoDiaMes))
    return next
  }
  d.setDate(d.getDate() + 1)
  return d
}

export async function getTareasRecurrentes(userEmail, modo, esSocia) {
  const email = userEmail.toLowerCase().trim()
  const { data, error } = await supabase.from('tareas_recurrentes').select('*')
  if (error) throw error
  let modoEfectivo = 'propias'
  if (esSocia && modo === 'ajenas') modoEfectivo = modo
  const filtered = data.filter(t => {
    const asignadoA = (t.asignado_a || '').toLowerCase().trim()
    const asignadoPor = (t.asignado_por || '').toLowerCase().trim()
    if (modoEfectivo === 'ajenas') return true
    return asignadoA === email || asignadoPor === email
  })
  return filtered.map(t => ({
    ...t,
    activaBool: String(t.activa || '').toUpperCase() === 'SI',
    frecuenciaConfigObj: (() => { try { return JSON.parse(t.frecuencia_config || '{}') } catch { return {} } })()
  })).sort((a, b) => (parseFlexibleDate(a.proxima_fecha)?.getTime() || 0) - (parseFlexibleDate(b.proxima_fecha)?.getTime() || 0))
}

export async function crearTareaRecurrente({ titulo, descripcion, asignadoPor, asignadoA, fechaInicio, fechaFin, tipoFrecuencia, frecuenciaConfig, horaSugerida, prioridad, recordatorioDias }) {
  const id = newId()
  const now = new Date().toISOString()
  const inicio = fechaInicio ? parseLocalDateInput(fechaInicio) : new Date()
  const { error } = await supabase.from('tareas_recurrentes').insert({
    id, titulo, descripcion: descripcion || '',
    asignado_por: asignadoPor.toLowerCase().trim(), asignado_a: asignadoA.toLowerCase().trim(),
    fecha_inicio: fmtDDMMYYYY(inicio) + ' 00:00:00', fecha_fin: fechaFin || null,
    tipo_frecuencia: tipoFrecuencia, frecuencia_config: JSON.stringify(frecuenciaConfig || {}),
    hora_sugerida: horaSugerida || null, prioridad: prioridad || 'Normal',
    recordatorio_dias: recordatorioDias ?? 0, checklist: '[]', activa: 'SI',
    proxima_fecha: fmtDDMMYYYY(inicio), ultima_generacion: null, fecha_creacion: now
  })
  if (error) throw error
  return { ok: true, id }
}

export async function actualizarTareaRecurrente(id, campos) {
  const { error } = await supabase.from('tareas_recurrentes').update(campos).eq('id', id)
  if (error) throw error
}

export async function eliminarTareaRecurrente(id) {
  const { error } = await supabase.from('tareas_recurrentes').delete().eq('id', id)
  if (error) throw error
}

// Revisa las plantillas activas vencidas y genera las tareas del día. Se llama al cargar la
// app (no hay cron/servidor propio); es seguro que corra desde varias sesiones a la vez porque
// chequea ultima_generacion antes de generar cada una.
export async function generarTareasRecurrentesPendientes() {
  const { data, error } = await supabase.from('tareas_recurrentes').select('*').eq('activa', 'SI')
  if (error) throw error
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const hoyISO = fmtISODate(hoy)
  for (const t of data) {
    if (t.ultima_generacion === hoyISO) continue
    const proxima = parseFlexibleDate(t.proxima_fecha)
    if (!proxima || proxima.getTime() > hoy.getTime()) continue
    if (t.fecha_fin && parseFlexibleDate(t.fecha_fin) && parseFlexibleDate(t.fecha_fin).getTime() < hoy.getTime()) {
      await actualizarTareaRecurrente(t.id, { activa: 'NO' })
      continue
    }

    // Varias pestañas/computadoras pueden correr esto a la vez: "reclamamos" la generación de
    // hoy con un UPDATE condicional (atómico en Postgres). Si otra sesión ya lo reclamó primero,
    // este UPDATE no afecta ninguna fila y no generamos la tarea duplicada.
    const { data: claimed, error: claimErr } = await supabase.from('tareas_recurrentes')
      .update({ ultima_generacion: hoyISO })
      .eq('id', t.id)
      .or(`ultima_generacion.is.null,ultima_generacion.neq.${hoyISO}`)
      .select('id')
    if (claimErr) throw claimErr
    if (!claimed || claimed.length === 0) continue

    await crearTarea({
      titulo: t.titulo, descripcion: t.descripcion, asignadoPor: t.asignado_por, asignadoA: t.asignado_a,
      fechaVenc: null, prioridad: t.prioridad,
      notas: `Generada automáticamente desde tarea recurrente "${t.titulo}".`
    })
    let config = {}
    try { config = JSON.parse(t.frecuencia_config || '{}') } catch {}
    const proximaNueva = calcularProximaFecha(t.tipo_frecuencia, config, proxima)
    await actualizarTareaRecurrente(t.id, { proxima_fecha: fmtDDMMYYYY(proximaNueva) })
  }
}
