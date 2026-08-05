const SUPABASE_URL = 'https://rnhucntkpvmodjvvnvao.supabase.co'
const SUPABASE_KEY = 'sb_publishable_pzxvPm0mSpY-bDo-nXJ-UA_wgOOvPVr'

// Se usa el cliente global cargado por CDN en index.html (window.supabase),
// asi el bundle de la app no incluye la libreria completa de supabase-js.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: { params: { eventsPerSecond: 10 } }
})
