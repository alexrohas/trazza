# Checklist legal de lanzamiento

Este documento no sustituye a una revision de abogado/gestor. Sirve para dejar claro que falta antes de abrir Trazza al publico.

## Datos que debes completar

- Nombre legal o razon social del titular.
- NIF/CIF.
- Domicilio fiscal/profesional que quieras publicar.
- Email legal/privacidad, por ejemplo `legal@tudominio.com`.
- Email de soporte.
- Dominio definitivo.
- Forma fiscal: autonomo o sociedad.

## Antes de lanzar

- Revisar `legal.html` antes de abrir pagos o cambiar las condiciones de la beta gratuita.
- Ejecutar `supabase-waitlist.sql` para guardar consentimiento de waitlist.
- Ejecutar `supabase-rls.sql` para aislar firms, cuentas, movimientos y journal por usuario.
- Confirmar que Supabase Auth tiene confirmacion de email activa.
- Confirmar que el registro publico esta cerrado o controlado por invitacion.
- Revisar RLS de todas las tablas en Supabase.
- Revisar Storage si se guardan capturas.
- Tener proceso para exportar datos del usuario.
- Tener proceso para borrar cuenta y datos.
- Decidir si se usan analytics. Si se usan cookies no tecnicas, anadir banner de consentimiento.
- Revisar IVA/facturas con gestor antes de activar Stripe.
- Completar terminos de pago, cancelacion y reembolso antes de cobrar.

## Pendiente tecnico recomendado

- Pantalla o accion de "Eliminar mi cuenta".
- Registro de aceptacion de terminos si se abre signup publico.
- Customer Portal de Stripe para gestionar suscripcion.
- Email transaccional para confirmacion, invitacion y soporte.
- Pagina de estado o email de soporte visible.

## Referencias oficiales

- LSSI, articulo 10: informacion general obligatoria del prestador del servicio.
  https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- AEPD: deber de informacion y modelo por capas para privacidad.
  https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion
- AEPD: guia sobre el uso de cookies.
  https://www.aepd.es/guias/guia-cookies.pdf
