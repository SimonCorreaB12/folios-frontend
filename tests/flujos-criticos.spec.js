const { test, expect } = require('@playwright/test');

// Correo único por ejecución: así la prueba de registro no choca con
// un usuario creado en una corrida anterior (el correo debe ser único, RN-01)
const correo = `prueba${Date.now()}@soyudemedellin.edu.co`;
const contrasena = 'secreta123';

// Las pruebas de este archivo corren en orden, porque el flujo depende
// del usuario que se crea en el registro
test.describe.configure({ mode: 'serial' });

test('la página de inicio carga y ofrece registrarse e iniciar sesión', async ({ page }) => {
  await page.goto('/templates/index.html');
  await expect(page.getByRole('link', { name: 'Iniciar sesión' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Registrarse' }).first()).toBeVisible();
});

test('una página privada sin sesión redirige al login', async ({ page }) => {
  await page.goto('/templates/documents.html');
  await expect(page).toHaveURL(/login\.html/);
});

test('HU-01: registro con correo institucional', async ({ page }) => {
  await page.goto('/templates/register.html');
  await page.fill('#nombre', 'Usuario de Prueba');
  await page.fill('#correo', correo);
  await page.selectOption('#semestre', '6');
  // Los programas llegan desde la API; selectOption espera a que exista la opción
  await page.selectOption('#programa', { label: 'Ingeniería de Sistemas' });
  await page.fill('#contrasena', contrasena);

  // El registro muestra un alert() de confirmación: se acepta automáticamente
  page.once('dialog', (dialogo) => dialogo.accept());
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/login\.html/);
});

test('HU-01: el registro rechaza un correo no institucional', async ({ page }) => {
  await page.goto('/templates/register.html');
  await page.fill('#nombre', 'Usuario de Prueba');
  await page.fill('#correo', 'alguien@gmail.com');
  await page.selectOption('#semestre', '6');
  await page.selectOption('#programa', { label: 'Ingeniería de Sistemas' });
  await page.fill('#contrasena', contrasena);
  await page.click('button[type="submit"]');

  await expect(page.locator('#errorCorreo')).not.toBeEmpty();
  await expect(page).toHaveURL(/register\.html/);
});

test('HU-02: login con contraseña incorrecta muestra error', async ({ page }) => {
  await page.goto('/templates/login.html');
  await page.fill('#correo', correo);
  await page.fill('#contrasena', 'contrasena-equivocada');
  await page.click('button[type="submit"]');

  await expect(page.locator('#errorContrasena')).toContainText('incorrectos');
});

test('HU-02 + HU-05 + HU-03: login, publicar un documento y verlo en el listado', async ({ page }) => {
  // Login
  await page.goto('/templates/login.html');
  await page.fill('#correo', correo);
  await page.fill('#contrasena', contrasena);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/documents\.html/);

  // Publicar
  const nombreDocumento = `Resumen de prueba ${Date.now()}`;
  await page.goto('/templates/upload_document.html');
  await page.fill('#nombre', nombreDocumento);
  await page.selectOption('#materia', { label: 'Análisis Numérico' });
  await page.selectOption('#categoria', { label: 'Resumen' });
  await page.fill('#enlace', 'https://drive.google.com/prueba');
  await page.fill('#descripcion', 'Documento creado por una prueba automática');
  await page.click('button[type="submit"]');

  // Debe volver al listado y mostrar el documento recién publicado
  await expect(page).toHaveURL(/documents\.html/);
  await expect(page.getByText(nombreDocumento)).toBeVisible();
});