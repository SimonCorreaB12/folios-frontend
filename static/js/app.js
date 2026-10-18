/* ==========================================================================
   FOLIOS — app.js
   JavaScript Vanilla — comportamiento compartido por las páginas.
   ========================================================================== */

const API_URL = 'http://127.0.0.1:8000';   // dirección del backend: un solo lugar para cambiarla
const TOKEN_KEY = 'foliosToken';           // clave de localStorage donde se guarda el token

document.addEventListener('DOMContentLoaded', () => {
  const navbar = document.querySelector('.navbar');
  const toggleBtn = document.querySelector('.navbar__toggle');

  if (toggleBtn && navbar) {
    toggleBtn.addEventListener('click', () => {
      navbar.classList.toggle('is-open');
    });
  }

  initRegistroForm();
  initLoginForm();
  initFormularioDocumento();
  initSesion();
  initDocumentos();
  initDocumentoDetalle();
  initPerfil();
});

/* --------------------------------------------------------------------------
   Comunicación con la API
   -------------------------------------------------------------------------- */

/**
 * Hace una petición al backend. Si hay token guardado, lo envía en el
 * encabezado Authorization. Nunca lanza errores: siempre devuelve
 * { ok, estado, datos }, donde estado = 0 significa "no hubo conexión".
 */
async function llamarApi(ruta, { metodo = 'GET', cuerpo = null } = {}) {
  const headers = {};
  if (cuerpo) headers['Content-Type'] = 'application/json';

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = await respuesta.json().catch(() => null);
    return { ok: respuesta.ok, estado: respuesta.status, datos };
  } catch (error) {
    return { ok: false, estado: 0, datos: null };
  }
}

// Qué campo del formulario corresponde a cada nombre de campo del backend
const CAMPO_A_ERROR = {
  nombre: 'errorNombre',
  correo: 'errorCorreo',
  contrasena: 'errorContrasena',
  semestre: 'errorSemestre',
  programa: 'errorPrograma',
  descripcion: 'errorDescripcion',
  id_materia: 'errorMateria',
  id_categoria: 'errorCategoria',
  enlace: 'errorEnlace',
};

function mostrarError(idElemento, mensaje) {
  const el = document.getElementById(idElemento);
  if (el) el.textContent = mensaje;
}

/** Muestra un error de la API en el lugar que corresponda del formulario. */
function mostrarErrorServidor(resp) {
  if (resp.estado === 0) {
    mostrarError('errorGeneral', 'No se pudo conectar con el servidor. Intenta de nuevo en un momento.');
    return;
  }

  // 422: el backend devuelve una lista con un error por campo inválido
  if (resp.estado === 422 && Array.isArray(resp.datos && resp.datos.detail)) {
    resp.datos.detail.forEach((e) => {
      const campo = e.loc[e.loc.length - 1];
      const mensaje = String(e.msg).replace('Value error, ', '');
      mostrarError(CAMPO_A_ERROR[campo] || 'errorGeneral', mensaje);
    });
    return;
  }

  const detalle = resp.datos && typeof resp.datos.detail === 'string' ? resp.datos.detail : null;
  mostrarError('errorGeneral', detalle || 'Ocurrió un error inesperado.');
}

/**
 * Valida en el navegador los campos indicados (para ahorrar viajes al servidor).
 * Devuelve true si todos son válidos y pinta el mensaje en los que no.
 */
function validarCampos(campos) {
  let esValido = true;
  campos.forEach(({ input, error, mensaje }) => {
    const valido = input.checkValidity() && input.value.trim() !== '';
    mostrarError(error, valido ? '' : mensaje);
    if (!valido) esValido = false;
  });
  return esValido;
}

/** Crea un <option>. Usa textContent (no innerHTML): el texto nunca se interpreta como HTML. */
function crearOpcion(valor, texto) {
  const option = document.createElement('option');
  option.value = valor;
  option.textContent = texto;
  return option;
}

/**
 * Llena un <select> con <optgroup>: agrupa los elementos según grupoDe().
 */
function llenarSelectAgrupado(select, elementos, grupoDe, valorDe, textoDe) {
  const grupos = new Map();
  elementos.forEach((elemento) => {
    const grupo = grupoDe(elemento);
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push(elemento);
  });

  grupos.forEach((lista, nombreGrupo) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = nombreGrupo;
    lista.forEach((elemento) => {
      optgroup.appendChild(crearOpcion(valorDe(elemento), textoDe(elemento)));
    });
    select.appendChild(optgroup);
  });
}

/* --------------------------------------------------------------------------
   Registro
   -------------------------------------------------------------------------- */
async function cargarProgramas(form) {
  const resp = await llamarApi('/api/programas');
  if (!resp.ok) {
    mostrarError('errorPrograma', 'No se pudieron cargar los programas. Recarga la página.');
    return;
  }
  llenarSelectAgrupado(
    form.programa,
    resp.datos,
    (programa) => programa.facultad,
    (programa) => programa.nombre,
    (programa) => programa.nombre
  );
}

function initRegistroForm() {
  const form = document.getElementById('formRegistro');
  if (!form) return;

  cargarProgramas(form);   // los programas vienen de la base de datos, no del HTML

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mostrarError('errorGeneral', '');

    const esValido = validarCampos([
      { input: form.nombre, error: 'errorNombre', mensaje: 'Ingresa tu nombre completo.' },
      { input: form.correo, error: 'errorCorreo', mensaje: 'Ingresa un correo institucional válido.' },
      { input: form.semestre, error: 'errorSemestre', mensaje: 'Selecciona tu semestre.' },
      { input: form.programa, error: 'errorPrograma', mensaje: 'Selecciona tu programa académico.' },
      { input: form.contrasena, error: 'errorContrasena', mensaje: 'La contraseña debe tener al menos 6 caracteres.' },
    ]);
    if (!esValido) return;

    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;   // evita enviar dos veces con doble clic

    const resp = await llamarApi('/api/registro', {
      metodo: 'POST',
      cuerpo: {
        nombre: form.nombre.value.trim(),
        correo: form.correo.value.trim(),
        contrasena: form.contrasena.value,
        semestre: Number(form.semestre.value),   // el select entrega texto; la API espera número
        programa: form.programa.value,
      },
    });

    boton.disabled = false;

    if (resp.ok) {
      alert('Cuenta creada correctamente. Ahora puedes iniciar sesión.');
      window.location.href = 'login.html';
      return;
    }
    if (resp.estado === 409) {
      mostrarError('errorCorreo', resp.datos.detail);
      return;
    }
    if (resp.estado === 400) {
      mostrarError('errorPrograma', resp.datos.detail);
      return;
    }
    mostrarErrorServidor(resp);
  });
}

/* --------------------------------------------------------------------------
   Inicio de sesión
   -------------------------------------------------------------------------- */
function initLoginForm() {
  const form = document.getElementById('formLogin');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mostrarError('errorGeneral', '');

    const esValido = validarCampos([
      { input: form.correo, error: 'errorCorreo', mensaje: 'Ingresa un correo institucional válido.' },
      { input: form.contrasena, error: 'errorContrasena', mensaje: 'Ingresa tu contraseña.' },
    ]);
    if (!esValido) return;

    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;

    const resp = await llamarApi('/api/login', {
      metodo: 'POST',
      cuerpo: {
        correo: form.correo.value.trim(),
        contrasena: form.contrasena.value,
      },
    });

    boton.disabled = false;

    if (resp.ok) {
      localStorage.setItem(TOKEN_KEY, resp.datos.access_token);
      window.location.href = 'documents.html';
      return;
    }
    if (resp.estado === 401) {
      mostrarError('errorContrasena', resp.datos.detail);
      return;
    }
    mostrarErrorServidor(resp);
  });
}

/* --------------------------------------------------------------------------
   Subir documento
   -------------------------------------------------------------------------- */
async function cargarCatalogosDocumento(form) {
  const [materias, categorias] = await Promise.all([
    llamarApi('/api/materias'),
    llamarApi('/api/categorias'),
  ]);

  if (materias.ok) {
    // Todas las materias, agrupadas por programa (decisión del equipo)
    llenarSelectAgrupado(
      form.materia,
      materias.datos,
      (materia) => materia.programa,
      (materia) => materia.codigo,
      (materia) => materia.nombre
    );
  } else {
    mostrarError('errorMateria', 'No se pudieron cargar las materias. Recarga la página.');
  }

  if (categorias.ok) {
    categorias.datos.forEach((categoria) => {
      form.categoria.appendChild(crearOpcion(categoria.id, categoria.nombre));
    });
  } else {
    mostrarError('errorCategoria', 'No se pudieron cargar las categorías. Recarga la página.');
  }
}

/** Lee ?id=... de la URL. Devuelve un entero >= 1, o null si no es válido. */
function leerIdDeLaUrl() {
  const id = Number(new URLSearchParams(window.location.search).get('id'));
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/**
 * Formulario de documentos. Lo usan dos páginas distintas:
 *  - upload_document.html   (data-modo ausente o "crear")  -> POST
 *  - edit_document.html  (data-modo="editar")           -> PUT, con los campos prellenados
 * Son páginas separadas, pero la validación y el envío viven en un solo lugar.
 */
async function initFormularioDocumento() {
  const form = document.getElementById('formDocumento');
  if (!form) return;

  const editando = form.dataset.modo === 'editar';
  const boton = form.querySelector('button[type="submit"]');
  let idDocumento = null;

  await cargarCatalogosDocumento(form);

  if (editando) {
    idDocumento = leerIdDeLaUrl();
    if (idDocumento === null) {
      mostrarError('errorGeneral', 'Documento no encontrado.');
      boton.disabled = true;
      return;
    }
    document.getElementById('enlaceCancelar').href = `document.html?id=${idDocumento}`;

    const [perfil, resp] = await Promise.all([obtenerPerfil(), llamarApi(`/api/documentos/${idDocumento}`)]);
    if (resp.estado === 401) {
      terminarSesion('login.html');
      return;
    }
    if (!resp.ok) {
      mostrarError('errorGeneral', resp.estado === 404 ? 'Documento no encontrado.' : 'No se pudo cargar el documento.');
      boton.disabled = true;
      return;
    }
    // Comodidad para el usuario; quien de verdad impide editar es el servidor (403).
    if (perfil.ok && perfil.datos.id !== resp.datos.id_autor) {
      mostrarError('errorGeneral', 'Solo el autor puede editar este documento.');
      boton.disabled = true;
      return;
    }

    const doc = resp.datos;
    form.nombre.value = doc.nombre;
    form.descripcion.value = doc.descripcion || '';
    form.materia.value = String(doc.id_materia);
    form.categoria.value = String(doc.id_categoria);
    form.enlace.value = doc.enlace;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mostrarError('errorGeneral', '');

    const esValido = validarCampos([
      { input: form.nombre, error: 'errorNombre', mensaje: 'Ingresa el nombre del documento.' },
      { input: form.materia, error: 'errorMateria', mensaje: 'Selecciona la materia.' },
      { input: form.categoria, error: 'errorCategoria', mensaje: 'Selecciona la categoría.' },
      { input: form.enlace, error: 'errorEnlace', mensaje: 'Ingresa un enlace válido (empieza por http:// o https://).' },
    ]);
    mostrarError('errorDescripcion', '');
    if (!esValido) return;

    boton.disabled = true;

    const resp = await llamarApi(editando ? `/api/documentos/${idDocumento}` : '/api/documentos', {
      metodo: editando ? 'PUT' : 'POST',
      cuerpo: {
        nombre: form.nombre.value.trim(),
        descripcion: form.descripcion.value,          // vacío = sin descripción (el backend lo normaliza)
        id_materia: Number(form.materia.value),       // los selects entregan texto; la API espera números
        id_categoria: Number(form.categoria.value),
        enlace: form.enlace.value.trim(),
      },
    });

    boton.disabled = false;

    if (resp.ok) {
      window.location.href = editando ? `document.html?id=${idDocumento}` : 'documents.html';
      return;
    }
    if (resp.estado === 401) {          // la sesión venció mientras llenabas el formulario
      terminarSesion('login.html');
      return;
    }
    mostrarErrorServidor(resp);         // 400, 403, 404, 422, sin conexión...
  });
}

/* --------------------------------------------------------------------------
   Detalle de un documento
   -------------------------------------------------------------------------- */
async function initDocumentoDetalle() {
  const contenedor = document.getElementById('docDetalle');
  if (!contenedor) return;

  const mensaje = document.getElementById('detalleMensaje');
  function mostrarMensajeDetalle(texto) {
    contenedor.style.display = 'none';
    mensaje.textContent = texto;
    mensaje.style.display = 'block';
  }

  const id = leerIdDeLaUrl();
  if (id === null) {
    mostrarMensajeDetalle('Documento no encontrado.');
    return;
  }

  const [perfil, resp] = await Promise.all([obtenerPerfil(), llamarApi(`/api/documentos/${id}`)]);
  if (resp.estado === 401) {
    terminarSesion('login.html');
    return;
  }
  if (resp.estado === 404) {
    mostrarMensajeDetalle('Documento no encontrado. Puede que su autor lo haya eliminado.');
    return;
  }
  if (!resp.ok) {
    mostrarMensajeDetalle('No se pudo cargar el documento. Intenta de nuevo en un momento.');
    return;
  }

  const doc = resp.datos;
  const esAutor = perfil.ok && perfil.datos.id === doc.id_autor;
  document.title = `${doc.nombre} — Folios`;

  const acciones = crearElemento('div', 'doc-detalle__acciones');
  if (esEnlaceSeguro(doc.enlace)) {
    const abrir = crearElemento('a', 'btn btn-primary', 'Abrir documento');
    abrir.href = doc.enlace;
    abrir.target = '_blank';
    abrir.rel = 'noopener noreferrer';
    acciones.appendChild(abrir);
  }

  // Mostrar u ocultar estos botones es comodidad: el servidor vuelve a comprobar
  // que quien edita o elimina sea el autor (RN-05).
  if (esAutor) {
    const editar = crearElemento('a', 'btn btn-outline', 'Editar');
    editar.href = `edit_document.html?id=${encodeURIComponent(doc.id)}`;
    acciones.appendChild(editar);

    const eliminar = crearElemento('button', 'btn btn-danger', 'Eliminar');
    eliminar.type = 'button';
    eliminar.addEventListener('click', async () => {
      mostrarError('errorGeneral', '');
      const seguro = confirm(`¿Eliminar "${doc.nombre}"?\n\nTambién se borrarán sus calificaciones y comentarios. Esta acción no se puede deshacer.`);
      if (!seguro) return;

      eliminar.disabled = true;
      const respuesta = await llamarApi(`/api/documentos/${doc.id}`, { metodo: 'DELETE' });
      if (respuesta.ok) {
        window.location.href = 'documents.html';
        return;
      }
      eliminar.disabled = false;
      if (respuesta.estado === 401) {
        terminarSesion('login.html');
        return;
      }
      mostrarErrorServidor(respuesta);
    });
    acciones.appendChild(eliminar);
  }

  contenedor.replaceChildren(
    crearElemento('span', 'doc-card__categoria', doc.categoria),
    crearElemento('h1', '', doc.nombre),
    crearElemento('span', 'doc-card__meta', doc.materia),
    crearElemento('span', 'doc-card__meta', `${doc.autor} · ${formatearFecha(doc.fecha)}`),
    crearRating(doc.calificacion),
    crearElemento('p', 'doc-detalle__descripcion', doc.descripcion || 'Este documento no tiene descripción.'),
    acciones
  );

  initCalificar(doc.id, esAutor);
  cargarComentarios(doc.id);
}

/**
 * Bloque "Tu calificación": 5 estrellas + comentario opcional.
 * Solo se muestra si NO eres el autor (RN-04: no puedes calificar tu propio documento).
 * El estudiante y el documento nunca viajan en el cuerpo: el documento va en la URL
 * y el estudiante lo determina el servidor a partir del token.
 */
async function initCalificar(idDocumento, esAutor) {
  const seccion = document.getElementById('seccionCalificar');
  if (!seccion || esAutor) return;   // el autor no puede calificar su propio documento

  seccion.style.display = 'block';
  const contenedorEstrellas = document.getElementById('estrellas');
  const form = document.getElementById('formCalificar');
  const botones = [];
  let valorSeleccionado = null;

  function pintarEstrellas(hasta) {
    botones.forEach((boton, i) => boton.classList.toggle('seleccionada', i < hasta));
  }

  for (let i = 1; i <= 5; i++) {
    const boton = crearElemento('button', '', '★', { type: 'button', 'aria-label': `${i} estrella${i > 1 ? 's' : ''}` });
    boton.addEventListener('click', () => { valorSeleccionado = i; pintarEstrellas(i); });
    contenedorEstrellas.appendChild(boton);
    botones.push(boton);
  }

  // Si el estudiante ya había calificado o comentado, se precarga (es una edición, no una calificación nueva)
  const propia = await llamarApi(`/api/documentos/${idDocumento}/mi-calificacion`);
  if (propia.ok && propia.datos) {
    if (propia.datos.valor) { valorSeleccionado = propia.datos.valor; pintarEstrellas(propia.datos.valor); }
    if (propia.datos.comentario) form.comentario.value = propia.datos.comentario;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    mostrarError('errorCalificar', '');

    const comentario = form.comentario.value.trim();
    if (valorSeleccionado === null && !comentario) {
      mostrarError('errorCalificar', 'Elige una calificación, escribe un comentario, o ambos.');
      return;
    }

    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;

    const resp = await llamarApi(`/api/documentos/${idDocumento}/calificar`, {
      metodo: 'POST',
      cuerpo: { valor: valorSeleccionado, comentario },
    });

    boton.disabled = false;

    if (resp.ok) {
      cargarComentarios(idDocumento);   // refresca la lista con el comentario recién guardado
      return;
    }
    if (resp.estado === 401) {
      terminarSesion('login.html');
      return;
    }
    // Error específico de este formulario (403 si el servidor detecta que sí
    // eres el autor, o el mensaje de "elige algo" que también valida el
    // servidor): se muestra junto al botón, no en errorGeneral (que queda
    // arriba del todo, lejos de este formulario).
    const detalle = resp.datos && typeof resp.datos.detail === 'string' ? resp.datos.detail
      : (resp.datos && Array.isArray(resp.datos.detail) && resp.datos.detail[0] && resp.datos.detail[0].msg) || null;
    mostrarError('errorCalificar', (detalle || 'Ocurrió un error inesperado.').replace('Value error, ', ''));
  });
}

/** Lista pública de comentarios de un documento (los que sí escribieron algo). */
async function cargarComentarios(idDocumento) {
  const lista = document.getElementById('listaComentarios');
  if (!lista) return;

  const resp = await llamarApi(`/api/documentos/${idDocumento}/comentarios`);
  if (resp.estado === 401) {
    terminarSesion('login.html');
    return;
  }
  if (!resp.ok) {
    lista.replaceChildren(crearElemento('p', 'docs-vacio', 'No se pudieron cargar los comentarios.'));
    return;
  }
  if (resp.datos.length === 0) {
    lista.replaceChildren(crearElemento('p', 'docs-vacio', 'Todavía no hay comentarios.'));
    return;
  }

  lista.replaceChildren(...resp.datos.map((c) => {
    const item = crearElemento('article', 'doc-comentario');
    const cabeza = crearElemento('div', 'doc-comentario__cabeza');
    cabeza.appendChild(crearElemento('span', 'doc-comentario__autor', c.autor));
    cabeza.appendChild(document.createTextNode(`· ${formatearFecha(c.fecha)}`));
    if (c.valor) cabeza.appendChild(crearRating(c.valor));
    item.appendChild(cabeza);
    item.appendChild(crearElemento('p', 'doc-comentario__texto', c.comentario));
    return item;
  }));
}

/* --------------------------------------------------------------------------
   Sesión
   -------------------------------------------------------------------------- */
// El perfil se pide una sola vez por página y lo comparten quienes lo necesiten
let perfilPendiente = null;
function obtenerPerfil() {
  if (!perfilPendiente) perfilPendiente = llamarApi('/api/perfil');
  return perfilPendiente;
}

function terminarSesion(destino) {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = destino;
}

async function initSesion() {
  // Botones de cerrar sesión, estén en la página que estén
  document.querySelectorAll('#btnCerrarSesion, #btnCerrarSesionSidebar').forEach((boton) => {
    boton.addEventListener('click', () => terminarSesion('index.html'));
  });

  // Navbar público: alterna los botones si la página los tiene
  const loggedOut = document.getElementById('navbarLoggedOut');
  const loggedIn = document.getElementById('navbarLoggedIn');
  if (loggedOut && loggedIn) {
    const haySesion = Boolean(localStorage.getItem(TOKEN_KEY));
    loggedOut.classList.toggle('hidden-block', haySesion);
    loggedIn.classList.toggle('hidden-block', !haySesion);
  }

  // Páginas privadas: son las que tienen el nombre del estudiante en el sidebar.
  // OJO: esto es comodidad, no seguridad. La protección real es que la API
  // responde 401 a quien no mande un token válido.
  const sidebarNombre = document.getElementById('sidebarNombre');
  if (!sidebarNombre) return;

  if (!localStorage.getItem(TOKEN_KEY)) {
    window.location.href = 'login.html';
    return;
  }

  const resp = await obtenerPerfil();
  if (resp.estado === 401) {          // token vencido o alterado
    terminarSesion('login.html');
    return;
  }
  if (resp.ok) {
    sidebarNombre.textContent = resp.datos.nombre;
    const detalle = document.getElementById('sidebarDetalle');
    if (detalle) detalle.textContent = `Semestre ${resp.datos.semestre} · ${resp.datos.puntaje} puntos`;
  }
}

/* --------------------------------------------------------------------------
   Perfil (HU-09)
   -------------------------------------------------------------------------- */
async function initPerfil() {
  const contenedor = document.getElementById('perfilDatos');
  if (!contenedor) return;   // no estamos en profile.html

  // Reutiliza la misma petición que ya hizo initSesion (obtenerPerfil la guarda)
  const resp = await obtenerPerfil();
  if (!resp.ok) {
    // Si fue 401, initSesion ya está mandando al login; aquí solo se avisa.
    document.getElementById('perfilNombre').textContent = 'No se pudo cargar tu perfil.';
    return;
  }

  const datos = resp.datos;
  // textContent (no innerHTML): lo que venga de la BD se muestra como texto, nunca como HTML
  document.getElementById('perfilNombre').textContent = datos.nombre;
  document.getElementById('perfilCorreo').textContent = datos.correo;
  document.getElementById('perfilPrograma').textContent = datos.programa ?? 'Sin programa';
  document.getElementById('perfilSemestre').textContent = datos.semestre;
  document.getElementById('perfilPuntaje').textContent = `${datos.puntaje} puntos`;
}

/* --------------------------------------------------------------------------
   Documentos (listado, búsqueda y filtros)
   El servidor es quien busca y filtra; el navegador solo pide y pinta.
   -------------------------------------------------------------------------- */

/** Crea un elemento con clase y texto. El texto va con textContent: nunca se interpreta como HTML. */
function crearElemento(etiqueta, clase, texto, atributos) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  if (atributos) Object.entries(atributos).forEach(([nombre, valor]) => elemento.setAttribute(nombre, valor));
  return elemento;
}

/** Solo se enlaza a http(s): así un "javascript:..." nunca se vuelve clicable. */
function esEnlaceSeguro(url) {
  try {
    const protocolo = new URL(url).protocol;
    return protocolo === 'http:' || protocolo === 'https:';
  } catch (error) {
    return false;
  }
}

/**
 * "2026-09-19" -> fecha local legible.
 * OJO: new Date("2026-09-19") la interpreta como medianoche UTC, que en Colombia
 * (UTC-5) es el día anterior. Por eso se arma con año, mes y día por separado.
 */
function formatearFecha(texto) {
  const [anio, mes, dia] = texto.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function crearRating(calificacion) {
  const rating = crearElemento('span', 'doc-card__rating');
  rating.appendChild(crearElemento('i', 'bi bi-star-fill'));
  // Promedio 0 = todavía nadie lo ha calificado
  rating.appendChild(document.createTextNode(calificacion > 0 ? ` ${calificacion.toFixed(1)}` : ' Sin calificar'));
  return rating;
}

function crearTarjetaDocumento(doc) {
  const tarjeta = crearElemento('article', 'doc-card');
  tarjeta.appendChild(crearElemento('span', 'doc-card__categoria', doc.categoria));
  tarjeta.appendChild(crearElemento('h3', 'doc-card__nombre', doc.nombre));
  tarjeta.appendChild(crearElemento('span', 'doc-card__meta', doc.materia));
  tarjeta.appendChild(crearElemento('span', 'doc-card__meta', `${doc.autor} · ${formatearFecha(doc.fecha)}`));

  tarjeta.appendChild(crearRating(doc.calificacion));

  const acciones = crearElemento('div', 'doc-card__acciones');
  const ver = crearElemento('a', 'btn btn-outline', 'Ver');
  ver.href = `document.html?id=${encodeURIComponent(doc.id)}`;
  acciones.appendChild(ver);

  if (esEnlaceSeguro(doc.enlace)) {
    const abrir = crearElemento('a', 'btn btn-primary', 'Abrir');
    abrir.href = doc.enlace;
    abrir.target = '_blank';
    abrir.rel = 'noopener noreferrer';   // la página abierta no puede manipular esta pestaña
    acciones.appendChild(abrir);
  }
  tarjeta.appendChild(acciones);
  return tarjeta;
}

async function initDocumentos() {
  const grid = document.getElementById('docsGrid');
  if (!grid) return;

  // Buscador y filtros son opcionales: la página "Mis documentos" no los tiene
  const buscador = document.getElementById('buscador');
  const filtroMateria = document.getElementById('filtroMateria');
  const filtroCategoria = document.getElementById('filtroCategoria');
  const vacio = document.getElementById('docsVacio');
  // La página "Mis documentos" usa este mismo listado, marcado con data-solo-mios="true"
  const soloMios = grid.dataset.soloMios === 'true';

  // Los filtros se llenan desde la API (todas las materias, agrupadas por programa).
  // Si la página no los tiene, ni siquiera se piden los catálogos.
  if (filtroMateria && filtroCategoria) {
    const [materias, categorias] = await Promise.all([
      llamarApi('/api/materias'),
      llamarApi('/api/categorias'),
    ]);
    if (materias.ok) {
      llenarSelectAgrupado(
        filtroMateria,
        materias.datos,
        (materia) => materia.programa,
        (materia) => materia.codigo,
        (materia) => materia.nombre
      );
    }
    if (categorias.ok) {
      categorias.datos.forEach((categoria) => {
        filtroCategoria.appendChild(crearOpcion(categoria.id, categoria.nombre));
      });
    }
  }

  function mostrarMensaje(texto) {
    grid.replaceChildren();
    vacio.textContent = texto;
    vacio.style.display = 'block';
  }

  let ultimaSolicitud = 0;

  async function cargarDocumentos() {
    const numero = ++ultimaSolicitud;

    const parametros = new URLSearchParams();
    const texto = buscador ? buscador.value.trim() : '';
    if (texto) parametros.set('q', texto);
    if (filtroMateria && filtroMateria.value) parametros.set('materia', filtroMateria.value);
    if (filtroCategoria && filtroCategoria.value) parametros.set('categoria', filtroCategoria.value);
    const hayFiltros = parametros.toString() !== '';   // solo cuenta lo que eligió el usuario
    if (soloMios) parametros.set('mios', 'true');
    const consulta = parametros.toString();

    const resp = await llamarApi(`/api/documentos${consulta ? '?' + consulta : ''}`);

    // Si mientras esperábamos se hizo otra búsqueda, esta respuesta ya es vieja:
    // se descarta para que no pise el resultado más reciente.
    if (numero !== ultimaSolicitud) return;

    if (resp.estado === 401) {
      terminarSesion('login.html');
      return;
    }
    if (!resp.ok) {
      mostrarMensaje('No se pudieron cargar los documentos. Intenta de nuevo en un momento.');
      return;
    }
    if (resp.datos.length === 0) {
      mostrarMensaje(hayFiltros
        ? 'No se encontraron documentos con esos filtros.'
        : soloMios
          ? 'Aún no has publicado documentos. Usa «Subir documento» para compartir el primero.'
          : 'Aún no hay documentos publicados. ¡Sé el primero en subir uno!');
      return;
    }

    vacio.style.display = 'none';
    grid.replaceChildren(...resp.datos.map(crearTarjetaDocumento));
  }

  // Buscador: espera 300 ms sin teclear antes de preguntarle al servidor,
  // para no hacer una petición por cada letra.
  let temporizador;
  if (buscador) {
    buscador.addEventListener('input', () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarDocumentos, 300);
    });
  }
  if (filtroMateria) filtroMateria.addEventListener('change', cargarDocumentos);
  if (filtroCategoria) filtroCategoria.addEventListener('change', cargarDocumentos);

  cargarDocumentos();
}