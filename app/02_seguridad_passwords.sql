-- Quita el acceso directo a la tabla usuarios (que incluye la contraseña)
-- y deja solo una vista segura sin ese campo para la app.
revoke select on usuarios from anon, authenticated;

create or replace view usuarios_public as
  select id, nombre, email, rol, color, activo, email_notif
  from usuarios;

grant select on usuarios_public to anon, authenticated;
