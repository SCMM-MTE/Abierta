# Identidad visual SCMM

Preferencia del usuario confirmada el 17/10/2026: usar el estilo aprobado de
Permutas MTE en todos los proyectos del SCMM, incluida la aplicación Android.

- Cabeceras: degradado `#0b244b` → `#164b8f` → `#287bc5`.
- Acción principal: `#1d64bd`, texto blanco; degradados de acción
  `#164f9b` → `#287bc5` cuando el componente los permita.
- Fondo claro `#f0f5fc`, superficies blancas, selecciones `#e2efff` y
  bordes `#cbdcf1`; texto principal `#172b48` y secundario `#60728c`.
- Usar el logo proporcionado por el usuario, sin redibujarlo ni deformarlo.
  Desde el 19/10/2026, el original es `scmm-logo.svg`, aportado por el usuario.
  Conservar su transparencia y proporción cuadrada, sin fondo negro añadido.
  `scmm-logo.png` es una rasterización fiel de 1024 × 1024 para Flutter y PDF.
- Mantener avisos, errores y estados de calendario distinguibles por texto
  y color. No convertir todos los estados semánticos a azul.
- Bordes redondeados, sombras suaves, foco de teclado visible y diseño adaptable.
- No reintroducir el subtítulo eliminado de la cabecera de Permutas.

Referencia implementada en Permutas: commit `fda1413`. En Flutter, el tema
compartido reside en `apps/mobile_flutter/lib/theme/scmm_theme.dart`;
en el panel, en `apps/admin_web/src/styles.css`. Los cambios visuales no
constituyen aprobación documental, cambio de permisos o activación del motor.

## Modos de apariencia

Por petición del usuario, todos los proyectos ofrecen **Sistema, Claro y Oscuro**.
Sistema es el valor inicial y sigue los cambios de apariencia del dispositivo.
La elección manual se guarda en el dispositivo (`scmm.theme`) y no cambia la
sesión, los permisos ni la configuración del servidor. Volver a Sistema elimina
la elección manual. El selector debe estar disponible antes y después del acceso.
Mantener el logo y los degradados azules en ambos modos; revisar fondos y textos
juntos, especialmente formularios, tablas, avisos y cabeceras del calendario.
