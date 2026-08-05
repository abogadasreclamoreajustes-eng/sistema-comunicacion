// Notificaciones de navegador: funcionan mientras el sitio está abierto (en esta pestaña
// o en background), no son push real — no hay servidor propio para eso (ver PROYECTO.md).
export function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') Notification.requestPermission()
}

export function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, tag })
    n.onclick = () => { window.focus(); n.close() }
  } catch {
    // Notification puede fallar en algunos navegadores/contextos; no es crítico.
  }
}
