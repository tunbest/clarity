import JSZip from 'jszip';

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';

export interface CoprojTemplateData {
  scopeName: string;
  scopeCode: string;
  date: string;
  projects: any[];
  meps: any[];
  risks: any[];
  tasks: any[];
  milestones: any[];
  transcript: string;
  raidNotes: string;
  environmentNotes: string;
  actionNotes: string;
}

const textOf = (node: Element) =>
  Array.from(node.getElementsByTagNameNS(A_NS, 't')).map((t) => t.textContent || '').join('');

function setText(node: Element, value: string) {
  const runs = Array.from(node.getElementsByTagNameNS(A_NS, 't'));
  if (runs.length) {
    runs[0].textContent = value;
    runs.slice(1).forEach((run) => { run.textContent = ''; });
    return;
  }
  const paragraph = node.getElementsByTagNameNS(A_NS, 'p')[0];
  if (!paragraph) return;
  const run = node.ownerDocument!.createElementNS(A_NS, 'a:r');
  const props = node.ownerDocument!.createElementNS(A_NS, 'a:rPr');
  props.setAttribute('lang', 'fr-FR');
  const t = node.ownerDocument!.createElementNS(A_NS, 'a:t');
  t.textContent = value;
  run.appendChild(props);
  run.appendChild(t);
  paragraph.appendChild(run);
}

function setShapeByText(doc: Document, predicate: (text: string) => boolean, value: string) {
  const shapes = Array.from(doc.getElementsByTagNameNS(P_NS, 'sp'));
  const shape = shapes.find((item) => predicate(textOf(item)));
  if (shape) setText(shape, value);
}

function setTableRows(doc: Document, tableIndex: number, rows: string[][]) {
  const tables = Array.from(doc.getElementsByTagNameNS(A_NS, 'tbl'));
  const table = tables[tableIndex];
  if (!table) return;
  const tr = Array.from(table.getElementsByTagNameNS(A_NS, 'tr'));
  if (!tr.length) return;
  const header = tr[0];
  const capacity = tr.length - 1;
  const visible = rows.slice(0, capacity);
  for (let i = 1; i < tr.length; i++) {
    const cells = Array.from(tr[i].getElementsByTagNameNS(A_NS, 'tc'));
    const row = visible[i - 1] || [];
    cells.forEach((cell, index) => {
      let value = row[index] || '';
      if (i === tr.length - 1 && rows.length > capacity && index === cells.length - 1) {
        value = [value, `+${rows.length - capacity} autres éléments`].filter(Boolean).join(' · ');
      }
      setText(cell, value);
    });
  }
  void header;
}

const dateText = (value: any) => value ? String(value).slice(0, 10) : 'À planifier';
const clean = (value: any) => value === null || value === undefined ? '' : Array.isArray(value) ? value.join(', ') : String(value);

export async function updateCoproJTemplate(source: ArrayBuffer, data: CoprojTemplateData) {
  const zip = await JSZip.loadAsync(source);
  const slideFiles = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  if (slideFiles.length !== 14) throw new Error(`Le modèle attendu comporte 14 diapositives ; ${slideFiles.length} trouvée(s).`);

  const today = data.date;
  const projectSummary = data.projects.map((p) => `${p.code || ''} — ${p.name || 'Projet'} · ${p.status || 'Statut à préciser'} · ${p.managerName || 'Pilote à préciser'}`);
  const summary = [
    `Périmètre : ${data.scopeName} (${data.scopeCode})`,
    `Projets consolidés : ${data.projects.length} · MEP : ${data.meps.length} · Risques : ${data.risks.length}`,
    ...projectSummary,
    data.transcript ? `Synthèse de réunion : ${data.transcript.slice(0, 1800)}` : 'Synthèse de réunion : à compléter.'
  ].join(' | ');

  const sortedMeps = [...data.meps].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const split = Math.ceil(sortedMeps.length / 2);
  const planningRows = (items: any[]) => items.map((m) => [
    dateText(m.date), clean(m.applicationCode || (m.trigrams || []).join('/')), clean(m.title || m.name),
    clean(m.gireNumber || m.gire || ''), clean(m.changeNumbers), [clean(m.description), m.ritmNumbers ? 'RITM : ' + clean(m.ritmNumbers) : ''].filter(Boolean).join(' · ')
  ]);
  const riskRows = data.risks.map((r, i) => [
    `R${i + 1}`, clean(r.title), clean(r.probability), clean(r.impact), clean(r.mitigationPlan || 'Plan de mitigation à définir')
  ]);
  const taskRows = data.tasks.map((t, i) => [
    `A${i + 1}`, clean(t.version || ''), clean(t.trigram || t.projectCode || ''),
    clean(t.title), clean(t.environment || ''), clean(t.changeNumber || t.serviceNow || ''),
    dateText(t.dueDate), clean(t.assigneeName || t.assigneeId || 'À affecter'),
    clean(t.description || ''), '', clean(t.status)
  ]);
  const actionRows = taskRows.map((r) => [r[0], r[3], r[7], r[6], r[10], 'P2']);

  for (let n = 1; n <= 14; n++) {
    const path = `ppt/slides/slide${n}.xml`;
    const file = zip.file(path);
    if (!file) continue;
    const xml = await file.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error(`Diapositive ${n} : XML PowerPoint illisible.`);

    if (n === 1) {
      setShapeByText(doc, (t) => t.includes('Comité projet'), `Comité projet ${data.scopeName}`);
      setShapeByText(doc, (t) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t.trim()), today);
    }
    if (n === 3) setShapeByText(doc, (t) => t.includes('Lot majeur') || t.includes('Migration Windows') || t.includes('Passage des certificats'), summary);
    if (n === 4) {
      const risksText = data.raidNotes || data.risks.map((r) => `${r.title} — ${r.status || 'À traiter'}`).join(' | ') || 'Aucun risque renseigné dans Clarity.';
      setShapeByText(doc, (t) => t.includes('I1 –') || t.includes('I1 -'), risksText.slice(0, 1600));
      setShapeByText(doc, (t) => t.includes('D1 –') || t.includes('D1 -'), data.actionNotes || 'Décisions à compléter à partir du comité.');
      setTableRows(doc, 0, actionRows);
      setTableRows(doc, 1, riskRows);
    }
    if (n === 5) setTableRows(doc, 0, planningRows(sortedMeps.slice(0, split)));
    if (n === 6) setTableRows(doc, 0, planningRows(sortedMeps.slice(split)));
    if (n === 7) {
      setShapeByText(doc, (t) => t.includes('Planning des MEP'), `Macro-planning — ${data.scopeName}`);
      const labels = Array.from(doc.getElementsByTagNameNS(P_NS, 'sp')).filter((s) => /Janv\.|MEP majeure|Lot 5\d|Migration WS/i.test(textOf(s)));
      const milestones = [...data.milestones].sort((a, b) => String(a.targetDate || '').localeCompare(String(b.targetDate || '')));
      labels.forEach((shape, i) => setText(shape, milestones[i] ? `${dateText(milestones[i].targetDate)} · ${milestones[i].title}` : ''));
    }
    if ([8, 9, 10].includes(n)) {
      const tables = Array.from(doc.getElementsByTagNameNS(A_NS, 'tbl'));
      tables.forEach((_, i) => setTableRows(doc, i, []));
      setShapeByText(doc, (t) => t.includes('Migration Netapp') || t.includes('Déploiement IHM'), data.environmentNotes || 'État des environnements : à compléter dans Clarity PM.');
    }
    if (n === 11 || n === 12) {
      const start = n === 11 ? 0 : 8;
      setTableRows(doc, 0, taskRows.slice(start, start + 8));
    }
    if (n === 13 || n === 14) {
      const tables = Array.from(doc.getElementsByTagNameNS(A_NS, 'tbl'));
      tables.forEach((_, i) => setTableRows(doc, i, []));
      setShapeByText(doc, (t) => t.includes('Migration BDD MSSQL') || t.includes('Migration WS 2022'), 'Annexe non alimentée automatiquement : données à compléter dans Clarity PM.');
    }

    const serialized = new XMLSerializer().serializeToString(doc);
    zip.file(path, serialized);
  }

  const output = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  return { bytes: output, slideCount: slideFiles.length };
}
