import 'server-only';
import { digitos } from './format';

export type DadosBoleto = {
  pagador: string;
  documento: string;
  vencimento: string; // YYYY-MM-DD
  valor: number | null;
  nossoNumero: string;
  beneficiarioDoc: string[];
};

/** Extrai o texto de um PDF (pdf.js no servidor). */
export async function textoPdf(buf: ArrayBuffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
  const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(buf), verbosity: 0, isEvalSupported: false }).promise;
  let t = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    t += c.items.map((x: any) => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  return t;
}

/**
 * Lê os campos do boleto. Validado com os layouts do Banco Inter
 * (texto extraído por pdf.js e por pdfplumber).
 */
export function lerBoleto(texto: string, docEscritorio: string): DadosBoleto {
  const T = texto.replace(/[ \t]+/g, ' ');
  const pg = T.match(/Pagador:?\s+(?!Vencimento)([^\n]+?)\s*(?:\n|CNPJ\/CPF)/);
  const docs = [...T.matchAll(/CNPJ\/CPF:?\s*([\d./-]{11,20})/g)].map((m) => m[1]);
  const docPagador = docs.find((d) => digitos(d) !== digitos(docEscritorio)) || '';
  const vc = T.match(/Vencimento\s*\n\s*(\d{2}\/\d{2}\/\d{4})/) || T.match(/(\d{2}\/\d{2}\/\d{4})\s+[\d.]+,\d{2}/);
  const vl =
    T.match(/R\$\s*([\d.]+,\d{2})/) ||
    T.match(/Valor do Documento\s*\n\s*([\d.]+,\d{2})/) ||
    T.match(/\d{2}\/\d{2}\/\d{4}\s+([\d.]+,\d{2})/);
  const nn = T.match(/(\d{5}\/\d{3}\/\d+-\d)/);
  const benef = [...T.matchAll(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s*-\s*[A-Z]/g)].map((m) => m[1]);
  return {
    pagador: pg ? pg[1].trim() : '',
    documento: docPagador,
    vencimento: vc ? vc[1].split('/').reverse().join('-') : '',
    valor: vl ? parseFloat(vl[1].replace(/\./g, '').replace(',', '.')) : null,
    nossoNumero: nn ? nn[1] : '',
    beneficiarioDoc: benef.length ? benef : docs.filter((d) => digitos(d) === digitos(docEscritorio)),
  };
}
