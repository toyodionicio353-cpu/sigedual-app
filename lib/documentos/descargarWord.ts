import type { ParrafoWord } from "./tiposWord";

/**
 * Descarga el documento como .docx.
 *
 * Existe porque cada liceo necesita su propio formato: su logo, su
 * interlineado, su tipo de letra. SIGEDUAL no puede ofrecer todo eso —
 * sería un editor de textos — así que entrega el documento ya redactado y
 * relleno, y cada establecimiento lo termina en Word.
 *
 * La librería `docx` se carga solo al pulsar el botón: pesa bastante y no
 * tiene por qué viajar en el paquete de todas las pantallas.
 */
export async function descargarWord(opciones: {
  nombreArchivo: string;
  titulo?: string;
  parrafos: ParrafoWord[];
}): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import("docx");

  const cuerpo = [];

  if (opciones.titulo?.trim()) {
    cuerpo.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: opciones.titulo.trim(), bold: true, size: 28 })],
      })
    );
  }

  for (const p of opciones.parrafos) {
    cuerpo.push(
      new Paragraph({
        alignment: p.alineacion === "izquierda" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
        spacing: { after: 240, line: 360 },
        children: p.runs.map(
          (r) => new TextRun({ text: r.texto, bold: r.negrita })
        ),
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
      },
    },
    sections: [
      {
        properties: {
          // Hoja carta con márgenes de 2,5 cm, en vigésimos de punto.
          page: { margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } },
        },
        children: cuerpo,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${opciones.nombreArchivo}.docx`;
  a.click();
  // Sin esto el blob queda en memoria hasta recargar la página.
  URL.revokeObjectURL(url);
}
