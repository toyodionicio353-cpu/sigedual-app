// Utilidades para RUN/RUT chileno: limpieza, formato y validación de dígito verificador.

export function limpiarRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

export function formatearRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoFormateado}-${dv}`;
}

export function normalizarRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo) || cuerpo.length < 7) return false;
  return calcularDv(cuerpo) === dv;
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validarTelefonoChileno(telefono: string): boolean {
  const limpio = telefono.replace(/[\s-]/g, "");
  return /^(\+?56)?9\d{8}$/.test(limpio);
}
