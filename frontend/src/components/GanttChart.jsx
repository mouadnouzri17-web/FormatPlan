import { useState, useEffect, useRef, useCallback, useMemo, memo  } from "react";
import { useAuth } from "../contexts/AuthContext";
import { createPortal } from "react-dom";

import * as XLSX from "xlsx";
import {
  ChevronRight, ChevronLeft, ChevronDown, Plus, PlusCircle , X, Check,
  Edit2, Trash2, ZoomIn, ZoomOut, Search, Mail, Clock, Link,
  PanelLeftClose, PanelLeftOpen, AlertTriangle,
  LayoutDashboard, CalendarRange, Users, FolderOpen,
  Building2, FileText, BarChart2, User, Receipt, Presentation, File,
  CalendarCheck, UserCheck, CheckCircle2, FileStack,
  GripVertical, MoreHorizontal, Briefcase, Settings, Clock4, CalendarDays,
  Columns,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  Upload, FileUp, AlertCircle, Wand2, Shuffle, ArrowRight, CheckCheck, ClipboardCheck, Printer, Eye, LayoutTemplate, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Image as ImageIcon, Type, Table2, Minus,
  UserCog, GanttChart 
} from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { saveAs } from "file-saver";

function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = "Quitter", cancelLabel = "Rester", isDestructive = true }) {
  return createPortal(
    <div style={{ 
      position: "fixed", 
      inset: 0, 
      zIndex: 9999, // Très haut pour passer devant les autres modals
      background: "rgba(0,0,0,0.5)", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "20px"
    }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ 
        background: "#fff", 
        borderRadius: "8px", 
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)", 
        width: "100%", 
        maxWidth: "400px", 
        overflow: "hidden", 
        animation: "fadeUp 0.2s ease-out" 
      }}>
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <AlertTriangle style={{ width: "22px", height: "22px", color: isDestructive ? "#d44c47" : "#0f7ddb" }} />
            <span style={{ fontSize: "18px", fontWeight: "700", color: "#37352f" }}>{title}</span>
          </div>
          <p style={{ fontSize: "14px", color: "#6b6b6b", lineHeight: "1.6", margin: 0 }}>{message}</p>
        </div>
        <div style={{ 
          padding: "12px 16px", 
          background: "#f9f9f9", 
          borderTop: "1px solid #eeeeee", 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: "10px" 
        }}>
          <button onClick={onCancel} style={{ 
            padding: "8px 16px", 
            fontSize: "13px", 
            borderRadius: "4px", 
            border: "1px solid #ddd", 
            background: "#fff", 
            cursor: "pointer", 
            fontWeight: "500" 
          }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ 
            padding: "8px 16px", 
            fontSize: "13px", 
            borderRadius: "4px", 
            border: "none", 
            background: isDestructive ? "#d44c47" : "#37352f", 
            color: "#fff", 
            cursor: "pointer", 
            fontWeight: "600" 
          }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body // C'est ici que createPortal envoie le HTML à la fin du <body>
  );
}

const generateAttendancePDF = (doc, allCandidates) => {
  const pdf = new jsPDF();
  const parts = doc.nom.split(" - ");
  const theme = parts[1] ? parts[1].trim() : "";
  const grpPart = parts[2] ? parts[2].trim() : "";
  const grpNumber = grpPart.replace("G", "");
  const list = allCandidates.filter(c =>
    (c.theme === theme || doc.nom.includes(c.theme)) &&
    String(c.groupe) === String(grpNumber)
  );
  pdf.setFontSize(18);
  pdf.text("LISTE D'ÉMARGEMENT", 105, 20, { align: "center" });
  pdf.setFontSize(11);
  pdf.rect(10, 25, 190, 30);
  pdf.text(`Formation : ${theme}`, 15, 35);
  pdf.text(`Date : ${doc.dateDoc ? fmt(doc.dateDoc) : "_________________"}`, 15, 45);
  pdf.text(`Groupe : ${grpNumber}`, 120, 35);
  pdf.text(`Entreprise : PlanAdmin Maroc`, 120, 45);
  const tableData = list.map((c, i) => [i + 1, c.matricule || "—", `${c.nom.toUpperCase()} ${c.prenom}`, ""]);
  autoTable(pdf, {
    startY: 60,
    head: [['N°', 'Matricule', 'Nom & Prénom', 'Signature']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillGray: [40, 40, 40], textColor: 255 },
    styles: { cellPadding: 5, fontSize: 10 },
    columnStyles: { 3: { minCellHeight: 15 } }
  });
  pdf.save(`${doc.nom}.pdf`);
};

const API_BASE = (typeof import_meta_env !== "undefined" && import_meta_env?.VITE_API_URL)
  || "https://sparkling-empathy-production-05b3.up.railway.app/api";

function norm(o) {
  if (!o) return o;
  const out = { ...o, id: o._id || o.id };
  if (!out.company && out.name) out.company = out.name;
 
  // ── Normaliser extraData ──
  if (typeof out.extraData === "string") {
    try { out.extraData = JSON.parse(out.extraData); } catch { out.extraData = {}; }
  }
  if (out.extraData && typeof out.extraData === "object" && !Array.isArray(out.extraData)) {
    if (!out.matricule && out.extraData["__matricule__"]) {
      out.matricule = out.extraData["__matricule__"];
    }
  } else {
    out.extraData = {};
  }
 
  // ── Normaliser paramètres planning (nouveaux champs workspace) ──
  // workingDays : [1,2,3,4,5] par défaut (jours OUVRÉS)
  if (!Array.isArray(out.workingDays) || out.workingDays.length === 0) {
    out.workingDays = [1, 2, 3, 4, 5];
  }
  // skipHolidays : true par défaut
  if (typeof out.skipHolidays !== "boolean") {
    out.skipHolidays = true;
  }
  // vacances : tableau d'objets {id, label, start, end}
  // Migration : ancienne DB stockait des strings → convertir
  if (!Array.isArray(out.vacances)) {
    out.vacances = [];
  } else {
    out.vacances = out.vacances.map(v => {
      if (typeof v === "string") {
        // Ancien format string — ignorer (données migrées)
        return null;
      }
      return v;
    }).filter(Boolean);
  }
 
  return out;
}
const normArr = a => (Array.isArray(a) ? a : []).map(norm);
  
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("gantt_auth_token");
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader, ...opts.headers },
    ...opts,
    body: opts.body !== undefined
      ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body))
      : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

const T = {
  sidebarBg: "#ffffff", sidebarText: "#37352f", sidebarSub: "#787774",
  sidebarHov: "rgba(55,53,47,0.06)", sidebarSel: "rgba(55,53,47,0.10)",
  sidebarBdr: "rgba(55,53,47,0.09)", pageBg: "#ffffff", pageText: "#37352f",
  pageSub: "#6b6b6b", pageTer: "#9b9a97", pageBdr: "rgba(55,53,47,0.09)",
  pageHov: "rgba(55,53,47,0.04)", pageInput: "rgba(55,53,47,0.04)", accent: "#0f7ddb",
  tagGray: { text: "#787774", bg: "rgba(227,226,224,0.5)", bd: "rgba(55,53,47,0.1)" },
  tagBrown: { text: "#9f6b53", bg: "rgba(238,224,218,0.5)", bd: "rgba(159,107,83,0.2)" },
  tagOrange: { text: "#d9730d", bg: "rgba(250,222,201,0.5)", bd: "rgba(217,115,13,0.2)" },
  tagYellow: { text: "#cb912f", bg: "rgba(253,236,200,0.5)", bd: "rgba(203,145,47,0.2)" },
  tagGreen: { text: "#448361", bg: "rgba(219,237,219,0.5)", bd: "rgba(68,131,97,0.2)" },
  tagBlue: { text: "#337ea9", bg: "rgba(211,229,239,0.5)", bd: "rgba(51,126,169,0.2)" },
  tagPurple: { text: "#9065b0", bg: "rgba(232,222,238,0.5)", bd: "rgba(144,101,176,0.2)" },
  tagPink: { text: "#c14c8a", bg: "rgba(245,224,233,0.5)", bd: "rgba(193,76,138,0.2)" },
  tagRed: { text: "#d44c47", bg: "rgba(253,224,220,0.5)", bd: "rgba(212,76,71,0.2)" },
};
const PALETTE_CYCLE = ["tagPurple", "tagOrange", "tagGreen", "tagBlue", "tagRed", "tagPink", "tagBrown", "tagYellow"];
const grpMap = {}; let grpIdx = 0;
function grpTag(g) { if (!g) return T.tagGray; if (!grpMap[g]) { grpMap[g] = T[PALETTE_CYCLE[grpIdx % PALETTE_CYCLE.length]]; grpIdx++; } return grpMap[g]; }
function Tag({ label, scheme }) { const s = scheme || T.tagGray; return (<span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 3, fontSize: 11, fontWeight: 500, color: s.text, background: s.bg, whiteSpace: "nowrap", letterSpacing: "0.01em", lineHeight: 1.6 }}>{label}</span>); }

function Spinner({ size = 16, color = T.pageSub }) {
  return (<div style={{ width: size, height: size, borderRadius: "50%", border: "2px solid rgba(55,53,47,0.12)", borderTopColor: color, animation: "spin 0.6s linear infinite", flexShrink: 0 }} />);
}
function Toast({ message, type = "error", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, []);
  const c = type === "error" ? { bg: "rgba(212,76,71,0.94)" } : { bg: "rgba(55,53,47,0.92)" };
  return (<div style={{ background: c.bg, color: "#fff", borderRadius: 6, padding: "10px 16px", fontSize: 13, fontWeight: 500, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 10, maxWidth: 360, animation: "fadeUp 0.2s ease-out" }}>
    {type === "error" && <AlertCircle style={{ width: 14, height: 14, flexShrink: 0 }} />}
    {type === "success" && <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />}
    <span style={{ flex: 1 }}>{message}</span>
    <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(255,255,255,0.65)", padding: 0, display: "flex" }}><X style={{ width: 13, height: 13 }} /></button>
  </div>);
}
function useToast() {
  const [toasts, setToasts] = useState([]);
  const uid_t = () => Math.random().toString(36).slice(2, 9);
  const show = useCallback((msg, type = "error") => { const id = uid_t(); setToasts(p => [...p, { id, message: msg, type }]); }, []);
  const remove = useCallback(id => setToasts(p => p.filter(t => t.id !== id)), []);
  const ToastContainer = () => (<div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>{toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />)}</div>);
  return { show, ToastContainer };
}

const HRAW = [
  ["2025-01-01", "Nouvel An"], ["2025-01-11", "Manifeste"], ["2025-01-14", "Nouvel An Amazigh"],
  ["2025-03-31", "Aïd Al Fitr", 1], ["2025-04-01", "Aïd Al Fitr J2", 1], ["2025-05-01", "Fête du Travail"],
  ["2025-06-06", "Aïd Al Adha", 1], ["2025-06-07", "Aïd Al Adha J2", 1], ["2025-06-27", "1er Moharram", 1],
  ["2025-07-30", "Fête du Trône"], ["2025-08-14", "Oued Eddahab"], ["2025-08-20", "Révolution du Roi"],
  ["2025-08-21", "Fête de la Jeunesse"], ["2025-09-05", "Aïd Al Mawlid", 1], ["2025-09-06", "Aïd Al Mawlid J2", 1],
  ["2025-11-06", "Marche Verte"], ["2025-11-18", "Fête de l'Indépendance"],
  ["2026-01-01", "Nouvel An"], ["2026-01-11", "Manifeste"], ["2026-01-14", "Nouvel An Amazigh"],
  ["2026-03-20", "Aïd Al Fitr", 1], ["2026-03-21", "Aïd Al Fitr J2", 1], ["2026-05-01", "Fête du Travail"],
  ["2026-05-27", "Aïd Al Adha", 1], ["2026-05-28", "Aïd Al Adha J2", 1], ["2026-06-17", "1er Moharram", 1],
  ["2026-07-30", "Fête du Trône"], ["2026-08-14", "Oued Eddahab"], ["2026-08-20", "Révolution du Roi"],
  ["2026-08-21", "Fête de la Jeunesse"], ["2026-08-25", "Aïd Al Mawlid", 1], ["2026-08-26", "Aïd Al Mawlid J2", 1],
  ["2026-11-06", "Marche Verte"], ["2026-11-18", "Fête de l'Indépendance"],
];
const HMAP = {}; HRAW.forEach(([d, t, r]) => { HMAP[d] = { title: t, religious: !!r }; });

const MFR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const pd = s => s instanceof Date ? s : new Date(s + "T00:00:00");
const ad = (d, n) => { const r = d instanceof Date ? new Date(d) : new Date(d + "T00:00:00"); r.setDate(r.getDate() + n); return r; };
const gdb = (a, b) => Math.round((b - a) / 864e5);
const d2s = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = s => { if (!s) return "—"; const d = pd(s); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`; };
const fmtFr = s => { if (!s) return "—"; const d = pd(s); return `${d.getDate()} ${MFR[d.getMonth()].slice(0, 3).toLowerCase()}. ${d.getFullYear()}`; };
const uid = () => Math.random().toString(36).slice(2, 9);

function isVac(d, vacs) { if (!vacs || !vacs.length) return false; const ds = d2s(d); return vacs.some(v => v.start && v.end && ds >= v.start && ds <= v.end); }
function isOff(d, wd, sh, vacs = []) { return wd.includes(d.getDay()) || (sh && !!HMAP[d2s(d)]) || isVac(d, vacs); }
function calcWD(s, e, wd, sh, vacs = []) { if (!s || !e) return 1; const sd = pd(s), ed = pd(e); if (sd > ed) return 1; let c = 0, cur = new Date(sd); while (cur <= ed) { if (!isOff(cur, wd, sh, vacs)) c++; cur.setDate(cur.getDate() + 1); } return Math.max(1, c); }
function addWD(start, n, wd, sh, vacs = []) { if (!start) return start; let cur = pd(start), s = 0; while (isOff(cur, wd, sh, vacs) && s++ < 60) cur = ad(cur, 1); let rem = Math.max(1, Math.round(n)) - 1; while (rem > 0) { cur = ad(cur, 1); if (!isOff(cur, wd, sh, vacs)) rem--; } return d2s(cur); }
function snap(ds, wd, sh, vacs = []) { let d = pd(ds), s = 0; while (isOff(d, wd, sh, vacs) && s++ < 60) d = ad(d, 1); return d2s(d); }
function autoProgress(task, wd, sh, vacs = []) { const now = new Date(); now.setHours(0, 0, 0, 0); const s = pd(task.start), e = pd(task.end), tot = calcWD(task.start, task.end, wd, sh, vacs); if (now < s) return { pct: 0, elapsed: 0, total: tot }; if (now > e) return { pct: 100, elapsed: tot, total: tot }; const el = Math.min(tot, calcWD(task.start, d2s(now), wd, sh, vacs)); return { pct: tot > 0 ? Math.round(el / tot * 100) : 0, elapsed: el, total: tot }; }
function moveSnap(os, oe, delta, wd, sh, vacs = []) { const w = calcWD(os, oe, wd, sh, vacs), ns = snap(d2s(ad(pd(os), delta)), wd, sh, vacs); return { start: ns, end: addWD(ns, w, wd, sh, vacs) }; }
function rezEnd(os, oe, delta, wd, sh, vacs = []) { const raw = d2s(ad(pd(oe), delta)), min = addWD(os, 1, wd, sh, vacs); return snap(pd(raw) < pd(min) ? min : raw, wd, sh, vacs); }
function rezStart(os, oe, delta, wd, sh, vacs = []) { const raw = d2s(ad(pd(os), delta)), max = d2s(ad(pd(oe), -1)); return snap(pd(raw) >= pd(oe) ? max : raw, wd, sh, vacs); }

function distributeBalanced(candidates, perGroup) {
  const pg = Math.max(1, parseInt(perGroup) || 15);
  const total = candidates.length;
  const nbGroups = Math.ceil(total / pg);
  const baseSize = Math.floor(total / nbGroups);
  const remainder = total % nbGroups;
  const result = [];
  let idx = 0;
  for (let g = 1; g <= nbGroups; g++) {
    const size = g <= remainder ? baseSize + 1 : baseSize;
    for (let i = 0; i < size; i++) {
      result.push({ ...candidates[idx], groupe: g });
      idx++;
    }
  }
  return result;
}

const ZOOMS = [
  { label: "Demi-jour", days: 3, cw: 192, halfDay: true },
  { label: "Semaine", days: 7, cw: 96, halfDay: false },
  { label: "2 semaines", days: 14, cw: 52, halfDay: false },
  { label: "Mois", days: 30, cw: 28, halfDay: false },
  { label: "Trimestre", days: 90, cw: 13, halfDay: false },
];
const GCOLS = [
  { key: "group",  label: "Thème",      w: 260 },
  { key: "groupe", label: "Grp",        w: 48  },
  { key: "count",  label: "Cand.",      w: 48  },
  { key: "wdays",  label: "Jours",      w: 48  },
  { key: "start",  label: "Début",      w: 138 },
  { key: "prog",   label: "Avancement", w: 90  },
  { key: "end",    label: "Fin",        w: 138 }
];
const CHDR = { group: "flex-start", groupe: "center", wdays: "center", start: "center", prog: "flex-start", end: "center" };
const GTOT = GCOLS.reduce((s, c) => s + c.w, 0);
const RH = 34;
const C_STATUS = [{ key: "Reçu", ...T.tagGray }, { key: "En cours", ...T.tagYellow }, { key: "Retenu", ...T.tagGreen }, { key: "Refusé", ...T.tagRed }];
const DOC_TYPES = ["Contrat", "Rapport", "CV", "Facture", "Présentation", "Émargement", "Fiche technique", "Récapitulatif","Synthèse des coûts", "Autre"];
const DOC_ICON = { Contrat: FileText, Rapport: BarChart2, CV: User, Facture: Receipt, Présentation: Presentation, Autre: File, Émargement: ClipboardCheck, "Fiche technique": ClipboardCheck, "Récapitulatif": ClipboardCheck, "Synthèse des coûts": BarChart2,};
const DOC_COLOR = { Contrat: "#337ea9", Rapport: "#9065b0", CV: "#448361", Facture: "#cb912f", Présentation: "#c14c8a", Autre: "#787774", Émargement: "#448361", "Fiche technique": "#d9730d", "Récapitulatif": "#0f7ddb","Synthèse des coûts": "#448361", };
function DocIcon({ type, size = 15, style = {} }) { const Icon = DOC_ICON[type] || File; const color = DOC_COLOR[type] || "#787774"; return <Icon style={{ width: size, height: size, color, strokeWidth: 1.8, flexShrink: 0, ...style }} />; }
const DOC_STATUS = [{ key: "Reçu", ...T.tagGray }, { key: "En attente", ...T.tagYellow }, { key: "Validé", ...T.tagGreen }, { key: "Rejeté", ...T.tagRed }];

const NAV = [{ key: "overview", label: "Vue d'ensemble", Icon: LayoutDashboard }, { key: "gantt", label: "Planification", Icon: CalendarRange }, { key: "candidats", label: "Candidats", Icon: Users }, { key: "documents", label: "Documents", Icon: FolderOpen }];

function fmtRangeShort(ws) { if (!ws) return ""; if (ws.startDate && ws.endDate) { const s = pd(ws.startDate), e = pd(ws.endDate); return `${String(s.getDate()).padStart(2, "0")}/${String(s.getMonth() + 1).padStart(2, "0")} → ${String(e.getDate()).padStart(2, "0")}/${String(e.getMonth() + 1).padStart(2, "0")}/${e.getFullYear().toString().slice(-2)}`; } return ""; }
function fmtRange(ws) { if (!ws) return ""; if (ws.startDate && ws.endDate) return `${fmtFr(ws.startDate)} → ${fmtFr(ws.endDate)}`; return ""; }

// ═══════════════════════════════════════════════════════════════
// MOTEUR DE CONFLITS v3 — Chevauchements + Fériés + WE + Congés
// ═══════════════════════════════════════════════════════════════

/** Retourne toutes les dates calendaires entre start et end inclus */
// Cache global pour getDatesInRange — évite de recalculer les mêmes plages
const _dateRangeCache = new Map();
function getDatesInRange(startStr, endStr) {
  const key = startStr + "_" + endStr;
  if (_dateRangeCache.has(key)) return _dateRangeCache.get(key);
  const dates = [];
  let ts = pd(startStr).getTime();
  const endTs = pd(endStr).getTime();
  while (ts <= endTs) { dates.push(d2s(new Date(ts))); ts += 86400000; }
  _dateRangeCache.set(key, dates);
  if (_dateRangeCache.size > 500) _dateRangeCache.delete(_dateRangeCache.keys().next().value);
  return dates;
}
 
function detectScheduleConflictsV3(result, wd = [6, 0], sh = true, vacs = []) {
  // Grouper sessions par candidat (même logique que MultiBase)
  const byC = {};
  result.forEach(r => {
    if (!r.start || !r.end) return;
    const mat = String(r.matricule || "").trim();
    const validMat = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
    const key = validMat
      ? mat.toLowerCase()
      : `${String(r.nom || "").trim().toLowerCase()}__${String(r.prenom || "").trim().toLowerCase()}`;
    if (!byC[key]) byC[key] = { nom: r.nom, prenom: r.prenom, matricule: r.matricule || "", sessions: [], _k: new Set() };
    const sk = `${r.theme}||${String(r.groupe)}`;
    if (!byC[key]._k.has(sk)) {
      byC[key]._k.add(sk);
      byC[key].sessions.push({ theme: r.theme, groupe: r.groupe, start: r.start, end: r.end });
    }
  });
 
  const wdSet = new Set(wd);
  const vacMap = new Map();
  vacs.forEach(v => {
    if (!v.start || !v.end) return;
    let ts = pd(v.start).getTime();
    const eTs = pd(v.end).getTime();
    while (ts <= eTs) { const ds = d2s(new Date(ts)); if (!vacMap.has(ds)) vacMap.set(ds, []); vacMap.get(ds).push(v.label || "Congé"); ts += 86400000; }
  });
 
  const all = [];
  Object.values(byC).forEach(({ nom, prenom, matricule, sessions }) => {
    const cc = [];
    const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
 
    // chevauchements
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start > sorted[i].end) break;
        cc.push({ type:"overlap", theme:sorted[j].theme, groupe:sorted[j].groupe, start:sorted[j].start, end:sorted[j].end, conflictsWith:sorted[i], description:`Chevauchement avec "${sorted[i].theme}" Grp${sorted[i].groupe} (${fmt(sorted[i].start)}→${fmt(sorted[i].end)})` });
      }
    }
 
    // fériés / WE / congés
    sorted.forEach(sess => {
      const dates = getDatesInRange(sess.start, sess.end);
      const hDates = [], wDates = [], vDates = [];
      dates.forEach(ds => {
        const dow = pd(ds).getDay();
        if (wdSet.has(dow)) wDates.push(ds);
        if (sh && HMAP[ds]) hDates.push(ds);
        if (vacMap.has(ds)) vDates.push(ds);
      });
 
      if (hDates.length > 0) {
        const ouv = hDates.filter(ds => !wd.includes(pd(ds).getDay()));
        if (ouv.length > 0) cc.push({ type:"holiday", theme:sess.theme, groupe:sess.groupe, start:sess.start, end:sess.end, offendingDates:ouv, description:`${ouv.length} jour(s) férié(s) : ${ouv.slice(0,2).map(ds=>`${fmt(ds)} — ${HMAP[ds]?.title}`).join(", ")}${ouv.length>2?` +${ouv.length-2} autres`:""}` });
      }
      if (wDates.length > 0 && wDates.length === dates.length)
        cc.push({ type:"weekend", theme:sess.theme, groupe:sess.groupe, start:sess.start, end:sess.end, offendingDates:wDates, description:`Session entièrement sur des week-ends (${wDates.length}j)` });
      if (vDates.length > 0) {
        const ouv = vDates.filter(ds => !wd.includes(pd(ds).getDay()) && !(sh && HMAP[ds]));
        if (ouv.length > 0) {
          const labs = [...new Set(ouv.flatMap(ds => vacMap.get(ds) || []))];
          cc.push({ type:"vacation", theme:sess.theme, groupe:sess.groupe, start:sess.start, end:sess.end, offendingDates:ouv, description:`${ouv.length}j en congé : ${labs.join(", ")}` });
        }
      }
    });
 
    if (cc.length > 0) all.push({ nom, prenom, matricule, conflicts: cc, sessions: sorted });
  });
  return all;
}

// ═══════════════════════════════════════════════════════════════
// HOOK CONFLITS v4 — Cohérent avec MultiBaseImportWizard
// Détecte : overlap, holiday, weekend, vacation, salle_pleine,
//           halfday (AM/PM), candidat_double
// ═══════════════════════════════════════════════════════════════
function useTaskConflicts(tasks, candidats, wd, sh, vacs) {
  const [liveConflicts,    setLiveConflicts]    = useState([]);
  const [conflictTypesMap, setConflictTypesMap] = useState({});
  const [halfDayKeys,      setHalfDayKeys]      = useState(new Set());
  const [candDoubleKeys,   setCandDoubleKeys]   = useState(new Set());
 
  // Clé de dépendance stable sans JSON.stringify
  const depsKey = useMemo(() => {
    let h = 0;
    tasks.forEach(t => {
      const s = `${t.id}:${t.start}:${t.end}:${t.slot||""}:${t.halfDay||""}`;
      for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) | 0;
    });
    return `${h}__${wd.join(",")}__${sh}__${vacs.map(v=>`${v.start}:${v.end}`).join("|")}`;
  }, [tasks, wd, sh, vacs]);
 
  useEffect(() => {
    if (!candidats.length || !tasks.length) {
      setLiveConflicts([]); setConflictTypesMap({});
      setHalfDayKeys(new Set()); setCandDoubleKeys(new Set());
      return;
    }
 
    const timer = setTimeout(() => {
      const run = () => {
        // ── Construire taskMap : clé → { start, end, halfDay, slot }
        // C'est la SOURCE DE VÉRITÉ pour les dates
        const taskMap = {};
        tasks.forEach(t => {
          const k = `${(t.group||"").trim()}||${String(t.groupe||"")}`;
          // Si plusieurs tasks pour la même clé, garder la plus récente (dernière)
          taskMap[k] = { start: t.start, end: t.end, halfDay: !!t.halfDay, slot: t.slot || null };
        });
 
        // ── Sessions virtuelles : candidats DB + dates des tasks
        const virtual = [];
        candidats.forEach(c => {
          if (!c.theme || !c.groupe) return;
          const k = `${c.theme.trim()}||${String(c.groupe)}`;
          const slot = taskMap[k];
          // Priorité : dates task > dates candidat (dateDebut/dateFin)
          const start = slot?.start || c.dateDebut || "";
          const end   = slot?.end   || c.dateFin   || "";
          if (!start || !end) return;
          virtual.push({
            ...c,
            start, end,
            halfDay:   slot?.halfDay ?? c.halfDay ?? false,
            slot:      slot?.slot    ?? c.slot    ?? null,
            lieu:      c.lieu    || (c.extraData instanceof Map ? c.extraData.get("lieu")    : c.extraData?.lieu)    || "",
            cabinet:   c.cabinet || (c.extraData instanceof Map ? c.extraData.get("cabinet") : c.extraData?.cabinet) || "",
            nbrEspace: c.nbrEspace || (c.extraData instanceof Map ? Number(c.extraData.get("nbrEspace")) : Number(c.extraData?.nbrEspace)) || 1,
          });
        });
 
        // ── v3 : overlap / holiday / weekend / vacation
        const v3 = detectScheduleConflictsV3(virtual, wd, sh, vacs);
 
        // ── Index lieu → salle pleine
        const lieuIndex = {}, groupLieuKey = {}, lieuCap = {};
        virtual.forEach(r => {
          const gKey    = `${r.theme.trim()}||${r.groupe}`;
          const lieuKey = [r.lieu, r.cabinet].filter(Boolean).join("||") || "default";
          groupLieuKey[gKey] = lieuKey;
          lieuCap[lieuKey]   = Math.max(lieuCap[lieuKey] || 1, Number(r.nbrEspace) || 1);
          if (!lieuIndex[lieuKey]) lieuIndex[lieuKey] = [];
          if (!lieuIndex[lieuKey].find(x => x.key === gKey))
            lieuIndex[lieuKey].push({ key: gKey, start: r.start, end: r.end, halfDay: r.halfDay, slot: r.slot });
        });
        const overlapCount = (gKey, lieuKey) => {
          const peers = lieuIndex[lieuKey] || [];
          const me    = peers.find(x => x.key === gKey);
          if (!me?.start) return 0;
          return peers.filter(p => {
            if (p.key === gKey || !p.start) return false;
            if (!(p.start <= me.end && p.end >= me.start)) return false;
            if (me.halfDay && p.halfDay) return me.slot === p.slot;
            return true;
          }).length + 1;
        };
 
       // ── Demi-journée double AM/PM
const newHalfKeys = new Set();
const byDateSlot  = {};
tasks.forEach(t => {
  if (!t.halfDay || !t.start) return;
  const dk = `${t.start}||${t.slot || "matin"}`;
  if (!byDateSlot[dk]) byDateSlot[dk] = [];
  
  // Utilisons une clé propre sans espaces cachés
  const groupKey = `${(t.group||"").trim()}||${String(t.groupe||"").trim()}`;
  byDateSlot[dk].push(groupKey);
});

Object.values(byDateSlot).forEach(keys => { 
  if (keys.length > 1) keys.forEach(k => newHalfKeys.add(k)); 
});
 
        // ── Candidat double (même candidat, 2 formations simultanées)
        const newCandKeys = new Set();
        const byCand      = {};
        virtual.forEach(r => {
          const mat = (r.matricule || "").trim().toLowerCase();
          const vM  = mat.length > 3 && mat !== "en cours de recrutement";
          const cId = vM ? `mat:${mat}` : `np:${String(r.nom||"").toLowerCase()}__${String(r.prenom||"").toLowerCase()}`;
          if (!byCand[cId]) byCand[cId] = [];
          byCand[cId].push({ gKey:`${r.theme.trim()}||${r.groupe}`, start:r.start, end:r.end||r.start, halfDay:r.halfDay, slot:r.slot });
        });
        Object.values(byCand).forEach(sessions => {
          if (sessions.length < 2) return;
          for (let i = 0; i < sessions.length; i++) {
            for (let j = i + 1; j < sessions.length; j++) {
              const a = sessions[i], b = sessions[j];
              if (a.gKey === b.gKey) continue;
              if (!(a.start <= b.end && b.start <= a.end)) continue;
              if (a.halfDay && b.halfDay && a.slot !== b.slot) continue;
              newCandKeys.add(a.gKey); newCandKeys.add(b.gKey);
            }
          }
        });
 
        // ── Construire conflictTypesMap
        const ctMap = {};
        const addT  = (key, type) => { if (!ctMap[key]) ctMap[key] = new Set(); ctMap[key].add(type); };
 
        v3.forEach(cf => {
          cf.conflicts.forEach(c => {
            const key     = `${c.theme}||${c.groupe}`;
            const lieuKey = groupLieuKey[key] || "default";
            const cap     = lieuCap[lieuKey] || 1;
            if (c.type === "overlap") {
              if (overlapCount(key, lieuKey) > cap) addT(key, "salle_pleine");
              // pas d'ajout "overlap" pur ici — couvert par candidat_double ou salle_pleine
            } else {
              addT(key, c.type);
            }
          });
        });
        Object.entries(groupLieuKey).forEach(([gKey, lieuKey]) => {
          if (overlapCount(gKey, lieuKey) > (lieuCap[lieuKey] || 1)) addT(gKey, "salle_pleine");
        });
        newHalfKeys.forEach(k  => addT(k, "halfday"));
        newCandKeys.forEach(k  => addT(k, "candidat_double"));
 
        setLiveConflicts(v3);
        setConflictTypesMap(ctMap);
        setHalfDayKeys(newHalfKeys);
        setCandDoubleKeys(newCandKeys);
      };
 
      if (typeof requestIdleCallback !== "undefined") requestIdleCallback(run, { timeout: 1000 });
      else run();
    }, 500);
 
    return () => clearTimeout(timer);
  }, [depsKey, candidats]); // candidats comme dépendance stable
 
  const liveConflictTaskKeys = useMemo(() => new Set(Object.keys(conflictTypesMap)), [conflictTypesMap]);
  const conflictsByType = useMemo(() => {
    const c = { overlap:0, holiday:0, weekend:0, vacation:0, salle_pleine:0, halfday:0, candidat_double:0 };
    Object.values(conflictTypesMap).forEach(types => types.forEach(t => { c[t] = (c[t] || 0) + 1; }));
    return c;
  }, [conflictTypesMap]);
 
  return { liveConflicts, liveConflictTaskKeys, conflictsByType, conflictTypesMap, halfDayKeys, candDoubleKeys };
}

// ── Bannière de conflits améliorée ───────────────────────────
function ConflictBanner({
  liveConflicts = [],
  roomConflictDetails = [],
  conflictTypesMap = {},
  onAutoResolve,
  onDismiss,
  liveResolving,
}) {
  const groupsInConflict = Object.keys(conflictTypesMap).length;
  const totalAlerts = groupsInConflict + liveConflicts.length + roomConflictDetails.length;

  const typeLabel = (type) => {
    if (type === 'holiday')         return 'Jour férié';
    if (type === 'weekend')         return 'Weekend';
    if (type === 'halfday')         return 'Conflit AM/PM';
    if (type === 'salle_pleine')    return 'Capacité salle';
    if (type === 'vacation')        return 'Congés';
    if (type === 'candidat_double') return 'Candidat déjà occupé';
    return type;
  };

  const S = {
    wrap: {
      border: '0.5px solid #fca5a5',
      borderRadius: 8,
      background: '#fff5f5',
      overflow: 'hidden',
      marginBottom: 16,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      gap: 12,
    },
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    },
    title: {
      fontSize: 12,
      fontWeight: 500,
      color: '#dc2626',
    },
    btnPrimary: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 4,
      border: '0.5px solid #37352f',
      background: '#37352f',
      color: '#fff',
      cursor: 'pointer',
    },
    btnSecondary: {
      fontSize: 11,
      fontWeight: 400,
      padding: '4px 10px',
      borderRadius: 4,
      border: '0.5px solid #fca5a5',
      background: 'transparent',
      color: '#dc2626',
      cursor: 'pointer',
    },
    section: {
      borderTop: '0.5px solid #fca5a5',
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: 600,
      color: '#dc2626',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    },
    row: {
      background: '#fff',
      border: '0.5px solid #e5e5e5',
      borderRadius: 6,
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    rowText: {
      fontSize: 12,
      color: '#37352f',
    },
    rowTextMuted: {
      fontSize: 12,
      color: '#37352f',
      fontWeight: 400,
    },
    badgeWrap: {
      display: 'flex',
      gap: 4,
      flexWrap: 'wrap',
      flexShrink: 0,
    },
    badge: {
      fontSize: 10,
      fontWeight: 500,
      background: '#fee2e2',
      color: '#b91c1c',
      padding: '2px 7px',
      borderRadius: 3,
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 6,
    },
  };

  return (
    <div style={S.wrap}>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <AlertCircle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }} />
          <span style={S.title}>
            {totalAlerts} alerte{totalAlerts > 1 ? 's' : ''} de planification détectée{totalAlerts > 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onAutoResolve} disabled={liveResolving} style={S.btnPrimary}>
            {liveResolving
              ? <Spinner size={12} color="#fff" />
              : <Wand2 style={{ width: 12, height: 12 }} />}
            Résoudre auto
          </button>
          <button onClick={onDismiss} style={S.btnSecondary}>Masquer</button>
        </div>
      </div>

      {/* Section 1 — Candidats en double */}
      {liveConflicts.length > 0 && (
        <div style={S.section}>
          <span style={S.sectionLabel}>Candidats en double</span>
          {liveConflicts.map((cf, i) => (
            <div key={i} style={S.row}>
              <Users style={{ width: 13, height: 13, color: '#9ca3af', flexShrink: 0 }} />
              <span style={{ ...S.rowText, flex: 1 }}>
                <strong>{cf.nom} {cf.prenom}</strong> — {cf.conflicts[0]?.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Section 2 — Alertes par groupe */}
      {Object.keys(conflictTypesMap).length > 0 && (
        <div style={S.section}>
          <span style={S.sectionLabel}>Alertes par groupe</span>
          <div style={S.grid}>
            {Object.entries(conflictTypesMap).map(([groupKey, types]) => {
              const [theme, grp] = groupKey.split('||');
              return (
                <div key={groupKey} style={S.row}>
                  <span style={{ fontSize: 12, color: '#37352f', fontWeight: 500 }}>
                    {theme} <span style={{ color: '#9ca3af', fontWeight: 400 }}>G{grp}</span>
                  </span>
                  <div style={S.badgeWrap}>
                    {Array.from(types).map(type => (
                      <span key={type} style={S.badge}>{typeLabel(type)}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 3 — Capacité des salles */}
      {roomConflictDetails.length > 0 && (
        <div style={S.section}>
          <span style={S.sectionLabel}>Capacité des salles</span>
          {roomConflictDetails.map((prob, i) => (
            <div key={i} style={S.row}>
              <span style={S.rowText}>
                Lieu <strong>{prob.lieu}</strong> : capacité {prob.cap} dépassée par{' '}
                <strong>{prob.group} (G{prob.groupeNo})</strong>
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sidebar, WsModal, Overview — inchangés
// ─────────────────────────────────────────────────────────────

function Sidebar({ workspaces, activeWs, onSelectWs, section, onSection, onCreateWs, open, apiOnline, currentUser, onLogout }) {
  const [wsOpen, setWsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropRef = useRef(null);
  const userMenuRef = useRef(null);
  const ws = workspaces.find(w => w.id === activeWs);
  useEffect(() => { if (!wsOpen) return; const h = e => { if (dropRef.current && !dropRef.current.contains(e.target)) setWsOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [wsOpen]);
  useEffect(() => { if (!userMenuOpen) return; const h = e => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [userMenuOpen]);
  const si = (active, onClick, children) => (<button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", height: 28, borderRadius: 4, border: "none", background: active ? T.sidebarSel : "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.08s", marginBottom: 1 }} onMouseEnter={e => { if (!active) e.currentTarget.style.background = T.sidebarHov; }} onMouseLeave={e => { e.currentTarget.style.background = active ? T.sidebarSel : "transparent"; }}>{children}</button>);
  const initials = currentUser ? (currentUser.displayName || currentUser.username || "?").slice(0, 2).toUpperCase() : "?";
  const displayName = currentUser ? (currentUser.displayName || currentUser.username) : "Utilisateur";
  const roleLabel = currentUser?.role === "admin" ? "Administrateur" : "Utilisateur";
  return (
    <aside style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 30, width: open ? 240 : 0, background: T.sidebarBg, borderRight: `1px solid ${T.sidebarBdr}`, overflow: "hidden", transition: "width 0.2s ease", flexShrink: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ width: 240, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div ref={dropRef} style={{ padding: "10px 8px 6px", position: "relative" }}>
          {si(false, () => setWsOpen(v => !v), <>
            <div style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: "rgba(55,53,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 style={{ width: 12, height: 12, color: T.sidebarText }} /></div>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.sidebarText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{ws ? ws.company : "Workspace"}</span>
            <ChevronDown style={{ width: 12, height: 12, color: T.sidebarSub, flexShrink: 0, transform: wsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </>)}
          {wsOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 8, right: 8, background: "#fff", borderRadius: 6, border: `1px solid ${T.sidebarBdr}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)", zIndex: 100, overflow: "hidden", padding: "4px" }}>
              {workspaces.map((w, index) => (
                <button key={w.id || `ws-${index}`} onClick={() => { onSelectWs(w.id); setWsOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, border: "none", background: w.id === activeWs ? T.sidebarSel : "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.08s" }} onMouseEnter={e => e.currentTarget.style.background = T.sidebarHov} onMouseLeave={e => e.currentTarget.style.background = w.id === activeWs ? T.sidebarSel : "transparent"}>
                  <div style={{ width: 18, height: 18, borderRadius: 3, background: "rgba(55,53,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 style={{ width: 10, height: 10, color: T.sidebarText }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.sidebarText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.company}</div>
                    <div style={{ fontSize: 11, color: T.sidebarSub }}>{fmtRangeShort(w)}</div>
                  </div>
                  {w.id === activeWs && <Check style={{ width: 12, height: 12, color: T.sidebarSub, flexShrink: 0 }} />}
                </button>
              ))}
              <div style={{ height: 1, background: T.sidebarBdr, margin: "4px 0" }} />
              <button onClick={() => { onCreateWs(); setWsOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", transition: "background 0.08s" }} onMouseEnter={e => e.currentTarget.style.background = T.sidebarHov} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Plus style={{ width: 14, height: 14, color: T.sidebarSub }} />
                <span style={{ fontSize: 13, color: T.sidebarSub }}>Ajouter un workspace</span>
              </button>
            </div>
          )}
        </div>
        <nav style={{ flex: 1, padding: "2px 8px", overflowY: "auto" }}>
          {NAV.map(item => { const active = section === item.key; const Icon = item.Icon; return si(active, () => onSection(item.key), <><Icon style={{ width: 15, height: 15, flexShrink: 0, color: active ? T.sidebarText : T.sidebarSub, strokeWidth: active ? 2.2 : 1.8 }} /><span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? T.sidebarText : T.sidebarSub, letterSpacing: "-0.003em" }}>{item.label}</span></>); })}
        </nav>
        {/* ── Footer : profil utilisateur ─────────────────────────────── */}
        <div style={{ borderTop: `1px solid ${T.sidebarBdr}` }}>
          {/* Indicateur API */}
          <div style={{ padding: "5px 16px", display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: apiOnline ? "#448361" : "#d44c47", flexShrink: 0, transition: "background 0.3s" }} />
            <span style={{ fontSize: 10, color: T.sidebarSub }}>{apiOnline ? "API connectée" : "Hors ligne"}</span>
          </div>
          {/* Profil utilisateur */}
          <div ref={userMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setUserMenuOpen(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "8px 12px 10px", border: "none", background: userMenuOpen ? T.sidebarHov : "transparent", cursor: "pointer", textAlign: "left", transition: "background 0.08s" }}
              onMouseEnter={e => { if (!userMenuOpen) e.currentTarget.style.background = T.sidebarHov; }}
              onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.background = "transparent"; }}
            >
              {/* Avatar */}
              <div style={{ width: 28, height: 28, borderRadius: "50%",
  background: "rgba(55,53,47,0.1)",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, fontSize: 11, fontWeight: 600, color: "#37352f",
  letterSpacing: "0.01em" }}>
  {initials}
</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.sidebarText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                <div style={{ fontSize: 10, color: T.sidebarSub }}>{roleLabel}</div>
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: T.sidebarSub, flexShrink: 0, transform: userMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {/* Menu déroulant */}
            {userMenuOpen && (
              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 8, right: 8, background: "#fff", borderRadius: 8, border: `1px solid ${T.sidebarBdr}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)", zIndex: 200, overflow: "hidden", padding: "6px" }}>
                {/* En-tête profil */}
                <div style={{ padding: "8px 10px 10px", borderBottom: `1px solid ${T.sidebarBdr}`, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%",
  background: "rgba(55,53,47,0.1)",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#37352f" }}>
  {initials}
</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.sidebarText }}>{displayName}</div>
                      <div style={{ fontSize: 11, color: T.sidebarSub }}>@{currentUser?.username}</div>
                    </div>
                  </div>
                </div>
                {/* Bouton Mon Profil */}
                <button
                  onClick={() => { setUserMenuOpen(false); onSection("profile"); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: T.sidebarText, fontSize: 13, fontWeight: 500, transition: "background 0.08s", marginBottom: 2 }}
                  onMouseEnter={e => e.currentTarget.style.background = T.sidebarHov}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <UserCog style={{ width: 14, height: 14 }} />
                  Mon Profil
                </button>
                {/* Bouton Déconnexion */}
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout && onLogout(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "#d44c47", fontSize: 13, fontWeight: 500, transition: "background 0.08s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(212,76,71,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function WsModal({ onClose, onCreate }) {
  const [company, setCompany] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const canCreate = company.trim() && startDate && endDate && startDate <= endDate;
  const create = async () => {
    if (!canCreate || saving) return; setSaving(true); await onCreate({ company: company.trim(), name: company.trim(), startDate, endDate });
    setSaving(false); onClose();
  };
  const iS = { width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 4, border: `1px solid rgba(55,53,47,0.2)`, fontSize: 13, color: T.pageText, outline: "none", fontFamily: "inherit", background: "#fff", transition: "box-shadow 0.12s,border-color 0.12s" };
  const fI = e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 2px ${T.accent}22`; };
  const fO = e => { e.target.style.borderColor = "rgba(55,53,47,0.2)"; e.target.style.boxShadow = "none"; };
  const dur = startDate && endDate && startDate <= endDate ? gdb(pd(startDate), pd(endDate)) + 1 : null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", width: "min(400px,95vw)", border: `1px solid rgba(55,53,47,0.13)`, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: T.pageText, letterSpacing: "-0.02em" }}>Nouveau workspace</span>
          <button onClick={onClose} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub }}><X style={{ width: 14, height: 14 }} /></button>
        </div>
        <div style={{ padding: "18px 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Entreprise / Client</div>
            <input autoFocus value={company} onChange={e => setCompany(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} placeholder="Ex: TechCorp Maroc" style={iS} onFocus={fI} onBlur={fO} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Période</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.pageTer, marginBottom: 4 }}>Début</div><input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(""); }} style={iS} onFocus={fI} onBlur={fO} /></div>
              <div style={{ paddingBottom: 9, color: T.pageTer, fontSize: 13 }}>→</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: T.pageTer, marginBottom: 4 }}>Fin</div><input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} style={iS} onFocus={fI} onBlur={fO} /></div>
            </div>
            {dur && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8, padding: "5px 10px", borderRadius: 4, background: "rgba(55,53,47,0.04)", border: `1px solid ${T.pageBdr}`, width: "fit-content" }}><CalendarRange style={{ width: 12, height: 12, color: T.pageSub }} /><span style={{ fontSize: 12, color: T.pageSub, fontWeight: 500 }}>{dur} jour{dur > 1 ? "s" : ""}</span></div>}
          </div>
          <button onClick={create} disabled={!canCreate || saving} style={{ width: "100%", padding: "9px", fontSize: 14, fontWeight: 600, color: "#fff", background: canCreate && !saving ? "#37352f" : "#ccc", border: "none", borderRadius: 4, cursor: canCreate && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving && <Spinner size={14} color="#fff" />}Créer le workspace
          </button>
        </div>
      </div>
    </div>
  );
}

function Overview({ ws, tasks, candidats, documents, onSection, loading, onDeleteWs, onUpdateWs }) {
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [editing, setEditing]             = useState(false);
  const [editForm, setEditForm]           = useState({ company: "", startDate: "", endDate: "" });
  const [saving, setSaving]               = useState(false);

  // ── Export modal ─────────────────────────────────────────────
  const [showExport, setShowExport]       = useState(false);
  const [exportBase, setExportBase]       = useState(null);   // { exportedAt, rows }
  const [allCols, setAllCols]             = useState([]);      // toutes les colonnes disponibles
  const [selectedCols, setSelectedCols]   = useState([]);      // colonnes cochées, dans l'ordre voulu
  const [dragIdx, setDragIdx]             = useState(null);
  const [exporting, setExporting]         = useState(false);

  // Colonnes "connues" avec label lisible
  const KNOWN_LABELS = {
  nom: "Nom", prenom: "Prénom", matricule: "Matricule",
  theme: "Formation", groupe: "Groupe", heures: "Heures",
  jours: "Jours",
  halfDay: "Demi-journée",       // ← AJOUTÉ
  slot:    "Créneau",            // ← AJOUTÉ (matin / après-midi)
  dateDebut: "Date début", dateFin: "Date fin",
  statut: "Statut", departement: "Département", csp: "CSP",
  domaine: "Domaine", objectif: "Objectif", contenu: "Contenu",
  niveau: "Niveau", publicCible: "Public cible",
  typeFormation: "Type formation", cabinet: "Cabinet",
  formateur: "Formateur", lieu: "Lieu", cout: "Coût",
  cnss: "N° CNSS", contact: "Contact", nbrEspace: "Capacité",
  cout_calcule: "Coût Calculé (Total/Pers)",
  mois_planif: "Mois de planification"
};

const handleSafeCloseExport = () => {
  // On demande confirmation si l'utilisateur a sélectionné des colonnes
  if (selectedCols.length > 0) {
    setShowExportConfirm(true);
  } else {
    setShowExport(false);
  }
};

const saveColumnOrder = async (cols) => {
  if (!ws?.id) return;
  try {
    await apiFetch(`/workspaces/${ws.id}/export-base`, {
      method: "PATCH",
      body: { exportBase: { columnOrder: cols } }
    });
  } catch (e) {
    console.error("Erreur sauvegarde ordre:", e);
  }
};

  const openExport = async () => {
  try {
    const response = await apiFetch(`/workspaces/${ws?.id}/export-base`);
    const data = response.data || response;

    if (!data || !data.rows || data.rows.length === 0) {
      alert("Données d'export indisponibles.");
      return;
    }

    setExportBase(data);

    // Initialisation des colonnes
    const colSet = new Set();
    data.rows.forEach(r => Object.keys(r).forEach(k => colSet.add(k)));
    colSet.add("cout_calcule"); 
    colSet.add("mois_planif");

    const cols = Array.from(colSet).map(k => ({
      key: k,
      label: KNOWN_LABELS[k] || k,
      known: !!KNOWN_LABELS[k],
    }));
    setAllCols(cols);

    // Charger l'ordre depuis la DB ou défaut
    if (data.columnOrder && data.columnOrder.length > 0) {
      setSelectedCols(data.columnOrder.filter(k => colSet.has(k)));
    } else {
      const defaultOrder = ["nom","prenom","matricule","theme","groupe","heures","jours","dateDebut","dateFin","statut"];
      setSelectedCols(defaultOrder.filter(k => colSet.has(k)));
    }
    
    setShowExport(true);
  } catch (err) {
    alert("Erreur lors du chargement des données d'export.");
  }
};

  const toggleCol = (key) => {
  setSelectedCols(prev => {
    const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
    saveColumnOrder(next); // Sauvegarde automatique
    return next;
  });
};

  // Drag-and-drop pour réordonner selectedCols
  const onDragStart = (e, idx) => { setDragIdx(idx); e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, idx) => {
  e.preventDefault();
  if (dragIdx === null || dragIdx === idx) return;
  setSelectedCols(prev => {
    const next = [...prev];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    saveColumnOrder(next); // Sauvegarde automatique de la nouvelle position
    return next;
  });
  setDragIdx(idx);
};
  const onDragEnd = () => setDragIdx(null);

  const doExport = async () => {
  if (!exportBase || !selectedCols.length) return;
  setExporting(true);
  try {
    const XLSX = await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs");

    // 1. Calcul des effectifs par groupe pour la formule du coût
    const groupCounts = {};
    exportBase.rows.forEach(r => {
      const key = `${r.theme}||${r.groupe}`;
      groupCounts[key] = (groupCounts[key] || 0) + 1;
    });

    const numericCols = ["heures", "jours", "groupe", "cout", "nbrEspace", "cout_unitaire"];

    // Helper : convertit "YYYY-MM-DD" en numéro de série Excel (entier pur = pas d'heure)
    const dateToExcelSerial = (str) => {
      const parts = str.split("-");
      if (parts.length !== 3) return str;
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      // Epoch Excel = 1er janvier 1900 (avec bug leap year 1900 inclus)
      const utc = Date.UTC(year, month, day);
      const excelEpoch = Date.UTC(1899, 11, 30); // 30 déc 1899
      return Math.round((utc - excelEpoch) / 86400000); // entier = date pure sans heure
    };

    // 2. Préparation des en-têtes
    const headers = selectedCols.map(k => {
      const col = allCols.find(c => c.key === k);
      return col ? col.label : (KNOWN_LABELS[k] || k);
    });

    // 3. Transformation des données pour Excel
    const rows = exportBase.rows.map(r =>
      selectedCols.map(k => {
        let value = r[k];

        // --- MOIS DE PLANIFICATION ---
        if (k === "mois_planif") {
          if (!r.dateDebut) return "Non planifié";
          const parts = r.dateDebut.split("-");
          if (parts.length !== 3) return "Date invalide";
          return MFR[parseInt(parts[1]) - 1];
        }

        // --- COUT CALCULÉ ---
        if (k === "cout_calcule") {
  const coutBase = parseFloat(String(r.cout || "0").replace(/\s/g, '').replace(',', '.')) || 0;
  const jours    = parseFloat(r.jours) || 0;
  const effectif = groupCounts[`${r.theme}||${r.groupe}`] || 1;

  return {
    f: `${coutBase}*${jours}/${effectif}`,
    t: 'n',
    z: '#,##0.00'
  };
}

if (k === "slot") {
      return value && value !== "" ? value : "Journée entière";
    }

        // --- DATES → numéro de série Excel entier (aucune heure) ---
        if ((k === "dateDebut" || k === "dateFin") && value) {
          return dateToExcelSerial(value);
        }

        // --- NOMBRES ---
        if (numericCols.includes(k)) {
          if (value === undefined || value === null || value === "") return 0;
          const num = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
          return isNaN(num) ? 0 : num;
        }

        // TEXTE STANDARD
        return value === undefined || value === null ? "" : value;
      })
    );

    // 4. Création de la feuille (sans cellDates, on gère manuellement)
    const wsXlsx = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // 5. Forcer le format date sur les colonnes dateDebut / dateFin
    selectedCols.forEach((colKey, index) => {
      const colLetter = XLSX.utils.encode_col(index);
      for (let i = 1; i <= rows.length; i++) {
        const cellRef = colLetter + (i + 1);
        if (!wsXlsx[cellRef]) continue;

        if (colKey === "dateDebut" || colKey === "dateFin") {
          wsXlsx[cellRef].t = 'n';          // type numérique
          wsXlsx[cellRef].z = 'dd/mm/yyyy'; // format date court français
        }

        if (colKey === "cout") {
  wsXlsx[cellRef].z = '#,##0.00';
}
if (colKey === "cout_calcule" && !wsXlsx[cellRef].f) {
  wsXlsx[cellRef].z = '#,##0.00';
}
      }
    });

    // 6. Largeur des colonnes
    wsXlsx["!cols"] = headers.map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsXlsx, "Base fusionnée");
    XLSX.writeFile(wb, `export_${ws.company.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);

  } catch (e) {
    console.error("Erreur Export:", e);
    alert("Erreur lors de l'export Excel.");
  }
  setExporting(false);
};

  // ── Styles ───────────────────────────────────────────────────
  const iS = { boxSizing: "border-box", padding: "7px 10px", borderRadius: 4, border: `1px solid rgba(55,53,47,0.2)`, fontSize: 13, color: T.pageText, outline: "none", fontFamily: "inherit", background: "#fff", transition: "border-color 0.12s,box-shadow 0.12s" };
  const fI = e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 2px ${T.accent}22`; };
  const fO = e => { e.target.style.borderColor = "rgba(55,53,47,0.2)"; e.target.style.boxShadow = "none"; };

  if (!ws) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 8 }}>
      <Building2 style={{ width: 40, height: 40, color: T.pageTer, strokeWidth: 1.4 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: T.pageText }}>Sélectionnez un workspace</div>
    </div>
  );
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: 10 }}>
      <Spinner size={20} color={T.accent} />
      <span style={{ fontSize: 14, color: T.pageSub }}>Chargement…</span>
    </div>
  );

  const done   = tasks.filter(t => { const now = new Date(); now.setHours(0,0,0,0); return pd(t.end) < now; }).length;
  const retained  = candidats.filter(c => c.statut === "Retenu").length;
  const validated = documents.filter(d => d.statut === "Validé").length;
  const uniqueCandidatsCount = (() => {
    const seen = new Set();
    candidats.forEach(c => {
      const mat = String(c.matricule || "").trim();
      const validMat = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
      seen.add(validMat ? mat.toLowerCase() : `${String(c.nom||"").trim().toLowerCase()}__${String(c.prenom||"").trim().toLowerCase()}`);
    });
    return seen.size;
  })();
  const divider = <div style={{ height: 1, background: T.pageBdr, margin: "32px 0" }} />;
  const dur = editForm.startDate && editForm.endDate && editForm.startDate <= editForm.endDate
    ? gdb(pd(editForm.startDate), pd(editForm.endDate)) + 1 : null;

  const handleDelete = async () => { setDeleting(true); await onDeleteWs(ws.id); setDeleting(false); setConfirmDelete(false); };
  const startEdit = () => { setEditForm({ company: ws.company||"", startDate: ws.startDate||"", endDate: ws.endDate||"" }); setEditing(true); };
  // Dans Overview
const saveEdit = async () => {
  if (!editForm.company.trim() || saving) return;
  setSaving(true);
  try {
    const response = await apiFetch(`/workspaces/${ws.id}`, { 
      method: "PUT", 
      body: { 
        company: editForm.company.trim(), 
        startDate: editForm.startDate, 
        endDate: editForm.endDate 
      } 
    });

    // ÉTAPE CRUCIALE : On extrait les données et on normalise
    const updatedData = response.data || response;
    
    // On appelle la fonction du parent
    onUpdateWs(updatedData); 
    
    setEditing(false);
  } catch (err) {
    console.error("Erreur saveEdit:", err);
    showToast("Erreur lors de la modification");
  }
  setSaving(false);
};

  // ── Groupes de colonnes pour le picker ───────────────────────
  // COL_GROUPS_EXPORT — ajouter halfDay et slot dans le groupe Formation
const COL_GROUPS_EXPORT = [
  { label: "Identité",  keys: ["nom","prenom","matricule","departement","csp"] },
  { label: "Formation", keys: [
      "theme","groupe","heures","jours",
      "halfDay","slot",                    // ← AJOUTÉ
      "dateDebut","dateFin","statut",
      "domaine","objectif","contenu","niveau","publicCible","typeFormation",
      "dateDebut","dateFin","mois_planif", 
    ]
  },
{ label: "Cabinet", keys: ["cabinet", "formateur", "lieu", "cout", "cout_calcule", "cnss", "contact", "nbrEspace"] },
];
  // Colonnes supplémentaires non-mappées (dynamiques depuis Excel)
  const knownKeys  = new Set(Object.keys(KNOWN_LABELS));
  const extraCols  = allCols.filter(c => !knownKeys.has(c.key));

  return (
    <div style={{ padding: "80px 96px 80px", maxWidth: 900 }}>

      {/* ── Modal suppression ── */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", width: "min(420px,95vw)", border: `1px solid rgba(55,53,47,0.13)`, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(212,76,71,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trash2 style={{ width: 16, height: 16, color: "#d44c47" }} /></div>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.pageText, letterSpacing: "-0.02em" }}>Supprimer le workspace</span>
              <button onClick={() => setConfirmDelete(false)} style={{ marginLeft: "auto", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub }}><X style={{ width: 14, height: 14 }} /></button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p style={{ fontSize: 14, color: T.pageText, margin: "0 0 8px", lineHeight: 1.6 }}>Vous êtes sur le point de supprimer <strong>"{ws.company}"</strong>.</p>
              <p style={{ fontSize: 13, color: T.pageSub, margin: "0 0 20px", lineHeight: 1.6 }}>Cette action supprimera définitivement <strong>{tasks.length} tâche{tasks.length!==1?"s":""}</strong>, <strong>{uniqueCandidatsCount} candidat{uniqueCandidatsCount!==1?"s":""}</strong> et <strong>{documents.length} document{documents.length!==1?"s":""}</strong>. Elle est irréversible.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: "7px 16px", fontSize: 13, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                <button onClick={handleDelete} disabled={deleting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#d44c47", border: "none", borderRadius: 4, cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.7 : 1 }}>
                  {deleting ? <Spinner size={13} color="#fff" /> : <Trash2 style={{ width: 13, height: 13 }} />}{deleting ? "Suppression…" : "Supprimer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODAL EXPORT EXCEL
      ══════════════════════════════════════════════════════════ */}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onMouseDown={e => { if (e.target === e.currentTarget) handleSafeCloseExport(); }}>
            {showExportConfirm && (
      <ConfirmModal 
        title="Fermer l'exportateur ?"
        message="Vos réglages de colonnes et l'ordre choisi ne seront pas appliqués si vous quittez maintenant."
        confirmLabel="Fermer l'export"
        cancelLabel="Continuer"
        onConfirm={() => {
          setShowExportConfirm(false);
          setShowExport(false);
        }}
        onCancel={() => setShowExportConfirm(false)}
      />
    )}
          <div style={{ background: "#fff", borderRadius: 8,   width: "min(1200px, 98vw)", maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid rgba(55,53,47,0.12)` }}>

            {/* Header */}
            <div style={{ padding: "16px 22px 14px", borderBottom: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(68,131,97,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileUp style={{ width: 16, height: 16, color: "#448361" }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.pageText }}>Exporter la base fusionnée</div>
                <div style={{ fontSize: 11, color: T.pageSub, marginTop: 1 }}>
                  {exportBase?.rows?.length || 0} lignes · Importé le {exportBase?.exportedAt ? new Date(exportBase.exportedAt).toLocaleDateString("fr-FR") : "—"}
                </div>
              </div>
              <button onClick={handleSafeCloseExport} style={{ marginLeft: "auto", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body — deux colonnes */}
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "350px 1fr", gap: 0 }}>

              {/* Colonne gauche — picker */}
              <div style={{ padding: "18px 20px", borderRight: `1px solid ${T.pageBdr}`, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Colonnes disponibles
                </div>

                {/* Actions rapides */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setSelectedCols(allCols.map(c => c.key))}
                    style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, color: T.accent, background: `${T.accent}0d`, border: `1px solid ${T.accent}30`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                    Tout sélectionner
                  </button>
                  <button onClick={() => setSelectedCols([])}
                    style={{ flex: 1, padding: "5px 0", fontSize: 11, color: T.pageSub, background: "transparent", border: `1px solid ${T.pageBdr}`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                    Tout désélectionner
                  </button>
                </div>

                {/* Groupes de colonnes connues */}
                {COL_GROUPS_EXPORT.map(grp => {
                  const grpCols = grp.keys.filter(k => allCols.find(c => c.key === k));
                  if (!grpCols.length) return null;
                  return (
                    <div key={grp.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, paddingBottom: 4, borderBottom: `1px solid ${T.pageBdr}` }}>
                        {grp.label}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {grpCols.map(k => {
                          const col = allCols.find(c => c.key === k);
                          const on  = selectedCols.includes(k);
                          return (
                            <div key={k} onClick={() => toggleCol(k)}
                              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4, cursor: "pointer", background: on ? `${T.accent}08` : "transparent", transition: "background 0.08s" }}
                              onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(55,53,47,0.03)"; }}
                              onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                              <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${on ? T.accent : "rgba(55,53,47,0.25)"}`, background: on ? T.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {on && <Check style={{ width: 9, height: 9, color: "#fff" }} />}
                              </div>
                              <span style={{ fontSize: 12, color: on ? T.pageText : T.pageSub, fontWeight: on ? 500 : 400 }}>
                                {col?.label || k}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Colonnes supplémentaires (non-mappées depuis Excel) */}
                {extraCols.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#9065b0", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, paddingBottom: 4, borderBottom: `1px solid rgba(144,101,176,0.2)` }}>
                      Colonnes Excel supplémentaires
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {extraCols.map(col => {
                        const on = selectedCols.includes(col.key);
                        return (
                          <div key={col.key} onClick={() => toggleCol(col.key)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 4, cursor: "pointer", background: on ? "rgba(144,101,176,0.08)" : "transparent" }}
                            onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(144,101,176,0.04)"; }}
                            onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${on ? "#9065b0" : "rgba(144,101,176,0.3)"}`, background: on ? "#9065b0" : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {on && <Check style={{ width: 9, height: 9, color: "#fff" }} />}
                            </div>
                            <span style={{ fontSize: 12, color: on ? T.pageText : T.pageSub, fontWeight: on ? 500 : 400 }}>
                              {col.label}
                            </span>
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(144,101,176,0.1)", color: "#9065b0", marginLeft: "auto", flexShrink: 0 }}>Excel</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Colonne droite — ordre + aperçu */}
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Ordre des colonnes
                  </div>
                  <span style={{ fontSize: 11, color: T.pageTer }}>
                    {selectedCols.length} colonne{selectedCols.length !== 1 ? "s" : ""} sélectionnée{selectedCols.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button 
  // Dans le bouton de reset de l'ordre :
onClick={() => {
  const defaultOrder = ["nom","prenom","matricule","theme","groupe","heures","jours","dateDebut","dateFin","statut"];
  const filteredDefault = defaultOrder.filter(k => allCols.find(c => c.key === k));
  setSelectedCols(filteredDefault);
  saveColumnOrder(filteredDefault); // Sauvegarde le reset en DB
}}
  style={{ fontSize: '10px', color: T.accent, background: 'none', border: 'none', cursor: 'pointer' }}
>
  Rétablir l'ordre par défaut
</button>

                {selectedCols.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", color: T.pageTer, fontSize: 12, fontStyle: "italic", border: `1px dashed ${T.pageBdr}`, borderRadius: 6 }}>
                    Sélectionnez des colonnes à gauche
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
                    {selectedCols.map((k, idx) => {
                      const col = allCols.find(c => c.key === k);
                      const isExtra = !knownKeys.has(k);
                      return (
                        <div key={k}
                          draggable
                          onDragStart={e => onDragStart(e, idx)}
                          onDragOver={e => onDragOver(e, idx)}
                          onDragEnd={onDragEnd}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: dragIdx === idx ? `${T.accent}08` : idx % 2 === 0 ? "#fff" : "rgba(55,53,47,0.015)", cursor: "grab", borderBottom: idx < selectedCols.length - 1 ? `1px solid ${T.pageBdr}` : "none", transition: "background 0.08s" }}>
                          {/* Grip */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, opacity: 0.35 }}>
                            <div style={{ width: 12, height: 1.5, background: T.pageText, borderRadius: 1 }} />
                            <div style={{ width: 12, height: 1.5, background: T.pageText, borderRadius: 1 }} />
                            <div style={{ width: 12, height: 1.5, background: T.pageText, borderRadius: 1 }} />
                          </div>
                          {/* Numéro */}
                          <span style={{ fontSize: 10, fontFamily: "monospace", color: T.pageTer, width: 18, textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                          {/* Label */}
                          <span style={{ flex: 1, fontSize: 12, color: T.pageText, fontWeight: 500 }}>{col?.label || k}</span>
                          {/* Badge Excel */}
                          {isExtra && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(144,101,176,0.1)", color: "#9065b0", flexShrink: 0 }}>Excel</span>
                          )}
                          {/* Supprimer */}
                          <button onClick={() => toggleCol(k)}
                            style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", color: T.pageTer, padding: 0, flexShrink: 0, borderRadius: 3 }}
                            title="Retirer">
                            <X style={{ width: 10, height: 10 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aperçu */}
                {/* Aperçu (Tableau de preview corrigé) */}
{selectedCols.length > 0 && exportBase?.rows?.length > 0 && (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
      Aperçu (3 premières lignes)
    </div>
    
    {/* Conteneur de scroll pour gérer les nombreuses colonnes */}
    <div style={{ 
      overflowX: "auto", 
      border: `1px solid ${T.pageBdr}`, 
      borderRadius: 6,
      background: "#fff" 
    }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: "100%", tableLayout: "fixed" }}>
        <thead>
          <tr style={{ background: "rgba(55,53,47,0.04)" }}>
            {selectedCols.map(k => {
              const col = allCols.find(c => c.key === k);
              return (
                <th key={k} style={{ 
                  padding: "8px 12px", 
                  fontWeight: 600, 
                  color: T.pageSub, 
                  textAlign: "left", 
                  whiteSpace: "nowrap", 
                  borderBottom: `1px solid ${T.pageBdr}`, 
                  borderRight: `1px solid ${T.pageBdr}50`,
                  fontSize: 10, 
                  textTransform: "uppercase", 
                  width: 140 // Largeur fixe pour l'alignement
                }}>
                  {col?.label || k}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {exportBase.rows.slice(0, 3).map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "rgba(55,53,47,0.015)" }}>
              {selectedCols.map(k => {
  let displayValue = row[k];
  
  // 1. LOGIQUE POUR LE MOIS DE PLANIFICATION
  // 1. LOGIQUE POUR LE MOIS DE PLANIFICATION (MOIS SEUL)
if (k === "mois_planif") {
  if (!row.dateDebut) {
    displayValue = <span style={{ color: T.pageTer }}>—</span>;
  } else {
    const d = new Date(row.dateDebut + "T00:00:00");
    // On n'affiche que le nom du mois
    displayValue = !isNaN(d.getTime()) ? MFR[d.getMonth()] : "Invalide";
  }
}

  // 2. LOGIQUE POUR LE COUT CALCULÉ
  else if (k === "cout_calcule") {
    const groupKey = `${row.theme}||${row.groupe}`;
    // On filtre les lignes pour trouver l'effectif réel de ce groupe
    const groupRows = exportBase.rows.filter(r => `${r.theme}||${r.groupe}` === groupKey);
    const coutBase = parseFloat(String(row.cout || "0").replace(/\s/g, '').replace(',', '.')) || 0;
    const jours = parseFloat(row.jours) || 0;
    const effectif = groupRows.length || 1;
    const calcul = Math.round(((coutBase * jours) / effectif) * 100) / 100;
    
    displayValue = calcul.toLocaleString('fr-FR', { minimumFractionDigits: 2 });
  }

  else if (k === "slot") {
    if (!displayValue || displayValue === "" || displayValue === "null") {
      displayValue = "Journée entière";
    }
  }

  // 3. LOGIQUE POUR LES DATES (Affichage jj/mm/aaaa)
  else if ((k === "dateDebut" || k === "dateFin") && displayValue && String(displayValue).includes('-')) {
    const [y, m, d] = String(displayValue).split('-');
    displayValue = `${d}/${m}/${y}`;
  }

  // 4. NETTOYAGE DES CHIFFRES SIMPLE (Suppression espaces/DH pour l'aperçu)
  else if (["cout", "cout_unitaire"].includes(k) && displayValue) {
    const num = parseFloat(String(displayValue).replace(/\s/g, '').replace(',', '.'));
    displayValue = !isNaN(num) ? num.toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : displayValue;
  }

  // RENDU DE LA CELLULE
  return (
    <td key={k} style={{ 
      padding: "8px 12px", 
      color: T.pageText, 
      whiteSpace: "nowrap", 
      overflow: "hidden", 
      textOverflow: "ellipsis", 
      borderBottom: `1px solid ${T.pageBdr}`,
      borderRight: `1px solid ${T.pageBdr}50`,
      width: 140, // Largeur fixe pour alignement avec les headers
      textAlign: "left"
    }} title={String(displayValue ?? "")}>
      {displayValue !== undefined && displayValue !== "" ? (
        displayValue
      ) : (
        <span style={{ color: T.pageTer, fontStyle: "italic" }}>—</span>
      )}
    </td>
  );
})}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div style={{ fontSize: 10, color: T.pageTer, marginTop: 6, fontStyle: "italic" }}>
      * Faites défiler horizontalement pour voir toutes les colonnes.
    </div>
  </div>
)}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 22px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: T.pageTer }}>
                {exportBase?.rows?.length || 0} lignes × {selectedCols.length} colonnes
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleSafeCloseExport}
                  style={{ padding: "7px 16px", fontSize: 13, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  Annuler
                </button>
                <button onClick={doExport} disabled={!selectedCols.length || exporting}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: !selectedCols.length || exporting ? "#ccc" : "#448361", border: "none", borderRadius: 4, cursor: !selectedCols.length || exporting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {exporting ? <Spinner size={13} color="#fff" /> : <FileUp style={{ width: 13, height: 13 }} />}
                  {exporting ? "Export…" : `Exporter .xlsx`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          CONTENU OVERVIEW
      ══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 8 }}>
        {editing ? (
          <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, background: "rgba(55,53,47,0.015)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>Modifier le workspace</div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 200px" }}>
                <div style={{ fontSize: 11, color: T.pageTer, marginBottom: 4 }}>Entreprise / Client</div>
                <input autoFocus value={editForm.company} onChange={e => setEditForm(p => ({ ...p, company: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                  style={{ ...iS, width: "100%", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", padding: "8px 12px", borderColor: T.accent, boxShadow: `0 0 0 2px ${T.accent}22` }} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 11, color: T.pageTer, marginBottom: 4 }}>Date de début</div>
                <input type="date" value={editForm.startDate}
                  onChange={e => { setEditForm(p => ({ ...p, startDate: e.target.value })); if (editForm.endDate && e.target.value > editForm.endDate) setEditForm(p => ({ ...p, endDate: "" })); }}
                  style={{ ...iS, width: "100%" }} onFocus={fI} onBlur={fO} />
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontSize: 11, color: T.pageTer, marginBottom: 4 }}>Date de fin</div>
                <input type="date" value={editForm.endDate} min={editForm.startDate || undefined}
                  onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
                  style={{ ...iS, width: "100%" }} onFocus={fI} onBlur={fO} />
              </div>
            </div>
            {dur && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 4, background: "rgba(55,53,47,0.04)", border: `1px solid ${T.pageBdr}`, width: "fit-content" }}>
                <CalendarRange style={{ width: 12, height: 12, color: T.pageSub }} />
                <span style={{ fontSize: 12, color: T.pageSub, fontWeight: 500 }}>{dur} jour{dur > 1 ? "s" : ""}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={saveEdit} disabled={saving || !editForm.company.trim()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: saving || !editForm.company.trim() ? "#ccc" : "#37352f", border: "none", borderRadius: 4, cursor: saving || !editForm.company.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? <Spinner size={13} color="#fff" /> : <Check style={{ width: 13, height: 13 }} />}{saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: "7px 14px", fontSize: 13, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: T.pageSub, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <CalendarRange style={{ width: 12, height: 12 }} />{fmtRange(ws)}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 40, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em", lineHeight: 1.1, margin: 0 }}>{ws.company}</h1>
                <div style={{ fontSize: 13, color: T.pageTer, marginTop: 8 }}>Créé le {new Date(ws.createdAt || Date.now()).toLocaleDateString("fr-FR")}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* ── BOUTON EXPORT ── */}
                {ws.hasExportBase && (
  <button onClick={openExport}
    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 500, color: "#448361", background: "rgba(68,131,97,0.06)", border: `1px solid rgba(68,131,97,0.3)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
    <FileUp style={{ width: 13, height: 13 }} /> Exporter Excel
  </button>
)}
                <button onClick={startEdit}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 500, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  <Edit2 style={{ width: 13, height: 13 }} /> Modifier
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 500, color: "#d44c47", background: "transparent", border: `1px solid rgba(212,76,71,0.3)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  <Trash2 style={{ width: 13, height: 13 }} /> Supprimer
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {divider}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, border: `1px solid ${T.pageBdr}`, borderRadius: 4, overflow: "hidden" }}>
        {[
          { Icon: CalendarRange, label: "Tâches planifiées", value: tasks.length, sub: `${done} terminée${done!==1?"s":""}`, key: "gantt" },
          { Icon: Users, label: "Candidats", value: uniqueCandidatsCount, sub: `${retained} retenu${retained!==1?"s":""}`, key: "candidats" },
          { Icon: FolderOpen, label: "Documents", value: documents.length, sub: `${validated} validé${validated!==1?"s":""}`, key: "documents" },
        ].map((s, i) => {
          const Icon = s.Icon;
          return (
            <button key={s.key} onClick={() => onSection(s.key)}
              style={{ padding: "24px", border: "none", background: "#fff", cursor: "pointer", textAlign: "left", borderRight: i < 2 ? `1px solid ${T.pageBdr}` : "none", transition: "background 0.08s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
              <div style={{ marginBottom: 12 }}><Icon style={{ width: 20, height: 20, color: T.pageSub, strokeWidth: 1.6 }} /></div>
              <div style={{ fontSize: 32, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: T.pageText, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: T.pageSub, marginTop: 2 }}>{s.sub}</div>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════
    DASHBOARD — métriques enrichies
══════════════════════════════════════════ */}
{divider}

{/* ── KPI secondaires ── */}
{(() => {
  const totalJours = tasks.reduce((s, t) => {
    if (!t.start || !t.end) return s;
    return s + calcWD(t.start, t.end, [6, 0], true, []);
  }, 0);

  const totalCout = candidats.reduce((s, c) => {
    const v = parseFloat(String(c.cout || "0").replace(/\s/g, "").replace(",", ".")) || 0;
    return s + v;
  }, 0);

  const uniqueThemes = [...new Set(tasks.map(t => t.group).filter(Boolean))];
  const uniqueGroupes = tasks.length;

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const startOfNextWeek = new Date(now);
  startOfNextWeek.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 || 7);
  const endOfNextWeek = new Date(startOfNextWeek);
  endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

  const inProgress = tasks.filter(t => {
    if (!t.start || !t.end) return false;
    return pd(t.start) <= now && pd(t.end) >= now;
  });
  const upcoming = tasks.filter(t => {
    if (!t.start) return false;
    const s = pd(t.start);
    return s > now && s <= endOfNextWeek;
  });

  const done = tasks.filter(t => t.end && pd(t.end) < now).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const avgPerCand = uniqueCandidatsCount > 0
    ? Math.round(totalCout / uniqueCandidatsCount)
    : 0;
  const avgPerDay = totalJours > 0
    ? Math.round(totalCout / totalJours)
    : 0;

  const cardS = {
    background: "rgba(55,53,47,0.03)", borderRadius: 8,
    padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
  };
  const bigNum = { fontSize: 24, fontWeight: 700, color: T.pageText, lineHeight: 1.1 };
  const lbl = { fontSize: 12, color: T.pageSub };
  const sub = { fontSize: 11, color: T.pageTer };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Ligne 1 : 4 KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
        {[
          { label: "Thèmes",        value: uniqueThemes.length,  sub: "formations distinctes" },
          { label: "Groupes",       value: uniqueGroupes,        sub: "groupes planifiés" },
          { label: "Bénéficiaires", value: uniqueCandidatsCount, sub: "candidats inscrits" },
          { label: "Jours formation", value: totalJours,         sub: "jours ouvrés cumulés" },
        ].map(k => (
          <div key={k.label} style={cardS}>
            <div style={lbl}>{k.label}</div>
            <div style={bigNum}>{k.value.toLocaleString("fr-FR")}</div>
            <div style={sub}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Avancement global */}
      <div style={{ background: "#fff", border: `1px solid ${T.pageBdr}`, borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
          Avancement global
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em", lineHeight: 1 }}>{pct}%</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.pageSub, marginBottom: 5 }}>
              <span>{done} groupe{done !== 1 ? "s" : ""} terminé{done !== 1 ? "s" : ""}</span>
              <span>{inProgress.length} en cours · {upcoming.length} à venir</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: "rgba(55,53,47,0.1)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#448361", borderRadius: 99 }} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
          {[
            { color: "#448361", label: `Terminés (${done})` },
            { color: "#cb912f", label: `En cours (${inProgress.length})` },
            { color: "rgba(55,53,47,0.18)", label: `À venir (${Math.max(0, tasks.length - done - inProgress.length)})` },
          ].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T.pageSub }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Ligne 2 : En cours + À venir */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 }}>
        {/* En cours */}
        <div style={{ background: "#fff", border: `1px solid ${T.pageBdr}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#cb912f" }} />
            Thèmes en cours — cette semaine
          </div>
          {inProgress.length === 0
            ? <div style={{ fontSize: 12, color: T.pageTer, fontStyle: "italic" }}>Aucune formation en cours</div>
            : inProgress.slice(0, 4).map((t, i) => {
                const pal = grpTag(t.group);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(inProgress.length, 4) - 1 ? `1px solid ${T.pageBdr}` : "none" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: pal.bg, color: pal.text, flexShrink: 0 }}>G{t.groupe || "—"}</span>
                    <span style={{ fontSize: 12, color: T.pageText, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.group}</span>
                    <span style={{ fontSize: 11, color: T.pageSub, fontFamily: "monospace", flexShrink: 0 }}>→ {fmt(t.end)}</span>
                  </div>
                );
              })
          }
        </div>

        {/* À venir */}
        <div style={{ background: "#fff", border: `1px solid ${T.pageBdr}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#337ea9" }} />
            Thèmes à venir — semaine prochaine
          </div>
          {upcoming.length === 0
            ? <div style={{ fontSize: 12, color: T.pageTer, fontStyle: "italic" }}>Aucune formation prévue la semaine prochaine</div>
            : upcoming.slice(0, 4).map((t, i) => {
                const pal = grpTag(t.group);
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < Math.min(upcoming.length, 4) - 1 ? `1px solid ${T.pageBdr}` : "none" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: pal.bg, color: pal.text, flexShrink: 0 }}>G{t.groupe || "—"}</span>
                    <span style={{ fontSize: 12, color: T.pageText, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.group}</span>
                    <span style={{ fontSize: 11, color: T.pageSub, fontFamily: "monospace", flexShrink: 0 }}>dès {fmt(t.start)}</span>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* Coût global */}
      {totalCout > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${T.pageBdr}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Coût global du plan de formation
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em" }}>
              {totalCout.toLocaleString("fr-FR")}
            </span>
            <span style={{ fontSize: 14, color: T.pageSub }}>MAD</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, paddingTop: 12, borderTop: `1px solid ${T.pageBdr}` }}>
            {[
              { label: "Coût moyen / candidat", value: `${avgPerCand.toLocaleString("fr-FR")} MAD` },
              { label: "Coût moyen / jour",     value: `${avgPerDay.toLocaleString("fr-FR")} MAD` },
              { label: "Budget consommé",        value: `${pct}%`, color: "#448361" },
            ].map(k => (
              <div key={k.label}>
                <div style={{ fontSize: 11, color: T.pageSub, marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: k.color || T.pageText }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
})()}

      {divider}

      {/* Tâches récentes */}
      {tasks.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Tâches récentes</div>
          <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 4, overflow: "hidden", marginBottom: 32 }}>
            {tasks.slice(0, 5).map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderBottom: i < Math.min(tasks.length,5)-1 ? `1px solid ${T.pageBdr}` : "none", background: i%2===0?"#fff":"rgba(55,53,47,0.015)" }}>
                <span style={{ fontSize: 11, color: T.pageTer, fontFamily: "monospace", width: 20, textAlign: "right", flexShrink: 0 }}>{i+1}</span>
                <span style={{ flex: 1, fontSize: 13, color: T.pageText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                <Tag label={t.group} scheme={grpTag(t.group)} />
                <span style={{ fontSize: 11, color: T.pageSub, fontFamily: "monospace", flexShrink: 0 }}>{fmt(t.end)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Candidats récents */}
      {candidats.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>Candidats récents</div>
          <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 4, overflow: "hidden" }}>
            {candidats.slice(0, 4).map((c, i) => {
              const st = C_STATUS.find(s => s.key === c.statut) || C_STATUS[0];
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", borderBottom: i < Math.min(candidats.length,4)-1 ? `1px solid ${T.pageBdr}` : "none", background: i%2===0?"#fff":"rgba(55,53,47,0.015)" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(55,53,47,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.pageSub, flexShrink: 0 }}>
                    {c.nom.charAt(0)}{c.prenom?.charAt(0)||""}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, color: T.pageText, fontWeight: 500 }}>{c.nom} {c.prenom}</span>
                  <span style={{ fontSize: 12, color: T.pageSub }}>{c.poste}</span>
                  <Tag label={c.statut} scheme={{ text: st.text, bg: st.bg, bd: st.bd }} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GANTT BAR
// ═══════════════════════════════════════════════════════════════
const GBar = memo(function GBar({ task, zoom, viewStart, totalDays, onUpdate, wd, sh, vacs, effectiveSlot, isLiveConflict, conflictTypes, prog }) {
  const dr  = useRef(null);
  const [prev, setPrev] = useState(null);
 
  const s   = gdb(viewStart, pd(task.start)), dur = gdb(pd(task.start), pd(task.end)) + 1;
  if (s + dur <= 0 || s >= totalDays) return null;
 
  const ds = prev ? prev.start : task.start;
  const de = prev ? prev.end   : task.end;
 
  const isHD    = task.halfDay === true;
  const hdSlot  = effectiveSlot || task.slot || "matin";
  const dayOff  = gdb(viewStart, pd(ds));
  const halfW   = zoom.halfDay ? zoom.cw / 2 : zoom.cw;
  const slotOff = zoom.halfDay && isHD && hdSlot === "après-midi" ? halfW : 0;
  const left    = dayOff * zoom.cw + slotOff;
  const width   = Math.max(isHD && zoom.halfDay ? halfW : (gdb(pd(ds), pd(de)) + 1) * zoom.cw, zoom.halfDay ? halfW : zoom.cw);
 
  const dragging = !!prev;
  const tag      = grpTag(task.group);
  const HW       = zoom.cw >= 28 ? 8 : 5;
  const HP       = Math.max(0, HW - 3);
  const dtype    = dr.current?.type ?? null;
 
  const conflictStyle = () => {
    if (!isLiveConflict || dragging) return {};
    if (conflictTypes?.has("overlap") || conflictTypes?.has("salle_pleine"))      return { boxShadow:"0 0 0 2px rgba(212,76,71,0.8)" };
    if (conflictTypes?.has("candidat_double") || conflictTypes?.has("halfday"))   return { boxShadow:"0 0 0 2px rgba(193,76,138,0.8)" };
    if (conflictTypes?.has("vacation")) return { boxShadow:"0 0 0 2px rgba(51,126,169,0.8)" };
    if (conflictTypes?.has("holiday"))  return { boxShadow:"0 0 0 2px rgba(68,131,97,0.8)" };
    if (conflictTypes?.has("weekend"))  return { boxShadow:"0 0 0 2px rgba(203,145,47,0.8)" };
    return {};
  };
  const barBg = () => {
    if (!isLiveConflict) return tag.bg;
    if (conflictTypes?.has("salle_pleine")||conflictTypes?.has("overlap"))        return "rgba(253,224,220,0.85)";
    if (conflictTypes?.has("candidat_double")||conflictTypes?.has("halfday"))     return "rgba(245,224,233,0.85)";
    if (conflictTypes?.has("vacation")) return "rgba(211,229,239,0.85)";
    if (conflictTypes?.has("holiday"))  return "rgba(219,237,219,0.85)";
    if (conflictTypes?.has("weekend"))  return "rgba(253,236,200,0.85)";
    return tag.bg;
  };
  const dotColor = () => {
    if (!isLiveConflict) return null;
    if (conflictTypes?.has("salle_pleine")||conflictTypes?.has("overlap"))       return "#d44c47";
    if (conflictTypes?.has("candidat_double")||conflictTypes?.has("halfday"))    return "#c14c8a";
    if (conflictTypes?.has("vacation")) return "#337ea9";
    if (conflictTypes?.has("holiday"))  return "#448361";
    if (conflictTypes?.has("weekend"))  return "#cb912f";
    return "#d44c47";
  };
  const dot = dotColor();
 
  function startDrag(e, type) {
    if (isHD && type !== "move") return; 
    e.stopPropagation(); e.preventDefault();
    dr.current = { type, startX: e.clientX, os: task.start, oe: task.end };
    setPrev({ start: task.start, end: task.end });
    document.body.style.cursor    = type === "move" ? "grabbing" : "col-resize";
    document.body.style.userSelect = "none";
    const mv = ev => {
      const d = Math.round((ev.clientX - dr.current.startX) / zoom.cw);
      const r = dr.current;
      if (r.type === "move")    setPrev({ start: d2s(ad(pd(r.os), d)), end: d2s(ad(pd(r.oe), d)) });
      else if (r.type === "rr") setPrev({ start: r.os, end: rezEnd(r.os, r.oe, d, wd, sh, vacs) });
      else                      setPrev({ start: rezStart(r.os, r.oe, d, wd, sh, vacs), end: r.oe });
    };
    const up = ev => {
      const d  = Math.round((ev.clientX - dr.current.startX) / zoom.cw);
      const r  = dr.current;
      let cm;
      if (r.type === "move")    cm = moveSnap(r.os, r.oe, d, wd, sh, vacs);
      else if (r.type === "rr") cm = { start: r.os, end: rezEnd(r.os, r.oe, d, wd, sh, vacs) };
      else                      cm = { start: rezStart(r.os, r.oe, d, wd, sh, vacs), end: r.oe };
      onUpdate(task.id, cm.start, cm.end);
      dr.current = null; setPrev(null);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
  }
 
  return (
    <div style={{ position:"absolute",left,width,top:"50%",transform:"translateY(-50%)",height:dragging?22:18,zIndex:dragging?20:isHD?6:5,userSelect:"none" }}>
      {dragging && (
        <div style={{ position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:"#37352f",color:"#fff",borderRadius:4,padding:"3px 9px",fontSize:11,whiteSpace:"nowrap",pointerEvents:"none",zIndex:50,boxShadow:"0 4px 12px rgba(0,0,0,0.2)",display:"flex",gap:8,alignItems:"center" }}>
          <span style={{ color:"rgba(255,255,255,0.45)",fontSize:10 }}>{dtype==="move"?"Déplacer":dtype==="rr"?"→ Fin":"← Début"}</span>
          <span>{fmt(ds)} → {fmt(de)}</span>
          <span style={{ color:"rgba(255,255,255,0.6)",fontFamily:"monospace" }}>{calcWD(ds,de,wd,sh,vacs)}j</span>
        </div>
      )}
      {!isHD && <div onMouseDown={e=>startDrag(e,"rl")} style={{ position:"absolute",left:-HP,top:0,bottom:0,width:HW+HP,cursor:"col-resize",zIndex:5,display:"flex",alignItems:"center" }}><div style={{ width:2,height:"55%",borderRadius:99,background:"rgba(55,53,47,0.25)",marginLeft:HP }} /></div>}
      <div onMouseDown={e=>startDrag(e,"move")} style={{ position:"absolute",left:isHD?1:HW,right:isHD?1:HW,top:0,bottom:0,borderRadius:3,overflow:"hidden",cursor:isHD?"default":dragging?"grabbing":"grab",...conflictStyle() }}>
        <div style={{ position:"absolute",inset:0,background:barBg(),border:`1px solid ${tag.bd||"transparent"}`,borderRadius:3 }} />
        <div style={{ position:"absolute",top:0,left:0,bottom:0,width:`${prog.pct}%`,background:tag.text,opacity:0.2,borderRadius:"3px 0 0 3px",transition:"width 0.3s" }} />
        {(width - (isHD ? 2 : HW * 2)) > 36 && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"0 6px",pointerEvents:"none",gap:4,overflow:"hidden" }}>
            {dot && <div style={{ width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0,boxShadow:"0 0 0 1.5px rgba(255,255,255,0.8)" }} />}
            {isHD && <span style={{ fontSize:8,fontWeight:800,color:hdSlot==="après-midi"?"#337ea9":"#cb912f",background:hdSlot==="après-midi"?"rgba(51,126,169,0.18)":"rgba(203,145,47,0.18)",borderRadius:2,padding:"1px 3px",flexShrink:0,letterSpacing:"0.06em" }}>{hdSlot==="matin"?"AM":"PM"}</span>}
            <span style={{ fontSize:10,fontWeight:500,color:tag.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>{task.group}{task.groupe?` — G${task.groupe}`:""}</span>
          </div>
        )}
      </div>
      {!isHD && <div onMouseDown={e=>startDrag(e,"rr")} style={{ position:"absolute",right:-HP,top:0,bottom:0,width:HW+HP,cursor:"col-resize",zIndex:5,display:"flex",alignItems:"center",justifyContent:"flex-end" }}><div style={{ width:2,height:"55%",borderRadius:99,background:"rgba(55,53,47,0.25)",marginRight:HP }} /></div>}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// GANTT ROW
// ═══════════════════════════════════════════════════════════════
const BackgroundStripes = memo(function BackgroundStripes({ totalDays, projStart, wd, sh, vacs, todayOff, zoom, rowCount }) {
  const canvasRef = useRef(null);
  const wdSet     = useMemo(() => new Set(wd), [wd]);
  const stripes   = useMemo(() => {
    const out = [];
    let ts = projStart.getTime();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(ts), ds = d2s(d);
      const isW = wdSet.has(d.getDay()), hol = sh ? HMAP[ds] : null, vac = isVac(d, vacs);
      if (isW || hol || vac) {
        const c = vac ? [51,126,169,0.12] : hol ? (hol.religious ? [68,131,97,0.08] : [212,76,71,0.06]) : [55,53,47,0.03];
        out.push({ i, c });
      }
      ts += 86400000;
    }
    return out;
  }, [totalDays, projStart, wdSet, sh, vacs]);
 
  const h = Math.max(600, (rowCount || 1) * RH), w = totalDays * zoom.cw;
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    cv.width = w; cv.height = h;
    ctx.clearRect(0, 0, w, h);
    stripes.forEach(({ i, c:[r,g,b,a] }) => { ctx.fillStyle=`rgba(${r},${g},${b},${a})`; ctx.fillRect(i*zoom.cw, 0, zoom.cw, h); });
  }, [stripes, zoom.cw, h, w]);
 
  return (
    <div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:0 }}>
      <canvas ref={canvasRef} style={{ position:"absolute",top:0,left:0,width:w,height:h }} />
      {todayOff >= 0 && todayOff <= totalDays && (
        <div style={{ position:"absolute",top:0,bottom:0,left:todayOff*zoom.cw,width:2,background:T.accent,opacity:0.5,zIndex:5 }} />
      )}
    </div>
  );
});

const GRow = memo(function GRow({ task, SC, cs, zoom, projStart, totalDays, todayOff, wd, sh, vacs, onEdit, onDelete, onUpdate, onUpdateSlot, registerScrollable, unregisterScrollable, slotMap, isLiveConflict, conflictTypes, wdays, prog, candidatCount }) {
  const [hov, setHov] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    registerScrollable(el); return () => unregisterScrollable(el);
  }, [registerScrollable, unregisterScrollable]);
 
  const isHD = task.halfDay === true;
  const effectiveSlot = task.slot || (slotMap && slotMap[task.id]) || "matin";
  const pal = grpTag(task.group);
  let displayGrp = task.groupe || "";
  if (!displayGrp && task.name?.includes(" — Grp ")) displayGrp = task.name.split(" — Grp ")[1];
 
  const getDot = () => {
    if (!isLiveConflict) return null;
    if (conflictTypes?.has("salle_pleine")||conflictTypes?.has("overlap"))       return "#d44c47";
    if (conflictTypes?.has("candidat_double")||conflictTypes?.has("halfday"))    return "#c14c8a";
    if (conflictTypes?.has("vacation")) return "#337ea9";
    if (conflictTypes?.has("holiday"))  return "#448361";
    if (conflictTypes?.has("weekend"))  return "#cb912f";
    return "#d44c47";
  };
  const dot = getDot();
 
  const rowBg = () => {
    if (hov) return "rgba(55,53,47,0.04)";
    if (!isLiveConflict) return "#fff";
    if (conflictTypes?.has("salle_pleine")||conflictTypes?.has("overlap"))       return "rgba(253,224,220,0.18)";
    if (conflictTypes?.has("candidat_double")||conflictTypes?.has("halfday"))    return "rgba(245,224,233,0.18)";
    if (conflictTypes?.has("vacation")) return "rgba(211,229,239,0.18)";
    if (conflictTypes?.has("holiday"))  return "rgba(219,237,219,0.18)";
    if (conflictTypes?.has("weekend"))  return "rgba(253,236,200,0.18)";
    return "rgba(253,224,220,0.18)";
  };
 
  return (
    <div style={{ display:"flex",height:RH,background:rowBg(),borderBottom:`1px solid ${T.pageBdr}`,transition:"background 0.06s" }} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{ display:"flex",flexShrink:0 }}>
        {/* Thème */}
        <div style={{ ...cs(SC[0].sw),padding:"0 8px",gap:5,justifyContent:"flex-start" }}>
          {dot
            ? <div style={{ width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0,boxShadow:`0 0 0 2px ${dot}33`,animation:conflictTypes?.has("overlap")?"pulse-conflict 1.5s ease-in-out infinite":"none" }} />
            : <div style={{ width:8,height:8,borderRadius:2,background:pal.text,flexShrink:0 }} />
          }
          <span style={{ fontSize:13,fontWeight:600,color:T.pageText,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }} title={task.group}>{task.group}</span>
          <div style={{ display:"flex",gap:1,flexShrink:0,opacity:hov?1:0,transition:"opacity 0.1s" }}>
            <button onClick={onEdit}   style={{ width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"transparent",cursor:"pointer",color:T.pageTer }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(55,53,47,0.1)";e.currentTarget.style.color=T.pageText;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.pageTer;}}><Edit2 style={{ width:11,height:11 }} /></button>
            <button onClick={onDelete} style={{ width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"transparent",cursor:"pointer",color:T.pageTer }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(212,76,71,0.1)";e.currentTarget.style.color="#d44c47";}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=T.pageTer;}}><Trash2 style={{ width:11,height:11 }} /></button>
          </div>
        </div>
        {/* Grp */}
        <div style={{ ...cs(SC[1].sw),justifyContent:"center",padding:"0 4px" }}>
          <span style={{ fontSize:12,fontWeight:600,color:T.pageSub }}>{displayGrp?`G${displayGrp}`:"—"}</span>
        </div>
        {/* Cand. — nb de candidats réels en DB pour ce groupe */}
        <div style={{ ...cs(SC[2].sw),justifyContent:"center",padding:"0 4px" }}>
          <span style={{ fontSize:11,fontFamily:"monospace",color:candidatCount>0?T.pageSub:T.pageTer }}>{candidatCount>0?candidatCount:"—"}</span>
        </div>
        {/* Jours / AM-PM */}
        <div style={{ ...cs(SC[3].sw), justifyContent: "center", padding: "0 4px" }}>
    {isHD ? (
      <div style={{ 
        display: "flex", 
        borderRadius: 4, 
        border: `1px solid ${T.pageBdr}`, 
        overflow: "hidden",
        background: "#fff" 
      }}>
        <button 
          onClick={() => onUpdateSlot(task.id, "matin")}
          style={{
            padding: "2px 4px", fontSize: "8px", fontWeight: "800", border: "none",
            cursor: "pointer",
            background: effectiveSlot === "matin" ? "rgba(203,145,47,0.2)" : "transparent",
            color: effectiveSlot === "matin" ? "#cb912f" : T.pageTer,
            borderRight: `1px solid ${T.pageBdr}`
          }}>AM</button>
        <button 
          onClick={() => onUpdateSlot(task.id, "après-midi")}
          style={{
            padding: "2px 4px", fontSize: "8px", fontWeight: "800", border: "none",
            cursor: "pointer",
            background: effectiveSlot === "après-midi" ? "rgba(51,126,169,0.2)" : "transparent",
            color: effectiveSlot === "après-midi" ? "#337ea9" : T.pageTer
          }}>PM</button>
      </div>
    ) : (
      <span style={{ fontSize: 12, fontFamily: "monospace", color: T.pageSub }}>{wdays}</span>
    )}
  </div>
        {/* Début */}
        <div style={{ ...cs(SC[4].sw),justifyContent:"center",padding:"0 4px",cursor:"pointer" }}
  title="Double-clic pour modifier"
  onDoubleClick={onEdit}>
  <span style={{ fontSize:11,fontFamily:"monospace",color:T.pageSub }}>{fmt(task.start)}</span>
</div>
        {/* Avancement */}
        <div style={{ ...cs(SC[5].sw),padding:"0 10px",flexDirection:"column",alignItems:"stretch",justifyContent:"center",gap:3 }}>
          <div style={{ height:3,background:"rgba(55,53,47,0.1)",borderRadius:99,overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${prog.pct}%`,background:prog.pct===100?T.tagGreen.text:"rgba(55,53,47,0.45)",borderRadius:99 }} />
          </div>
          <span style={{ fontSize:10,color:T.pageTer,fontFamily:"monospace" }}>{prog.pct}%</span>
        </div>
        {/* Fin */}
        <div style={{ ...cs(SC[6].sw),justifyContent:"center",padding:"0 4px",borderRight:`1px solid ${T.pageBdr}`,cursor:"pointer" }}
  title="Double-clic pour modifier"
  onDoubleClick={onEdit}>
  <span style={{ fontSize:11,fontFamily:"monospace",color:T.pageSub }}>{fmt(task.end)}</span>
</div>
      </div>
      {/* Zone barre */}
      <div style={{ flex:1,overflow:"hidden" }}>
        <div ref={ref} style={{ overflowX:"hidden",width:"100%",height:"100%" }}>
          <div style={{ width:totalDays*zoom.cw,height:"100%",position:"relative" }}>
            <GBar task={task} zoom={zoom} viewStart={projStart} totalDays={totalDays} onUpdate={onUpdate} wd={wd} sh={sh} vacs={vacs} effectiveSlot={effectiveSlot} isLiveConflict={isLiveConflict} conflictTypes={conflictTypes} prog={prog} />
          </div>
        </div>
      </div>
    </div>
  );
});

function usePlanningSettings(wsId, wsWorkingDays, wsSkipHolidays, wsVacances, onUpdateWs) {
  const wdFromDB = useCallback(wds => {
    const all = [0,1,2,3,4,5,6];
    return all.filter(d => !(wds || [1,2,3,4,5]).includes(d));
  }, []);
 
  const [wd,   setWdLocal]   = useState(() => wdFromDB(wsWorkingDays));
  const [sh,   setShLocal]   = useState(() => wsSkipHolidays ?? true);
  const [vacs, setVacsLocal] = useState(() => wsVacances ?? []);
 
  const prevWsId = useRef(null);
  useEffect(() => {
    if (wsId !== prevWsId.current) {
      prevWsId.current = wsId;
      setWdLocal(wdFromDB(wsWorkingDays));
      setShLocal(wsSkipHolidays ?? true);
      setVacsLocal(wsVacances ?? []);
    }
  }, [wsId, wsWorkingDays, wsSkipHolidays, wsVacances]);
 
  const saveTimer = useRef(null);
  const saveDB = useCallback((workingDays, skipHolidays, vacances) => {
    if (!wsId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        // PATCH /api/workspaces/:id/settings
        const r = await apiFetch(`/workspaces/${wsId}/settings`, {
          method: "PATCH",
          body: { workingDays, skipHolidays, vacances },
        });
        if (onUpdateWs && r.data) onUpdateWs(r.data);
      } catch (err) { console.error("Erreur sauvegarde settings :", err.message); }
    }, 800);
  }, [wsId, onUpdateWs]);
 
  const setWd = useCallback(updater => {
    setWdLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const all  = [0,1,2,3,4,5,6];
      const wds  = all.filter(d => !next.includes(d));
      setShLocal(sh => { setVacsLocal(v => { saveDB(wds, sh, v); return v; }); return sh; });
      return next;
    });
  }, [saveDB]);
 
  const setSh = useCallback(updater => {
    setShLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setWdLocal(wd => {
        const all = [0,1,2,3,4,5,6];
        const wds = all.filter(d => !wd.includes(d));
        setVacsLocal(v => { saveDB(wds, next, v); return v; });
        return wd;
      });
      return next;
    });
  }, [saveDB]);
 
  const setVacs = useCallback(updater => {
    setVacsLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setWdLocal(wd => {
        const all = [0,1,2,3,4,5,6];
        const wds = all.filter(d => !wd.includes(d));
        setShLocal(sh => { saveDB(wds, sh, next); return sh; });
        return wd;
      });
      return next;
    });
  }, [saveDB]);
 
  return { wd, setWd, sh, setSh, vacs, setVacs };
}

function RichDatePicker({ value, onChange, min, wd, sh, vacs, groupRows, currentKey, disabled, hasPreDates = false }) {  const [open, setOpen]         = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return pd(value);
    if (min)   return pd(min);
    return new Date();
  });

  const triggerRef = useRef(null);
  const popupRef   = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // ── Position calculée par rapport au trigger ──────────────
  const computePos = useCallback(() => {
  if (!triggerRef.current) return;
  const rect = triggerRef.current.getBoundingClientRect();
  const popW = 340;
  const popH = 480;
  const vw   = window.innerWidth;
  const vh   = window.innerHeight;
  const gap  = 6;

  // ── Horizontal ──
  let left = rect.left;
  if (left + popW > vw - 8) left = vw - popW - 8;
  if (left < 8) left = 8;

  // ── Vertical : position FIXE par rapport au viewport (pas au document) ──
  // rect.top / rect.bottom sont déjà relatifs au viewport avec getBoundingClientRect()
  // On N'ajoute PAS window.scrollY car position:fixed est relatif au viewport
  let top;
  if (rect.bottom + gap + popH <= vh - 8) {
    top = rect.bottom + gap;        // ← supprimé window.scrollY
  } else {
    top = rect.top - gap - popH;   // ← supprimé window.scrollY
  }

  // Garde le popup dans le viewport
  if (top < 8) top = 8;
  if (top + popH > vh - 8) top = vh - popH - 8;

  setPos({ top, left });
}, []);

  const openPicker = () => { computePos(); setOpen(true); };

  // ── Recalculer si scroll/resize ───────────────────────────
  useEffect(() => {
    if (!open) return;
    const update = () => computePos();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, computePos]);

  // ── Fermer au clic extérieur ──────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popupRef.current   && !popupRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (value) setViewDate(pd(value)); }, [value]);

  // ── Index formations planifiées ───────────────────────────
  const planningIndex = useMemo(() => {
    const idx = {};
    groupRows.forEach(gr => {
      if (!gr.start || !gr.end) return;
      let cur = pd(gr.start);
      const end = pd(gr.end);
      while (cur <= end) {
        const dk = d2s(cur);
        if (!idx[dk]) idx[dk] = [];
        idx[dk].push({
          theme:   gr.theme,
          groupe:  gr.groupe,
          key:     gr.key,
          halfDay: gr.halfDay,
          slot:    gr.slot,
        });
        cur = ad(cur, 1);
      }
    });
    return idx;
  }, [groupRows]);

  // ── Index congés ─────────────────────────────────────────
  const vacsIndex = useMemo(() => {
    const idx = {};
    vacs.forEach(v => {
      let cur = pd(v.start);
      const end = pd(v.end);
      while (cur <= end) {
        idx[d2s(cur)] = v.label || "Congé";
        cur = ad(cur, 1);
      }
    });
    return idx;
  }, [vacs]);

  // ── Construction du mois ──────────────────────────────────
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    let startDow   = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;
    const result = [];
    for (let i = 0; i < startDow; i++)
      result.push({ date: new Date(year, month, i - startDow + 1), cur: false });
    for (let i = 1; i <= lastDay.getDate(); i++)
      result.push({ date: new Date(year, month, i), cur: true });
    while (result.length % 7 !== 0) {
      const last = result[result.length - 1].date;
      result.push({ date: ad(last, 1), cur: false });
    }
    return result;
  }, [year, month]);

  const MON_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const DOW_FR = ["Lu","Ma","Me","Je","Ve","Sa","Di"];

  const COLORS  = ["#0f7ddb","#448361","#9065b0","#d4774a","#337ea9","#c2672a","#2d7f6a"];
  const themeColor = t =>
    COLORS[Math.abs([...t].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

  const todayStr = d2s(new Date());

  // ── Popup via portail ─────────────────────────────────────
  const popup = open && createPortal(
    <div
      ref={popupRef}
      style={{
        position:     "fixed",
        top:          pos.top,
        left:         pos.left,
        zIndex:       9999,
        width:        340,
        background:   "#fff",
        border:       "1px solid rgba(55,53,47,0.18)",
        borderRadius: 8,
        boxShadow:    "0 8px 32px rgba(0,0,0,0.14)",
        padding:      "12px 14px 10px",
        userSelect:   "none",
        fontSize:     12,
        fontFamily:   "inherit",
      }}>

      {/* ── Navigation mois ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          style={{ width: 26, height: 26, border: "1px solid rgba(55,53,47,0.15)", borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft style={{ width: 13, height: 13, color: "#37352f" }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#37352f" }}>
          {MON_FR[month]} {year}
        </span>
        <button type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          style={{ width: 26, height: 26, border: "1px solid rgba(55,53,47,0.15)", borderRadius: 4, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight style={{ width: 13, height: 13, color: "#37352f" }} />
        </button>
      </div>

      {/* ── Légende ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "4px 6px", borderRadius: 5, background: "rgba(55,53,47,0.025)", border: "1px solid rgba(55,53,47,0.08)", flexWrap: "wrap" }}>
        {[
          { bg: "rgba(212,76,71,0.18)",  label: "Férié"    },
          { bg: "rgba(51,126,169,0.18)", label: "Congé"    },
          { bg: "rgba(55,53,47,0.1)",    label: "Weekend"  },
          { bg: "rgba(15,125,219,0.12)", label: "Formation" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: "1px solid rgba(55,53,47,0.12)", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#6b6b6b" }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* ── En-têtes jours ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 2 }}>
        {DOW_FR.map((d, i) => (
          <div key={d} style={{
            textAlign: "center", fontSize: 10, fontWeight: 600, padding: "2px 0",
            color: i >= 5 ? "rgba(212,76,71,0.55)" : "#9b9a97",
          }}>{d}</div>
        ))}
      </div>

      {/* ── Grille ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
        {days.map(({ date, cur }, i) => {
          const dk           = d2s(date);
          const dow          = date.getDay();
          const isWeekend    = wd.includes(dow);
          // ── Utiliser HMAP global pour TOUS les fériés ──
          const ferieInfo    = sh ? HMAP[dk] : null;
          const isFerie      = !!ferieInfo;
          const vacLabel     = vacsIndex[dk];
          const isVac        = !!vacLabel;
          const plans        = cur ? (planningIndex[dk] || []) : [];
          const isSel        = value === dk;
          const isToday      = dk === todayStr;
          const isMin        = !!(min && dk < min);
          const isDisabled   = !cur || isWeekend || isFerie || isVac || isMin;
          const isCurrent    = plans.some(p => p.key === currentKey);
          const otherPlans   = plans.filter(p => p.key !== currentKey);

          let bg = "#fff";
          if (!cur)               bg = "transparent";
          else if (isSel)         bg = T.accent;
          else if (isFerie)       bg = "rgba(212,76,71,0.14)";
          else if (isVac)         bg = "rgba(51,126,169,0.12)";
          else if (isWeekend)     bg = "rgba(55,53,47,0.07)";
          else if (otherPlans.length > 0) bg = "rgba(15,125,219,0.07)";

          // ── Tooltip avec nom du férié ──
          const tooltipLines = [
            isFerie   ? `🇲🇦 ${ferieInfo.title}` : null,
            isVac     ? `🏖 ${vacLabel}` : null,
            isWeekend ? "Weekend" : null,
            ...otherPlans.slice(0, 4).map(p =>
              `📚 ${p.theme.length > 30 ? p.theme.slice(0,30)+"…" : p.theme} G${p.groupe}${p.halfDay ? ` (${p.slot === "matin" ? "AM" : "PM"})` : ""}`
            ),
            otherPlans.length > 4 ? `+${otherPlans.length - 4} autres` : null,
            isCurrent ? "↑ Ce groupe" : null,
          ].filter(Boolean);

          return (
            <div
              key={i}
              title={tooltipLines.length > 0 ? tooltipLines.join("\n") : undefined}
              onClick={() => { if (isDisabled) return; onChange(dk); setOpen(false); }}
              style={{
                borderRadius:   4,
                padding:        "3px 1px 2px",
                cursor:         isDisabled ? "default" : "pointer",
                background:     bg,
                opacity:        !cur ? 0.22 : isMin ? 0.38 : 1,
                border:         isSel
                  ? `1.5px solid ${T.accent}`
                  : isToday
                    ? `1.5px solid ${T.accent}`
                    : isCurrent && !isSel
                      ? `1.5px dashed rgba(15,125,219,0.45)`
                      : "1.5px solid transparent",
                minHeight:      40,
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "flex-start",
                gap:            1,
                paddingTop:     4,
                transition:     "background 0.06s",
              }}
              onMouseEnter={e => { if (!isDisabled && !isSel && cur) e.currentTarget.style.background = `${T.accent}14`; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = bg; }}>

              {/* ── Numéro du jour ── */}
              <span style={{
                fontSize:   12,
                lineHeight: 1,
                fontWeight: isSel || isToday ? 700 : 400,
                color:      isSel      ? "#fff"
                          : isFerie    ? "#c0392b"
                          : isVac      ? "#1a6b9a"
                          : isWeekend  ? "rgba(55,53,47,0.35)"
                          : !cur       ? "rgba(55,53,47,0.2)"
                          : "#37352f",
              }}>
                {date.getDate()}
              </span>

              {/* ── Nom du férié (tronqué) ── */}
              {cur && isFerie && !isSel && ferieInfo.title && (
                <span style={{
                  fontSize:     7,
                  color:        ferieInfo.religious ? "#448361" : "#c0392b",
                  lineHeight:   1.2,
                  maxWidth:     "100%",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                  textAlign:    "center",
                  padding:      "0 1px",
                  display:      "block",
                  fontWeight:   600,
                }}>
                  {ferieInfo.title.length > 7
                    ? ferieInfo.title.slice(0, 6) + "…"
                    : ferieInfo.title
                  }
                </span>
              )}

              {/* ── Points formations ── */}
              {cur && !isSel && otherPlans.length > 0 && (
                <div style={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 1 }}>
                  {otherPlans.slice(0, 3).map((p, pi) => (
                    <div key={pi} style={{
                      width: 4, height: 4, borderRadius: "50%",
                      background: themeColor(p.theme),
                    }} />
                  ))}
                  {otherPlans.length > 3 && (
                    <span style={{ fontSize: 8, color: "#9b9a97", lineHeight: 1 }}>+</span>
                  )}
                </div>
              )}

              {/* ── Barre groupe actuel ── */}
              {cur && isCurrent && !isSel && (
                <div style={{ width: "60%", height: 2, borderRadius: 1, background: T.accent, marginTop: 1 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Détail formations à la date sélectionnée ── */}
      {value && planningIndex[value]?.length > 0 && (
        <div style={{ marginTop: 8, borderRadius: 5, border: "1px solid rgba(15,125,219,0.2)", overflow: "hidden" }}>
          <div style={{ padding: "4px 8px", background: "rgba(15,125,219,0.06)", borderBottom: "1px solid rgba(15,125,219,0.12)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#0f7ddb", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Formations le {fmt(value)}
            </span>
          </div>
          <div style={{ maxHeight: 80, overflowY: "auto" }}>
            {planningIndex[value].map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
                background: i % 2 === 0 ? "#fff" : "rgba(55,53,47,0.015)",
                borderBottom: i < planningIndex[value].length - 1 ? "1px solid rgba(55,53,47,0.06)" : "none",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: themeColor(p.theme), flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#37352f", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.theme}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.accent, flexShrink: 0 }}>G{p.groupe}</span>
                {p.halfDay && (
                  <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 99, background: "rgba(55,53,47,0.07)", color: "#6b6b6b", flexShrink: 0 }}>
                    {p.slot === "matin" ? "AM" : "PM"}
                  </span>
                )}
                {p.key === currentKey && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#448361", flexShrink: 0 }}>← ici</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Férié info à la date sélectionnée ── */}
      {value && sh && HMAP[value] && (
        <div style={{ marginTop: 6, padding: "5px 8px", borderRadius: 5, background: "rgba(212,76,71,0.06)", border: "1px solid rgba(212,76,71,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>🇲🇦</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#c0392b" }}>
            {HMAP[value].title}
          </span>
          {HMAP[value].religious && (
            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(68,131,97,0.1)", color: "#448361" }}>Religieux</span>
          )}
        </div>
      )}

      {/* ── Congé info à la date sélectionnée ── */}
      {value && vacsIndex[value] && (
        <div style={{ marginTop: 6, padding: "5px 8px", borderRadius: 5, background: "rgba(51,126,169,0.06)", border: "1px solid rgba(51,126,169,0.2)", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>🏖</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#1a6b9a" }}>
            {vacsIndex[value]}
          </span>
        </div>
      )}

      {/* ── Actions ── */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          style={{ flex: 1, padding: "5px 0", fontSize: 11, color: "#6b6b6b", background: "transparent", border: "1px solid rgba(55,53,47,0.18)", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
          Effacer
        </button>
        <button type="button"
          onClick={() => {
            const today = d2s(new Date());
            if (!min || today >= min) { onChange(today); setOpen(false); }
          }}
          style={{ flex: 1, padding: "5px 0", fontSize: 11, fontWeight: 600, color: T.accent, background: `${T.accent}0d`, border: `1px solid ${T.accent}30`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
          Aujourd'hui
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <input
        type="text"
        readOnly
        value={value ? fmt(value) : ""}
        placeholder="jj/mm/aaaa"
        disabled={disabled}
        onClick={openPicker}
        style={{
          padding: "3px 6px", fontSize: 11,
          borderRadius: "4px 0 0 4px",
          border: `1px solid ${hasPreDates ? "rgba(51,126,169,0.35)" : "rgba(55,53,47,0.2)"}`,  // ← bordure bleue si Excel
          borderRight: "none",
          outline: "none", fontFamily: "inherit",
          color: hasPreDates ? "#0f7ddb"           // ← bleu si pré-planifié Excel
               : value      ? "#37352f" 
               :               "#9b9a97",
          fontWeight: hasPreDates ? 600 : 400,     // ← gras si Excel
          width: 108,
          background: disabled           ? "rgba(55,53,47,0.04)" 
                    : hasPreDates        ? "rgba(15,125,219,0.04)"  // ← fond bleu très léger
                    :                      "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          caretColor: "transparent",
        }}
      />
      <button type="button"
        onClick={openPicker}
        style={{
          padding: "0 7px", height: 26,
          border: `1px solid ${hasPreDates ? "rgba(51,126,169,0.35)" : "rgba(55,53,47,0.2)"}`,  // ← bordure assortie
          borderRadius: "0 4px 4px 0",
          background: open ? `${T.accent}10` : hasPreDates ? "rgba(15,125,219,0.04)" : "#fff",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <CalendarRange style={{ width: 12, height: 12, color: open ? T.accent : hasPreDates ? "#0f7ddb" : "#9b9a97" }} />
      </button>
      {popup}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GANTT VIEW
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// CALENDAR VIEW — À placer JUSTE AVANT function GanttView
// ═══════════════════════════════════════════════════════════════
function CalendarView({ displayTasksFiltered, metaCache, candidatCountByKey, conflictTypesMap, liveConflictTaskKeys, wd, sh, vacs, onEditTask }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered,   setHovered]   = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);


  const prevMonth = () => { if (viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); };
  const nextMonth = () => { if (viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); };
  const goToday   = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const { weeks, firstDay, lastDay } = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last  = new Date(viewYear, viewMonth + 1, 0);
    let startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: new Date(viewYear, viewMonth, i - startDow + 1), cur: false });
    for (let i = 1; i <= last.getDate(); i++) cells.push({ date: new Date(viewYear, viewMonth, i), cur: true });
    while (cells.length % 7 !== 0) cells.push({ date: ad(cells[cells.length-1].date, 1), cur: false });
    const wks = [];
    for (let i = 0; i < cells.length; i += 7) wks.push(cells.slice(i, i+7));
    return { weeks: wks, firstDay: first, lastDay: last };
  }, [viewYear, viewMonth]);

  const tasksByDay = useMemo(() => {
    const idx = {};
    displayTasksFiltered.forEach(t => {
      if (!t.start || !t.end) return;
      const mStart = d2s(firstDay), mEnd = d2s(lastDay);
      const effStart = t.start > mStart ? t.start : mStart;
      const effEnd   = t.end   < mEnd   ? t.end   : mEnd;
      if (effStart > effEnd) return;
      let cur = pd(effStart);
      const end = pd(effEnd);
      while (cur <= end) {
        const ds = d2s(cur);
        if (!idx[ds]) idx[ds] = [];
        idx[ds].push({ task: t, isStart: ds === t.start, isEnd: ds === t.end, key: `${(t.group||"").trim()}||${String(t.groupe||"")}` });
        cur = ad(cur, 1);
      }
    });
    return idx;
  }, [displayTasksFiltered, firstDay, lastDay]);

  const getConflictColor = (key) => {
    const cf = conflictTypesMap[key];
    if (!cf) return null;
    if (cf.has("salle_pleine")||cf.has("overlap"))      return "#d44c47";
    if (cf.has("candidat_double")||cf.has("halfday"))   return "#c14c8a";
    if (cf.has("vacation")) return "#337ea9";
    if (cf.has("holiday"))  return "#448361";
    return "#d44c47";
  };

  const monthStats = useMemo(() => {
    const active = new Set();
    displayTasksFiltered.forEach(t => {
      if (!t.start || !t.end) return;
      const mStart = d2s(firstDay), mEnd = d2s(lastDay);
      if (t.start <= mEnd && t.end >= mStart) active.add(`${(t.group||"").trim()}||${String(t.groupe||"")}`);
    });
    return { count: active.size };
  }, [displayTasksFiltered, firstDay, lastDay]);

  const DOW_LABELS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const todayStr = d2s(today);

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {/* Navigation */}
      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
        <button onClick={prevMonth} style={{ width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.pageBdr}`,borderRadius:4,background:"#fff",cursor:"pointer",color:T.pageSub }}>
          <ChevronLeft style={{ width:13,height:13 }} />
        </button>
        <div style={{ fontSize:18,fontWeight:700,color:T.pageText,letterSpacing:"-0.02em",minWidth:180,textAlign:"center" }}>
          {MFR[viewMonth]} {viewYear}
        </div>
        <button onClick={nextMonth} style={{ width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.pageBdr}`,borderRadius:4,background:"#fff",cursor:"pointer",color:T.pageSub }}>
          <ChevronRight style={{ width:13,height:13 }} />
        </button>
        <button onClick={goToday} style={{ height:28,padding:"0 12px",fontSize:12,color:T.pageSub,background:"transparent",border:`1px solid ${T.pageBdr}`,borderRadius:4,cursor:"pointer",fontFamily:"inherit" }}>
          Aujourd'hui
        </button>
        <div style={{ marginLeft:"auto",fontSize:12,color:T.pageSub }}>
          {monthStats.count} groupe{monthStats.count!==1?"s":""} ce mois
        </div>
      </div>

      {/* Grille */}
      <div style={{ border:`1px solid ${T.pageBdr}`,borderRadius:6,overflow:"hidden",background:"#fff" }}>
        {/* En-têtes */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${T.pageBdr}`,background:"#f7f7f7" }}>
          {DOW_LABELS.map((d,i) => (
            <div key={d} style={{ padding:"8px 0",textAlign:"center",fontSize:11,fontWeight:600,color:i>=5?"rgba(212,76,71,0.45)":T.pageTer,textTransform:"uppercase",letterSpacing:"0.06em" }}>
              {d}
            </div>
          ))}
        </div>

        {/* Semaines */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:wi<weeks.length-1?`1px solid ${T.pageBdr}`:"none" }}>
            {week.map(({ date, cur }, di) => {
              const ds     = d2s(date);
              const isToday= ds === todayStr;
              const dow    = date.getDay();
              const isWE   = wd.includes(dow);
              const hol    = sh ? HMAP[ds] : null;
              const isVac_ = isVac(date, vacs);
              const tasks_ = tasksByDay[ds] || [];
              const shown  = tasks_.slice(0, 4);
              const more   = tasks_.length - 4;

              let cellBg = "#fff";
              if (!cur)    cellBg = "rgba(55,53,47,0.018)";
              else if (isVac_) cellBg = "rgba(51,126,169,0.05)";
              else if (hol)    cellBg = hol.religious ? "rgba(68,131,97,0.05)" : "rgba(212,76,71,0.035)";
              else if (isWE)   cellBg = "rgba(55,53,47,0.025)";

              return (
                <div key={di} style={{ minHeight:115,padding:"5px 4px 4px",background:cellBg,borderRight:di<6?`1px solid ${T.pageBdr}`:"none",position:"relative" }}>
                  {/* Numéro */}
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3,paddingRight:2 }}>
                    <span style={{ width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",fontSize:12,fontWeight:isToday?700:400,background:isToday?"#37352f":"transparent",color:isToday?"#fff":!cur?T.pageTer:isWE?"rgba(212,76,71,0.35)":T.pageText,flexShrink:0 }}>
                      {date.getDate()}
                    </span>
                    {hol && cur && (
                      <span style={{ fontSize:9,color:hol.religious?"#448361":"#d9730d",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:62,textAlign:"right" }} title={hol.title}>
                        {hol.title.length>9?hol.title.slice(0,8)+"…":hol.title}
                      </span>
                    )}
                  </div>

                  {/* Formations */}
<div style={{ display:"flex",flexDirection:"column",gap:2 }}>
  {(expandedDay === ds ? tasks_ : shown).map(({ task, isStart, key }, ti) => {
    const pal       = grpTag(task.group);
    const isHov     = hovered === key;
    const cfColor   = getConflictColor(key);
    const isConf    = liveConflictTaskKeys.has(key);
    const count     = candidatCountByKey[key] || 0;
    const meta      = metaCache[task.id] || { prog:{ pct:0 } };
    const isHD      = task.halfDay;
    const slotLabel = isHD ? (task.slot==="après-midi"?"PM":"AM") : null;

    return (
      <div key={ti}
        onMouseEnter={() => setHovered(key)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => onEditTask && onEditTask(task)}
        title={`${task.group} — G${task.groupe}${count?` · ${count} cand.`:""}${meta.prog.pct?` · ${meta.prog.pct}%`:""}`}
        style={{ borderRadius:3,padding:"2px 5px",fontSize:10,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:3,overflow:"hidden",background:isConf?(cfColor+"18"):isHov?`${pal.text}1a`:pal.bg,border:`1px solid ${isConf?cfColor:isHov?pal.text:(pal.bd||"transparent")}`,color:isConf?cfColor:pal.text,transition:"all 0.08s",position:"relative" }}>
        <div style={{ width:5,height:5,borderRadius:"50%",background:isConf?cfColor:pal.text,flexShrink:0,opacity:isStart?1:0.3 }} />
        <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1 }}>
          {task.group.length>15?task.group.slice(0,14)+"…":task.group}
          {task.groupe ? <span style={{ opacity:0.7 }}> G{task.groupe}</span> : ""}
        </span>
        {slotLabel && <span style={{ fontSize:8,fontWeight:700,opacity:0.8,flexShrink:0 }}>{slotLabel}</span>}
        {count>0 && isStart && <span style={{ fontSize:9,opacity:0.6,flexShrink:0 }}>{count}</span>}
        {meta.prog.pct>0 && (
          <div style={{ position:"absolute",bottom:0,left:0,height:2,width:`${meta.prog.pct}%`,background:isConf?cfColor:pal.text,opacity:0.35,borderRadius:"0 0 0 3px" }} />
        )}
      </div>
    );
  })}

  {/* Bouton +X autres / Réduire */}
  {more > 0 && expandedDay !== ds && (
    <div
      onClick={e => { e.stopPropagation(); setExpandedDay(ds); }}
      style={{ fontSize:9,color:T.accent,paddingLeft:6,fontStyle:"italic",cursor:"pointer",fontWeight:600 }}
    >
      +{more} autre{more>1?"s":""}
    </div>
  )}
  {expandedDay === ds && tasks_.length > 4 && (
    <div
      onClick={e => { e.stopPropagation(); setExpandedDay(null); }}
      style={{ fontSize:9,color:T.pageSub,paddingLeft:6,fontStyle:"italic",cursor:"pointer" }}
    >
      ▲ Réduire
    </div>
  )}
</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Légende */}
      <div style={{ display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:T.pageSub,paddingBottom:4 }}>
        {[
          { bg:"rgba(212,76,71,0.15)",  bd:"#d44c47", label:"Conflit"          },
          { bg:"rgba(51,126,169,0.1)",  bd:"#337ea9", label:"Congé"            },
          { bg:"rgba(68,131,97,0.07)",  bd:"#448361", label:"Férié religieux"  },
          { bg:"rgba(212,76,71,0.05)",  bd:"#d9730d", label:"Férié national"   },
          { bg:"rgba(55,53,47,0.03)",   bd:"rgba(55,53,47,0.2)", label:"Weekend" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex",alignItems:"center",gap:5 }}>
            <div style={{ width:12,height:12,borderRadius:2,background:l.bg,border:`1px solid ${l.bd}`,flexShrink:0 }} />
            {l.label}
          </div>
        ))}
        <div style={{ display:"flex",alignItems:"center",gap:5 }}>
          <div style={{ width:24,height:12,borderRadius:2,background:"linear-gradient(to right,rgba(15,125,219,0.2) 40%,transparent)",border:"1px solid rgba(15,125,219,0.3)",flexShrink:0 }} />
          Avancement (barre en bas)
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// GANTT VIEW — Version complète avec toggle Gantt/Calendrier
// ═══════════════════════════════════════════════════════════════
function GanttView({
  tasks, setTasks,
  candidats = [], setCandidats, setDocuments,
  wsId, showToast,
  wsWorkingDays, wsSkipHolidays, wsVacances, onUpdateWs,
}) {
  const { wd, setWd, sh, setSh, vacs, setVacs } = usePlanningSettings(wsId, wsWorkingDays, wsSkipHolidays, wsVacances, onUpdateWs);

  const [zi,           setZi]           = useState(1);
  const [editId,       setEditId]       = useState(null);
  const [form,         setForm]         = useState({ group:"", groupe:"", start:"", end:"", nbJ:1 });
  const [cw,           setCw]           = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [vacForm,      setVacForm]      = useState({ label:"", start:"", end:"" });
  const [saving,       setSaving]       = useState(false);
  const [scrollTop,    setScrollTop]    = useState(0);
  const [viewHeight,   setViewHeight]   = useState(600);

  // ── Tri & Filtres
  const [ganttSortField,   setGanttSortField]   = useState(null);
  const [ganttSortDir,     setGanttSortDir]     = useState("asc");
  const [ganttFilters,     setGanttFilters]     = useState({ group:"", groupe:"", wdays:"", start:"", end:"" });
  const [showGanttFilters, setShowGanttFilters] = useState(false);

  // ── Mode d'affichage
  const [viewMode, setViewMode] = useState("gantt"); // "gantt" | "calendar"

  const contRef  = useRef(null), hdrRef = useRef(null), scrRef = useRef(null), listRef = useRef(null);
  const scrollLeftRef = useRef(0), scrollRafRef = useRef(null);
  const rowScrollables = useRef(new Set());
  const registerScrollable   = useCallback(el => { if (!el) return; rowScrollables.current.add(el); el.scrollLeft = scrollLeftRef.current; }, []);
  const unregisterScrollable = useCallback(el => { if (el) rowScrollables.current.delete(el); }, []);

  const zoom  = ZOOMS[zi];
  const today = new Date();

  useEffect(() => { if (!contRef.current) return; const ro = new ResizeObserver(es => { for (const e of es) setCw(e.contentRect.width); }); ro.observe(contRef.current); setCw(contRef.current.offsetWidth); return () => ro.disconnect(); }, []);
  useEffect(() => { if (!listRef.current) return; const ro = new ResizeObserver(es => { for (const e of es) setViewHeight(e.contentRect.height); }); ro.observe(listRef.current); setViewHeight(listRef.current.offsetHeight || 600); return () => ro.disconnect(); }, []);

  const datesKey = useMemo(() => {
    let mn = "", mx = "";
    tasks.forEach(t => { if (t.start&&(!mn||t.start<mn)) mn=t.start; if (t.end&&(!mx||t.end>mx)) mx=t.end; });
    return `${mn}__${mx}`;
  }, [tasks]);

  const { projStart, totalDays } = useMemo(() => {
    const ts  = tasks.flatMap(t=>[t.start,t.end]).filter(Boolean).map(pd);
    const min = ts.length>0?ts.reduce((a,b)=>a<b?a:b):today;
    const max = ts.length>0?ts.reduce((a,b)=>a>b?a:b):ad(today,180);
    return { projStart: ad(min,-14), totalDays: Math.max(365, gdb(ad(min,-14),max)+60) };
  }, [datesKey]);

  const days     = useMemo(() => Array.from({length:totalDays},(_,i)=>ad(projStart,i)), [projStart,totalDays]);
  const todayOff = useMemo(() => gdb(projStart,today), [projStart]);

  const sync = useCallback(sl => {
    scrollLeftRef.current = sl;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      const val = scrollLeftRef.current;
      rowScrollables.current.forEach(el => { el.scrollLeft = val; });
      if (hdrRef.current) hdrRef.current.scrollLeft = val;
      if (scrRef.current) scrRef.current.scrollLeft = val;
      scrollRafRef.current = null;
    });
  }, []);

  const scrollStepV = (dir) => { if (listRef.current) listRef.current.scrollBy({ top: dir*RH, behavior:'smooth' }); };
  const scrollStepH = (dir) => { const ns = Math.max(0, scrollLeftRef.current + dir*zoom.cw); sync(ns); if (scrRef.current) scrRef.current.scrollLeft = ns; };

  useEffect(() => { const off = gdb(projStart,today); requestAnimationFrame(()=>sync(Math.max(0,off*zoom.cw-120))); }, []);
  useEffect(() => {
  if (viewMode !== "gantt") return;
  // Double RAF pour attendre que le DOM soit complètement remonté
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Recalculer viewHeight
      if (listRef.current) {
        setViewHeight(listRef.current.offsetHeight || 600);
        // Reset scrollTop pour forcer la virtualisation à recalculer
        setScrollTop(listRef.current.scrollTop || 0);
      }
      // Réappliquer le scrollLeft horizontal
      const sl = scrollLeftRef.current;
      rowScrollables.current.forEach(el => { el.scrollLeft = sl; });
      if (hdrRef.current) hdrRef.current.scrollLeft = sl;
      if (scrRef.current) scrRef.current.scrollLeft = sl;
    });
  });
}, [viewMode]);
  const scrollBy = n => { const cur = scrRef.current?.scrollLeft ?? scrollLeftRef.current; sync(Math.max(0,cur+n*zoom.cw)); };
  const goTodayGantt = () => sync(Math.max(0,gdb(projStart,today)*zoom.cw-120));

  const avail = cw>0?Math.min(cw*0.44,GTOT):GTOT;
  const scale = cw>0?avail/GTOT:1;
  const SC    = useMemo(()=>GCOLS.map(c=>({...c,sw:Math.max(Math.round(c.w*scale),c.key==="group"?140:c.key==="groupe"?40:c.key==="count"?40:c.key==="wdays"?40:c.key==="prog"?60:66)})),[scale]);
  const cs    = useCallback(w=>({width:w,minWidth:w,maxWidth:w,boxSizing:"border-box",flexShrink:0,display:"flex",alignItems:"center",overflow:"hidden",borderRight:`1px solid ${T.pageBdr}`}),[]);

  const weekHdrs = useMemo(()=>{
    const r=[]; let wi=0;
    while(wi<days.length){ const d=days[wi],span=Math.min(days.length-wi,7-(d.getDay()===0?6:d.getDay()-1)); r.push({date:d,span,key:wi}); wi+=span; }
    return r;
  },[days]);

  const activeGroupKeys = useMemo(()=>new Set(candidats.map(c=>`${(c.theme||"").trim()}||${String(c.groupe||"1").trim()}`)),[candidats]);

  const candidatCountByKey = useMemo(()=>{
    const m={};
    candidats.forEach(c=>{ const k=`${(c.theme||"").trim()}||${String(c.groupe||"1").trim()}`; m[k]=(m[k]||0)+1; });
    return m;
  },[candidats]);

  

  // ── 1. displayTasks
  const displayTasks = useMemo(()=>{
    const finalTasksMap=new Map(), existingTasksMap=new Map();
    tasks.forEach(t=>{ const theme=(t.group||"").trim(); let grp=String(t.groupe||"").trim(); if(!grp&&t.name?.includes(" — Grp "))grp=t.name.split(" — Grp ")[1]; if(!grp)grp="1"; existingTasksMap.set(`${theme}||${grp}`,{...t,group:theme,groupe:grp}); });
    activeGroupKeys.forEach(key=>{
      if(existingTasksMap.has(key)){ finalTasksMap.set(key,existingTasksMap.get(key)); }
      else {
        const [theme,grp]=key.split("||");
        const sampleCand=candidats.find(c=>(c.theme||"").trim()===theme&&String(c.groupe||"1")===grp);
        finalTasksMap.set(key,{ id:`virtual-${key}`,group:theme,groupe:grp,name:`${theme} — Grp ${grp}`,start:sampleCand?.dateDebut||"",end:sampleCand?.dateFin||"",halfDay:sampleCand?.halfDay||false,slot:sampleCand?.slot||null,isVirtual:true });
      }
    });
    return Array.from(finalTasksMap.values()).sort((a,b)=>a.group!==b.group?a.group.localeCompare(b.group):parseInt(a.groupe)-parseInt(b.groupe));
  },[tasks,activeGroupKeys,candidats]);

  // ── 2. Conflits
  const { liveConflicts, liveConflictTaskKeys, conflictsByType, conflictTypesMap } = useTaskConflicts(displayTasks,candidats,wd,sh,vacs);
  const [showConflicts,setShowConflicts]=useState(true);
  const [liveResolving,setLiveResolving]=useState(false);
  const [lastResCount,setLastResCount]=useState(null);
  const prevCfCount=useRef(0);
  useEffect(()=>{ if(liveConflicts.length>prevCfCount.current)setShowConflicts(true); prevCfCount.current=liveConflicts.length; },[liveConflicts.length]);

  // ── 3. slotMap
  const slotMap = useMemo(()=>{
    const map={},byDate={};
    displayTasks.forEach(t=>{ if(!t.halfDay)return; const k=t.start||""; if(!byDate[k])byDate[k]=[]; byDate[k].push(t.id); });
    Object.values(byDate).forEach(ids=>ids.forEach((id,i)=>{ map[id]=i%2===0?"matin":"après-midi"; }));
    return map;
  },[displayTasks]);

  // ── 4. metaCache
  const metaCache = useMemo(()=>{
    const cache={},now=new Date(); now.setHours(0,0,0,0);
    const nowStr=d2s(now);
    displayTasks.forEach(t=>{
      if(!t.start||!t.end){ cache[t.id]={wdays:0,prog:{pct:0}}; return; }
      const isHD=t.halfDay===true, wdays=isHD?0.5:calcWD(t.start,t.end,wd,sh,vacs);
      let pct=0;
      if(!isHD){ if(nowStr<t.start)pct=0; else if(nowStr>t.end)pct=100; else { const el=Math.min(wdays,calcWD(t.start,nowStr,wd,sh,vacs)); pct=wdays>0?Math.round(el/wdays*100):0; } }
      cache[t.id]={wdays,prog:{pct}};
    });
    return cache;
  },[displayTasks,wd,sh,vacs]);

  // ── 5. displayTasksFiltered
  const displayTasksFiltered = useMemo(()=>{
    let rows=[...displayTasks];
    if(ganttFilters.group.trim()){ const q=ganttFilters.group.trim().toLowerCase(); rows=rows.filter(t=>(t.group||"").toLowerCase().includes(q)); }
    if(ganttFilters.groupe.trim()) rows=rows.filter(t=>String(t.groupe||"").includes(ganttFilters.groupe.trim()));
    if(ganttFilters.wdays.trim())  rows=rows.filter(t=>String(metaCache[t.id]?.wdays??"").includes(ganttFilters.wdays.trim()));
    if(ganttFilters.start.trim())  rows=rows.filter(t=>(t.start||"").includes(ganttFilters.start.trim()));
    if(ganttFilters.end.trim())    rows=rows.filter(t=>(t.end||"").includes(ganttFilters.end.trim()));
    if(ganttSortField){
      rows=[...rows].sort((a,b)=>{
        let va,vb;
        if(ganttSortField==="group"){ va=(a.group||"").toLowerCase(); vb=(b.group||"").toLowerCase(); }
        else if(ganttSortField==="groupe"){ va=parseInt(a.groupe)||0; vb=parseInt(b.groupe)||0; }
        else if(ganttSortField==="wdays"){ va=metaCache[a.id]?.wdays??0; vb=metaCache[b.id]?.wdays??0; }
        else if(ganttSortField==="start"){ va=a.start||"9999"; vb=b.start||"9999"; }
        else if(ganttSortField==="end"){ va=a.end||"9999"; vb=b.end||"9999"; }
        else if(ganttSortField==="count"){ va=candidatCountByKey[`${(a.group||"").trim()}||${String(a.groupe||"")}`]||0; vb=candidatCountByKey[`${(b.group||"").trim()}||${String(b.groupe||"")}`]||0; }
        else if(ganttSortField==="prog"){ va=metaCache[a.id]?.prog?.pct??0; vb=metaCache[b.id]?.prog?.pct??0; }
        if(va<vb)return ganttSortDir==="asc"?-1:1;
        if(va>vb)return ganttSortDir==="asc"?1:-1;
        return 0;
      });
    }
    return rows;
  },[displayTasks,ganttFilters,ganttSortField,ganttSortDir,metaCache,candidatCountByKey]);

  const updTask = useCallback(async (taskId,start,end)=>{
    const task=tasks.find(t=>t.id===taskId||t._id===taskId); if(!task)return;
    const theme=task.group, groupe=task.groupe||"";
    setTasks(prev=>prev.map(t=>(t.id===taskId||t._id===taskId)?{...t,start,end}:t));
    if(typeof setCandidats==="function") setCandidats(prev=>prev.map(c=>(c.theme===theme&&String(c.groupe)===String(groupe))?{...c,dateDebut:start,dateFin:end}:c));
    if(typeof setDocuments==="function") setDocuments(prev=>prev.map(d=>(d.theme===theme&&String(d.groupe)===String(groupe))?{...d,dateDoc:start}:d));
    try { await apiFetch(`/workspaces/${wsId}/gantt/group-dates`,{method:"PATCH",body:{theme,groupe:String(groupe),start,end}}); }
    catch(err){ try{ await apiFetch(`/tasks/${taskId}/dates`,{method:"PATCH",body:{start,end}}); }catch(err2){ showToast("Erreur synchronisation : "+err2.message); } }
  },[tasks,wsId,setTasks,setCandidats,setDocuments,showToast]);

  const updTaskSlot = useCallback(async (taskId,newSlot)=>{
    const task=tasks.find(t=>t.id===taskId||t._id===taskId); if(!task)return;
    const realId=task._id||task.id;
    setTasks(prev=>prev.map(t=>(t.id===taskId||t._id===taskId)?{...t,slot:newSlot}:t));
    if(typeof setCandidats==="function") setCandidats(prev=>prev.map(c=>(c.theme===task.group&&String(c.groupe)===String(task.groupe))?{...c,slot:newSlot}:c));
    try{ await apiFetch(`/tasks/${realId}`,{method:"PUT",body:{...task,slot:newSlot,_id:realId}}); }catch(err){ showToast("Erreur créneau : "+err.message); }
  },[tasks,setTasks,setCandidats,showToast]);

  function fc(field,val){
    setForm(p=>{
      const u={...p,[field]:val};
      if(field==="start"&&u.start){ u.start=snap(u.start,wd,sh,vacs); if(u.nbJ)u.end=addWD(u.start,u.nbJ,wd,sh,vacs); }
      if(field==="end"&&u.end){ u.end=snap(u.end,wd,sh,vacs); if(u.start)u.nbJ=calcWD(u.start,u.end,wd,sh,vacs); }
      if(field==="nbJ"){ const n=Math.max(1,Math.round(parseFloat(val)||1)); u.nbJ=n; if(u.start)u.end=addWD(u.start,n,wd,sh,vacs); }
      return u;
    });
  }

  const allGroups = useMemo(()=>[...new Set(tasks.map(t=>t.group).filter(Boolean))],[tasks]);

  const startEdit = t => {
    setEditId(t.id);
    let eGrp=t.groupe||"";
    if(!eGrp&&t.name?.includes(" — Grp "))eGrp=t.name.split(" — Grp ")[1];
    setForm({group:t.group||"",groupe:eGrp,start:t.start,end:t.end,nbJ:calcWD(t.start,t.end,wd,sh,vacs)});
  };

  const syncSnapshot = async (updatedTasks)=>{ if(!wsId)return; try{ await apiFetch(`/workspaces/${wsId}/gantt/tasks`,{method:"PATCH",body:{tasks:updatedTasks}}); }catch(err){console.warn("Sync:",err.message);} };

  const commit = async ()=>{
    if(!form.group.trim()||!form.start||!form.end||saving)return;
    const ns=snap(form.start,wd,sh,vacs), ne=addWD(ns,calcWD(form.start,form.end,wd,sh,vacs),wd,sh,vacs);
    const bName=form.group.trim()+(form.groupe?.trim()?` — Grp ${form.groupe.trim()}`:"");
    const body={name:bName,group:form.group.trim(),groupe:form.groupe?.trim()||"",start:ns,end:ne};
    setSaving(true);
    try{
      if(editId==="new"){ const r=await apiFetch(`/workspaces/${wsId}/tasks`,{method:"POST",body}); const created=r.data||r; created.id=created._id||created.id; setTasks(p=>{const next=[...p,created];syncSnapshot(next);return next;}); }
      else { const r=await apiFetch(`/tasks/${editId}`,{method:"PUT",body}); const updated=r.data||r; updated.id=updated._id||updated.id; setTasks(p=>{const next=p.map(t=>(t.id===editId||t._id===editId)?updated:t);syncSnapshot(next);return next;}); if(typeof setCandidats==="function")setCandidats(prev=>prev.map(c=>(c.theme===body.group&&String(c.groupe)===String(body.groupe))?{...c,dateDebut:ns,dateFin:ne}:c)); }
      setEditId(null);
    }catch(e){showToast("Erreur sauvegarde : "+e.message);}
    setSaving(false);
  };

  const delTask = async id=>{
    setTasks(p=>{const next=p.filter(t=>t.id!==id&&t._id!==id);syncSnapshot(next);return next;});
    if(editId===id)setEditId(null);
    try{await apiFetch(`/tasks/${id}`,{method:"DELETE"});}catch(e){showToast("Erreur suppression : "+e.message);}
  };

  async function handleAutoResolve(){
    setLiveResolving(true); setLastResCount(null);
    requestAnimationFrame(()=>{ setTimeout(async()=>{
      const taskMap={}; displayTasks.forEach(t=>{taskMap[`${t.group}||${t.groupe||""}`]={start:t.start,end:t.end,jours:calcWD(t.start,t.end,wd,sh,vacs)};});
      const virtual=candidats.filter(c=>c.theme&&c.groupe).map(c=>({...c,start:taskMap[`${c.theme}||${c.groupe}`]?.start||"",end:taskMap[`${c.theme}||${c.groupe}`]?.end||"",jours:taskMap[`${c.theme}||${c.groupe}`]?.jours||c.jours||1})).filter(c=>c.start&&c.end);
      const {result:fixed,resolutions,remainingCount}=resolveConflictsAuto(virtual,wd,sh,vacs);
      const newDates={}; fixed.forEach(r=>{const k=`${r.theme}||${r.groupe}`;if(!newDates[k])newDates[k]={start:r.start,end:r.end};});
      for(const[k,dates]of Object.entries(newDates)){const task=displayTasks.find(t=>`${t.group}||${t.groupe||""}`===k);if(task&&(task.start!==dates.start||task.end!==dates.end))await updTask(task.id||task._id,dates.start,dates.end);}
      setLastResCount({resolved:resolutions.length,remaining:remainingCount});
      if(remainingCount===0)showToast(`${resolutions.length} chevauchement(s) résolus`,"success");
      else showToast(`${resolutions.length} résolutions, ${remainingCount} persistant(s)`,"error");
      setLiveResolving(false);
    },0);});
  }

  const exportGantt = ()=>{
    const data=displayTasks.map(t=>{const meta=metaCache[t.id]||{wdays:1,prog:{pct:0}};const k=`${t.group}||${t.groupe||""}`;let grp=t.groupe||"";if(!grp&&t.name?.includes(" — Grp "))grp=t.name.split(" — Grp ")[1];return{"Thème / Formation":t.group||"","Groupe":grp?`G${grp}`:"—","Candidats":candidatCountByKey[k]||0,"Nb jours":t.halfDay?0.5:meta.wdays,"Début":t.start?fmt(t.start):"—","Fin":t.end?fmt(t.end):"—","Avancement (%)":meta.prog.pct,"Statut":meta.prog.pct===100?"Terminé":meta.prog.pct===0?"Non démarré":"En cours"};});
    const ws=XLSX.utils.json_to_sheet(data); ws["!cols"]=[{wch:40},{wch:8},{wch:10},{wch:10},{wch:12},{wch:12},{wch:14},{wch:14}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Planification"); XLSX.writeFile(wb,"planification_export.xlsx");
    showToast(`${data.length} tâche(s) exportée(s)`,"success");
  };

  const addVac = ()=>{ if(!vacForm.label.trim()||!vacForm.start||!vacForm.end||vacForm.start>vacForm.end)return; setVacs(p=>[...p,{id:uid(),...vacForm}]); setVacForm({label:"",start:"",end:""}); };

  const iS  = {padding:"5px 9px",borderRadius:4,border:`1px solid rgba(55,53,47,0.18)`,fontSize:12,color:T.pageText,fontFamily:"inherit",outline:"none",background:"#fff"};
  const fI  = e=>{e.target.style.borderColor=T.accent;e.target.style.boxShadow=`0 0 0 2px ${T.accent}18`;};
  const fO  = e=>{e.target.style.borderColor="rgba(55,53,47,0.18)";e.target.style.boxShadow="none";};
  const tbBtn = (active,onClick,children)=>(
    <button onClick={onClick} style={{height:26,padding:"0 9px",display:"flex",alignItems:"center",gap:5,fontSize:13,color:active?T.pageText:T.pageSub,background:active?"rgba(55,53,47,0.1)":"transparent",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontWeight:active?500:400}} onMouseEnter={e=>e.currentTarget.style.background="rgba(55,53,47,0.07)"} onMouseLeave={e=>e.currentTarget.style.background=active?"rgba(55,53,47,0.1)":"transparent"}>{children}</button>
  );

  function EditRow({isNew}){
    const pickerGroupRows=displayTasks.map(t=>({key:`${(t.group||"").trim()}||${String(t.groupe||"")}`,theme:t.group||"",groupe:t.groupe||"",start:t.start||"",end:t.end||"",halfDay:t.halfDay||false,slot:t.slot||null}));
    const pickerCurrentKey=(editId&&editId!=="new")?`${form.group.trim()}||${form.groupe?.trim()||""}`:null;
    return (
      <div style={{display:"flex",height:RH+6,background:"rgba(55,53,47,0.025)",borderBottom:`1px solid ${T.pageBdr}`}}>
        <div style={{display:"flex",flexShrink:0}}>
          <div style={{...cs(SC[0].sw),padding:"0 8px",gap:6}}>
            <div style={{width:2,height:14,borderRadius:1,background:T.accent,flexShrink:0}}/>
            <input autoFocus value={form.group} onChange={e=>fc("group",e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditId(null);}} placeholder="Thème / Formation" list="grps_g" style={{flex:1,minWidth:0,fontSize:13,fontWeight:600,background:"transparent",outline:"none",color:T.pageText,fontFamily:"inherit",border:"none"}}/>
            <datalist id="grps_g">{allGroups.map(g=><option key={g} value={g}/>)}</datalist>
          </div>
          <div style={{...cs(SC[1].sw),padding:"0 4px",justifyContent:"center"}}><input value={form.groupe} onChange={e=>fc("groupe",e.target.value)} placeholder="N°" style={{width:"100%",fontSize:12,background:"transparent",outline:"none",color:T.pageText,fontFamily:"inherit",border:"none",textAlign:"center"}}/></div>
          <div style={{...cs(SC[2].sw),justifyContent:"center",padding:"0 4px"}}><span style={{fontSize:11,color:T.pageTer}}>—</span></div>
          <div style={{...cs(SC[3].sw),justifyContent:"center",padding:"0 4px"}}><input type="number" min={1} step={1} value={form.nbJ} onChange={e=>fc("nbJ",e.target.value)} style={{width:"100%",fontSize:12,background:"transparent",outline:"none",color:T.pageText,fontFamily:"monospace",textAlign:"center",border:"none"}}/></div>
          <div style={{...cs(SC[4].sw),justifyContent:"center",padding:"0 2px"}}>
            <RichDatePicker value={form.start} onChange={val=>fc("start",val)} wd={wd} sh={sh} vacs={vacs} groupRows={pickerGroupRows} currentKey={pickerCurrentKey}/>
          </div>
          <div style={{...cs(SC[5].sw),padding:"0 10px"}}><span style={{fontSize:11,color:T.pageTer}}>{form.start&&form.end?`${calcWD(form.start,form.end,wd,sh,vacs)}j ouvrés`:"—"}</span></div>
          <div style={{...cs(SC[6].sw),justifyContent:"center",padding:"0 2px",borderRight:`1px solid ${T.pageBdr}`}}>
            <RichDatePicker value={form.end} onChange={val=>fc("end",val)} min={form.start||undefined} wd={wd} sh={sh} vacs={vacs} groupRows={pickerGroupRows} currentKey={pickerCurrentKey}/>
          </div>
        </div>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:8,padding:"0 12px"}}>
          <button onClick={commit} disabled={saving} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",fontSize:13,fontWeight:500,color:"#fff",background:"#37352f",border:"none",borderRadius:4,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit",opacity:saving?0.7:1}}>
            {saving?<Spinner size={11} color="#fff"/>:<Check style={{width:11,height:11}}/>}{isNew?"Ajouter":"Enregistrer"}
          </button>
          <button onClick={()=>setEditId(null)} style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:`1px solid ${T.pageBdr}`,background:"#fff",cursor:"pointer",color:T.pageSub}}><X style={{width:11,height:11}}/></button>
        </div>
      </div>
    );
  }

  const roomConflictDetails = useMemo(()=>{
    const problems=[],processedKeys=new Set();
    displayTasks.forEach(t=>{
      const gKey=`${(t.group||"").trim()}||${String(t.groupe||"")}`;
      if(conflictTypesMap[gKey]?.has("salle_pleine")&&!processedKeys.has(gKey)){
        const sample=candidats.find(c=>c.theme===t.group&&String(c.groupe)===String(t.groupe));
        const lieu=sample?.lieu||sample?.extraData?.lieu||"Lieu non défini";
        const cap=Number(sample?.nbrEspace||sample?.extraData?.nbrEspace||1);
        const competitors=displayTasks.filter(other=>{
          const oKey=`${(other.group||"").trim()}||${String(other.groupe||"")}`;
          if(oKey===gKey)return false;
          const otherSample=candidats.find(c=>c.theme===other.group&&String(c.groupe)===String(other.groupe));
          const oLieu=otherSample?.lieu||otherSample?.extraData?.lieu||"Lieu non défini";
          if(oLieu!==lieu)return false;
          if(!(other.start<=t.end&&other.end>=t.start))return false;
          if(t.halfDay&&other.halfDay)return t.slot===other.slot;
          return true;
        });
        problems.push({group:t.group,groupeNo:t.groupe,lieu,cap,start:t.start,end:t.end,competitors:competitors.map(c=>`${c.group} (G${c.groupe})`)});
        processedKeys.add(gKey);
      }
    });
    return problems;
  },[displayTasks,conflictTypesMap,candidats]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div ref={contRef} style={{padding:"60px 40px 80px",width:"100%",boxSizing:"border-box"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse-conflict{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Titre */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
        <CalendarRange style={{width:24,height:24,color:T.pageSub,strokeWidth:1.6}}/>
        <h1 style={{fontSize:32,fontWeight:800,color:T.pageText,letterSpacing:"-0.04em",margin:0}}>Planification</h1>
      </div>
      <div style={{fontSize:13,color:T.pageSub,marginBottom:16}}>
        {displayTasksFiltered.length!==displayTasks.length
          ? <>{displayTasksFiltered.length} / {displayTasks.length} groupe{displayTasks.length!==1?"s":""} · </>
          : <>{displayTasks.length} groupe{displayTasks.length!==1?"s":""} · </>
        }
        {candidats.length} candidat{candidats.length!==1?"s":""} · {7-wd.length}j ouvrés/semaine
      </div>

      {/* ── Barre outils ── */}
      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:12,flexWrap:"wrap"}}>

        {/* Toggle Gantt / Calendrier */}
        <div style={{display:"flex",border:`1px solid ${T.pageBdr}`,borderRadius:4,overflow:"hidden"}}>
          <button onClick={()=>setViewMode("gantt")} style={{height:26,padding:"0 11px",display:"flex",alignItems:"center",gap:5,fontSize:12,border:"none",borderRight:`1px solid ${T.pageBdr}`,background:viewMode==="gantt"?"rgba(55,53,47,0.1)":"transparent",color:viewMode==="gantt"?T.pageText:T.pageSub,cursor:"pointer",fontFamily:"inherit",fontWeight:viewMode==="gantt"?600:400}}>
            <GanttChart style={{width:12,height:12}} /> Gantt
          </button>
          <button onClick={()=>setViewMode("calendar")} style={{height:26,padding:"0 11px",display:"flex",alignItems:"center",gap:5,fontSize:12,border:"none",background:viewMode==="calendar"?"rgba(55,53,47,0.1)":"transparent",color:viewMode==="calendar"?T.pageText:T.pageSub,cursor:"pointer",fontFamily:"inherit",fontWeight:viewMode==="calendar"?600:400}}>
            <CalendarDays style={{width:12,height:12}}/> Calendrier
          </button>
        </div>

        <div style={{width:1,height:16,background:T.pageBdr,margin:"0 4px"}}/>
        {tbBtn(sh,()=>setSh(v=>!v),<>🇲🇦 Fériés</>)}
        <div style={{width:1,height:16,background:T.pageBdr,margin:"0 4px"}}/>
        {tbBtn(showSettings,()=>setShowSettings(v=>!v),<><Settings style={{width:13,height:13}}/> Paramètres</>)}
        {tbBtn(showGanttFilters,()=>setShowGanttFilters(v=>!v),
          <><Search style={{width:13,height:13}}/> Filtrer
            {Object.values(ganttFilters).some(v=>v.trim())&&(
              <span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99,background:T.accent,color:"#fff",marginLeft:2}}>
                {Object.values(ganttFilters).filter(v=>v.trim()).length}
              </span>
            )}
          </>
        )}
        {Object.values(ganttFilters).some(v=>v.trim())&&(
          <button onClick={()=>setGanttFilters({group:"",groupe:"",wdays:"",start:"",end:""})} style={{height:26,padding:"0 8px",display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#d44c47",background:"rgba(212,76,71,0.06)",border:"1px solid rgba(212,76,71,0.2)",borderRadius:4,cursor:"pointer",fontFamily:"inherit"}}>
            <X style={{width:10,height:10}}/> Reset filtres
          </button>
        )}

        {/* Navigation Gantt (masquée en mode calendrier) */}
        {viewMode==="gantt"&&<div style={{width:1,height:16,background:T.pageBdr,margin:"0 4px"}}/>}
        {viewMode==="gantt"&&(
          <div style={{display:"flex",border:`1px solid ${T.pageBdr}`,borderRadius:4,overflow:"hidden"}}>
            <button style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRight:`1px solid ${T.pageBdr}`,background:"transparent",cursor:"pointer",color:T.pageSub}} onClick={()=>scrollBy(-zoom.days)}><ChevronLeft style={{width:12,height:12}}/></button>
            <button style={{height:26,padding:"0 8px",border:"none",background:"transparent",cursor:"pointer",fontSize:12,color:T.pageSub,fontFamily:"inherit"}} onClick={goTodayGantt}>Aujourd'hui</button>
            <button style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderLeft:`1px solid ${T.pageBdr}`,background:"transparent",cursor:"pointer",color:T.pageSub}} onClick={()=>scrollBy(zoom.days)}><ChevronRight style={{width:12,height:12}}/></button>
          </div>
        )}
        {viewMode==="gantt"&&(
          <div style={{display:"flex",border:`1px solid ${T.pageBdr}`,borderRadius:4,overflow:"hidden"}}>
            <button style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRight:`1px solid ${T.pageBdr}`,background:"transparent",cursor:"pointer",color:T.pageSub,opacity:zi===0?0.3:1}} onClick={()=>setZi(z=>Math.max(0,z-1))} disabled={zi===0}><ZoomIn style={{width:12,height:12}}/></button>
            <span style={{padding:"0 8px",lineHeight:"26px",fontSize:12,color:T.pageSub}}>{zoom.label}</span>
            <button style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderLeft:`1px solid ${T.pageBdr}`,background:"transparent",cursor:"pointer",color:T.pageSub,opacity:zi===ZOOMS.length-1?0.3:1}} onClick={()=>setZi(z=>Math.min(ZOOMS.length-1,z+1))} disabled={zi===ZOOMS.length-1}><ZoomOut style={{width:12,height:12}}/></button>
          </div>
        )}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
          <button onClick={exportGantt} disabled={displayTasks.length===0} style={{display:"flex",alignItems:"center",gap:5,height:26,padding:"0 10px",fontSize:13,fontWeight:500,color:T.pageText,background:"transparent",border:`1px solid rgba(55,53,47,0.25)`,borderRadius:4,cursor:displayTasks.length===0?"not-allowed":"pointer",fontFamily:"inherit",opacity:displayTasks.length===0?0.4:1}}>
            <FileUp style={{width:13,height:13}}/> Exporter Excel
          </button>
          <button onClick={()=>{setEditId("new");setForm({group:"",groupe:"",start:"",end:"",nbJ:1});}} style={{display:"flex",alignItems:"center",gap:5,height:26,padding:"0 10px",fontSize:13,fontWeight:500,color:"#fff",background:"#37352f",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"inherit"}}>
            <Plus style={{width:13,height:13}}/> Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Bannière conflits */}
      {(liveConflicts.length>0||liveConflictTaskKeys.size>0)&&showConflicts&&(
        <ConflictBanner liveConflicts={liveConflicts} roomConflictDetails={roomConflictDetails} conflictsByType={conflictsByType} onAutoResolve={handleAutoResolve} onDismiss={()=>setShowConflicts(false)} liveResolving={liveResolving} lastResolutionCount={lastResCount} conflictTypesMap={conflictTypesMap}/>
      )}
      {liveConflicts.length===0&&liveConflictTaskKeys.size===0&&candidats.length>0&&displayTasks.length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:4,background:"rgba(68,131,97,0.08)",border:"1px solid rgba(68,131,97,0.2)",marginBottom:8}}>
          <CheckCheck style={{width:12,height:12,color:"#448361",flexShrink:0}}/>
          <span style={{fontSize:12,color:"#448361",fontWeight:500}}>Aucun conflit — planification cohérente</span>
        </div>
      )}

      {/* Panneau paramètres */}
      {showSettings&&(
        <div style={{border:`1px solid ${T.pageBdr}`,borderRadius:6,background:"rgba(55,53,47,0.02)",padding:"20px 24px",marginBottom:16,display:"flex",flexDirection:"column",gap:20}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:T.pageSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Jours de weekend</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[["Lun",1],["Mar",2],["Mer",3],["Jeu",4],["Ven",5],["Sam",6],["Dim",0]].map(([label,d])=>{
                const isW=wd.includes(d);
                return(<button key={d} onClick={()=>setWd(p=>p.includes(d)?p.length>=6?p:p.filter(x=>x!==d):[...p,d])} style={{padding:"5px 12px",borderRadius:4,fontSize:12,fontWeight:isW?600:400,border:`1px solid ${isW?"rgba(55,53,47,0.35)":T.pageBdr}`,background:isW?"rgba(55,53,47,0.1)":"#fff",color:isW?T.pageText:T.pageSub,cursor:"pointer",fontFamily:"inherit"}}>{label}{isW&&<Check style={{width:10,height:10,marginLeft:4,verticalAlign:"middle"}}/>}</button>);
              })}
            </div>
          </div>
          <div style={{height:1,background:T.pageBdr}}/>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:T.pageSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Périodes de congé</div>
            {vacs.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
                {vacs.map(v=>(<div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 12px",borderRadius:4,border:`1px solid ${T.pageBdr}`,background:"rgba(51,126,169,0.06)"}}>
                  <div style={{width:8,height:8,borderRadius:2,background:T.tagBlue.text,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:600,color:T.pageText,flex:1}}>{v.label}</span>
                  <span style={{fontSize:12,color:T.pageSub,fontFamily:"monospace"}}>{fmt(v.start)} → {fmt(v.end)}</span>
                  <button onClick={()=>setVacs(p=>p.filter(x=>x.id!==v.id))} style={{width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"transparent",cursor:"pointer",color:T.pageTer}}><Trash2 style={{width:10,height:10}}/></button>
                </div>))}
              </div>
            )}
            <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div style={{flex:"2 1 160px"}}><div style={{fontSize:10,color:T.pageTer,marginBottom:3}}>Libellé</div><input value={vacForm.label} onChange={e=>setVacForm(p=>({...p,label:e.target.value}))} placeholder="Ex : Ramadan" style={{...iS,width:"100%",boxSizing:"border-box"}} onFocus={fI} onBlur={fO}/></div>
              <div style={{flex:"1 1 120px"}}><div style={{fontSize:10,color:T.pageTer,marginBottom:3}}>Début</div><input type="date" value={vacForm.start} onChange={e=>setVacForm(p=>({...p,start:e.target.value}))} style={{...iS,width:"100%",boxSizing:"border-box"}} onFocus={fI} onBlur={fO}/></div>
              <div style={{flex:"1 1 120px"}}><div style={{fontSize:10,color:T.pageTer,marginBottom:3}}>Fin</div><input type="date" value={vacForm.end} min={vacForm.start||undefined} onChange={e=>setVacForm(p=>({...p,end:e.target.value}))} style={{...iS,width:"100%",boxSizing:"border-box"}} onFocus={fI} onBlur={fO}/></div>
              <button onClick={addVac} style={{display:"flex",alignItems:"center",gap:5,height:30,padding:"0 12px",fontSize:12,fontWeight:500,color:"#fff",background:"#37352f",border:"none",borderRadius:4,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0}}><Plus style={{width:12,height:12}}/> Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VUE CALENDRIER ── */}
      {viewMode==="calendar"&&(
        <CalendarView
          displayTasksFiltered={displayTasksFiltered}
          metaCache={metaCache}
          candidatCountByKey={candidatCountByKey}
          conflictTypesMap={conflictTypesMap}
          liveConflictTaskKeys={liveConflictTaskKeys}
          wd={wd} sh={sh} vacs={vacs}
          onEditTask={task=>startEdit(task)}
        />
      )}

      {/* ── VUE GANTT ── */}
      {viewMode==="gantt"&&(
      <div style={{border:`1px solid ${T.pageBdr}`,borderRadius:4,background:"#fff"}}>
        {/* Header sticky */}
        {(()=>{
          const HDR_H=sh?52:30,BADGE_H=sh?22:0,WEEK_H=14,DAY_H=16,FILTER_H=showGanttFilters?24:0,totalHdrH=HDR_H+FILTER_H;
          return (
            <div style={{display:"flex",background:"#f7f7f7",borderBottom:`1px solid ${T.pageBdr}`,height:totalHdrH,position:"sticky",top:0,zIndex:20,borderTopLeftRadius:3,borderTopRightRadius:3}}>
              <div style={{display:"flex",flexShrink:0,flexDirection:"column",justifyContent:"flex-end"}}>
                <div style={{display:"flex",height:HDR_H}}>
                  {SC.map(col=>{
                    const isSorted=ganttSortField===col.key;
                    const sortable=["group","groupe","count","wdays","start","end","prog"].includes(col.key);
                    return(
                      <div key={col.key} onClick={()=>{ if(!sortable)return; if(ganttSortField===col.key)setGanttSortDir(d=>d==="asc"?"desc":"asc"); else{setGanttSortField(col.key);setGanttSortDir("asc");} }}
                        style={{...cs(col.sw),justifyContent:CHDR[col.key]??"flex-start",padding:["wdays","start","end","count"].includes(col.key)?"0 4px":"0 8px",height:"100%",alignItems:"flex-end",paddingBottom:4,cursor:sortable?"pointer":"default",userSelect:"none",gap:3,background:isSorted?`${T.accent}06`:"transparent"}}>
                        <span style={{fontSize:10,fontWeight:600,color:isSorted?T.accent:T.pageTer,textTransform:"uppercase",letterSpacing:"0.06em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{col.label}</span>
                        {sortable&&(isSorted?(ganttSortDir==="asc"?<ArrowUp style={{width:9,height:9,color:T.accent,flexShrink:0}}/>:<ArrowDown style={{width:9,height:9,color:T.accent,flexShrink:0}}/>):<ArrowUpDown style={{width:9,height:9,color:"rgba(55,53,47,0.2)",flexShrink:0}}/>)}
                      </div>
                    );
                  })}
                </div>
                {showGanttFilters&&(
                  <div style={{display:"flex",height:FILTER_H,borderTop:`1px solid ${T.pageBdr}`,background:"rgba(55,53,47,0.015)"}}>
                    {SC.map(col=>{
                      const filterable=["group","groupe","wdays","start","end"].includes(col.key);
                      const val=ganttFilters[col.key]||"";
                      return(
                        <div key={col.key} style={{...cs(col.sw),padding:"0 3px",alignItems:"center"}}>
                          {filterable?(<input value={val} onChange={e=>setGanttFilters(p=>({...p,[col.key]:e.target.value}))} placeholder="…" style={{width:"100%",fontSize:10,padding:"1px 4px",border:`1px solid ${val?T.accent:"rgba(55,53,47,0.15)"}`,borderRadius:3,outline:"none",fontFamily:"inherit",color:T.pageText,background:val?`${T.accent}08`:"#fff",boxSizing:"border-box"}}/>):<div style={{width:"100%",height:18}}/>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{flex:1,overflow:"hidden"}}>
                <div ref={hdrRef} style={{overflowX:"hidden",width:"100%",height:"100%"}}>
                  <div style={{width:totalDays*zoom.cw,height:"100%",position:"relative"}}>
                    {sh&&(
                      <div style={{position:"absolute",top:0,left:0,right:0,height:BADGE_H,overflow:"hidden"}}>
                        {days.map((d,i)=>{ const ds=d2s(d),hol=HMAP[ds]; if(!hol)return null; const color=hol.religious?"#448361":"#9f6b53",dot=hol.religious?"#448361":"#d9730d",bw=zoom.cw>=28?Math.min(zoom.cw*4,hol.title.length*7+20):zoom.cw-2;
                          return(<div key={ds} title={`${hol.title} — ${fmt(ds)}`} style={{position:"absolute",left:i*zoom.cw+2,top:3,height:BADGE_H-6,width:bw,zIndex:10,display:"flex",alignItems:"center",gap:4,padding:"0 5px",borderRadius:3,background:"#fff",border:`1px solid rgba(55,53,47,0.14)`,overflow:"hidden",pointerEvents:"none"}}>
                            <div style={{width:5,height:5,borderRadius:"50%",background:dot,flexShrink:0}}/>{zoom.cw>=28&&<span style={{fontSize:9,fontWeight:500,color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hol.title}</span>}
                          </div>);
                        })}
                      </div>
                    )}
                    <div style={{position:"absolute",top:BADGE_H,left:0,right:0,display:"flex",borderBottom:`1px solid ${T.pageBdr}`,height:WEEK_H}}>
                      {weekHdrs.map(wh=>(<div key={wh.key} style={{width:wh.span*zoom.cw,minWidth:wh.span*zoom.cw,borderRight:`1px solid ${T.pageBdr}`,display:"flex",alignItems:"center",padding:"0 4px",overflow:"hidden"}}><span style={{fontSize:9,color:T.pageTer,whiteSpace:"nowrap"}}>{String(wh.date.getDate()).padStart(2,"0")}/{String(wh.date.getMonth()+1).padStart(2,"0")}</span></div>))}
                    </div>
                    <div style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",height:DAY_H}}>
                      {zoom.halfDay
                        ?days.map((d,i)=>{ const ds=d2s(d),isW=wd.includes(d.getDay()),isT=d.toDateString()===today.toDateString(),hol=sh?HMAP[ds]:null,vac=isVac(d,vacs); let bg="transparent"; if(vac)bg="rgba(51,126,169,0.1)";else if(hol)bg=hol.religious?"rgba(68,131,97,0.08)":"rgba(212,76,71,0.06)";else if(isW)bg="rgba(55,53,47,0.04)"; const hw=zoom.cw/2;
                          return(<span key={i} style={{display:"contents"}}><div style={{width:hw,minWidth:hw,borderRight:`1px dashed rgba(203,145,47,0.4)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:bg,borderLeft:isT?"2px solid "+T.accent:"none"}}><span style={{fontSize:8,fontWeight:700,color:"#8a6520"}}>AM</span></div><div style={{width:hw,minWidth:hw,borderRight:`1px solid ${T.pageBdr}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:bg}}><span style={{fontSize:8,color:T.pageTer}}>PM</span></div></span>);
                        })
                        :days.map((d,i)=>{ const ds=d2s(d),isW=wd.includes(d.getDay()),isT=d.toDateString()===today.toDateString(),hol=sh?HMAP[ds]:null,vac=isVac(d,vacs); let bg="transparent"; if(vac)bg="rgba(51,126,169,0.1)";else if(hol)bg=hol.religious?"rgba(68,131,97,0.08)":"rgba(212,76,71,0.06)";else if(isW)bg="rgba(55,53,47,0.04)";
                          return(<div key={i} style={{width:zoom.cw,minWidth:zoom.cw,borderRight:`1px solid ${T.pageBdr}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:bg}}>{zoom.cw>=24&&(<span style={{fontSize:9,fontFamily:"monospace",background:isT?"#37352f":hol?(hol.religious?"rgba(68,131,97,0.18)":"rgba(217,115,13,0.18)"):undefined,color:isT?"#fff":hol?(hol.religious?"#448361":"#d9730d"):(isW||vac)?T.pageTer:T.pageSub,borderRadius:(isT||hol)?2:undefined,padding:(isT||hol)?"1px 3px":undefined,fontWeight:isT?700:hol?700:400}}>{d.getDate()}</span>)}</div>);
                        })
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Rows virtualisées */}
        {(()=>{
          const ROW_COUNT=displayTasksFiltered.length,totalH=ROW_COUNT*RH,OVERSCAN=8;
          const startIdx=Math.max(0,Math.floor(scrollTop/RH)-OVERSCAN);
          const endIdx=Math.min(ROW_COUNT-1,Math.ceil((scrollTop+viewHeight)/RH)+OVERSCAN);
          const visible=displayTasksFiltered.slice(startIdx,endIdx+1);
          return(
            <>
              <button onClick={()=>scrollStepV(-1)} style={{width:"100%",height:22,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderBottom:`1px solid ${T.pageBdr}`,background:"#f9f9f9",cursor:"pointer",color:T.pageSub}}><ChevronUp style={{width:11,height:11}}/></button>
              <div ref={listRef} style={{height:Math.min(totalH,window.innerHeight*0.7),overflowY:"auto",overflowX:"hidden",position:"relative"}} onScroll={e=>setScrollTop(e.currentTarget.scrollTop)}>
                <div style={{height:totalH,position:"relative"}}>
                  <div style={{position:"absolute",top:0,left:SC.reduce((s,c)=>s+c.sw,0),right:0,bottom:0,overflow:"hidden",pointerEvents:"none"}}>
                    <div style={{width:"100%",height:"100%",overflow:"hidden"}}>
                      <BackgroundStripes totalDays={totalDays} projStart={projStart} wd={wd} sh={sh} vacs={vacs} todayOff={todayOff} zoom={zoom} rowCount={ROW_COUNT}/>
                    </div>
                  </div>
                  <div style={{position:"absolute",top:startIdx*RH,left:0,right:0}}>
                    {visible.map(t=>{
                      if(editId===t.id||editId===t._id)return <EditRow key={t.id} isNew={false}/>;
                      const cfKey=`${t.group}||${t.groupe||""}`,isLiveConflict=liveConflictTaskKeys.has(cfKey),conflictTypes=conflictTypesMap[cfKey]||null,meta=metaCache[t.id]||{wdays:1,prog:{pct:0}},candidatCount=candidatCountByKey[cfKey]||0;
                      return(<GRow key={t.id} task={t} SC={SC} cs={cs} zoom={zoom} projStart={projStart} totalDays={totalDays} todayOff={todayOff} wd={wd} sh={sh} vacs={vacs} onEdit={()=>startEdit(t)} onDelete={()=>delTask(t.id||t._id)} onUpdate={updTask} onUpdateSlot={updTaskSlot} registerScrollable={registerScrollable} unregisterScrollable={unregisterScrollable} slotMap={slotMap} isLiveConflict={isLiveConflict} conflictTypes={conflictTypes} wdays={meta.wdays} prog={meta.prog} candidatCount={candidatCount}/>);
                    })}
                  </div>
                </div>
              </div>
              <button onClick={()=>scrollStepV(1)} style={{width:"100%",height:22,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderTop:`1px solid ${T.pageBdr}`,background:"#f9f9f9",cursor:"pointer",color:T.pageSub}}><ChevronDown style={{width:11,height:11}}/></button>
            </>
          );
        })()}

        {editId==="new"&&<EditRow isNew/>}
        {editId!=="new"&&(
          <div onClick={()=>{setEditId("new");setForm({group:"",groupe:"",start:"",end:"",nbJ:1});}} style={{display:"flex",alignItems:"center",gap:7,padding:"0 10px",height:30,cursor:"pointer",color:T.pageTer,fontSize:13}} onMouseEnter={e=>e.currentTarget.style.background=T.pageHov} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Plus style={{width:12,height:12}}/> Ajouter une tâche
          </div>
        )}

        <div style={{display:"flex",borderTop:`1px solid ${T.pageBdr}`,background:"#f9f9f9",position:"sticky",bottom:0,zIndex:20,borderBottomLeftRadius:3,borderBottomRightRadius:3,alignItems:"center"}}>
          <style>{`.gs::-webkit-scrollbar{height:14px}.gs::-webkit-scrollbar-track{background:#f0efed}.gs::-webkit-scrollbar-thumb{background:rgba(55,53,47,0.22);border-radius:99px;border:3px solid #f0efed}.gs::-webkit-scrollbar-thumb:hover{background:rgba(55,53,47,0.38)}`}</style>
          <div style={{width:SC.reduce((s,c)=>s+c.sw,0),flexShrink:0,borderRight:`1px solid ${T.pageBdr}`,background:"#f9f9f9",height:22}}/>
          <button onClick={()=>scrollStepH(-1)} style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.pageBdr}`,borderRadius:4,background:"#fff",cursor:"pointer",color:T.pageSub,flexShrink:0}}><ChevronLeft style={{width:11,height:11}}/></button>
          <div ref={scrRef} className="gs" style={{flex:1,overflowX:"auto",overflowY:"hidden"}} onScroll={e=>sync(e.currentTarget.scrollLeft)}><div style={{width:totalDays*zoom.cw,height:1}}/></div>
          <button onClick={()=>scrollStepH(1)} style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.pageBdr}`,borderRadius:4,background:"#fff",cursor:"pointer",color:T.pageSub,flexShrink:0}}><ChevronRight style={{width:11,height:11}}/></button>
        </div>
      </div>
      )}

      {/* États vides */}
      {displayTasksFiltered.length===0&&displayTasks.length>0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:T.pageTer,fontSize:13,marginTop:16}}>
          <Search style={{width:32,height:32,color:T.pageTer,strokeWidth:1.4,marginBottom:10}}/>
          <div style={{fontWeight:600,color:T.pageSub,marginBottom:4}}>Aucun résultat pour ces filtres</div>
          <button onClick={()=>setGanttFilters({group:"",groupe:"",wdays:"",start:"",end:""})} style={{fontSize:12,color:T.accent,background:"transparent",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"inherit"}}>Réinitialiser les filtres</button>
        </div>
      )}
      {displayTasks.length===0&&candidats.length>0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:T.pageTer,fontSize:13,marginTop:16}}>
          <CalendarRange style={{width:32,height:32,color:T.pageTer,strokeWidth:1.4,marginBottom:10}}/>
          <div style={{fontWeight:600,color:T.pageSub,marginBottom:4}}>Aucune tâche liée aux candidats</div>
          <div>Les tâches planifiées s'affichent ici après un import multi-bases.</div>
        </div>
      )}
      {candidats.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:T.pageTer,fontSize:13,marginTop:16}}>
          <CalendarRange style={{width:32,height:32,color:T.pageTer,strokeWidth:1.4,marginBottom:10}}/>
          <div style={{fontWeight:600,color:T.pageSub,marginBottom:4}}>Aucun candidat importé</div>
          <div>Importez vos données via l'assistant multi-bases pour voir la planification.</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOTEUR DE RÉSOLUTION — inchangé (résout uniquement les overlaps)
// ═══════════════════════════════════════════════════════════════

function resolveConflictsAuto(result, dWd, dSh, dV) {
  const getCK = r => {
    const mat = String(r.matricule || "").trim().toLowerCase();
    const vM  = mat.length > 3 && mat !== "en cours de recrutement";
    return vM ? mat : `${String(r.nom||"").toLowerCase()}__${String(r.prenom||"").toLowerCase()}`;
  };
  const nextWD = ds => snap(d2s(ad(pd(ds), 1)), dWd, dSh, dV);
 
  let cur = result.map(r => ({ ...r }));
  const resolutions = [], attempted = new Set();
 
  for (let iter = 0; iter < 200; iter++) {
    const conflicts = detectScheduleConflictsV3(cur, dWd, dSh, dV);
    const overlaps  = conflicts.filter(cf => cf.conflicts.some(c => c.type === "overlap"));
    if (!overlaps.length) break;
 
    const groupSlots = {};
    cur.forEach(r => {
      if (!r.start || !r.end) return;
      const k = `${r.theme}||${r.groupe}`;
      if (!groupSlots[k]) groupSlots[k] = { theme:r.theme, groupe:r.groupe, start:r.start, end:r.end, jours: r.jours || Math.max(1, calcWD(r.start, r.end, dWd, dSh, dV)) };
    });
    const groupsByTheme = {};
    cur.forEach(r => { if (!groupsByTheme[r.theme]) groupsByTheme[r.theme]=[]; if (!groupsByTheme[r.theme].includes(r.groupe)) groupsByTheme[r.theme].push(r.groupe); });
 
    let found = null;
    outer: for (const cf of overlaps) {
      const ck = getCK(cf);
      for (const ov of cf.conflicts.filter(c => c.type === "overlap")) {
        const a = ov.conflictsWith, b = { theme:ov.theme, groupe:ov.groupe, start:ov.start, end:ov.end };
        if (!a) continue;
        const pk = `${ck}|${a.theme}|${a.groupe}|${b.theme}|${b.groupe}`;
        if (!attempted.has(pk)) { found = { cf, sessA:a, sessB:b, pk, ck }; break outer; }
      }
    }
    if (!found) break;
 
    const { cf, sessA, sessB, pk, ck } = found;
    const candSess = cur.filter(r => getCK(r) === ck && r.start && r.end);
    let resolved   = false;
 
    // Essayer de déplacer sessB vers un autre groupe du même thème
    for (const g of (groupsByTheme[sessB.theme] || [])) {
      if (String(g) === String(sessB.groupe)) continue;
      const slot = groupSlots[`${sessB.theme}||${g}`];
      if (!slot) continue;
      const others = candSess.filter(s => !(s.theme===sessB.theme && String(s.groupe)===String(sessB.groupe)));
      if (others.some(s => slot.start <= s.end && s.start <= slot.end)) continue;
      cur = cur.map(r => getCK(r)===ck && r.theme===sessB.theme && String(r.groupe)===String(sessB.groupe) ? {...r, groupe:g, start:slot.start, end:slot.end} : r);
      resolutions.push({ type:"groupe", nom:cf.nom, prenom:cf.prenom, matricule:cf.matricule, theme:sessB.theme, from:`Grp ${sessB.groupe} (${fmt(sessB.start)}→${fmt(sessB.end)})`, to:`Grp ${g} (${fmt(slot.start)}→${fmt(slot.end)})` });
      resolved = true; break;
    }
 
    // Sinon, décaler le groupe
    if (!resolved) {
      const gk   = `${sessB.theme}||${sessB.groupe}`;
      const gSlot = groupSlots[gk];
      if (gSlot) {
        const jours    = gSlot.jours || 1;
        const newStart = nextWD(sessA.end);
        const newEnd   = addWD(newStart, jours, dWd, dSh, dV);
        if (newStart > gSlot.start) {
          cur = cur.map(r => r.theme===sessB.theme && String(r.groupe)===String(sessB.groupe) ? {...r, start:newStart, end:newEnd} : r);
          groupSlots[gk] = { ...gSlot, start:newStart, end:newEnd };
          resolutions.push({ type:"date", nom:cf.nom, prenom:cf.prenom, matricule:cf.matricule, theme:sessB.theme, from:`${fmt(gSlot.start)}→${fmt(gSlot.end)}`, to:`${fmt(newStart)}→${fmt(newEnd)}` });
          resolved = true;
        }
      }
    }
    if (!resolved) attempted.add(pk);
  }
 
  const seen = new Set();
  const deduped = resolutions.filter(r => { const k=`${r.nom}__${r.theme}__${r.from}`; if(seen.has(k))return false; seen.add(k); return true; });
  const remaining = detectScheduleConflictsV3(cur, dWd, dSh, dV).filter(cf => cf.conflicts.some(c => c.type==="overlap"));
  return { result: cur, resolutions: deduped, remainingCount: remaining.length };
}

// ConflictAlert + ResolutionSummary (pour ImportWizard, inchangés)
function ConflictAlert({ conflicts, onDismiss, onAutoResolve, resolving }) {
  const [expanded, setExpanded] = useState(false); const shown = expanded ? conflicts : conflicts.slice(0, 3);
  return (
    <div style={{ border: "1.5px solid rgba(212,76,71,0.4)", borderRadius: 6, background: "rgba(253,224,220,0.35)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderBottom: "1px solid rgba(212,76,71,0.15)" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "rgba(212,76,71,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertCircle style={{ width: 18, height: 18, color: "#d44c47" }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#d44c47", marginBottom: 3 }}>{conflicts.length} conflit{conflicts.length > 1 ? "s" : ""} de planning détecté{conflicts.length > 1 ? "s" : ""}</div><div style={{ fontSize: 12, color: "#9b3c3c", lineHeight: 1.6 }}>{conflicts.length === 1 ? "Un candidat est inscrit à plusieurs formations dont les périodes se chevauchent." : `${conflicts.length} candidats avec des formations se chevauchant.`}</div></div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {onAutoResolve && <button onClick={onAutoResolve} disabled={resolving} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", opacity: resolving ? 0.6 : 1 }}>{resolving ? <Spinner size={11} color="#fff" /> : <Wand2 style={{ width: 11, height: 11 }} />}{resolving ? "Résolution…" : "Résoudre auto"}</button>}
          {onDismiss && <button onClick={onDismiss} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#d44c47", flexShrink: 0 }}><X style={{ width: 13, height: 13 }} /></button>}
        </div>
      </div>
      {shown.map((cf, i) => (
        <div key={i} style={{ padding: "10px 18px 10px 62px", borderBottom: i < shown.length - 1 ? "1px solid rgba(212,76,71,0.1)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(212,76,71,0.03)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: "rgba(212,76,71,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#d44c47", flexShrink: 0 }}>{cf.nom?.charAt(0)}{cf.prenom?.charAt(0)}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.pageText }}>{cf.nom} {cf.prenom}</span>
            {cf.matricule && <span style={{ fontSize: 10, color: T.pageTer, fontFamily: "monospace" }}>{cf.matricule}</span>}
            <span style={{ fontSize: 10, fontWeight: 600, color: "#d44c47", background: "rgba(212,76,71,0.12)", padding: "1px 6px", borderRadius: 3 }}>{cf.sessions.length} formations en conflit</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{cf.sessions.map((s, si) => { const pal = grpTag(s.theme); return (<div key={si} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 4, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(212,76,71,0.15)" }}><div style={{ width: 6, height: 6, borderRadius: 2, background: pal.text, flexShrink: 0 }} /><span style={{ fontSize: 12, fontWeight: 600, color: pal.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.theme}</span><span style={{ fontSize: 11, color: T.pageSub }}>Grp {s.groupe}</span><span style={{ fontSize: 11, fontFamily: "monospace", color: T.pageSub, background: "rgba(55,53,47,0.05)", padding: "1px 6px", borderRadius: 3 }}>{fmt(s.start)} → {fmt(s.end)}</span></div>); })}</div>
        </div>
      ))}
      {conflicts.length > 3 && <button onClick={() => setExpanded(v => !v)} style={{ width: "100%", padding: "8px 18px", border: "none", borderTop: "1px solid rgba(212,76,71,0.15)", background: "transparent", cursor: "pointer", fontSize: 12, color: "#d44c47", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>{expanded ? <><ChevronDown style={{ width: 12, height: 12, transform: "rotate(180deg)" }} /> Réduire</> : <><ChevronDown style={{ width: 12, height: 12 }} /> Voir {conflicts.length - 3} de plus</>}</button>}
    </div>
  );
}

function ResolutionSummary({ resolutions, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? resolutions : resolutions.slice(0, 5);
  return (
    <div style={{ border: "1.5px solid rgba(51,126,169,0.4)", borderRadius: 6, background: "rgba(220,235,245,0.35)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid rgba(51,126,169,0.15)" }}>
        <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, background: "rgba(51,126,169,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCheck style={{ width: 15, height: 15, color: "#337ea9" }} /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#337ea9" }}>{resolutions.length} conflit{resolutions.length > 1 ? "s" : ""} résolus automatiquement</div><div style={{ fontSize: 11, color: "#1a5a8a" }}>Changements de groupe ou décalages de dates appliqués.</div></div>
        <button onClick={onClose} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#337ea9" }}><X style={{ width: 12, height: 12 }} /></button>
      </div>
      {shown.map((r, i) => (
        <div key={i} style={{ padding: "7px 18px 7px 58px", borderBottom: i < shown.length - 1 ? "1px solid rgba(51,126,169,0.1)" : "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ width: 20, height: 20, borderRadius: 3, background: "rgba(51,126,169,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.type === "groupe" ? <Shuffle style={{ width: 10, height: 10, color: "#337ea9" }} /> : <CalendarRange style={{ width: 10, height: 10, color: "#337ea9" }} />}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.pageText }}>{r.nom} {r.prenom}</span>
          {r.matricule && <span style={{ fontSize: 10, color: T.pageTer, fontFamily: "monospace" }}>{r.matricule}</span>}
          <span style={{ fontSize: 11, color: T.pageSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>{r.theme}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9b3c3c", background: "rgba(212,76,71,0.07)", padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>{r.from}</span>
          <ArrowRight style={{ width: 10, height: 10, color: T.pageTer, flexShrink: 0 }} />
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#2d6a4f", background: "rgba(68,131,97,0.1)", padding: "1px 6px", borderRadius: 3, whiteSpace: "nowrap" }}>{r.to}</span>
        </div>
      ))}
      {resolutions.length > 5 && <button onClick={() => setExpanded(v => !v)} style={{ width: "100%", padding: "6px", border: "none", borderTop: "1px solid rgba(51,126,169,0.15)", background: "transparent", cursor: "pointer", fontSize: 11, color: "#337ea9", fontFamily: "inherit" }}>{expanded ? "Réduire" : "Voir tout"}</button>}
    </div>
  );
}



/* ===========================================================
   IMPORT WIZARD
========================================================== */
// Certains fichiers Excel retournent les heures comme date (ex: "1900-01-07 12:00:00" = 7.5h)
// On convertit : Excel date serial -> heures (1 jour Excel = 24h, mais base = 1 = 24h, 0.5 = 12h)
function parseHoursValue(raw) {
  if (!raw) return 0;
  const s = String(raw).trim();
  // Format date Excel: "1900-01-01 HH:MM:SS" ou "1900-01-DD ..."
  const dateMatch = s.match(/^1900-01-(\d{2})\s+(\d{2}):(\d{2})/);
  if (dateMatch) {
    const days = parseInt(dateMatch[1]) - 1; // jour 1 = 0 heures, jour 2 = 24h...
    const hh = parseInt(dateMatch[2]);
    const mm = parseInt(dateMatch[3]);
    return days * 24 + hh + mm / 60;
  }
  return parseFloat(s.replace(",", ".")) || 0;
}
const hrs2j = h => {
  if (!h || h <= 0) return 0;
  const raw      = h / 7.5;          // 56.25 / 7.5 = 7.5
  const floored  = Math.floor(raw);   // 7
  const decimal  = raw - floored;     // 0.5

  // Si la partie décimale est <= 0.25 → arrondi à l'entier inférieur
  // Si entre 0.25 et 0.75 → demi-journée (0.5)
  // Si >= 0.75 → arrondi à l'entier supérieur
  if (decimal < 0.25)       return floored;
  if (decimal <= 0.75)      return floored + 0.5;
  return floored + 1;
};
const HALF_DAY_THRESHOLD = 3.75;
const HALF_DAY_MIN = 2; // en dessous = donnée aberrante, pas une vraie demi-journée
const isHalfDay = h => {
  const f = parseHoursValue(h);
  return f >= HALF_DAY_MIN && f <= HALF_DAY_THRESHOLD;
};
const hrs2slots = h => {
  const f = parseHoursValue(h);
  if (f <= 0) return 2;
  if (f >= HALF_DAY_MIN && f <= HALF_DAY_THRESHOLD) return 1; // demi-journée
  return Math.max(2, Math.ceil(f / 7.5) * 2); // minimum 1 jour entier
};
const fmtJours = j => j === 0.5 ? "½ j" : j === 1 ? "1 j" : `${j} j`;

const parseRawDuration = (raw, unit) => {
  if (unit === "jours") {
    const d = parseFloat(String(raw || "").replace(",", ".")) || 1;
    return d * 7.5; // 1 jour = 7.5h — unifie le pipeline existant
  }
  return parseHoursValue(raw); // comportement d'origine
};

function splitFullName(full) {
  const s = String(full || "").trim().replace(/\s+/g, " ");
  if (!s) return { nom: "", prenom: "" };

  const parts = s.split(" ");
  if (parts.length === 1) return { nom: parts[0], prenom: "" };

  // Détecte si un mot est en "Title Case" :
  // première lettre majuscule ET au moins une lettre minuscule dans le mot
  const isTitleCase = w => /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝ]/.test(w)
    && /[a-zàáâãäåæçèéêëìíîïðñòóôõöùúûüýþÿ]/.test(w);

  // Stratégie 1 : dernier mot en Title Case → prénom
  const last = parts[parts.length - 1];
  if (isTitleCase(last)) {
    return {
      nom: parts.slice(0, -1).join(" "),
      prenom: last,
    };
  }

  // Stratégie 2 : chercher depuis la fin le premier mot
  // qui n'est PAS tout en majuscules → séparateur nom/prénom
  for (let i = parts.length - 1; i >= 1; i--) {
    if (isTitleCase(parts[i])) {
      return {
        nom: parts.slice(0, i).join(" "),
        prenom: parts.slice(i).join(" "),
      };
    }
  }

  // Fallback : premier mot = nom, reste = prénom
  return {
    nom: parts[0],
    prenom: parts.slice(1).join(" "),
  };
}

function parseExcelDate(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  // Format ISO : 2026-04-21
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Mois français (long et abrégé)
  const moisFR = {
    "janvier": 1, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12,
    "jan": 1, "fev": 2, "fév": 2, "avr": 4, "juil": 7, "aoû": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12, "déc": 12,
  };

  // "mardi 21 avril 2026" ou "21 avril 2026"
  const matchFR = s.toLowerCase().match(/(\d{1,2})\s+([\wéûôàè]+)\s+(\d{4})/);
  if (matchFR) {
    const day = matchFR[1].padStart(2, "0");
    const moisKey = matchFR[2].replace(/[.,]/g, "");
    const mois = moisFR[moisKey];
    const year = matchFR[3];
    if (mois) return `${year}-${String(mois).padStart(2, "0")}-${day}`;
  }

  // "21/04/2026" ou "21-04-2026"
  const matchSlash = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchSlash) {
    return `${matchSlash[3]}-${matchSlash[2].padStart(2, "0")}-${matchSlash[1].padStart(2, "0")}`;
  }

  // Numéro sériel Excel (ex: 46200)
  const serial = parseInt(s);
  if (!isNaN(serial) && serial > 40000 && serial < 60000) {
    const d = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(d)) return d2s(d);
  }

  // Dernier recours : parsing natif
  try {
    const d = new Date(s);
    if (!isNaN(d)) return d2s(d);
  } catch (e) { }

  return "";
}



/* ===========================================================
   CANDIDATS — Modal + View
========================================================== */
function CModal({ item, onClose, onSave }) {
  // 👇 Suppression de email et telephone dans l'état initial
  const [f, setF] = useState(item || { nom: "", prenom: "", matricule: "", poste: "", statut: "Reçu", notes: "" });
  const inp = (label, key, type = "text", span = 1) => (<div key={key} style={{ gridColumn: `span ${span}` }}><div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div><input type={type} value={f[key] || ""} onChange={e => setF(p => ({ ...p, [key]: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 4, border: `1px solid rgba(55,53,47,0.2)`, fontSize: 13, color: T.pageText, outline: "none", fontFamily: "inherit", background: "#fff" }} onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 2px ${T.accent}22`; }} onBlur={e => { e.target.style.borderColor = "rgba(55,53,47,0.2)"; e.target.style.boxShadow = "none"; }} /></div>);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 16px 48px rgba(0,0,0,0.18)", width: "min(460px,95vw)", border: `1px solid rgba(55,53,47,0.13)`, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 16, fontWeight: 700, color: T.pageText, letterSpacing: "-0.02em" }}>{item ? "Modifier le candidat" : "Nouveau candidat"}</span><button onClick={onClose} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub }}><X style={{ width: 14, height: 14 }} /></button></div>
        <div style={{ padding: "18px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {inp("Nom *", "nom", "text", 1)}{inp("Prénom *", "prenom", "text", 1)}
          {inp("Matricule", "matricule", "text", 1)}{inp("Poste / Fonction", "poste", "text", 1)}
          {/* 👇 Les champs Email et Téléphone ont été supprimés ici */}
          <div style={{ gridColumn: "span 2" }}><div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>Notes</div><textarea value={f.notes || ""} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", borderRadius: 4, border: `1px solid rgba(55,53,47,0.2)`, fontSize: 13, color: T.pageText, outline: "none", fontFamily: "inherit", resize: "vertical" }} /></div>
        </div>
        <div style={{ padding: "12px 24px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", justifyContent: "flex-end", gap: 8, background: "rgba(55,53,47,0.02)" }}><button onClick={onClose} style={{ padding: "6px 14px", fontSize: 13, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button><button onClick={() => { if (!f.nom.trim() || !f.prenom.trim()) return; onSave(f); onClose(); }} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={e => e.currentTarget.style.background = "#111"} onMouseLeave={e => e.currentTarget.style.background = "#37352f"}>{item ? "Enregistrer" : "Ajouter"}</button></div>
      </div>
    </div>
  );
}

function MultiBaseImportWizard({ onClose, onDone, setTasks, wsStart, wsEnd, wsId, showToast, setDocuments,wsWorkingDays, wsSkipHolidays, wsVacances, onUpdateWs }) {
const [conflictDetail, setConflictDetail] = useState(null); 
  const [showConfirm, setShowConfirm] = useState(false); // <--- AJOUTEZ CETTE LIGNE
   const { wd, setWd, sh, setSh, vacs, setVacs } = usePlanningSettings(
    wsId, wsWorkingDays, wsSkipHolidays, wsVacances, onUpdateWs
  );
  const [vacForm, setVacForm] = useState({ label: "", start: "", end: "" });
  const [showSettings, setShowSettings] = useState(true);

  const [step, setStep] = useState(1);
  const [durationUnit, setDurationUnit] = useState("heures");

  const mkBase = () => ({ rows: [], fileName: "", fileError: "", dragOver: false, mapping: {} });
  const [base1, setBase1] = useState(mkBase());
  const [base2, setBase2] = useState(mkBase());
  const [base3, setBase3] = useState(mkBase());

  const [anomalies1, setAnomalies1] = useState([]);
  const [anomalies2, setAnomalies2] = useState([]);
  const [anomalies3, setAnomalies3] = useState([]);
  const [excluded1, setExcluded1] = useState(new Set());
  const [excluded2, setExcluded2] = useState(new Set());
  const [excluded3, setExcluded3] = useState(new Set());

  const [merged, setMerged] = useState([]);
  const [themeConf, setThemeConf] = useState([]);
  const [result, setResult] = useState([]);
  const [ganttDone, setGanttDone] = useState(false);
  const [importing, setImporting] = useState(false);

  // ── Conflits ────────────────────────────────────────────────────
  const [liveConflicts, setLiveConflicts] = useState({});
  const conflictTimerRef = useRef(null);

  // ── Colonnes visibles — TOUTES CACHÉES par défaut sauf les 7 de base ──
  const [visibleCols, setVisibleCols] = useState({
    theme:         true,
    groupe:        true,
    count:         true,
    duree:         true,
    start:         true,
    end:           true,
    statut:        true,
    domaine:       false,
    typeFormation: false,
    niveau:        false,
    publicCible:   false,
    objectif:      false,
    contenu:       false,
    cabinet:       false,
    formateur:     false,
    lieu:          false,
    cout:          false,
    cnss:          false,
    departement:   false,
    csp:           false,
  });
  const [showColPicker, setShowColPicker] = useState(false);

  // ── Filtres par colonne ──────────────────────────────────────────
  const [colFilters, setColFilters] = useState({});
  const [conflictEdit, setConflictEdit] = useState({}); 


  // ── Tri ──────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState("theme");
  const [sortDir,   setSortDir]   = useState("asc");

  // ── Définition des colonnes ─────────────────────────────────────
  const COL_DEFS = [
    { key: "theme",         label: "Formation",       sortable: true,  filterable: true,  group: "Base" },
    { key: "groupe",        label: "Groupe",          sortable: true,  filterable: false, group: "Base" },
    { key: "count",         label: "Candidats",       sortable: true,  filterable: false, group: "Base" },
    { key: "duree",         label: "Durée / Séance",  sortable: true,  filterable: false, group: "Base" },
    { key: "start",         label: "Début",           sortable: true,  filterable: false, group: "Base" },
    { key: "end",           label: "Fin",             sortable: true,  filterable: false, group: "Base" },
    { key: "statut",        label: "Statut",          sortable: true,  filterable: true,  group: "Base" },
    { key: "domaine",       label: "Domaine",         sortable: true,  filterable: true,  group: "Formation" },
    { key: "typeFormation", label: "Type formation",  sortable: true,  filterable: true,  group: "Formation" },
    { key: "niveau",        label: "Niveau",          sortable: true,  filterable: true,  group: "Formation" },
    { key: "publicCible",   label: "Public cible",    sortable: true,  filterable: true,  group: "Formation" },
    { key: "objectif",      label: "Objectif",        sortable: false, filterable: true,  group: "Formation" },
    { key: "contenu",       label: "Contenu",         sortable: false, filterable: true,  group: "Formation" },
    { key: "cabinet",       label: "Cabinet",         sortable: true,  filterable: true,  group: "Cabinet" },
    { key: "formateur",     label: "Formateur",       sortable: true,  filterable: true,  group: "Cabinet" },
    { key: "lieu",          label: "Lieu",            sortable: true,  filterable: true,  group: "Cabinet" },
    { key: "cout",          label: "Coût",            sortable: true,  filterable: false, group: "Cabinet" },
    { key: "cnss",          label: "N° CNSS",         sortable: false, filterable: true,  group: "Cabinet" },
    { key: "departement",   label: "Département",     sortable: true,  filterable: true,  group: "Personnel" },
    { key: "csp",           label: "CSP",             sortable: true,  filterable: true,  group: "Personnel" },
  ];
  const COL_GROUPS = ["Base", "Formation", "Cabinet", "Personnel"];

  // ── conflictIndex ────────────────────────────────────────────────
  const conflictIndex = useMemo(() => {
    const idx = {};
    Object.entries(liveConflicts).forEach(([key, types]) => { idx[key] = types; });
    return idx;
  }, [liveConflicts]);

  // ── useEffect conflits (VERSION CORRIGÉE) ───────────────────────────
useEffect(() => {
  if (!result.length) { setLiveConflicts({}); return; }
  if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current);
  
  conflictTimerRef.current = setTimeout(() => {
    const run = () => {
      // 1. Détection des conflits de candidats (le même nom/matricule)
      const allCandidateConflicts = detectScheduleConflictsV3(result, wd, sh, vacs);

      // 2. Indexation de TOUS les groupes par lieu pour la capacité
      const lieuIndex = {};
      const groupLieuKey = {};
      const lieuCapacity = {};

      result.forEach(r => {
        const gKey = `${r.theme.trim()}||${r.groupe}`;
        // On normalise le nom du lieu (trim et minuscule) pour éviter les erreurs de frappe
        const rawLieu = [r.lieu, r.cabinet].filter(Boolean).join("||") || "default";
        const lieuKey = rawLieu.trim().toLowerCase(); 
        
        groupLieuKey[gKey] = lieuKey;
        lieuCapacity[lieuKey] = Math.max(lieuCapacity[lieuKey] || 1, Number(r.nbrEspace) || 1);

        if (!lieuIndex[lieuKey]) lieuIndex[lieuKey] = [];
        if (!lieuIndex[lieuKey].find(x => x.key === gKey)) {
          lieuIndex[lieuKey].push({
            key: gKey,
            start: r.start || "",
            end: r.end || "",
            halfDay: r.halfDay || false,
            slot: r.slot || null,
          });
        }
      });

      // 3. Fonction de calcul des occupations simultanées
      const getSimultaneousCount = (targetGKey, lieuKey) => {
        const peers = lieuIndex[lieuKey] || [];
        const me = peers.find(x => x.key === targetGKey);
        if (!me || !me.start) return 0;

        return peers.filter(p => {
          if (p.key === targetGKey || !p.start) return false;
          // Vérification du chevauchement de dates
          const overlap = p.start <= me.end && p.end >= me.start;
          if (!overlap) return false;
          // Si c'est une demi-journée, on ne compte que si c'est le même créneau (AM/PM)
          if (me.halfDay && p.halfDay) return me.slot === p.slot;
          return true;
        }).length + 1; // +1 pour s'inclure soi-même
      };

      const idx = {};

      // A. AJOUT DES CONFLITS DE SALLE PLEINE (Indépendant des candidats)
      Object.keys(groupLieuKey).forEach(gKey => {
        const lKey = groupLieuKey[gKey];
        const cap = lieuCapacity[lKey];
        const count = getSimultaneousCount(gKey, lKey);

        if (count > cap) {
          if (!idx[gKey]) idx[gKey] = new Set();
          idx[gKey].add("salle_pleine");
        }
      });

      // B. AJOUT DES AUTRES CONFLITS (Fériés, Congés, etc.) issus de detectScheduleConflictsV3
      allCandidateConflicts.forEach(cf => {
        cf.conflicts.forEach(c => {
          const key = `${c.theme}||${c.groupe}`;
          if (!idx[key]) idx[key] = new Set();
          
          // On n'ajoute pas 'overlap' ici car il est déjà couvert par 'salle_pleine' 
          // ou 'candidat_double' (géré par candidatConflictKeys)
          if (c.type !== "overlap") {
            idx[key].add(c.type);
          }
        });
      });

      setLiveConflicts(idx);
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(run, { timeout: 800 });
    } else {
      run();
    }
  }, 400);
  
  return () => { if (conflictTimerRef.current) clearTimeout(conflictTimerRef.current); };
}, [result, wd, sh, vacs, wsStart, wsEnd]);

  const batchId        = useRef(uid());
  const fileRef1       = useRef(null);
  const fileRef2       = useRef(null);
  const fileRef3       = useRef(null);
  const batchTasksRef  = useRef([]);

  // ── groupRows ────────────────────────────────────────────────────
  const groupRows = useMemo(() => {
    const seen = new Map();
    result.forEach(r => {
      const key = `${r.theme.trim()}||${r.groupe}`;
      if (!seen.has(key)) {
        seen.set(key, {
  key,
  theme:       r.theme.trim(),
  groupe:      r.groupe,
  start:       r.start   || "",
  end:         r.end     || "",
  jours:       r.jours   || 1,
  halfDay:     r.halfDay || false,
  slot:        r.slot    || null,
  nbrEspace:   r.nbrEspace || 1,
  lieu:        r.lieu    || "",
  cabinet:     r.cabinet || "",
  hasPreDates: r.hasPreDates || false,  // ← AJOUTER
  count:       0,
});
      }
      seen.get(key).count++;
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.theme !== b.theme ? a.theme.localeCompare(b.theme) : Number(a.groupe) - Number(b.groupe)
    );
  }, [result]);

  // ── halfDayConflictKeys ──────────────────────────────────────────
  const halfDayConflictKeys = useMemo(() => {
    const bad = new Set();
    const byDate = {};
    groupRows.forEach(gr => {
      if (!gr.halfDay || !gr.start) return;
      const slot = gr.slot || "matin";
      const dk   = `${gr.start}||${slot}`;
      if (!byDate[dk]) byDate[dk] = [];
      byDate[dk].push(gr.key);
    });
    Object.values(byDate).forEach(keys => {
      if (keys.length > 1) keys.forEach(k => bad.add(k));
    });
    return bad;
  }, [groupRows]);

  // ── candidatConflictKeys ─────────────────────────────────────────
  const candidatConflictKeys = useMemo(() => {
    const bad = new Set();
    const byCandidat = {};
    result.forEach(r => {
      if (!r.start) return;
      const mat = (r.matricule || "").trim().toLowerCase();
      const vM  = mat.length > 3 && mat !== "en cours de recrutement";
      const cId = vM
        ? `mat:${mat}`
        : `np:${r.nom.toLowerCase()}__${r.prenom.toLowerCase()}`;
      if (!byCandidat[cId]) byCandidat[cId] = [];
      byCandidat[cId].push({
        gKey:    `${r.theme.trim()}||${r.groupe}`,
        theme:   r.theme.trim(),
        start:   r.start,
        end:     r.end || r.start,
        halfDay: r.halfDay || false,
        slot:    r.slot || null,
      });
    });
    Object.values(byCandidat).forEach(sessions => {
      if (sessions.length < 2) return;
      for (let i = 0; i < sessions.length; i++) {
        for (let j = i + 1; j < sessions.length; j++) {
          const a = sessions[i];
          const b = sessions[j];
          if (a.gKey === b.gKey) continue;
          const overlap = a.start <= b.end && b.start <= a.end;
          if (!overlap) continue;
          if (a.halfDay && b.halfDay && a.slot !== b.slot) continue;
          bad.add(a.gKey);
          bad.add(b.gKey);
        }
      }
    });
    return bad;
  }, [result]);

  // ── conflictCount ────────────────────────────────────────────────
  const conflictCount = useMemo(() => {
    const keys = new Set([
      ...Object.keys(liveConflicts),
      ...halfDayConflictKeys,
      ...candidatConflictKeys,
    ]);
    return keys.size;
  }, [liveConflicts, halfDayConflictKeys, candidatConflictKeys]);

  const getConflictDetail = useCallback((gr) => {
  const key = gr.key;
  const cf  = conflictIndex[key];

  // ── PRIORITÉ 1 : HORS PÉRIODE ────────────────────────────
  const wsE = wsEnd || (wsStart ? `${wsStart.slice(0,4)}-12-31` : null);
  if (wsE && gr.end && gr.end > wsE) {
    return {
      key, type: "hors_periode",
      title: "Groupe hors de la période du workspace",
      color: "#d44c47",
      items: [{
        conflictWith: `Fin workspace : ${fmt(wsE)}`,
        periode:      `Fin groupe : ${fmt(gr.end)}`,
        periodeOther: `Dépassement : ${gdb(pd(wsE), pd(gr.end))} jour(s)`,
      }],
    };
  }

  // ── PRIORITÉ 2 : DEMI-JOURNÉE ────────────────────────────
  if (halfDayConflictKeys.has(key)) {
    const slot  = gr.slot || "matin";
    const peers = groupRows.filter(g =>
      g.key !== key && g.halfDay && g.start === gr.start && (g.slot || "matin") === slot
    );
    return {
      key, type: "halfday",
      title: `Créneau ${slot === "matin" ? "matin" : "après-midi"} déjà occupé le ${fmt(gr.start)}`,
      color: "#d44c47",
      items: peers.map(p => ({
        conflictWith: `${p.theme} — G${p.groupe}`,
        periode:      fmt(gr.start),
        periodeOther: `Même créneau : ${slot === "matin" ? "Matin" : "Après-midi"}`,
      })),
    };
  }

  // ── PRIORITÉ 3 : SALLE PLEINE ────────────────────────────
  if (cf?.has("salle_pleine")) {
    const lieuKey = [gr.lieu, gr.cabinet].filter(Boolean).join("||") || "default";
    const peers   = groupRows.filter(g => {
      if (g.key === key || !g.start) return false;
      const pLieuKey = [g.lieu, g.cabinet].filter(Boolean).join("||") || "default";
      if (pLieuKey !== lieuKey) return false;
      const overlap = g.start <= gr.end && gr.start <= g.end;
      if (!overlap) return false;
      if (gr.halfDay && g.halfDay) return gr.slot === g.slot;
      return true;
    });
    return {
      key, type: "salle_pleine",
      title: `Salle pleine — ${gr.lieu || gr.cabinet || "lieu non défini"} (capacité : ${gr.nbrEspace})`,
      color: "#d44c47",
      items: peers.map(p => ({
        conflictWith: `${p.theme} — G${p.groupe}`,
        periode:      `${fmt(gr.start)}${gr.end !== gr.start ? ` → ${fmt(gr.end)}` : ""}`,
        periodeOther: `${fmt(p.start)}${p.end !== p.start ? ` → ${fmt(p.end)}` : ""}`,
        lieu:         gr.lieu || gr.cabinet || "même lieu",
        capacite:     gr.nbrEspace,
        simultanes:   peers.length + 1,
      })),
    };
  }

  // ── PRIORITÉ 4 : CHEVAUCHEMENT ───────────────────────────
  if (cf?.has("overlap")) {
    const lieuKey = [gr.lieu, gr.cabinet].filter(Boolean).join("||") || "default";
    const peers   = groupRows.filter(g => {
      if (g.key === key || !g.start) return false;
      const pLieuKey = [g.lieu, g.cabinet].filter(Boolean).join("||") || "default";
      if (pLieuKey !== lieuKey) return false;
      const overlap = g.start <= gr.end && gr.start <= g.end;
      if (!overlap) return false;
      if (gr.halfDay && g.halfDay) return gr.slot === g.slot;
      return true;
    });
    return {
      key, type: "overlap",
      title: `Chevauchement de planning — ${gr.lieu || gr.cabinet || "lieu non défini"}`,
      color: "#d44c47",
      items: peers.map(p => ({
        conflictWith: `${p.theme} — G${p.groupe}`,
        periode:      `${fmt(gr.start)}${gr.end !== gr.start ? ` → ${fmt(gr.end)}` : ""}`,
        periodeOther: `${fmt(p.start)}${p.end !== p.start ? ` → ${fmt(p.end)}` : ""}`,
        lieu:         gr.lieu || gr.cabinet || "même lieu",
        capacite:     gr.nbrEspace,
        simultanes:   peers.length + 1,
      })),
    };
  }

  // ── PRIORITÉ 5 : CANDIDAT DOUBLE ─────────────────────────
  if (candidatConflictKeys.has(key)) {
    const details = [];
    const byCandidat = {};
    result.forEach(r => {
      if (!r.start) return;
      const mat = (r.matricule || "").trim().toLowerCase();
      const vM  = mat.length > 3 && mat !== "en cours de recrutement";
      const cId = vM
        ? `mat:${mat}`
        : `np:${r.nom.toLowerCase()}__${r.prenom.toLowerCase()}`;
      if (!byCandidat[cId]) byCandidat[cId] = [];
      byCandidat[cId].push({
        gKey:      `${r.theme.trim()}||${r.groupe}`,
        theme:     r.theme.trim(),
        groupe:    r.groupe,
        start:     r.start,
        end:       r.end || r.start,
        halfDay:   r.halfDay || false,
        slot:      r.slot || null,
        nom:       r.nom,
        prenom:    r.prenom,
        matricule: r.matricule || "",
      });
    });

    Object.values(byCandidat).forEach(sessions => {
      if (sessions.length < 2) return;
      for (let i = 0; i < sessions.length; i++) {
        for (let j = i + 1; j < sessions.length; j++) {
          const a = sessions[i];
          const b = sessions[j];
          if (a.gKey === b.gKey) continue;
          if (a.gKey !== key && b.gKey !== key) continue;
          const overlap = a.start <= b.end && b.start <= a.end;
          if (!overlap) continue;
          if (a.halfDay && b.halfDay && a.slot !== b.slot) continue;
          const other = a.gKey === key ? b : a;
          details.push({
            candidat:     `${a.nom} ${a.prenom}${a.matricule ? ` (${a.matricule})` : ""}`,
            conflictWith: `${other.theme} — G${other.groupe}`,
            periode:      `${fmt(a.start)}${a.end !== a.start ? ` → ${fmt(a.end)}` : ""}`,
            periodeOther: `${fmt(other.start)}${other.end !== other.start ? ` → ${fmt(other.end)}` : ""}`,
          });
        }
      }
    });

    return {
      key, type: "candidat_double",
      title: "Candidats planifiés sur deux formations simultanées",
      color: "#d44c47",
      items: details,
    };
  }

  // ── PRIORITÉ 6 : FÉRIÉ ───────────────────────────────────
  if (cf?.has("holiday")) {
    return {
      key, type: "holiday",
      title: "La formation tombe sur un jour férié",
      color: "#448361",
      items: [{ conflictWith: "Jour férié marocain", periode: fmt(gr.start), periodeOther: "Déplacez la date de début" }],
    };
  }

  // ── PRIORITÉ 7 : CONGÉ ───────────────────────────────────
  if (cf?.has("vacation")) {
    const vac = vacs.find(v => gr.start >= v.start && gr.start <= v.end);
    return {
      key, type: "vacation",
      title: "La formation tombe sur une période de congé",
      color: "#337ea9",
      items: [{ conflictWith: vac?.label || "Congé", periode: `${fmt(gr.start)} → ${fmt(gr.end)}`, periodeOther: vac ? `Congé : ${fmt(vac.start)} → ${fmt(vac.end)}` : "" }],
    };
  }

  return null;
}, [result, groupRows, conflictIndex, candidatConflictKeys, halfDayConflictKeys, wsStart, wsEnd, vacs]);

  // ── updateGroupDates ─────────────────────────────────────────────
  const updateGroupDates = useCallback((key, field, value) => {
    setResult(prev => prev.map(r => {
      const rKey = `${r.theme.trim()}||${r.groupe}`;
      if (rKey !== key) return r;
      if (field === "start") {
        if (r.halfDay) return { ...r, start: value, end: value };
        const newEnd = value && r.jours > 0
          ? addWD(value, r.jours, wd, sh, vacs)
          : r.end;
        return { ...r, start: value, end: newEnd };
      }
      if (field === "slot") return { ...r, slot: value };
      return { ...r, [field]: value };
    }));
    setGanttDone(false);
  }, [wd, sh, vacs]);

  // ── Valeurs uniques par colonne (pour les selects) ───────────────
  const colUniqueValues = useMemo(() => {
    const uv = {};
    COL_DEFS.filter(c => c.filterable).forEach(col => {
      const s = new Set();
      result.forEach(r => {
        const v = r[col.key];
        if (v && String(v).trim()) s.add(String(v).trim());
      });
      uv[col.key] = Array.from(s).sort();
    });
    return uv;
  }, [result]);

  // ── Helper tri ───────────────────────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown style={{ width: 9, height: 9, color: T.pageTer, marginLeft: 3, flexShrink: 0 }} />;
    return sortDir === "asc"
      ? <ArrowUp   style={{ width: 9, height: 9, color: T.accent, marginLeft: 3, flexShrink: 0 }} />
      : <ArrowDown style={{ width: 9, height: 9, color: T.accent, marginLeft: 3, flexShrink: 0 }} />;
  };

  // ── groupRowsFiltered ────────────────────────────────────────────
  const groupRowsFiltered = useMemo(() => {
    const enriched = groupRows.map(gr => {
      const sample = result.find(r =>
        `${r.theme.trim()}||${r.groupe}` === gr.key
      ) || {};
      return {
        ...gr,
        domaine:       sample.domaine       || "",
        cabinet:       sample.cabinet       || "",
        lieu:          sample.lieu          || "",
        formateur:     sample.formateur     || "",
        typeFormation: sample.typeFormation || "",
        cout:          sample.cout          || "",
        cnss:          sample.cnss          || "",
        departement:   sample.departement   || "",
        csp:           sample.csp           || "",
        objectif:      sample.objectif      || "",
        contenu:       sample.contenu       || "",
        niveau:        sample.niveau        || "",
        publicCible:   sample.publicCible   || "",
      };
    });

    const getStatut = (gr) => {
      const cf                  = conflictIndex[gr.key];
      const hasOverlap          = cf?.has("overlap");
      const hasSallePleine      = cf?.has("salle_pleine");
      const hasHoliday          = cf?.has("holiday");
      const hasVac              = cf?.has("vacation");
      const hasHalfDayConflict  = halfDayConflictKeys.has(gr.key);
      const hasCandidatConflict = candidatConflictKeys.has(gr.key);
      const wsE                 = wsEnd || (wsStart ? `${wsStart.slice(0,4)}-12-31` : null);
      const isOutOfRange        = wsE && gr.end && gr.end > wsE;
      if (isOutOfRange || hasOverlap || hasSallePleine ||
          hasHalfDayConflict || hasCandidatConflict ||
          hasVac || hasHoliday) return "conflit";
      if (gr.start) return "ok";
      return "planifier";
    };

    let rows = enriched.filter(gr => {
      for (const [key, val] of Object.entries(colFilters)) {
        if (!val || val === "") continue;
        if (key === "statut") {
          if (getStatut(gr) !== val) return false;
          continue;
        }
        if (key === "theme") {
          if (!gr.theme.toLowerCase().includes(val.toLowerCase())) return false;
          continue;
        }
        const grVal = String(gr[key] || "").toLowerCase();
        if (!grVal.includes(val.toLowerCase())) return false;
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let va, vb;
      if (sortField === "statut") {
        const order = { conflit: 0, planifier: 1, ok: 2 };
        va = order[getStatut(a)] ?? 3;
        vb = order[getStatut(b)] ?? 3;
      } else if (sortField === "groupe") {
        va = Number(a.groupe); vb = Number(b.groupe);
      } else if (sortField === "count") {
        va = a.count; vb = b.count;
      } else if (sortField === "start" || sortField === "end") {
        va = a[sortField] || "9999"; vb = b[sortField] || "9999";
      } else if (sortField === "cout") {
        va = parseFloat(String(a.cout).replace(/[^\d.]/g, "")) || 0;
        vb = parseFloat(String(b.cout).replace(/[^\d.]/g, "")) || 0;
      } else {
        va = String(a[sortField] || "").toLowerCase();
        vb = String(b[sortField] || "").toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ?  1 : -1;
      return 0;
    });

    return rows;
  }, [
    groupRows, result, conflictIndex, halfDayConflictKeys, candidatConflictKeys,
    colFilters, sortField, sortDir, wsStart, wsEnd,
  ]);

  // ── Champs bases ─────────────────────────────────────────────────
  const FIELDS_BASE1 = [
    { key: "nomprenom",   label: "Nom complet (1 colonne)",  required: false },
    { key: "nom",         label: "Nom",                      required: false },
    { key: "prenom",      label: "Prénom",                   required: false },
    { key: "intitule",    label: "Intitulé de formation ★",  required: true  },
    { key: "heures",      label: "Nb heures ★",              required: true  },
    { key: "matricule",   label: "Matricule",                required: false },
    { key: "dateDebut",   label: "Date début",               required: false },
    { key: "dateFin",     label: "Date fin",                 required: false },
    { key: "departement", label: "Département / Service",    required: false },
    { key: "csp",         label: "CSP / Catégorie",          required: false },
    { key: "cout",        label: "Coût",                     required: false },
  ];
  const FIELDS_BASE2 = [
    { key: "intitule",     label: "Intitulé de formation ★", required: true  },
    { key: "domaine",      label: "Domaine",                 required: false },
    { key: "objectif",     label: "Objectif",                required: false },
    { key: "contenu",      label: "Contenu",                 required: false },
    { key: "duree",        label: "Durée (info)",            required: false },
    { key: "niveau",       label: "Niveau",                  required: false },
    { key: "public",       label: "Public cible",            required: false },
    { key: "prerequis",    label: "Prérequis",               required: false },
    { key: "typeFormation",label: "Type de formation",       required: false },
    { key: "lieu",         label: "Lieu",                    required: false },
    { key: "cout",         label: "Coût",                    required: false },
  ];
  const FIELDS_BASE3 = [
    { key: "intitule",     label: "Intitulé de formation ★", required: true  },
    { key: "cabinet",      label: "Nom du cabinet ★",        required: true  },
    { key: "cnss",         label: "N° CNSS",                 required: false },
    { key: "nbrEspace",    label: "Nbr d'espace (Capacité)", required: false },
    { key: "lieu",         label: "Lieu de formation",       required: false },
    { key: "cout",         label: "Coût / personne",         required: false },
    { key: "typeFormation",label: "Type de formation",       required: false },
    { key: "contact",      label: "Contact / Tel",           required: false },
    { key: "formateur",    label: "Formateur",               required: false },
  ];

  // ── Styles ───────────────────────────────────────────────────────
  const iS  = { padding: "5px 9px", borderRadius: 4, border: `1px solid rgba(55,53,47,0.2)`, fontSize: 12, color: T.pageText, fontFamily: "inherit", outline: "none", background: "#fff", boxSizing: "border-box" };
  const fI  = e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = `0 0 0 2px ${T.accent}18`; };
  const fO  = e => { e.target.style.borderColor = "rgba(55,53,47,0.2)"; e.target.style.boxShadow = "none"; };
  const thS = { padding: "7px 10px", fontSize: 10, fontWeight: 600, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em", background: "rgba(55,53,47,0.03)", borderBottom: `1px solid ${T.pageBdr}`, textAlign: "left" };
  const tdS = { padding: "6px 10px", fontSize: 12, color: T.pageText, borderBottom: `1px solid ${T.pageBdr}` };

  const PROG = [
    { key: 1,  label: "Intro"    },
    { key: 2,  label: "Personnel"},
    { key: 4,  label: "Formations"},
    { key: 6,  label: "Cabinets" },
    { key: 8,  label: "Fusion"   },
    { key: 9,  label: "Groupes"  },
    { key: 10, label: "Résultat" },
  ];
  const visualStep = step >= 10 ? 10 : step >= 9 ? 9 : step >= 8 ? 8 : step >= 6 ? 6 : step >= 4 ? 4 : step >= 2 ? 2 : 1;
  const stepTitle  = {
    1:  "Import multi-bases Excel",
    2:  "Base Personnel",
    3:  "Vérification — Base Personnel",
    4:  "Base Formations",
    5:  "Vérification — Base Formations",
    6:  "Base Cabinets",
    7:  "Vérification — Base Cabinets",
    8:  "Aperçu avant fusion",
    9:  "Configurer les groupes",
    10: "Résultat & Gantt",
  }[step] || "";

  // ── readExcelFile ────────────────────────────────────────────────
  function readExcelFile(file, setter) {
    if (!file) return;
    setter(p => ({ ...p, fileError: "" }));
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv", "ods"].includes(ext)) {
      setter(p => ({ ...p, fileError: "Format non supporté (.xlsx, .xls, .csv)" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data   = new Uint8Array(e.target.result);
        const wb     = XLSX.read(data, { type: "array" });
        const ws     = wb.Sheets[wb.SheetNames[0]];
        const arr    = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
        const filt   = arr.filter(row => row.some(c => String(c).trim() !== ""));
        if (filt.length < 2) { setter(p => ({ ...p, fileError: "Fichier vide." })); return; }
        const maxC   = Math.max(...filt.map(r => r.length));
        const padded = filt.map(r => {
          const a = [...r];
          while (a.length < maxC) a.push("");
          return a.map(v => String(v ?? "").trim());
        });
        setter(p => ({ ...p, rows: padded, fileName: file.name, mapping: {} }));
      } catch {
        setter(p => ({ ...p, fileError: "Erreur de lecture." }));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function isBaseReady(base, fields) {
    if (base.rows.length < 2) return false;
    const m     = base.mapping;
    const reqOk = fields.filter(f => f.required).every(f => m[f.key] >= 0);
    const hasId = fields.some(f => f.key === "nomprenom")
      ? (m["nomprenom"] >= 0 || (m["nom"] >= 0 && m["prenom"] >= 0))
      : true;
    return reqOk && hasId;
  }
  const b1Ready = isBaseReady(base1, FIELDS_BASE1);
  const b2Ready = isBaseReady(base2, FIELDS_BASE2);
  const b3Ready = isBaseReady(base3, FIELDS_BASE3);

  // ── analyzeBase1 ─────────────────────────────────────────────────
  function analyzeBase1() {
    const m   = base1.mapping;
    const npi = m["nomprenom"] ?? -1, ni = m["nom"] ?? -1, pi = m["prenom"] ?? -1;
    const ti  = m["intitule"]  ?? -1, mi = m["matricule"] ?? -1;
    const useCombo = npi >= 0;
    if ((!useCombo && (ni < 0 || pi < 0)) || ti < 0) return { anomalies: [], excluded: new Set() };
    const records = base1.rows.slice(1).map((r, i) => {
      let nom, prenom;
      if (useCombo) { const sp = splitFullName(r[npi]); nom = sp.nom; prenom = sp.prenom; }
      else { nom = (r[ni] || "").trim(); prenom = (r[pi] || "").trim(); }
      return { idx: i + 1, nom, prenom, matricule: mi >= 0 ? String(r[mi] || "").trim() : "", theme: (r[ti] || "").trim() };
    }).filter(r => r.theme);
    const mG = {}, nG = {}, eG = {};
    records.forEach(r => {
      const fn  = `${r.nom.toLowerCase()} ${r.prenom.toLowerCase()}`;
      const mat = r.matricule.toLowerCase();
      const vM  = mat.length > 3 && mat !== "en cours de recrutement";
      if (vM) { if (!mG[mat]) mG[mat] = []; mG[mat].push(r); }
      if (fn.trim()) { if (!nG[fn]) nG[fn] = []; nG[fn].push(r); }
      const ek = `${fn}__${mat}__${r.theme.toLowerCase()}`;
      if (!eG[ek]) eG[ek] = []; eG[ek].push(r);
    });
    const det = []; const ex = new Set();
    Object.entries(eG).forEach(([, rs]) => { if (rs.length > 1) { det.push({ desc: `Inscription en double — ${rs[0].nom} ${rs[0].prenom} / "${rs[0].theme}"`, records: rs }); for (let i = 1; i < rs.length; i++) ex.add(rs[i].idx); } });
    Object.entries(mG).forEach(([mat, rs]) => { const ds = new Set(rs.map(r => `${r.nom.toLowerCase()} ${r.prenom.toLowerCase()}`)); if (ds.size > 1) { det.push({ desc: `Matricule ${mat} assigné à plusieurs candidats`, records: rs }); const fn0 = `${rs[0].nom.toLowerCase()} ${rs[0].prenom.toLowerCase()}`; rs.forEach(r => { if (`${r.nom.toLowerCase()} ${r.prenom.toLowerCase()}` !== fn0) ex.add(r.idx); }); } });
    Object.entries(nG).forEach(([, rs]) => { const ds = new Set(rs.map(r => r.matricule.toLowerCase()).filter(m => m.length > 3 && m !== "en cours de recrutement")); if (ds.size > 1) { det.push({ desc: `${rs[0].nom} ${rs[0].prenom} a plusieurs matricules`, records: rs }); const vRs = rs.filter(r => { const m = r.matricule.toLowerCase(); return m.length > 3 && m !== "en cours de recrutement"; }); if (vRs.length > 0) { const fm = vRs[0].matricule.toLowerCase(); rs.forEach(r => { const rm = r.matricule.toLowerCase(); if (rm.length > 3 && rm !== "en cours de recrutement" && rm !== fm) ex.add(r.idx); }); } } });
    return { anomalies: det, excluded: ex };
  }

  // ── analyzeBaseEnrich ────────────────────────────────────────────
  function analyzeBaseEnrich(base) {
    const m  = base.mapping;
    const ti = m["intitule"] ?? -1;
    if (ti < 0) return { anomalies: [], excluded: new Set() };
    const records = base.rows.slice(1).map((r, i) => ({ idx: i + 1, intitule: (r[ti] || "").trim() })).filter(r => r.intitule);
    const dup = {};
    records.forEach(r => { const k = r.intitule.toLowerCase(); if (!dup[k]) dup[k] = []; dup[k].push(r); });
    const det = []; const ex = new Set();
    Object.entries(dup).forEach(([, rs]) => { if (rs.length > 1) { det.push({ desc: `Intitulé en double : "${rs[0].intitule}" (${rs.length} occurrences)`, records: rs }); for (let i = 1; i < rs.length; i++) ex.add(rs[i].idx); } });
    return { anomalies: det, excluded: ex };
  }

  // ── exportAnomalies ──────────────────────────────────────────────
  function exportAnomalies(anomalies, label) {
    const rows = [];
    anomalies.forEach(a => a.records.forEach(r => {
      rows.push({ "Type d'anomalie": a.desc, "Ligne Excel": r.idx + 1, "Nom / Intitulé": r.intitule || `${r.nom || ""} ${r.prenom || ""}`.trim(), "Matricule": r.matricule || "—", "Formation": r.theme || "—" });
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 50 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 35 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
    XLSX.writeFile(wb, `anomalies_${label}_${Date.now()}.xlsx`);
    showToast(`${rows.length} anomalies exportées`, "success");
  }

  // ── AnomaliesPanel ───────────────────────────────────────────────
  function AnomaliesPanel({ anomalies, excluded, setExcluded, label, onExport }) {
    const totalRows = anomalies.reduce((s, a) => s + a.records.length, 0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {anomalies.length === 0 ? (
          <div style={{ padding: "14px 16px", borderRadius: 6, border: `1px solid rgba(68,131,97,0.3)`, background: "rgba(68,131,97,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 style={{ width: 16, height: 16, color: "#448361", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#448361" }}>Aucune anomalie détectée</div>
              <div style={{ fontSize: 12, color: T.pageSub, marginTop: 2 }}>Les données de {label} sont cohérentes.</div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ padding: "10px 14px", borderRadius: 6, border: `1px solid rgba(212,76,71,0.25)`, background: "rgba(212,76,71,0.05)", display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <AlertTriangle style={{ width: 15, height: 15, color: "#d44c47", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#d44c47" }}>{anomalies.length} anomalie{anomalies.length > 1 ? "s" : ""} détectée{anomalies.length > 1 ? "s" : ""}</div>
                  <div style={{ fontSize: 11, color: T.pageSub, marginTop: 2 }}>{totalRows} ligne{totalRows > 1 ? "s" : ""} · {excluded.size} exclue{excluded.size > 1 ? "s" : ""}</div>
                </div>
              </div>
              <button onClick={onExport} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, color: "#d44c47", background: "rgba(212,76,71,0.06)", border: "1px solid rgba(212,76,71,0.25)", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                <FileUp style={{ width: 12, height: 12 }} /> Exporter les erreurs
              </button>
            </div>
            <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thS, width: 42, textAlign: "center" }}>Excl.</th>
                    <th style={thS}>Type d'anomalie</th>
                    <th style={thS}>Ligne</th>
                    <th style={thS}>Candidat / Intitulé</th>
                    <th style={thS}>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.flatMap(a => a.records.map(r => {
                    const isEx = excluded.has(r.idx);
                    const name = r.intitule || `${r.nom || ""} ${r.prenom || ""}`.trim();
                    return (
                      <tr key={r.idx} style={{ background: isEx ? "rgba(212,76,71,0.03)" : "#fff" }}>
                        <td style={{ ...tdS, textAlign: "center", padding: "6px" }}>
                          <input type="checkbox" checked={isEx} onChange={() => setExcluded(p => { const n = new Set(p); n.has(r.idx) ? n.delete(r.idx) : n.add(r.idx); return n; })} style={{ cursor: "pointer" }} />
                        </td>
                        <td style={{ ...tdS, fontSize: 11, color: "#d44c47", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.desc}>{a.desc}</td>
                        <td style={{ ...tdS, fontFamily: "monospace", color: T.pageSub, fontSize: 11 }}>Ligne {r.idx + 1}</td>
                        <td style={{ ...tdS, fontWeight: isEx ? 400 : 600, color: isEx ? T.pageTer : T.pageText }}>{name}</td>
                        <td style={{ ...tdS, color: T.pageSub, fontSize: 11 }}>{r.theme || r.matricule || "—"}</td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── BasePanel ────────────────────────────────────────────────────
  function BasePanel({ base, setter, fields, fileRef, color }) {
    const headers = base.rows[0] || [];
    const preview = base.rows.slice(1, 5);
    const mapping = base.mapping;
    const hasId   = fields.some(f => f.key === "nomprenom")
      ? (mapping["nomprenom"] >= 0 || (mapping["nom"] >= 0 && mapping["prenom"] >= 0))
      : true;
    const canMap  = fields.filter(f => f.required).every(f => mapping[f.key] >= 0) && hasId;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          onDragOver={e => { e.preventDefault(); setter(p => ({ ...p, dragOver: true })); }}
          onDragLeave={() => setter(p => ({ ...p, dragOver: false }))}
          onDrop={e => { e.preventDefault(); setter(p => ({ ...p, dragOver: false })); readExcelFile(e.dataTransfer.files[0], setter); }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${base.dragOver ? color : "rgba(55,53,47,0.15)"}`, borderRadius: 7, padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", background: base.dragOver ? `${color}06` : "rgba(55,53,47,0.01)", transition: "all 0.12s", minHeight: 90 }}
        >
          <FileUp style={{ width: 18, height: 18, color: base.fileName ? color : T.pageTer }} />
          {base.fileName
            ? <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600, color: T.pageText }}>{base.fileName}</div><div style={{ fontSize: 11, color: T.pageSub }}>{base.rows.length - 1} lignes · Cliquer pour remplacer</div></div>
            : <div style={{ textAlign: "center" }}><div style={{ fontSize: 13, color: T.pageText }}>Glisser-déposer ou <span style={{ color: T.accent, fontWeight: 600 }}>parcourir</span></div><div style={{ fontSize: 11, color: T.pageTer, marginTop: 2 }}>.xlsx · .xls · .csv · .ods</div></div>
          }
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.ods" style={{ display: "none" }} onChange={e => { readExcelFile(e.target.files?.[0], setter); e.target.value = ""; }} />
        </div>
        {base.fileError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 4, background: "rgba(212,76,71,0.05)", border: "1px solid rgba(212,76,71,0.2)", color: "#d44c47", fontSize: 12 }}>
            <AlertTriangle style={{ width: 12, height: 12, flexShrink: 0 }} />{base.fileError}
          </div>
        )}
        {base.rows.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Associer les colonnes</div>
            <div style={{ overflowX: "auto", border: `1px solid ${T.pageBdr}`, borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
                <thead>
                  <tr style={{ background: "rgba(55,53,47,0.02)" }}>
                    {headers.map((h, ci) => (
                      <th key={ci} style={{ ...thS, minWidth: 110 }}>
                        <select
                          value={Object.entries(mapping).find(([, v]) => v === ci)?.[0] || ""}
                          onChange={e => {
                            const field = e.target.value;
                            setter(p => {
                              const next = { ...p.mapping };
                              Object.keys(next).forEach(k => { if (next[k] === ci) next[k] = -1; });
                              if (field) { Object.keys(next).forEach(k => { if (k === field) next[k] = -1; }); next[field] = ci; }
                              return { ...p, mapping: next };
                            });
                          }}
                          style={{ ...iS, width: "100%", fontSize: 11 }}
                        >
                          <option value="">— Ignorer —</option>
                          {fields.map(f => <option key={f.key} value={f.key} disabled={mapping[f.key] >= 0 && mapping[f.key] !== ci}>{f.label}</option>)}
                        </select>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {headers.map((h, ci) => (
                      <th key={ci} style={{ ...thS, color: T.pageText, fontWeight: 600, fontSize: 11, background: Object.values(mapping).includes(ci) ? `${color}08` : undefined }}>
                        {h || `Col ${ci + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ ...tdS, background: Object.values(mapping).includes(ci) ? `${color}06` : undefined, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }} title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {fields.map(f => {
                if (f.key === "nom" || f.key === "prenom") return null;
                if (f.key === "nomprenom" && fields.some(ff => ff.key === "nom")) {
                  const ok = mapping["nomprenom"] >= 0 || (mapping["nom"] >= 0 && mapping["prenom"] >= 0);
                  return (
                    <span key="ident" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 3, fontSize: 11, border: `1px solid ${ok ? "rgba(68,131,97,0.3)" : T.pageBdr}`, background: ok ? "rgba(68,131,97,0.07)" : "transparent", color: ok ? "#448361" : T.pageSub }}>
                      {ok ? <Check style={{ width: 9, height: 9 }} /> : <div style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${T.pageTer}` }} />}Identité
                    </span>
                  );
                }
                const ok = mapping[f.key] >= 0;
                return (
                  <span key={f.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 3, fontSize: 11, border: `1px solid ${ok ? "rgba(68,131,97,0.3)" : f.required ? "rgba(212,76,71,0.3)" : T.pageBdr}`, background: ok ? "rgba(68,131,97,0.07)" : f.required ? "rgba(212,76,71,0.04)" : "transparent", color: ok ? "#448361" : f.required ? "#d44c47" : T.pageSub }}>
                    {ok ? <Check style={{ width: 9, height: 9 }} /> : <div style={{ width: 9, height: 9, borderRadius: "50%", border: `1.5px solid ${f.required ? "#d44c47" : T.pageTer}` }} />}
                    {(f.label || f.key).replace(" ★", "")}{f.required ? " ★" : ""}
                  </span>
                );
              })}
            </div>
            {canMap && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#448361" }}>
                <CheckCircle2 style={{ width: 12, height: 12 }} /> Mapping complet — prêt à vérifier
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── fusionBases (Étape 8) ──────────────────────────────────────────────────
  function fusionBases() {
    const m1 = base1.mapping, r1 = base1.rows;
    const m2 = base2.mapping, r2 = base2.rows;
    const m3 = base3.mapping, r3 = base3.rows;
    
    // 1. On identifie les colonnes du fichier Personnel qui ont été mappées
    //    pour savoir lesquelles conserver en tant que "données brutes"
    const headers1 = r1[0] || [];
    const mappedIndices1 = new Set(Object.values(m1).filter(v => v >= 0));

    // 2. Indexation de la Base 2 (Formations)
    const idx2 = {};
    r2.slice(1).forEach((row, i) => {
      if (excluded2.has(i + 1)) return;
      const k = (row[m2["intitule"]] || "").trim().toLowerCase();
      if (k && !idx2[k]) { 
        const e = {}; 
        FIELDS_BASE2.filter(f => f.key !== "intitule" && m2[f.key] >= 0).forEach(f => { 
          e[f.key] = row[m2[f.key]] || ""; 
        }); 
        idx2[k] = e; 
      }
    });

    // 3. Indexation de la Base 3 (Cabinets)
    const idx3 = {};
    r3.slice(1).forEach((row, i) => {
      if (excluded3.has(i + 1)) return;
      const k = (row[m3["intitule"]] || "").trim().toLowerCase();
      if (k && !idx3[k]) { 
        const e = {}; 
        FIELDS_BASE3.filter(f => f.key !== "intitule" && m3[f.key] >= 0).forEach(f => { 
          e[f.key] = row[m3[f.key]] || ""; 
        }); 
        idx3[k] = e; 
      }
    });

    // 4. Fusion des données à partir de la Base 1 (Personnel)
    const useCombo = m1["nomprenom"] >= 0;
    const fused = [];

    r1.slice(1).forEach((row, idx) => {
      if (excluded1.has(idx + 1)) return;
      
      const intitRaw = (row[m1["intitule"]] || "").trim();
      if (!intitRaw) return;

      // Traitement de l'identité
      let nom = "", prenom = "";
      if (useCombo) { 
        const sp = splitFullName(row[m1["nomprenom"]]); 
        nom = sp.nom; 
        prenom = sp.prenom; 
      } else { 
        nom = (row[m1["nom"]] || "").trim(); 
        prenom = (row[m1["prenom"]] || "").trim(); 
      }

      // --- NOUVEAU : CAPTURE DES COLONNES NON-MAPPÉES ---
      const unmappedData = {};
      headers1.forEach((headerName, colIdx) => {
        if (!mappedIndices1.has(colIdx)) {
          const key = headerName || `Colonne ${colIdx + 1}`;
          unmappedData[key] = row[colIdx] || "";
        }
      });
      // ------------------------------------------------

      const h    = parseRawDuration(m1["heures"] >= 0 ? row[m1["heures"]] : "", durationUnit);
      const half = isHalfDay(h);
      const b2   = idx2[intitRaw.toLowerCase()] || {};
      const b3   = idx3[intitRaw.toLowerCase()] || {};
      const dd   = m1["dateDebut"] >= 0 ? parseExcelDate(row[m1["dateDebut"]]) : "";

      fused.push({
        nom, 
        prenom, 
        theme: intitRaw, 
        heures: h, 
        jours: half ? 0.5 : hrs2j(h), 
        halfDay: half,
        matricule: m1["matricule"] >= 0 ? (row[m1["matricule"]] || "").trim() : "",
        start: dd,
        end: m1["dateFin"] >= 0 ? parseExcelDate(row[m1["dateFin"]]) : "",
        hasPreDates: !!dd,
        
        // Stockage des données supplémentaires brutes
        unmappedData,

        // Données enrichies Base Personnel
        departement: m1["departement"] >= 0 ? row[m1["departement"]] || "" : "",
        csp: m1["csp"] >= 0 ? row[m1["csp"]] || "" : "",
        
        // Données enrichies Base Formations
        domaine: b2["domaine"] || "",
        objectif: b2["objectif"] || "",
        contenu: b2["contenu"] || "",
        niveau: b2["niveau"] || "",
        publicCible: b2["public"] || "",
        
        // Données enrichies Base Cabinets
        typeFormation: b3["typeFormation"] || b2["typeFormation"] || "",
        cabinet: b3["cabinet"] || "",
        cnss: b3["cnss"] || "",
        lieu: b3["lieu"] || "",
        nbrEspace: Math.max(1, parseInt(b3["nbrEspace"] || "") || 1),
        cout: b3["cout"] || "",
        formateur: b3["formateur"] || "",
        contact: b3["contact"] || "",
        
        groupe: 1, 
        statut: "Reçu", 
        id: uid(),
      });
    });

    setMerged(fused);

    // Préparation de la configuration des groupes (Étape 9)
    const tmap = {};
    fused.forEach(r => {
      const dk = r.hasPreDates ? `${r.start}__${r.end}` : "__";
      const tk = `${r.theme}__${dk}`;
      if (!tmap[tk]) {
        tmap[tk] = { 
          theme: r.theme, 
          total: 0, 
          jours: r.jours, 
          heures: r.heures, 
          halfDay: r.halfDay, 
          perGroup: "15", 
          preDateDebut: r.hasPreDates ? r.start : "", 
          preDateFin: r.hasPreDates ? r.end : "", 
          hasPreDates: r.hasPreDates, 
          _set: new Set() 
        };
      }
      const mat = r.matricule;
      const vM  = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
      tmap[tk]._set.add(vM ? mat.toLowerCase() : `${r.nom.toLowerCase()}__${r.prenom.toLowerCase()}`);
      tmap[tk].total = tmap[tk]._set.size;
    });

    setThemeConf(Object.values(tmap).map(({ _set, ...rest }) => rest));
    setStep(9);
  }

  // ── generateGroups ───────────────────────────────────────────────
  function generateGroups() {
    const byThemeDate = {};
    merged.forEach(r => {
      const gk = `${r.theme}__${r.hasPreDates ? `${r.start}__${r.end}` : "__"}`;
      if (!byThemeDate[gk]) byThemeDate[gk] = [];
      const mat = r.matricule;
      const vM  = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
      const ck  = vM ? mat.toLowerCase() : `${r.nom.toLowerCase()}__${r.prenom.toLowerCase()}`;
      if (!byThemeDate[gk].find(c => c._ck === ck)) byThemeDate[gk].push({ ...r, _ck: ck });
    });
    const gCount = {}, res = [];
    Object.entries(byThemeDate).forEach(([gk, cands]) => {
      if (!cands.length) return;
      const tc  = themeConf.find(t => `${t.theme}__${t.preDateDebut ? `${t.preDateDebut}__${t.preDateFin}` : "__"}` === gk);
      const pg  = Math.max(1, parseInt(tc?.perGroup) || 15);
      const theme = cands[0].theme;
      if (!gCount[theme]) gCount[theme] = 0;
      const dist = distributeBalanced(cands, pg);
      [...new Set(dist.map(c => c.groupe))].forEach(lg => {
        gCount[theme]++;
        const gg = gCount[theme];
        dist.filter(c => c.groupe === lg).forEach(c => res.push({
          ...c, groupe: gg,
          unmappedData: c.unmappedData,
          start:       tc?.hasPreDates ? tc.preDateDebut : "",
          end:         tc?.hasPreDates ? tc.preDateFin   : "",
          hasPreDates: !!tc?.hasPreDates,
          nbrEspace:   c.nbrEspace || 1,
          id:          uid(),
        }));
      });
    });
    setResult(res);
    setGanttDone(false);
    setStep(10);
  }

  // ── generateGantt ────────────────────────────────────────────────
  function generateGantt() {
    const startDay  = snap(wsStart || d2s(new Date()), wd, sh, vacs);
    const wsEndDate = wsEnd || (() => {
      const yr = startDay ? startDay.slice(0, 4) : new Date().getFullYear();
      return `${yr}-12-31`;
    })();

    const groupsMap = new Map();
    result.forEach(r => {
      const k = `${r.theme.trim()}||${r.groupe}`;
      if (!groupsMap.has(k)) groupsMap.set(k, {
        theme:        r.theme.trim(),
        groupe:       String(r.groupe),
        heures:       r.heures,
        jours:        r.jours  || 1,
        slots:        hrs2slots(r.heures),
        hasPreDates:  !!(r.start && r.start.length === 10),
        preDateDebut: r.start || "",
        preDateFin:   r.end   || "",
        nbrEspace:    Math.max(1, r.nbrEspace || 1),
        lieu:         r.lieu   || "",
        cabinet:      r.cabinet || "",
      });
    });

    const all    = Array.from(groupsMap.values());
    const prePl  = all.filter(g => g.hasPreDates);
    const toSch  = all.filter(g => !g.hasPreDates);
    const newTasks = [];

    prePl.forEach(g => newTasks.push({
      id:      uid(),
      name:    `${g.theme} — Grp ${g.groupe}`,
      group:   g.theme,
      groupe:  g.groupe,
      start:   g.preDateDebut,
      end:     g.preDateFin || g.preDateDebut,
      halfDay: g.slots === 1,
      slot:    null,
      _key:    `${g.theme}||${g.groupe}`,
    }));

    const byLieu = {};
    toSch.forEach(g => {
      const lieuKey = [g.lieu, g.cabinet].filter(Boolean).join("||") || "default";
      if (!byLieu[lieuKey]) byLieu[lieuKey] = { nbrEspace: g.nbrEspace, halves: [], fulls: [] };
      byLieu[lieuKey].nbrEspace = Math.max(byLieu[lieuKey].nbrEspace, g.nbrEspace);
      if (g.slots === 1) byLieu[lieuKey].halves.push(g);
      else               byLieu[lieuKey].fulls.push(g);
    });

    Object.entries(byLieu).forEach(([, { nbrEspace, halves, fulls }]) => {
      const nFiles     = Math.max(1, nbrEspace);
      const fileCursors = Array.from({ length: nFiles }, () => startDay);
      const bestFile   = () => { let b = 0; for (let f = 1; f < nFiles; f++) { if (fileCursors[f] < fileCursors[b]) b = f; } return b; };

      fulls.forEach(g => {
        const bf = bestFile();
        const s  = fileCursors[bf];
        const nb = Math.max(1, g.jours);
        const e  = addWD(s, nb - 1, wd, sh, vacs);
        newTasks.push({ id: uid(), name: `${g.theme} — Grp ${g.groupe}`, group: g.theme, groupe: g.groupe, start: s, end: e, halfDay: false, slot: null, _key: `${g.theme}||${g.groupe}` });
        fileCursors[bf] = snap(d2s(ad(pd(e), 1)), wd, sh, vacs);
      });

      let i = 0;
      while (i < halves.length) {
        const bf = bestFile();
        const ds = fileCursors[bf];
        const g1 = halves[i];
        const g2 = halves[i + 1] || null;
        newTasks.push({ id: uid(), name: `${g1.theme} — Grp ${g1.groupe}`, group: g1.theme, groupe: g1.groupe, start: ds, end: ds, halfDay: true, slot: "matin", _key: `${g1.theme}||${g1.groupe}` });
        if (g2) {
          newTasks.push({ id: uid(), name: `${g2.theme} — Grp ${g2.groupe}`, group: g2.theme, groupe: g2.groupe, start: ds, end: ds, halfDay: true, slot: "après-midi", _key: `${g2.theme}||${g2.groupe}` });
          i += 2;
        } else {
          i++;
        }
        fileCursors[bf] = snap(d2s(ad(pd(ds), 1)), wd, sh, vacs);
      }
    });

    let outOfRange = 0;
    newTasks.forEach(t => { if (t.end > wsEndDate) outOfRange++; });
    const totalFiles = Object.values(byLieu).reduce((s, l) => s + Math.max(1, l.nbrEspace), 0);
    const nLieux     = Object.keys(byLieu).length;

    const taskMap = {};
    newTasks.forEach(t => { taskMap[t._key] = t; });

    const updated = result.map(r => {
      const t = taskMap[`${r.theme.trim()}||${r.groupe}`];
      return { ...r, start: t ? t.start : r.start, end: t ? t.end : r.end, halfDay: t ? t.halfDay : (r.halfDay || false), slot: t ? t.slot : (r.slot || null) };
    });

    setResult(updated);
    setGanttDone(true);
    batchTasksRef.current = newTasks.map(({ _key, ...t }) => t);

    if (outOfRange > 0) {
      showToast(`⚠ ${outOfRange} groupe(s) dépassent le ${fmt(wsEndDate)} — ${nLieux} lieu(x) · ${totalFiles} espace(s) parallèle(s). Élargissez l'intervalle ou augmentez la capacité des lieux.`, "error");
    } else {
      showToast(`✓ ${newTasks.length} groupe(s) planifiés — ${nLieux} lieu(x) · ${totalFiles} espace(s) parallèle(s)`, "success");
    }
  }

  // ── confirm ──────────────────────────────────────────────────────
async function confirm() {
  if (importing) return;
  setImporting(true);

  try {
    // 1. Construction des tâches uniques
    const tasksMap = new Map();
    result.forEach(r => {
      const key = `${(r.theme || "").trim()}||${r.groupe}`;
      if (!tasksMap.has(key)) {
        tasksMap.set(key, {
          id: Math.random().toString(36).substr(2, 9),
          name: `${r.theme} — Grp ${r.groupe}`,
          group: (r.theme || "").trim(),
          groupe: r.groupe,
          start: r.start,
          end: r.end,
          halfDay: r.halfDay || false,
          slot: r.slot || null,
          workspaceId: wsId
        });
      }
    });
    const finalTasks = Array.from(tasksMap.values());

    // 2. Préparation des candidats
    const candidatsData = result.map(r => ({
      nom: (r.nom || "").trim(),
      prenom: (r.prenom || "").trim(),
      matricule: (r.matricule || "").trim(),
      theme: (r.theme || "").trim(),
      groupe: r.groupe,
      jours: r.jours || 1,
      dateDebut: r.start,
      dateFin: r.end,
      slot: r.slot,
      halfDay: r.halfDay,
      heures: r.heures || 0,
      nbrEspace: r.nbrEspace || 1,
      extraData: {
        ...(r.unmappedData || {}),
        domaine: r.domaine,
        objectif: r.objectif,
        contenu: r.contenu,
        cabinet: r.cabinet,
        cnss: r.cnss,
        lieu: r.lieu,
        cout: r.cout,
        formateur: r.formateur,
        departement: r.departement,
        csp: r.csp,
        typeFormation: r.typeFormation,
      },
    }));

    let finalCreatedDocs = [];

    if (wsId) {
      // 3. Sauvegarder les tâches
      if (finalTasks.length > 0) {
        await apiFetch(`/workspaces/${wsId}/tasks/bulk`, {
          method: "POST",
          body: { tasks: finalTasks },
        });

        await apiFetch(`/workspaces/${wsId}/gantt`, {
          method: "POST",
          body: { tasks: finalTasks, candidats: candidatsData },
        });
      }

      // 4. Nettoyage des anciens candidats et documents
      await apiFetch(`/workspaces/${wsId}/candidats`, { method: "DELETE" });
      await apiFetch(`/workspaces/${wsId}/documents`, { method: "DELETE" }); 

      // 5. Importation des nouveaux candidats
      await apiFetch(`/workspaces/${wsId}/candidats/import`, {
        method: "POST",
        body: { batchId: batchId.current, candidats: candidatsData },
      });

      // 6. Génération des documents (Émargements + Fiches Techniques)
      const attendanceDocs = finalTasks.map(t => ({
        nom: `Liste d'émargement - ${t.group} - G${t.groupe}`,
        type: "Émargement",
        statut: "En attente",
        dateDoc: t.start || "",
      }));

      const uniqueThemes = [...new Set(finalTasks.map(t => t.group))];
      const ficheTechDocs = uniqueThemes.map(theme => ({
        nom: `Fiche technique - ${theme}`,
        type: "Fiche technique",
        statut: "En attente",
        dateDoc: candidatsData.find(c => c.theme === theme)?.dateDebut || "",
      }));

      const recapDoc = {
        nom: `Récapitulatif des actions de formation`,
        type: "Récapitulatif",
        statut: "En attente",
        dateDoc: wsStart || new Date().toISOString().split('T')[0], // Date du début du projet
      };

      const syntheseDoc = {
  nom: `Synthèse des coûts de formation`,
  type: "Synthèse des coûts",
  statut: "En attente",
  dateDoc: wsStart || new Date().toISOString().split('T')[0],
};

const allDocsToCreate = [...attendanceDocs, ...ficheTechDocs, recapDoc, syntheseDoc];
      // CRUCIAL : On crée tous les documents en parallèle et on récupère les données normalisées
      const results = await Promise.all(
        allDocsToCreate.map(d => 
          apiFetch(`/workspaces/${wsId}/documents`, { method: "POST", body: d })
            .then(res => norm(res.data || res))
            .catch(e => { console.warn("Erreur doc:", d.nom); return null; })
        )
      );
      finalCreatedDocs = results.filter(Boolean);
    }

    showToast(`${candidatsData.length} candidats importés`, "success");

    // 7. Persister la base fusionnée en local pour l'export Excel ultérieur
    // 7. Sauvegarder la base fusionnée en Base de Données
try {
  const exportBaseData = result.map(r => {
    let creneauLabel = "Journée entière"; 
  
  if (r.halfDay) {
    if (r.slot === "matin") creneauLabel = "AM";
    else if (r.slot === "après-midi") creneauLabel = "PM";
    else creneauLabel = "AM"; // Sécurité
  } else {
    // Force la valeur même si r.slot est vide
    creneauLabel = "Journée entière";
  }

    return {
      nom: r.nom,
      prenom: r.prenom,
      matricule: r.matricule || "",
      theme: r.theme,
      groupe: r.groupe,
      heures: r.heures || 0,
      jours: r.jours || 0,
      halfDay: r.halfDay || false,
      slot: creneauLabel,
      dateDebut: r.start || "",
      dateFin: r.end || "",
      statut: r.statut || "Reçu",
      departement: r.departement || "",
      csp: r.csp || "",
      domaine: r.domaine || "",
      objectif: r.objectif || "",
      contenu: r.contenu || "",
      niveau: r.niveau || "",
      publicCible: r.publicCible || "",
      typeFormation: r.typeFormation || "",
      cabinet: r.cabinet || "",
      formateur: r.formateur || "",
      lieu: r.lieu || "",
      cout: r.cout || "",
      cnss: r.cnss || "",
      contact: r.contact || "",
      nbrEspace: r.nbrEspace || 1,
      ...(r.unmappedData || {}),
    };
  });

  // Sauvegarde API
  const updateRes = await apiFetch(`/workspaces/${wsId}/export-base`, {
  method: "PATCH",
  body: { 
    exportBase: { 
      rows: exportBaseData,
      exportedAt: new Date().toISOString()
    } 
  }
});

if (updateRes.data && onUpdateWs) {
  // updateRes.data contient maintenant le workspace avec hasExportBase: true
  onUpdateWs(updateRes.data); 
}
} catch (e) {
  console.error("Erreur sauvegarde exportBase:", e.message);
}

    // 8. Finalisation : on envoie les candidats, les tâches ET les documents créés
    onDone(candidatsData, finalTasks, finalCreatedDocs); 
    onClose();

  } catch (e) {
    console.error(e);
    showToast("Erreur d'importation : " + e.message, "error");
  } finally {
    setImporting(false);
  }
}
  // ── renderStatut (helper) ────────────────────────────────────────
  const renderStatut = (gr, cf, hasOverlap, hasSallePleine, hasHoliday, hasVac, hasHalfDayConflict, hasCandidatConflict, isOutOfRange, currentSlot) => {
  
  const conflictBtn = (label, color = "#d44c47") => (
    <button
      onClick={() => setConflictDetail(getConflictDetail(gr))}
      style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
      title="Cliquer pour voir le détail">
      <AlertTriangle style={{ width: 12, height: 12, color, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, color, textDecoration: "underline dotted" }}>{label}</span>
    </button>
  );

  if (isOutOfRange)          return conflictBtn("HORS PÉRIODE");
  if (hasHalfDayConflict)    return conflictBtn(currentSlot === "matin" ? "AM DÉJÀ PRIS" : "PM DÉJÀ PRIS");
  if (hasSallePleine)        return conflictBtn("SALLE PLEINE");
  if (hasOverlap)            return conflictBtn("CHEVAUCHEMENT");
  if (hasCandidatConflict)   return conflictBtn("CANDIDAT DOUBLE");
  if (hasVac)                return conflictBtn("CONGÉ", "#337ea9");
  if (hasHoliday)            return conflictBtn("FÉRIÉ", "#448361");

  if (gr.start) return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Check style={{ width: 12, height: 12, color: "#448361" }} />
      <span style={{ fontSize: 10, color: "#448361" }}>
        {gr.halfDay ? `OK — ${currentSlot === "matin" ? "Matin" : "Après-midi"}` : "OK"}
      </span>
    </div>
  );
  return <span style={{ fontSize: 10, color: T.pageTer }}>À planifier</span>;
};

// APRÈS


  // ── renderCell (helper tableau step 10) ─────────────────────────
  const renderCell = (key, gr, cf, hasOverlap, hasSallePleine, hasHoliday, hasVac, hasHalfDayConflict, hasCandidatConflict, isOutOfRange, currentSlot) => {
    switch (key) {
      case "theme":
        return (
          <td key={key} style={{ ...tdS, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <Tag label={gr.theme} scheme={grpTag(gr.theme)} />
          </td>
        );
      case "groupe":
        return <td key={key} style={{ ...tdS, textAlign: "center", fontWeight: 700, color: T.accent }}>G{gr.groupe}</td>;
      case "count":
        return <td key={key} style={{ ...tdS, textAlign: "center" }}><span style={{ fontSize: 11, color: T.pageSub }}>{gr.count} pers.</span></td>;
      case "duree":
        return (
          <td key={key} style={{ ...tdS, fontSize: 11 }}>
            {gr.halfDay ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontFamily: "monospace", color: T.pageSub }}>½ j</span>
                <div style={{ display: "flex", borderRadius: 4, border: `1px solid ${hasHalfDayConflict ? "#d44c47" : T.pageBdr}`, overflow: "hidden" }}>
                  {[["AM", "matin"], ["PM", "après-midi"]].map(([label, val]) => {
                    const active = currentSlot === val;
                    return (
                      <button key={val} onClick={() => updateGroupDates(gr.key, "slot", val)}
                        style={{ padding: "2px 7px", fontSize: 10, fontWeight: active ? 700 : 400, border: "none", borderRight: val === "matin" ? `1px solid ${T.pageBdr}` : "none", background: active ? (hasHalfDayConflict ? "rgba(212,76,71,0.15)" : "rgba(55,53,47,0.12)") : "#fff", color: active ? (hasHalfDayConflict ? "#d44c47" : T.pageText) : T.pageTer, cursor: "pointer", fontFamily: "inherit" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <span style={{ fontFamily: "monospace", color: T.pageSub }}>{gr.jours} j</span>
            )}
          </td>
        );
      case "start":
  return (
    <td key={key} style={{ ...tdS, padding: "4px 8px" }}>
      <RichDatePicker
        value={gr.start || ""}
        onChange={val => updateGroupDates(gr.key, "start", val)}
        wd={wd} sh={sh} vacs={vacs}
        groupRows={groupRows}
        currentKey={gr.key}
        hasPreDates={gr.hasPreDates}   // ← AJOUTER
      />
    </td>
  );

case "end":
  return (
    <td key={key} style={{ ...tdS, padding: "4px 8px" }}>
      {gr.halfDay
        ? <span style={{ fontSize: 11, color: T.pageTer, fontStyle: "italic" }}>= Début</span>
        : gr.jours <= 1
          ? (
            <RichDatePicker
              value={gr.end || gr.start || ""}
              onChange={() => {}}
              min={gr.start || undefined}
              wd={wd} sh={sh} vacs={vacs}
              groupRows={groupRows}
              currentKey={gr.key}
              disabled={true}
              hasPreDates={gr.hasPreDates}   // ← AJOUTER
            />
          )
          : (
            <RichDatePicker
              value={gr.end || ""}
              onChange={val => updateGroupDates(gr.key, "end", val)}
              min={gr.start || undefined}
              wd={wd} sh={sh} vacs={vacs}
              groupRows={groupRows}
              currentKey={gr.key}
              disabled={false}
              hasPreDates={gr.hasPreDates}   // ← AJOUTER
            />
          )
      }
    </td>
  );
      case "statut":
        return (
          <td key={key} style={{ ...tdS, minWidth: 140 }}>
            {renderStatut(gr, cf, hasOverlap, hasSallePleine, hasHoliday, hasVac, hasHalfDayConflict, hasCandidatConflict, isOutOfRange, currentSlot)}
          </td>
        );
      default:
        return (
          <td key={key} style={{ ...tdS, fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={gr[key] || ""}>
            {gr[key] ? <span style={{ color: T.pageText }}>{gr[key]}</span> : <span style={{ color: T.pageTer, fontStyle: "italic" }}>—</span>}
          </td>
        );
    }
  };
  
const handleSafeClose = () => {
  // On demande confirmation si des fichiers sont chargés ou si on a dépassé l'étape 1
  if (step > 1 || base1.fileName || base2.fileName || base3.fileName) {
    setShowConfirm(true);
  } else {
    onClose();
  }
};
  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget) handleSafeClose(); }}
    >
      {showConfirm && (
      <ConfirmModal 
        title="Arrêter l'importation ?"
        message="Vous allez perdre toute votre progression et les fichiers chargés. Voulez-vous vraiment quitter ?"
        confirmLabel="Arrêter l'import"
        cancelLabel="Continuer l'import"
        onConfirm={onClose} // Ferme réellement le modal
        onCancel={() => setShowConfirm(false)} // Ferme juste l'alerte
      />
    )}

      <div style={{ background: "#fff", borderRadius: 8, width: "min(1150px,98vw)", maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid rgba(55,53,47,0.12)` }}>
{/* ── Modal détail conflit ── */}
{conflictDetail && (
  <div
    style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    onMouseDown={e => { if (e.target === e.currentTarget) setConflictDetail(null); }}>
    <div style={{ background: "#fff", borderRadius: 8, width: "min(640px,96vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", border: `1px solid rgba(55,53,47,0.12)` }}>

      {/* Header */}
      <div style={{ padding: "14px 18px 12px", borderBottom: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, background: `${conflictDetail.color}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
          <AlertTriangle style={{ width: 14, height: 14, color: conflictDetail.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.pageText }}>{conflictDetail.title}</div>
          <div style={{ fontSize: 11, color: T.pageSub, marginTop: 2 }}>
            {conflictDetail.key.split("||")[0]} — G{conflictDetail.key.split("||")[1]}
          </div>
        </div>
        <button onClick={() => { setConflictDetail(null); setConflictEdit({}); }}
          style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer", color: T.pageSub, flexShrink: 0 }}>
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>

        {conflictDetail.type === "candidat_double" && (
  <>
    <div style={{ fontSize: 12, color: T.pageSub, marginBottom: 4 }}>
      {conflictDetail.items.length} candidat{conflictDetail.items.length > 1 ? "s" : ""} inscrit{conflictDetail.items.length > 1 ? "s" : ""} simultanément sur plusieurs formations :
    </div>
    <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(55,53,47,0.03)" }}>
            {["Candidat", "Aussi inscrit dans", "Période ici", "Période là-bas", "Action"].map(h => (
              <th key={h} style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", borderBottom: `1px solid ${T.pageBdr}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {conflictDetail.items.map((item, i) => {
            // Clé unique pour ce candidat dans cet item
            const editKey   = `${i}__${item.candidat}`;
            const isEditing = !!conflictEdit[editKey];

            // Groupes disponibles pour la formation "aussi inscrit dans"
            // ex: "ATEX — G1" → theme="ATEX", on liste tous les groupes de ce thème
            const otherTheme  = item.conflictWith.split(" — ")[0]?.trim();
            const otherGroupe = item.conflictWith.split(" — G")[1]?.trim();
            const thisTheme   = conflictDetail.key.split("||")[0];
            const thisGroupe  = conflictDetail.key.split("||")[1];

            // Tous les groupes existants pour la formation en conflit
            const otherGroupeOptions = [...new Set(
              result
                .filter(r => r.theme.trim() === otherTheme)
                .map(r => String(r.groupe))
            )].sort((a, b) => Number(a) - Number(b));

            // Tous les groupes existants pour CE groupe (formation actuelle)
            const thisGroupeOptions = [...new Set(
              result
                .filter(r => r.theme.trim() === thisTheme)
                .map(r => String(r.groupe))
            )].sort((a, b) => Number(a) - Number(b));

            const editVal = conflictEdit[editKey] || { targetFormation: "other", newGroupe: otherGroupe };

            return (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "rgba(55,53,47,0.015)", borderLeft: `3px solid #d44c47`, verticalAlign: "top" }}>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: T.pageText, borderBottom: `1px solid ${T.pageBdr}` }}>
                  {item.candidat}
                </td>
                <td style={{ padding: "8px 10px", fontSize: 12, color: "#d44c47", fontWeight: 500, borderBottom: `1px solid ${T.pageBdr}` }}>
                  {item.conflictWith}
                </td>
                <td style={{ padding: "8px 10px", fontSize: 11, fontFamily: "monospace", color: T.pageSub, borderBottom: `1px solid ${T.pageBdr}` }}>
                  {item.periode}
                </td>
                <td style={{ padding: "8px 10px", fontSize: 11, fontFamily: "monospace", color: T.pageSub, borderBottom: `1px solid ${T.pageBdr}` }}>
                  {item.periodeOther}
                </td>

                {/* ── Colonne Action ── */}
                <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.pageBdr}`, minWidth: 200 }}>
                  {!isEditing ? (
                    <button
                      onClick={() => setConflictEdit(p => ({ ...p, [editKey]: { targetFormation: "other", newGroupe: otherGroupe } }))}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", fontSize: 11, fontWeight: 600, color: T.accent, background: `${T.accent}0d`, border: `1px solid ${T.accent}30`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                      <UserCog style={{ width: 11, height: 11 }} />
                      Changer de groupe
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

                      {/* Choix : modifier dans quelle formation */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Modifier le groupe dans :
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[
                          { val: "here",  label: thisTheme.length > 18 ? thisTheme.slice(0,18)+"…" : thisTheme,  full: thisTheme  },
                          { val: "other", label: otherTheme.length > 18 ? otherTheme.slice(0,18)+"…" : otherTheme, full: otherTheme },
                        ].map(opt => (
                          <button key={opt.val}
                            title={opt.full}
                            onClick={() => setConflictEdit(p => ({
                              ...p,
                              [editKey]: {
                                targetFormation: opt.val,
                                newGroupe: opt.val === "here" ? thisGroupe : otherGroupe,
                              }
                            }))}
                            style={{
                              flex: 1, padding: "3px 6px", fontSize: 10, fontWeight: 600, borderRadius: 3, cursor: "pointer", fontFamily: "inherit", border: "none",
                              background: editVal.targetFormation === opt.val ? T.accent : "rgba(55,53,47,0.07)",
                              color:      editVal.targetFormation === opt.val ? "#fff" : T.pageSub,
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Sélection du nouveau groupe */}
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        Nouveau groupe :
                      </div>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {(editVal.targetFormation === "here" ? thisGroupeOptions : otherGroupeOptions).map(g => (
                          <button key={g}
                            onClick={() => setConflictEdit(p => ({ ...p, [editKey]: { ...editVal, newGroupe: g } }))}
                            style={{
                              padding: "3px 10px", fontSize: 11, fontWeight: 700, borderRadius: 3, cursor: "pointer", fontFamily: "inherit", border: "none",
                              background: editVal.newGroupe === g ? T.accent : "rgba(55,53,47,0.07)",
                              color:      editVal.newGroupe === g ? "#fff" : T.pageText,
                            }}>
                            G{g}
                          </button>
                        ))}
                      </div>

                      {/* Boutons confirmer / annuler */}
                      <div style={{ display: "flex", gap: 5, marginTop: 2 }}>
                        <button
                          onClick={() => {
                            // Extraire le nom/matricule depuis item.candidat
                            // format : "NOM Prénom (MAT)" ou "NOM Prénom"
                            const matMatch = item.candidat.match(/\(([^)]+)\)$/);
                            const mat      = matMatch ? matMatch[1].trim() : "";
                            const nomPrenom = item.candidat.replace(/\s*\([^)]+\)$/, "").trim();
                            const [nom, ...prenomParts] = nomPrenom.split(" ");
                            const prenom = prenomParts.join(" ");

                            const targetTheme = editVal.targetFormation === "here" ? thisTheme : otherTheme;
                            const currentGrp  = editVal.targetFormation === "here" ? Number(thisGroupe) : Number(otherGroupe);
                            const newGrp      = Number(editVal.newGroupe);

                            if (currentGrp === newGrp) {
                              setConflictEdit(p => { const n = { ...p }; delete n[editKey]; return n; });
                              return;
                            }

                            // Mettre à jour result
                            setResult(prev => prev.map(r => {
                              const sameTheme = r.theme.trim() === targetTheme;
                              const sameGrp   = Number(r.groupe) === currentGrp;
                              if (!sameTheme || !sameGrp) return r;
                              // Identifier le candidat
                              const rMat = (r.matricule || "").trim();
                              const matchByMat  = mat && rMat.toLowerCase() === mat.toLowerCase();
                              const matchByName = !mat && r.nom.toLowerCase() === nom.toLowerCase() && r.prenom.toLowerCase() === prenom.toLowerCase();
                              if (!matchByMat && !matchByName) return r;
                              return { ...r, groupe: newGrp };
                            }));

                            setConflictEdit(p => { const n = { ...p }; delete n[editKey]; return n; });
                            setGanttDone(false);
                          }}
                          style={{ flex: 1, padding: "4px 0", fontSize: 11, fontWeight: 700, color: "#fff", background: "#37352f", border: "none", borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                          ✓ Appliquer
                        </button>
                        <button
                          onClick={() => setConflictEdit(p => { const n = { ...p }; delete n[editKey]; return n; })}
                          style={{ flex: 1, padding: "4px 0", fontSize: 11, color: T.pageSub, background: "transparent", border: `1px solid ${T.pageBdr}`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </>
)}

        {(conflictDetail.type === "overlap" || conflictDetail.type === "salle_pleine") && (
          <>
            <div style={{ fontSize: 12, color: T.pageSub, marginBottom: 4 }}>
              {conflictDetail.items.length} groupe{conflictDetail.items.length > 1 ? "s" : ""} en chevauchement sur le même lieu/créneau :
            </div>
            <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(55,53,47,0.03)" }}>
                    {["Groupe en conflit", "Période ce groupe", "Période autre groupe", "Lieu", conflictDetail.type === "salle_pleine" ? "Simultanés / Capacité" : ""].filter(Boolean).map(h => (
                      <th key={h} style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", borderBottom: `1px solid ${T.pageBdr}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conflictDetail.items.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "rgba(55,53,47,0.015)", borderLeft: `3px solid #d44c47` }}>
                      <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 600, color: "#d44c47", borderBottom: `1px solid ${T.pageBdr}` }}>{item.conflictWith}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, fontFamily: "monospace", color: T.pageSub, borderBottom: `1px solid ${T.pageBdr}` }}>{item.periode}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, fontFamily: "monospace", color: T.pageSub, borderBottom: `1px solid ${T.pageBdr}` }}>{item.periodeOther}</td>
                      <td style={{ padding: "7px 10px", fontSize: 11, color: T.pageSub, borderBottom: `1px solid ${T.pageBdr}` }}>{item.lieu}</td>
                      {conflictDetail.type === "salle_pleine" && (
                        <td style={{ padding: "7px 10px", fontSize: 11, fontWeight: 700, color: "#d44c47", borderBottom: `1px solid ${T.pageBdr}` }}>
                          {item.simultanes} / {item.capacite}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {(conflictDetail.type === "hors_periode" || conflictDetail.type === "halfday" || conflictDetail.type === "holiday" || conflictDetail.type === "vacation") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {conflictDetail.items.map((item, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", borderRadius: 6, border: `1px solid ${conflictDetail.color}25`, background: `${conflictDetail.color}06`, borderLeft: `3px solid ${conflictDetail.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.pageText }}>{item.conflictWith}</div>
                <div style={{ fontSize: 12, color: T.pageSub }}>{item.periode}</div>
                {item.periodeOther && <div style={{ fontSize: 12, color: conflictDetail.color, fontWeight: 500 }}>{item.periodeOther}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Suggestion d'action */}
        <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 6, background: "rgba(55,53,47,0.03)", border: `1px solid ${T.pageBdr}`, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 18, flexShrink: 0 }}>💡</div>
          <div style={{ fontSize: 12, color: T.pageSub, lineHeight: 1.6 }}>
            {conflictDetail.type === "candidat_double" && "Modifiez les dates d'un des groupes pour éviter le chevauchement, ou vérifiez si le candidat doit bien être inscrit aux deux formations."}
            {conflictDetail.type === "salle_pleine"    && "Augmentez la capacité du lieu (champ « Nbr d'espace ») dans la Base Cabinets, ou décalez les dates d'un des groupes."}
            {conflictDetail.type === "overlap"         && "Décalez la date de début de ce groupe pour éviter le chevauchement sur le même lieu."}
            {conflictDetail.type === "hors_periode"    && "Avancez la date de fin du groupe ou élargissez la période du workspace, puis régénérez la planification."}
            {conflictDetail.type === "halfday"         && "Changez le créneau (Matin / Après-midi) de l'un des groupes, ou décalez la date."}
            {conflictDetail.type === "holiday"         && "Cliquez sur Régénérer pour recalculer les dates en excluant les jours fériés."}
            {conflictDetail.type === "vacation"        && "Cliquez sur Régénérer pour recalculer les dates en excluant cette période de congé."}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
        <button onClick={() => { setConflictDetail(null); setConflictEdit({}); } }
          style={{ padding: "6px 18px", fontSize: 13, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
          Fermer
        </button>
      </div>
    </div>
  </div>
)}
        {/* ── HEADER ── */}
        <div style={{ padding: "16px 22px 12px", borderBottom: `1px solid ${T.pageBdr}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.pageText }}>{stepTitle}</div>
              <div style={{ fontSize: 11, color: T.pageSub, marginTop: 1 }}>Import multi-bases Excel · Étape {visualStep}/7</div>
            </div>
            <button onClick={handleSafeClose} style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {PROG.map(s => {
              const done = visualStep > s.key, active = visualStep === s.key;
              return (
                <div key={s.key} style={{ flex: 1 }}>
                  <div style={{ height: 2, borderRadius: 99, background: (done || active) ? T.accent : "rgba(55,53,47,0.1)", marginBottom: 4 }} />
                  <div style={{ fontSize: 9, color: (done || active) ? T.accent : T.pageTer, fontWeight: (done || active) ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {done ? "✓ " : ""}{s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

          {/* ── ÉTAPE 1 ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, color: T.pageSub, lineHeight: 1.7 }}>
                Importez jusqu'à 3 fichiers Excel complémentaires. Ils sont fusionnés via l'<strong>intitulé de formation</strong> comme clé de jointure.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { color: "#0f7ddb", label: "Base Personnel ★",  desc: "Nom, prénom, intitulé, heures, matricule, dates…", required: true,  ready: b1Ready, fields: ["Nom/Prénom", "Intitulé", "Nb heures", "Matricule", "Dates"] },
                  { color: "#448361", label: "Base Formations",    desc: "Domaine, objectif, contenu, niveau…",              required: false, ready: b2Ready, fields: ["Domaine", "Objectif", "Contenu", "Niveau"] },
                  { color: "#9065b0", label: "Base Cabinets",      desc: "Cabinet, N° CNSS, lieu, coût, formateur…",         required: false, ready: b3Ready, fields: ["Cabinet", "CNSS", "Lieu", "Coût"] },
                ].map((b, i) => (
                  <div key={i} style={{ border: `1px solid ${b.ready ? `${b.color}35` : T.pageBdr}`, borderRadius: 7, padding: "14px 14px 12px", background: b.ready ? `${b.color}05` : "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.pageText }}>{b.label}</div>
                      {b.ready
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: "#448361", padding: "1px 7px", borderRadius: 99, background: "rgba(68,131,97,0.1)", border: "1px solid rgba(68,131,97,0.25)" }}>PRÊT</span>
                        : b.required
                          ? <span style={{ fontSize: 10, fontWeight: 600, color: "#d44c47", padding: "1px 7px", borderRadius: 99, background: "rgba(212,76,71,0.06)", border: "1px solid rgba(212,76,71,0.2)" }}>requis</span>
                          : <span style={{ fontSize: 10, color: T.pageTer, padding: "1px 7px", borderRadius: 99, border: `1px solid ${T.pageBdr}` }}>optionnel</span>
                      }
                    </div>
                    <div style={{ fontSize: 11, color: T.pageSub, lineHeight: 1.6, marginBottom: 10 }}>{b.desc}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {b.fields.map((f, fi) => <span key={fi} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: `${b.color}0d`, color: b.color, border: `1px solid ${b.color}1c` }}>{f}</span>)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 6, border: `1px solid ${T.pageBdr}`, background: "rgba(55,53,47,0.02)", fontSize: 12, color: T.pageSub }}>
                <strong style={{ color: T.pageText }}>Clé de jointure :</strong> L'intitulé de formation doit être identique dans les 3 bases.
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <BasePanel base={base1} setter={setBase1} fields={FIELDS_BASE1} fileRef={fileRef1} color="#0f7ddb" />
              {base1.rows.length > 0 && (
                <div style={{ padding: "12px 14px", borderRadius: 6, border: `1px solid ${T.pageBdr}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.05em" }}>Unité de durée</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ v: "heures", label: "Heures  (ex : 7.5)" }, { v: "jours", label: "Jours  (ex : 1, 0.5)" }].map(({ v, label }) => (
                      <button key={v} onClick={() => setDurationUnit(v)}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 4, border: `1.5px solid ${durationUnit === v ? T.accent : T.pageBdr}`, background: durationUnit === v ? `${T.accent}08` : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: durationUnit === v ? 600 : 400, color: durationUnit === v ? T.accent : T.pageText, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
                        {durationUnit === v && <Check style={{ width: 11, height: 11 }} />}{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && <AnomaliesPanel anomalies={anomalies1} excluded={excluded1} setExcluded={setExcluded1} label="la base Personnel" onExport={() => exportAnomalies(anomalies1, "base_personnel")} />}

          {/* ── ÉTAPE 4 ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "8px 12px", borderRadius: 5, border: "1px solid rgba(68,131,97,0.25)", background: "rgba(68,131,97,0.04)", fontSize: 12, color: "#448361", display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 style={{ width: 12, height: 12, flexShrink: 0 }} />Base optionnelle. Si vous n'avez pas ce fichier, cliquez sur "Passer".
              </div>
              <BasePanel base={base2} setter={setBase2} fields={FIELDS_BASE2} fileRef={fileRef2} color="#448361" />
            </div>
          )}

          {step === 5 && <AnomaliesPanel anomalies={anomalies2} excluded={excluded2} setExcluded={setExcluded2} label="la base Formations" onExport={() => exportAnomalies(anomalies2, "base_formations")} />}

          {/* ── ÉTAPE 6 ── */}
          {step === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ padding: "8px 12px", borderRadius: 5, border: "1px solid rgba(144,101,176,0.25)", background: "rgba(144,101,176,0.04)", fontSize: 12, color: "#9065b0", display: "flex", alignItems: "center", gap: 7 }}>
                <CheckCircle2 style={{ width: 12, height: 12, flexShrink: 0 }} />Base optionnelle. Si vous n'avez pas ce fichier, cliquez sur "Passer".
              </div>
              <BasePanel base={base3} setter={setBase3} fields={FIELDS_BASE3} fileRef={fileRef3} color="#9065b0" />
            </div>
          )}

          {step === 7 && <AnomaliesPanel anomalies={anomalies3} excluded={excluded3} setExcluded={setExcluded3} label="la base Cabinets" onExport={() => exportAnomalies(anomalies3, "base_cabinets")} />}

          {/* ── ÉTAPE 8 ── */}
          {step === 8 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: T.pageSub }}>Vérifiez les bases avant de lancer la fusion.</div>
              {[
                { label: "Base Personnel", ok: b1Ready, count: base1.rows.length - 1, excl: excluded1.size, color: "#0f7ddb", required: true  },
                { label: "Base Formations", ok: b2Ready, count: base2.rows.length - 1, excl: excluded2.size, color: "#448361", required: false },
                { label: "Base Cabinets",  ok: b3Ready, count: base3.rows.length - 1, excl: excluded3.size, color: "#9065b0", required: false },
              ].map((b, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 6, border: `1px solid ${b.ok ? `${b.color}30` : b.required ? "rgba(212,76,71,0.25)" : T.pageBdr}`, background: b.ok ? `${b.color}04` : "#fff" }}>
                  {b.ok
                    ? <CheckCircle2 style={{ width: 15, height: 15, color: b.color, flexShrink: 0 }} />
                    : b.required
                      ? <AlertTriangle style={{ width: 15, height: 15, color: "#d44c47", flexShrink: 0 }} />
                      : <div style={{ width: 15, height: 15, borderRadius: "50%", border: `2px dashed ${T.pageTer}`, flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.pageText }}>{b.label}</div>
                    <div style={{ fontSize: 11, color: T.pageSub }}>{b.ok ? `${b.count} lignes${b.excl ? ` · ${b.excl} exclue(s)` : ""}` : b.required ? "Manquante" : "Non chargée"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ÉTAPE 9 ── */}
          {step === 9 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: T.pageSub }}>Définissez le nombre maximum de candidats par groupe.</div>
              <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{["Intitulé", "Durée", "Dates pré-planifiées", "Total", "Max/groupe", "Groupes"].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {themeConf.map((tc, i) => {
                      const pg = Math.max(1, parseInt(tc.perGroup) || 15);
                      const nb = Math.ceil(tc.total / pg);
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "rgba(55,53,47,0.01)" }}>
                          <td style={{ ...tdS, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tc.theme}>{tc.theme}</td>
                          <td style={{ ...tdS, fontFamily: "monospace" }}>{tc.halfDay ? "½ j" : `${tc.jours} j`}</td>
                          <td style={tdS}>
                            {tc.hasPreDates && tc.preDateDebut
                              ? <span style={{ fontSize: 11, fontFamily: "monospace", color: "#337ea9" }}>{fmt(tc.preDateDebut)}{tc.preDateFin ? ` → ${fmt(tc.preDateFin)}` : ""}</span>
                              : <span style={{ color: T.pageTer, fontSize: 11 }}>Auto</span>
                            }
                          </td>
                          <td style={{ ...tdS, textAlign: "center", fontWeight: 700 }}>{tc.total}</td>
                          <td style={{ ...tdS, textAlign: "center" }}>
                            <input type="number" min={1} step={1} value={tc.perGroup}
                              onChange={e => setThemeConf(p => p.map((x, j) => j === i ? { ...x, perGroup: e.target.value } : x))}
                              style={{ ...iS, width: 65, textAlign: "center", fontWeight: 600 }}
                              onFocus={fI} onBlur={fO} />
                          </td>
                          <td style={{ ...tdS, textAlign: "center", fontWeight: 600, color: T.accent }}>{nb} gr.</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "rgba(55,53,47,0.02)" }}>
                      <td colSpan={3} style={{ ...tdS, fontWeight: 600, color: T.pageSub, fontSize: 11 }}>Total</td>
                      <td style={{ ...tdS, textAlign: "center", fontWeight: 700 }}>{themeConf.reduce((s, t) => s + t.total, 0)}</td>
                      <td style={tdS} />
                      <td style={{ ...tdS, textAlign: "center", fontWeight: 700, color: T.accent }}>
                        {themeConf.reduce((s, tc) => s + Math.ceil(tc.total / Math.max(1, parseInt(tc.perGroup) || 15)), 0)} gr.
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              ÉTAPE 10 — Résultat & Gantt
          ════════════════════════════════════════════════════════ */}
          {step === 10 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Paramètres planification ── */}
              <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
                <div onClick={() => setShowSettings(v => !v)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(55,53,47,0.03)", cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Settings style={{ width: 13, height: 13, color: T.pageSub }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.pageText }}>Paramètres de planification</span>
                    <span style={{ fontSize: 10, color: T.pageTer }}>Weekends · Fériés · Congés</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.pageSub, background: "rgba(55,53,47,0.06)", padding: "2px 8px", borderRadius: 10 }}>
                      {7 - wd.length}j/sem · {sh ? "🇲🇦 Fériés ON" : "Fériés OFF"}{vacs.length ? ` · ${vacs.length} congé(s)` : ""}
                    </span>
                    {(wsStart || wsEnd) && (
                      <span style={{ fontSize: 11, color: "#0f7ddb", background: "rgba(15,125,219,0.07)", border: "1px solid rgba(15,125,219,0.2)", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                       {wsStart ? fmt(wsStart) : "?"} → {wsEnd ? fmt(wsEnd) : "?"}
                      </span>
                    )}
                    <ChevronDown style={{ width: 13, height: 13, color: T.pageSub, transform: showSettings ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
                  </div>
                </div>
                {showSettings && (
                  <div style={{ padding: "14px 16px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Jours ouvrés */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pageSub, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>Jours de weekend (non ouvrés)</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[["Lun", 1], ["Mar", 2], ["Mer", 3], ["Jeu", 4], ["Ven", 5], ["Sam", 6], ["Dim", 0]].map(([l, d]) => {
                          const isW = wd.includes(d);
                          return (
                            <button key={d} onClick={() => { setWd(p => p.includes(d) ? (p.length > 1 ? p.filter(x => x !== d) : p) : [...p, d]); setGanttDone(false); }}
                              style={{ padding: "5px 10px", fontSize: 11, fontWeight: isW ? 600 : 400, borderRadius: 4, border: `1px solid ${isW ? T.accent : T.pageBdr}`, background: isW ? `${T.accent}10` : "#fff", cursor: "pointer", color: isW ? T.accent : T.pageSub, fontFamily: "inherit" }}>
                              {isW ? <Check style={{ width: 9, height: 9, display: "inline", marginRight: 3 }} /> : null}{l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Fériés */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => { setSh(v => !v); setGanttDone(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 4, border: `1px solid ${sh ? "rgba(68,131,97,0.35)" : T.pageBdr}`, background: sh ? "rgba(68,131,97,0.08)" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, color: sh ? "#448361" : T.pageSub, fontFamily: "inherit" }}>
                        {sh ? <CheckCircle2 style={{ width: 12, height: 12 }} /> : <div style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${T.pageTer}` }} />}
                        🇲🇦 Jours fériés marocains
                      </button>
                      <span style={{ fontSize: 11, color: T.pageTer }}>{sh ? "Les jours fériés sont exclus du calcul" : "Fériés non pris en compte"}</span>
                    </div>
                    {/* Congés */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: T.pageSub, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>Périodes de congés / fermeture</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <input placeholder="Libellé (ex: Ramadan)" value={vacForm.label} onChange={e => setVacForm(p => ({ ...p, label: e.target.value }))} style={{ ...iS, flex: 2 }} onFocus={fI} onBlur={fO} />
                        <input type="date" value={vacForm.start} onChange={e => setVacForm(p => ({ ...p, start: e.target.value }))} style={{ ...iS, flex: 1 }} onFocus={fI} onBlur={fO} />
                        <input type="date" value={vacForm.end} min={vacForm.start || undefined} onChange={e => setVacForm(p => ({ ...p, end: e.target.value }))} style={{ ...iS, flex: 1 }} onFocus={fI} onBlur={fO} />
                        <button onClick={() => { if (!vacForm.start || !vacForm.end || vacForm.start > vacForm.end) return; setVacs(p => [...p, { id: uid(), ...vacForm }]); setVacForm({ label: "", start: "", end: "" }); setGanttDone(false); }}
                          style={{ padding: "0 12px", background: "#37352f", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                          <Plus style={{ width: 13, height: 13 }} /> Ajouter
                        </button>
                      </div>
                      {vacs.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {vacs.map(v => (
                            <div key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 10px", borderRadius: 4, background: "rgba(51,126,169,0.08)", border: "1px solid rgba(51,126,169,0.22)", fontSize: 11, color: "#337ea9" }}>
                               <strong>{v.label}</strong> · {fmt(v.start)} → {fmt(v.end)}
                              <button onClick={() => { setVacs(p => p.filter(x => x.id !== v.id)); setGanttDone(false); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#337ea9", padding: 0, marginLeft: 2, display: "flex", alignItems: "center" }}>
                                <X style={{ width: 10, height: 10 }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Bandeau hors-intervalle ── */}
              {(() => {
                const wsE = wsEnd || (wsStart ? `${wsStart.slice(0,4)}-12-31` : null);
                const oor = wsE ? groupRows.filter(gr => gr.end && gr.end > wsE).length : 0;
                return oor > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 5, background: "rgba(212,76,71,0.07)", border: "1px solid rgba(212,76,71,0.3)" }}>
                    <AlertTriangle style={{ width: 13, height: 13, color: "#d44c47", flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: "#d44c47", fontWeight: 600 }}>{oor} groupe{oor > 1 ? "s" : ""} hors intervalle</span>
                    <span style={{ fontSize: 11, color: T.pageSub }}>— date de fin dépasse le {fmt(wsE)}. Régénérez la planification.</span>
                  </div>
                ) : null;
              })()}

              {/* ── Bandeaux conflits ── */}
              {conflictCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 5, background: "rgba(212,76,71,0.06)", border: "1px solid rgba(212,76,71,0.22)" }}>
                  <AlertTriangle style={{ width: 13, height: 13, color: "#d44c47", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#d44c47", fontWeight: 600 }}>{conflictCount} groupe{conflictCount > 1 ? "s" : ""} en conflit</span>
                  <span style={{ fontSize: 11, color: T.pageSub }}>— chevauchement, jour férié ou congé détecté. Corrigez les dates ou régénérez.</span>
                </div>
              )}
              {conflictCount === 0 && result.length > 0 && ganttDone && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 5, background: "rgba(68,131,97,0.07)", border: "1px solid rgba(68,131,97,0.22)" }}>
                  <CheckCheck style={{ width: 13, height: 13, color: "#448361", flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#448361", fontWeight: 600 }}>Aucun conflit — planification cohérente avec le Gantt</span>
                </div>
              )}

              {/* ── Bouton Gantt ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={generateGantt}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 18px", fontSize: 12, fontWeight: 700, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  <Wand2 style={{ width: 13, height: 13 }} />
                  {ganttDone ? "♻ Regénérer auto" : "Générer planification auto"}
                </button>
                {ganttDone
                  ? <span style={{ fontSize: 11, color: "#448361" }}>✓ Planification générée — vous pouvez ajuster les dates manuellement</span>
                  : <span style={{ fontSize: 11, color: T.pageTer }}>Génère les dates automatiquement en respectant weekends, fériés et congés</span>
                }
              </div>

              {/* ── Barre contrôle : picker colonnes + filtres actifs ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

                {/* Picker colonnes */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowColPicker(v => !v)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: showColPicker ? T.accent : T.pageText, background: showColPicker ? `${T.accent}0d` : "#fff", border: `1px solid ${showColPicker ? T.accent : T.pageBdr}`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                    <Columns style={{ width: 12, height: 12 }} />
                    Colonnes
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99, background: T.accent, color: "#fff", marginLeft: 2 }}>
                      {Object.values(visibleCols).filter(Boolean).length}
                    </span>
                  </button>

                  {showColPicker && (
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, background: "#fff", border: `1px solid ${T.pageBdr}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "10px 0", minWidth: 260, maxHeight: 420, overflowY: "auto" }}>
                      {COL_GROUPS.map(grp => (
                        <div key={grp}>
                          <div style={{ padding: "6px 14px 4px", fontSize: 9, fontWeight: 700, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.07em", borderTop: grp !== COL_GROUPS[0] ? `1px solid ${T.pageBdr}` : "none", marginTop: grp !== COL_GROUPS[0] ? 6 : 0 }}>
                            {grp}
                          </div>
                          {COL_DEFS.filter(c => c.group === grp).map(col => {
                            const isOn     = visibleCols[col.key];
                            const hasFilter = !!colFilters[col.key];
                            return (
                              <div key={col.key}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 14px", cursor: "pointer", background: isOn ? `${T.accent}06` : "transparent" }}
                                onClick={() => setVisibleCols(p => ({ ...p, [col.key]: !p[col.key] }))}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${isOn ? T.accent : "rgba(55,53,47,0.25)"}`, background: isOn ? T.accent : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    {isOn && <Check style={{ width: 9, height: 9, color: "#fff" }} />}
                                  </div>
                                  <span style={{ fontSize: 12, color: isOn ? T.pageText : T.pageSub, fontWeight: isOn ? 500 : 400 }}>{col.label}</span>
                                </div>
                                {hasFilter && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, flexShrink: 0 }} />}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {/* Footer picker */}
                      <div style={{ display: "flex", gap: 6, padding: "10px 14px 4px", borderTop: `1px solid ${T.pageBdr}`, marginTop: 6 }}>
                        <button onClick={e => { e.stopPropagation(); const next = {}; COL_DEFS.forEach(c => { next[c.key] = true; }); setVisibleCols(next); }}
                          style={{ flex: 1, padding: "4px 0", fontSize: 11, fontWeight: 600, color: T.accent, background: `${T.accent}0d`, border: `1px solid ${T.accent}30`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                          Tout afficher
                        </button>
                        <button onClick={e => { e.stopPropagation(); const next = {}; COL_DEFS.forEach(c => { next[c.key] = ["theme","groupe","count","duree","start","end","statut"].includes(c.key); }); setVisibleCols(next); }}
                          style={{ flex: 1, padding: "4px 0", fontSize: 11, color: T.pageSub, background: "transparent", border: `1px solid ${T.pageBdr}`, borderRadius: 3, cursor: "pointer", fontFamily: "inherit" }}>
                          Par défaut
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chips filtres actifs */}
                {Object.entries(colFilters).filter(([, v]) => v).map(([key, val]) => {
                  const colDef = COL_DEFS.find(c => c.key === key);
                  return (
                    <div key={key} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 10px", borderRadius: 4, background: `${T.accent}0d`, border: `1px solid ${T.accent}25`, fontSize: 11, color: T.accent }}>
                      <span style={{ fontWeight: 600 }}>{colDef?.label} :</span>
                      <span>{val}</span>
                      <button onClick={() => setColFilters(p => { const n = { ...p }; delete n[key]; return n; })}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: T.accent, padding: 0, display: "flex", alignItems: "center" }}>
                        <X style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  );
                })}

                {/* Compteur */}
                <span style={{ fontSize: 11, color: T.pageTer, marginLeft: "auto" }}>
                  {groupRowsFiltered.length} / {groupRows.length} groupe{groupRows.length > 1 ? "s" : ""}
                </span>

                {/* Reset filtres */}
                {Object.values(colFilters).some(Boolean) && (
                  <button onClick={() => setColFilters({})}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", fontSize: 11, color: "#d44c47", background: "rgba(212,76,71,0.06)", border: "1px solid rgba(212,76,71,0.2)", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    <X style={{ width: 10, height: 10 }} /> Réinitialiser filtres
                  </button>
                )}
              </div>

              {/* ── Tableau ── */}
              <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: 420 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>

                    {/* THEAD */}
                    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      {/* Ligne 1 : headers + tri */}
                      <tr style={{ background: "#f0f0f0" }}>
                        {COL_DEFS.filter(c => visibleCols[c.key]).map(col => (
                          <th key={col.key}
                            style={{ ...thS, cursor: col.sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap", background: sortField === col.key ? `${T.accent}10` : "rgba(55,53,47,0.03)" }}
                            onClick={() => col.sortable && handleSort(col.key)}>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              {col.label}
                              {col.sortable && <SortIcon field={col.key} />}
                            </div>
                          </th>
                        ))}
                      </tr>
                      {/* Ligne 2 : filtres inline */}
                      <tr style={{ background: "#f7f7f7", borderBottom: `1px solid ${T.pageBdr}` }}>
                        {COL_DEFS.filter(c => visibleCols[c.key]).map(col => (
                          <th key={col.key} style={{ padding: "4px 6px" }}>
                            {col.filterable ? (
                              col.key === "statut" ? (
                                <select value={colFilters[col.key] || ""} onChange={e => setColFilters(p => ({ ...p, [col.key]: e.target.value }))}
                                  style={{ ...iS, fontSize: 10, width: "100%", padding: "2px 4px" }}>
                                  <option value="">Tous</option>
                                  <option value="ok">✓ OK</option>
                                  <option value="conflit">⚠ Conflit</option>
                                  <option value="planifier">À planifier</option>
                                </select>
                              ) : colUniqueValues[col.key]?.length > 0 && col.key !== "theme" && col.key !== "objectif" && col.key !== "contenu" ? (
                                <select value={colFilters[col.key] || ""} onChange={e => setColFilters(p => ({ ...p, [col.key]: e.target.value }))}
                                  style={{ ...iS, fontSize: 10, width: "100%", padding: "2px 4px" }}>
                                  <option value="">Tous</option>
                                  {colUniqueValues[col.key].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                              ) : (
                                <input placeholder="Filtrer…" value={colFilters[col.key] || ""} onChange={e => setColFilters(p => ({ ...p, [col.key]: e.target.value }))}
                                  style={{ ...iS, fontSize: 10, width: "100%", padding: "2px 4px" }} />
                              )
                            ) : <div />}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    {/* TBODY */}
                    <tbody>
                      {groupRowsFiltered.map((gr, i) => {
                        const cf                  = conflictIndex[gr.key];
                        const hasOverlap          = cf?.has("overlap");
                        const hasSallePleine      = cf?.has("salle_pleine");
                        const hasHoliday          = cf?.has("holiday");
                        const hasVac              = cf?.has("vacation");
                        const hasHalfDayConflict  = halfDayConflictKeys.has(gr.key);
                        const hasCandidatConflict = candidatConflictKeys.has(gr.key);
                        const wsE          = wsEnd || (wsStart ? `${wsStart.slice(0,4)}-12-31` : null);
                        const isOutOfRange = wsE && gr.end && gr.end > wsE;
                        const currentSlot  = gr.slot || "matin";

                        const isRed = isOutOfRange || hasOverlap || hasSallePleine || hasHalfDayConflict || hasCandidatConflict;
                        const rowBg = isRed        ? "rgba(212,76,71,0.06)"
                          : hasVac                 ? "rgba(51,126,169,0.06)"
                          : hasHoliday             ? "rgba(68,131,97,0.06)"
                          : i % 2 === 0            ? "#fff"
                          :                          "rgba(55,53,47,0.01)";
                        const borderColor = isRed  ? "#d44c47"
                          : hasVac                 ? "#337ea9"
                          : hasHoliday             ? "#448361"
                          :                          "transparent";

                        return (
                          <tr key={gr.key} style={{ background: rowBg, borderLeft: `3px solid ${borderColor}` }}>
                            {COL_DEFS.filter(c => visibleCols[c.key]).map(col =>
                              renderCell(col.key, gr, cf, hasOverlap, hasSallePleine, hasHoliday, hasVac, hasHalfDayConflict, hasCandidatConflict, isOutOfRange, currentSlot)
                            )}
                          </tr>
                        );
                      })}
                      {groupRowsFiltered.length === 0 && (
                        <tr>
                          <td colSpan={COL_DEFS.filter(c => visibleCols[c.key]).length}
                            style={{ ...tdS, textAlign: "center", padding: "24px", color: T.pageTer, fontStyle: "italic" }}>
                            Aucun groupe ne correspond aux filtres
                          </td>
                        </tr>
                      )}
                    </tbody>

                    {/* TFOOT */}
                    <tfoot>
                      <tr style={{ background: "rgba(55,53,47,0.02)" }}>
                        {COL_DEFS.filter(c => visibleCols[c.key]).map((col, idx) => (
                          <td key={col.key} style={{ ...tdS, fontWeight: 600, fontSize: 11, color: T.pageSub }}>
                            {idx === 0
                              ? groupRowsFiltered.length < groupRows.length
                                ? `${groupRowsFiltered.length} / ${groupRows.length} groupes`
                                : `${groupRows.length} groupe${groupRows.length > 1 ? "s" : ""}`
                              : col.key === "count"
                              ? `${groupRowsFiltered.reduce((s, g) => s + g.count, 0)} cand.`
                              : col.key === "statut"
                              ? conflictCount > 0
                                ? <span style={{ color: "#d44c47", fontWeight: 700 }}>⚠ {conflictCount} conflit(s)</span>
                                : ganttDone ? <span style={{ color: "#448361" }}>✓ Prêt</span> : ""
                              : ""
                            }
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          )}
          {/* ── FIN ÉTAPE 10 ── */}

        </div>
        {/* ── FIN BODY ── */}

        {/* ── FOOTER ── */}
        <div style={{ padding: "12px 22px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => {
              if (step === 1) handleSafeClose();
              else if (step === 3) setStep(2);
              else if (step === 5) setStep(4);
              else if (step === 7) setStep(6);
              else if (step === 8) setStep(6);
              else setStep(s => s - 1);
            }}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", fontSize: 12, color: T.pageSub, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
            <ChevronLeft style={{ width: 13, height: 13 }} />{step === 1 ? "Annuler" : "Retour"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step === 1 && (
              <button onClick={() => setStep(2)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: T.accent, border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Commencer <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 2 && (
              <button onClick={() => { const { anomalies, excluded } = analyzeBase1(); setAnomalies1(anomalies); setExcluded1(excluded); setStep(3); }}
                disabled={!b1Ready}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: b1Ready ? "#37352f" : "#ccc", border: "none", borderRadius: 4, cursor: b1Ready ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                Vérifier les données <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 3 && (
              <button onClick={() => setStep(4)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Continuer <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 4 && (b2Ready
              ? <button onClick={() => { const { anomalies, excluded } = analyzeBaseEnrich(base2); setAnomalies2(anomalies); setExcluded2(excluded); setStep(5); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  Vérifier les données <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              : <button onClick={() => setStep(6)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, color: T.pageText, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  Passer <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
            )}
            {step === 5 && (
              <button onClick={() => setStep(6)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Continuer <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 6 && (b3Ready
              ? <button onClick={() => { const { anomalies, excluded } = analyzeBaseEnrich(base3); setAnomalies3(anomalies); setExcluded3(excluded); setStep(7); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  Vérifier les données <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
              : <button onClick={() => setStep(8)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, color: T.pageText, background: "transparent", border: `1px solid rgba(55,53,47,0.2)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                  Passer <ChevronRight style={{ width: 12, height: 12 }} />
                </button>
            )}
            {step === 7 && (
              <button onClick={() => setStep(8)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Continuer <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 8 && (
              <button onClick={fusionBases} disabled={!b1Ready}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: b1Ready ? "#37352f" : "#ccc", border: "none", borderRadius: 4, cursor: b1Ready ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <Shuffle style={{ width: 12, height: 12 }} /> Fusionner et créer les groupes <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 9 && (
              <button onClick={generateGroups}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
                Générer les groupes <ChevronRight style={{ width: 12, height: 12 }} />
              </button>
            )}
            {step === 10 && (
              <button onClick={confirm} disabled={importing}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff",       background: importing ? "#ccc" : "#37352f", 
 border: "none", borderRadius: 4,       cursor: importing ? "not-allowed" : "pointer",
 fontFamily: "inherit" }}>
                {importing ? <Spinner size={12} color="#fff" /> : <Check style={{ width: 12, height: 12 }} />}
                {importing ? "Import en cours…" : `Importer ${result.length} candidats`}
              </button>
            )}
          </div>
        </div>
        {/* ── FIN FOOTER ── */}

      </div>
    </div>
  );
}

function CandidatsView({currentUser, candidats, setCandidats, tasks, setTasks, ws, wsId, showToast, setDocuments, onUpdateWs  }) {
  const [modal, setModal] = useState(null);
  const [viewMode, setViewMode] = useState("liste"); const [filterTheme, setFilterTheme] = useState("Tous");
  const [filterGroupe, setFilterGroupe] = useState("Tous"); const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false); const [showColPicker, setShowColPicker] = useState(false);
  const [visibleExtraCols, setVisibleExtraCols] = useState(new Set()); const [colPickerInit, setColPickerInit] = useState(false);
  const [saving, setSaving] = useState(false);
  // PERF D: virtualisation de la liste candidats
  const [candScrollTop, setCandScrollTop] = useState(0);
  const colPickerRef = useRef(null);
  const [multiImportOpen, setMultiImportOpen] = useState(false);

  const exportCandidats = () => {
  // 1. Pré-calcul du nombre de personnes par groupe (pour la formule du coût)
  const groupCounts = {};
  candidats.forEach(cand => {
    const k = `${cand.theme}||${cand.groupe}`;
    groupCounts[k] = (groupCounts[k] || 0) + 1;
  });

  // 2. Configuration des colonnes de base
  const baseColsConfig = [
    { key: "matricule", label: "Matricule" },
    { key: "nom",       label: "Nom" },
    { key: "prenom",    label: "Prénom" },
    { key: "theme",     label: "Thème / Formation" },
    { key: "jours",     label: "Durée (Jours)" },
    { key: "slot",      label: "Créneau" }, // <-- Colonne pour AM/PM
    { key: "groupe",    label: "Groupe" },
    { key: "dateDebut", label: "Date Début" },
    { key: "dateFin",   label: "Date Fin" },
    { key: "statut",    label: "Statut" },
  ];

  const selectedExtraKeys = Array.from(visibleExtraCols);

  // ==========================================
  // DEBUT DU MAP (TRAITEMENT LIGNE PAR LIGNE)
  // ==========================================
  const data = filtered.map(c => {
    const row = {};

    // A. RECHERCHE DE LA TÂCHE GANTT POUR LE CRÉNEAU (SLOT)
    // On cherche la tâche correspondante pour voir si elle est AM ou PM
    const assocTask = tasks.find(t => 
    (t.group === c.theme) && String(t.groupe) === String(c.groupe)
  );
  
  // On récupère le slot soit du candidat, soit de la tâche associée
  const rawSlot = assocTask?.slot || c.slot || "";
  const isHalf = assocTask?.halfDay || c.halfDay;

  // --- LOGIQUE CORRIGÉE ---
  let slotLabel = "Journée entière"; 
  if (isHalf) {
    if (rawSlot === "matin") slotLabel = "AM";
    else if (rawSlot === "après-midi") slotLabel = "PM";
    else slotLabel = "AM"; 
  }


    // B. CALCUL DU COÛT SELON VOTRE FORMULE
    const key = `${c.theme}||${c.groupe}`;
    const nbrPersonnes = groupCounts[key] || 1;
    const nbrJours = c.jours || 0;
    const groupCostRaw = c.extraData?.cout || c.cout || "0";
    const groupCost = parseFloat(String(groupCostRaw).replace(/\s/g, '').replace(',', '.')) || 0;
    const coutIndividuel = nbrPersonnes > 0 ? (groupCost * nbrJours) / nbrPersonnes : 0;

    // C. REMPLISSAGE DES COLONNES DE BASE
    baseColsConfig.forEach(col => {
      let val = c[col.key] || "";

      // Gestion spécifique des dates (on prend celles du Gantt en priorité)
      if (col.key === "dateDebut") val = assocTask?.start || c.dateDebut || "";
      if (col.key === "dateFin")   val = assocTask?.end || c.dateFin || "";
      if (col.key === "dateDebut" || col.key === "dateFin") val = fmt(val);

      // Gestion spécifique du créneau AM/PM
      if (col.key === "slot") val = slotLabel; 


      row[col.label] = val;
    });

    // D. INSERTION DU COÛT CALCULÉ
    row["Coût Individuel (MAD)"] = Math.round(coutIndividuel * 100) / 100;

    // E. INSERTION DES COLONNES SUPPLÉMENTAIRES (Cochées dans l'interface)
    selectedExtraKeys.forEach(extraKey => {
      if (extraKey.toLowerCase() !== "cout") { // On évite de doubler le coût
        row[extraKey] = c.extraData?.[extraKey] || "";
      }
    });

    return row;
  });
  // ==========================================
  // FIN DU MAP
  // ==========================================

  // 4. Génération effective du fichier Excel
  const sheet = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Export_Candidats");
  XLSX.writeFile(wb, `Export_Candidats_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  showToast(`${data.length} candidats exportés`, "success");
};

  useEffect(() => { if (!showColPicker) return; const h = e => { if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setShowColPicker(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [showColPicker]);
  const hasFormation = useMemo(() => candidats.some(c => c.theme), [candidats]);
  const allThemes = useMemo(() => [...new Set(candidats.filter(c => c.theme).map(c => c.theme))].sort(), [candidats]);
  const allGroupes = useMemo(() => [...new Set(candidats.filter(c => c.groupe).map(c => String(c.groupe)))].sort((a, b) => Number(a) - Number(b)), [candidats]);

  const filtered = useMemo(() => {
    const raw = candidats.filter(c => {
      const mT = filterTheme === "Tous" || c.theme === filterTheme;
      const mG = filterGroupe === "Tous" || String(c.groupe) === filterGroupe;
      const mS = !search || `${c.nom} ${c.prenom} ${c.poste || ""} ${c.theme || ""}`.toLowerCase().includes(search.toLowerCase());
      return mT && mG && mS;
    });
    const seen = new Map();
    raw.forEach(c => {
      const key = `${String(c.nom || "").trim().toLowerCase()}__${String(c.prenom || "").trim().toLowerCase()}__${c.theme || ""}__${c.groupe || ""}`;
      if (!seen.has(key)) seen.set(key, c);
    });
    return Array.from(seen.values());
  }, [candidats, filterTheme, filterGroupe, search]);

  /* -- COMPTEURS UNIQUES PAR PERSONNE (matricule > nom+prénom) -- */
  const uniqueCandidatsCount = useMemo(() => {
    const seen = new Set();
    candidats.forEach(c => {
      const mat = String(c.matricule || "").trim();
      const validMat = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
      const key = validMat
        ? mat.toLowerCase()
        : `${String(c.nom || "").trim().toLowerCase()}__${String(c.prenom || "").trim().toLowerCase()}`;
      seen.add(key);
    });
    return seen.size;
  }, [candidats]);

  const uniqueFilteredCount = useMemo(() => {
    const seen = new Set();
    filtered.forEach(c => {
      const mat = String(c.matricule || "").trim();
      const validMat = mat.length > 3 && mat.toLowerCase() !== "en cours de recrutement";
      const key = validMat
        ? mat.toLowerCase()
        : `${String(c.nom || "").trim().toLowerCase()}__${String(c.prenom || "").trim().toLowerCase()}`;
      seen.add(key);
    });
    return seen.size;
  }, [filtered]);


  const save = async f => {
    setSaving(true);
    try {
      if (modal === "new") { const body = { ...f, createdAt: new Date().toISOString() }; const created = norm(await apiFetch(`/workspaces/${wsId}/candidats`, { method: "POST", body })); setCandidats(p => { const n = [...p, created]; syncCache(n); return n; }); }
      else { const updated = norm(await apiFetch(`/candidats/${modal.id}`, { method: "PUT", body: f })); setCandidats(p => { const n = p.map(c => c.id === modal.id ? updated : c); syncCache(n); return n; }); }
    } catch (e) { showToast("Erreur : " + e.message); }
    setSaving(false); setModal(null);
  };
  const delCand = async id => {
    setCandidats(p => { const n = p.filter(c => c.id !== id); syncCache(n); return n; });
    try { await apiFetch(`/candidats/${id}`, { method: "DELETE" }); } catch (e) { showToast("Erreur suppression : " + e.message); }
  };
  const formationGroups = useMemo(() => { const fg = {}; filtered.filter(c => c.theme).forEach(c => { const key = `${c.theme}||${c.groupe || 1}`; if (!fg[key]) fg[key] = { theme: c.theme, groupe: c.groupe || 1, jours: c.jours || 0, start: c.dateDebut || "", end: c.dateFin || "", cands: [] }; fg[key].cands.push(c); }); return fg; }, [filtered]);
  const activeFilters = (filterTheme !== "Tous" ? 1 : 0) + (filterGroupe !== "Tous" ? 1 : 0);
  const filterBtn = (active, onClick, children) => (<button onClick={onClick} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 13, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${active ? "rgba(55,53,47,0.3)" : T.pageBdr}`, background: active ? "rgba(55,53,47,0.07)" : "transparent", color: active ? T.pageText : T.pageSub, fontWeight: active ? 600 : 400, display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap" }}>{children}</button>);
  const canImport = !currentUser?.parentId || currentUser?.permissions?.canImportExcel;
  return (
    <div style={{ padding: "60px 40px 80px", width: "100%", boxSizing: "border-box" }}>
      {modal && <CModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} onSave={save} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><Users style={{ width: 24, height: 24, color: T.pageSub, strokeWidth: 1.6 }} /><h1 style={{ fontSize: 32, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em", margin: 0 }}>Candidats</h1></div>

      {/* -- SOUS-TITRE : compteurs basés sur personnes uniques -- */}
      <div style={{ fontSize: 13, color: T.pageSub, marginBottom: 24 }}>
        <span style={{ fontWeight: 600, color: T.pageText }}>{uniqueFilteredCount}</span>
        {uniqueFilteredCount !== uniqueCandidatsCount && <span style={{ color: T.pageTer }}> / {uniqueCandidatsCount}</span>}
        {" "}candidat{uniqueCandidatsCount !== 1 ? "s" : ""}
        {hasFormation && <> · {allThemes.length} thème{allThemes.length > 1 ? "s" : ""}</>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {(allThemes.length > 0 || allGroupes.length > 0) && <button onClick={() => setShowFilters(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: `1px solid ${showFilters || activeFilters > 0 ? "rgba(55,53,47,0.3)" : T.pageBdr}`, background: activeFilters > 0 ? `${T.accent}10` : showFilters ? "rgba(55,53,47,0.07)" : "transparent", color: activeFilters > 0 ? T.accent : showFilters ? T.pageText : T.pageSub, fontWeight: showFilters || activeFilters > 0 ? 600 : 400, borderRadius: 4 }}><Search style={{ width: 12, height: 12 }} />Filtres{activeFilters > 0 ? <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{activeFilters}</span> : <ChevronDown style={{ width: 11, height: 11, transform: showFilters ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />}</button>}
          {filterTheme !== "Tous" && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: `${T.accent}12`, border: `1px solid ${T.accent}40`, fontSize: 12, color: T.accent, fontWeight: 500 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: grpTag(filterTheme).text, display: "inline-block" }} /><span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filterTheme}</span><button onClick={() => setFilterTheme("Tous")} style={{ border: "none", background: "none", cursor: "pointer", color: T.accent, display: "flex", padding: 0, marginLeft: 2 }}><X style={{ width: 10, height: 10 }} /></button></div>}
          {filterGroupe !== "Tous" && <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, background: `${T.accent}12`, border: `1px solid ${T.accent}40`, fontSize: 12, color: T.accent, fontWeight: 500 }}>Grp {filterGroupe}<button onClick={() => setFilterGroupe("Tous")} style={{ border: "none", background: "none", cursor: "pointer", color: T.accent, display: "flex", padding: 0, marginLeft: 2 }}><X style={{ width: 10, height: 10 }} /></button></div>}
          {activeFilters > 0 && <button onClick={() => { setFilterTheme("Tous"); setFilterGroupe("Tous"); }} style={{ fontSize: 11, color: T.pageTer, border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>Tout effacer</button>}
          {hasFormation && <><div style={{ height: 16, width: 1, background: T.pageBdr, margin: "0 2px" }} />{[["liste", "Liste"], ["formation", "Par formation"]].map(([v, l]) => (<button key={v} onClick={() => setViewMode(v)} style={{ padding: "3px 10px", borderRadius: 4, border: `1px solid ${viewMode === v ? "rgba(55,53,47,0.3)" : T.pageBdr}`, background: viewMode === v ? "rgba(55,53,47,0.07)" : "transparent", color: viewMode === v ? T.pageText : T.pageSub, fontSize: 13, fontWeight: viewMode === v ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>))}</>}
          {viewMode === "liste" && (() => {
            const allExtraKeys = []; const seen = new Set(); candidats.forEach(c => { if (c.extraData) Object.keys(c.extraData).forEach(k => { if (!seen.has(k) && k !== "__matricule__") { seen.add(k); allExtraKeys.push(k); } }); });
            if (allExtraKeys.length === 0) return null;
            if (!colPickerInit && allExtraKeys.length > 0) { setColPickerInit(true); setVisibleExtraCols(new Set()); }
            const activeCount = allExtraKeys.filter(k => visibleExtraCols.has(k)).length;
            return (<div ref={colPickerRef} style={{ position: "relative" }}><button onClick={() => setShowColPicker(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", border: `1px solid ${showColPicker || activeCount > 0 ? "rgba(55,53,47,0.3)" : T.pageBdr}`, background: showColPicker ? "rgba(55,53,47,0.07)" : "transparent", color: showColPicker ? T.pageText : T.pageSub, borderRadius: 4 }}><Settings style={{ width: 12, height: 12 }} />Colonnes{activeCount > 0 && <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: T.accent, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{activeCount}</span>}<ChevronDown style={{ width: 11, height: 11, transform: showColPicker ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} /></button>
              {showColPicker && <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "#fff", borderRadius: 6, border: `1px solid ${T.pageBdr}`, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 260, overflow: "hidden" }}>
                <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${T.pageBdr}` }}><div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Colonnes supplémentaires</div><div style={{ fontSize: 11, color: T.pageTer }}>Données importées depuis Excel</div></div>
                <div style={{ padding: "6px 0", maxHeight: 280, overflowY: "auto" }}>{allExtraKeys.map(k => { const on = visibleExtraCols.has(k); return (<button key={k} onClick={() => setVisibleExtraCols(prev => { const n = new Set(prev); on ? n.delete(k) : n.add(k); return n; })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(55,53,47,0.04)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${on ? "transparent" : T.pageTer}`, background: on ? T.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}>{on && <Check style={{ width: 10, height: 10, color: "#fff", strokeWidth: 3 }} />}</div><span style={{ fontSize: 13, color: T.pageText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{k}</span></button>); })}</div>
                <div style={{ padding: "8px 14px", borderTop: `1px solid ${T.pageBdr}`, display: "flex", gap: 8, background: "rgba(55,53,47,0.015)" }}><button onClick={() => setVisibleExtraCols(new Set(allExtraKeys))} style={{ flex: 1, padding: "5px", fontSize: 12, border: `1px solid ${T.pageBdr}`, borderRadius: 4, background: "transparent", cursor: "pointer", color: T.pageSub, fontFamily: "inherit" }}>Tout afficher</button><button onClick={() => setVisibleExtraCols(new Set())} style={{ flex: 1, padding: "5px", fontSize: 12, border: `1px solid ${T.pageBdr}`, borderRadius: 4, background: "transparent", cursor: "pointer", color: T.pageSub, fontFamily: "inherit" }}>Tout masquer</button></div>
              </div>}
            </div>);
          })()}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 9px", border: `1px solid ${T.pageBdr}`, borderRadius: 4 }}><Search style={{ width: 12, height: 12, color: T.pageTer }} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ fontSize: 13, border: "none", outline: "none", color: T.pageText, fontFamily: "inherit", width: 140, background: "transparent" }} />{search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.pageTer, display: "flex", padding: 0 }}><X style={{ width: 10, height: 10 }} /></button>}</div>
            <button onClick={exportCandidats} disabled={filtered.length === 0} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", fontSize: 13, fontWeight: 500, color: T.pageText, background: "transparent", border: `1px solid rgba(55,53,47,0.25)`, borderRadius: 4, cursor: filtered.length === 0 ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: filtered.length === 0 ? 0.4 : 1 }} onMouseEnter={e => { if (filtered.length > 0) e.currentTarget.style.background = "rgba(55,53,47,0.06)"; }} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><FileUp style={{ width: 13, height: 13 }} /> Exporter Excel</button>
            {canImport && (
            <button onClick={() => setMultiImportOpen(true)} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", fontSize: 13, fontWeight: 500, color: T.pageText, background: "transparent", border: `1px solid rgba(55,53,47,0.25)`, borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>
              <FileStack style={{ width: 13, height: 13 }} /> Import 3 bases
            </button>
            )}
           {multiImportOpen && (
  <MultiBaseImportWizard
    onClose={() => setMultiImportOpen(false)}
  onDone={async (cands, newTasks, newDocs) => { // <--- Ajout de newDocs ici
    // 1. Mise à jour IMMÉDIATE et complète (Optimiste)
    setCandidats(normArr(cands));
    setTasks(normArr(newTasks));
    if (newDocs) setDocuments(normArr(newDocs)); // <--- Mise à jour immédiate des docs !

    showToast("Importation réussie", "success");

    // 2. Synchronisation de sécurité avec le serveur (optionnel si le point 1 est bien fait)
    setTimeout(async () => {
      try {
        const [resTasks, resCands, resDocs] = await Promise.all([
          apiFetch(`/workspaces/${wsId}/tasks`),
          apiFetch(`/workspaces/${wsId}/candidats?limit=5000`),
          apiFetch(`/workspaces/${wsId}/documents`)
        ]);
        
        setTasks(normArr(extractArray(resTasks, 'tasks')));
        setCandidats(normArr(extractArray(resCands, 'candidats')));
        setDocuments(normArr(extractArray(resDocs, 'documents')));
      } catch (e) {
        console.error("Erreur de synchronisation finale:", e);
      }
    }, 1500);
  }}
    setTasks={setTasks}
    wsStart={ws?.startDate || null}
    wsEnd={ws?.endDate || null}
    wsId={wsId}
    showToast={showToast}
    wsWorkingDays={ws?.workingDays}
    wsSkipHolidays={ws?.skipHolidays}
    wsVacances={ws?.vacances}
  onUpdateWs={onUpdateWs}
  />
)}
            <button onClick={() => setModal("new")} style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px", fontSize: 13, fontWeight: 500, color: "#fff", background: "#37352f", border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }} onMouseEnter={e => e.currentTarget.style.background = "#111"} onMouseLeave={e => e.currentTarget.style.background = "#37352f"}><Plus style={{ width: 13, height: 13 }} />Nouveau</button>
          </div>
        </div>
        {showFilters && (<div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, padding: "14px 16px", background: "rgba(55,53,47,0.015)", display: "flex", flexDirection: "column", gap: 12 }}>
          {allThemes.length > 0 && <div><div style={{ fontSize: 10, fontWeight: 600, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Thème de formation</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{filterBtn(filterTheme === "Tous", () => setFilterTheme("Tous"), <><span>Tous</span><span style={{ fontSize: 11, color: T.pageTer }}>({uniqueFilteredCount})</span></>)}{allThemes.map(t => { const count = filtered.filter(c => c.theme === t).length; const pal = grpTag(t); return filterBtn(filterTheme === t, () => setFilterTheme(filterTheme === t ? "Tous" : t), <><span style={{ width: 6, height: 6, borderRadius: 2, background: pal.text, display: "inline-block" }} /><span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span><span style={{ fontSize: 11, color: T.pageTer }}>({count})</span></>); })}</div></div>}
          {allGroupes.length > 0 && <div><div style={{ fontSize: 10, fontWeight: 600, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Groupe</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{filterBtn(filterGroupe === "Tous", () => setFilterGroupe("Tous"), <span>Tous</span>)}{allGroupes.map(g => filterBtn(filterGroupe === g, () => setFilterGroupe(filterGroupe === g ? "Tous" : g), <span>Grp {g}</span>))}</div></div>}
        </div>)}
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}><Users style={{ width: 36, height: 36, color: T.pageTer, margin: "0 auto 12px", display: "block", strokeWidth: 1.4 }} /><div style={{ fontSize: 15, fontWeight: 600, color: T.pageText }}>Aucun candidat</div><div style={{ fontSize: 13, color: T.pageSub, marginTop: 4 }}>{activeFilters > 0 || search ? "Aucun résultat pour les filtres actifs" : "Ajoutez manuellement ou importez depuis Excel"}</div>
        </div>
      ) : viewMode === "formation" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.values(formationGroups).map(fg => {
            const pal = grpTag(fg.theme); return (<div key={`${fg.theme}||${fg.groupe}`} style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "rgba(55,53,47,0.02)", borderBottom: `1px solid ${T.pageBdr}` }}><div style={{ width: 8, height: 8, borderRadius: 2, background: pal.text, flexShrink: 0 }} /><div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.pageText }}>{fg.theme}</div><Tag label={`Groupe ${fg.groupe}`} scheme={pal} /><div style={{ display: "flex", gap: 8, fontSize: 12, color: T.pageSub }}><span><span style={{ fontFamily: "monospace", fontWeight: 600, color: T.pageText }}>{fg.jours === 0.5 ? "½" : fg.jours}</span> jour{fg.jours > 1 ? "s" : ""}</span><span>·</span><span><span style={{ fontFamily: "monospace", fontWeight: 600, color: T.pageText }}>{fg.cands.length}</span> candidat{fg.cands.length > 1 ? "s" : ""}</span>{fg.start && <><span>·</span><span style={{ fontFamily: "monospace", fontSize: 11 }}>{fmt(fg.start)} → {fmt(fg.end)}</span></>}</div></div>
              {fg.cands.map((c, i) => { const st = C_STATUS.find(s => s.key === c.statut) || C_STATUS[0]; return (<div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 16px", borderBottom: i < fg.cands.length - 1 ? `1px solid ${T.pageBdr}` : "none", background: "#fff", transition: "background 0.06s" }} onMouseEnter={e => e.currentTarget.style.background = T.pageHov} onMouseLeave={e => e.currentTarget.style.background = "#fff"}><div style={{ width: 24, height: 24, borderRadius: 4, background: "rgba(55,53,47,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.pageSub, flexShrink: 0 }}>{c.nom.charAt(0)}{c.prenom?.charAt(0) || ""}</div><span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.pageText }}>{c.nom} {c.prenom}</span><Tag label={c.statut} scheme={{ text: st.text, bg: st.bg }} /><div style={{ display: "flex", gap: 2 }}><button onClick={() => setModal(c)} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => e.currentTarget.style.background = "rgba(55,53,47,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><Edit2 style={{ width: 10, height: 10 }} /></button><button onClick={() => delCand(c.id)} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,76,71,0.1)"; e.currentTarget.style.color = "#d44c47"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.pageTer; }}><Trash2 style={{ width: 10, height: 10 }} /></button></div></div>); })}
            </div>);
          })}
          {filtered.filter(c => !c.theme).length > 0 && (<div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 6, overflow: "hidden" }}><div style={{ padding: "10px 16px", background: "rgba(55,53,47,0.02)", borderBottom: `1px solid ${T.pageBdr}`, fontSize: 13, fontWeight: 600, color: T.pageSub }}>Sans formation assignée</div>{filtered.filter(c => !c.theme).map((c, i, arr) => { const st = C_STATUS.find(s => s.key === c.statut) || C_STATUS[0]; return (<div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${T.pageBdr}` : "none", background: "#fff" }} onMouseEnter={e => e.currentTarget.style.background = T.pageHov} onMouseLeave={e => e.currentTarget.style.background = "#fff"}><div style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(55,53,47,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.pageSub, flexShrink: 0 }}>{c.nom.charAt(0)}{c.prenom?.charAt(0) || ""}</div><span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.pageText }}>{c.nom} {c.prenom}</span><span style={{ fontSize: 12, color: T.pageSub }}>{c.poste || "—"}</span><Tag label={c.statut} scheme={{ text: st.text, bg: st.bg }} /><div style={{ display: "flex", gap: 2 }}><button onClick={() => setModal(c)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => e.currentTarget.style.background = "rgba(55,53,47,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><Edit2 style={{ width: 11, height: 11 }} /></button><button onClick={() => delCand(c.id)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,76,71,0.1)"; e.currentTarget.style.color = "#d44c47"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.pageTer; }}><Trash2 style={{ width: 11, height: 11 }} /></button></div></div>); })}</div>)}
        </div>
      ) : (() => {
        const CAND_ROW_H = 42; // hauteur approximative d'une ligne candidat
        const CAND_OVERSCAN = 10;
        const CAND_VIEW_H = Math.min(filtered.length * CAND_ROW_H, window.innerHeight * 0.65);
        const totalCandH = filtered.length * CAND_ROW_H;
        const startCI = Math.max(0, Math.floor(candScrollTop / CAND_ROW_H) - CAND_OVERSCAN);
        const endCI = Math.min(filtered.length - 1, Math.ceil((candScrollTop + CAND_VIEW_H) / CAND_ROW_H) + CAND_OVERSCAN);
        const visibleCands = filtered.slice(startCI, endCI + 1);

        const allExtraKeys = []; const seen = new Set(); filtered.forEach(c => { if (c.extraData) Object.keys(c.extraData).forEach(k => { if (!seen.has(k) && k !== "__matricule__") { seen.add(k); allExtraKeys.push(k); } }); });
        const hasDates = filtered.some(c => c.dateDebut || c.dateFin);
        const hasMat = filtered.some(c => c.matricule);
        const baseCols = [{ key: "candidat", label: "Candidat", flex: "2fr" }, { key: "theme", label: "Thème / Poste", flex: "1.5fr" }, { key: "duree", label: "Durée", flex: "70px" }, { key: "groupe", label: "Groupe", flex: "70px" }, ...(hasDates ? [{ key: "debut", label: "Début", flex: "90px" }, { key: "fin", label: "Fin", flex: "90px" }] : []), ...(hasMat ? [{ key: "matricule", label: "Matricule", flex: "100px" }] : [])];
        const extraColDefs = allExtraKeys.filter(k => visibleExtraCols.has(k)).map(k => ({ key: `extra_${k}`, label: k, flex: "1fr", extraKey: k }));
        const allCols = [...baseCols, ...extraColDefs];
        const gridCols = [...allCols.map(c => c.flex), "60px"].join(" ");
        return (
          <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 4, background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: gridCols, background: "#f7f7f7", borderBottom: `1px solid ${T.pageBdr}`, padding: "0 16px", position: "sticky", top: 0, zIndex: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3 }}>{allCols.map(col => (<div key={col.key} style={{ padding: "7px 0", fontSize: 10, fontWeight: 600, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.label}</div>))}<div /></div>
            {/* PERF D: conteneur virtuel avec hauteur totale — seules les lignes visibles sont dans le DOM */}
            <div style={{ height: CAND_VIEW_H, overflowY: "auto", position: "relative" }} onScroll={e => setCandScrollTop(e.currentTarget.scrollTop)}>
              <div style={{ height: totalCandH, position: "relative" }}>
                <div style={{ position: "absolute", top: startCI * CAND_ROW_H, left: 0, right: 0 }}>
                  {visibleCands.map((c, vi) => {
                    const i = startCI + vi;
                    const pal = c.theme ? grpTag(c.theme) : null;
                    return (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: gridCols, padding: "0 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.pageBdr}` : "none", alignItems: "center", background: "#fff", minHeight: CAND_ROW_H, transition: "background 0.06s" }} onMouseEnter={e => e.currentTarget.style.background = T.pageHov} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", minWidth: 0 }}><div style={{ width: 26, height: 26, borderRadius: 4, background: "rgba(55,53,47,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.pageSub, flexShrink: 0 }}>{c.nom.charAt(0)}{c.prenom?.charAt(0) || ""}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: T.pageText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom} {c.prenom}</div></div></div>                <div style={{ fontSize: 12, color: T.pageSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.theme ? <Tag label={c.theme} scheme={pal} /> : (c.poste || "—")}</div>
<div style={{ fontSize: 12, color: T.pageSub, display: 'flex', alignItems: 'center', gap: '6px' }}>
  {c.jours ? (
    <>
      <span style={{ fontFamily: "monospace", fontWeight: 700, color: T.pageText }}>
        {c.jours === 0.5 ? "½" : c.jours}
      </span>
      <span style={{ color: T.pageTer }}> j</span>

      {/* --- LOGIQUE DE RÉCUPÉRATION DU CRÉNEAU --- */}
      {c.jours === 0.5 && (() => {
        // On cherche si une tâche Gantt existe pour ce Thème + Groupe
        const taskAssociee = tasks.find(t => 
          (t.group === c.theme) && String(t.groupe) === String(c.groupe)
        );
        
        // On prend le slot de la tâche, sinon celui du candidat
        const slotEffectif = taskAssociee?.slot || c.slot;

        if (!slotEffectif) return null;

        return (
          <span style={{
            fontSize: '9px',
            fontWeight: '800',
            padding: '1px 5px',
            borderRadius: '3px',
            background: slotEffectif === 'matin' ? 'rgba(217, 115, 13, 0.12)' : 'rgba(15, 125, 219, 0.12)',
            color: slotEffectif === 'matin' ? '#d9730d' : '#0f7ddb',
            border: `1px solid ${slotEffectif === 'matin' ? 'rgba(217, 115, 13, 0.3)' : 'rgba(15, 125, 219, 0.3)'}`,
            textTransform: 'uppercase',
            marginLeft: '2px'
          }}>
            {slotEffectif === 'matin' ? 'AM' : 'PM'}
          </span>
        );
      })()}
    </>
  ) : "—"}
</div>                 
<div style={{ fontSize: 12, color: T.pageSub }}>{c.groupe ? <><span style={{ color: T.pageTer, fontSize: 11 }}>Grp </span><span style={{ fontFamily: "monospace", fontWeight: 700, color: T.pageText }}>{c.groupe}</span></> : "—"}</div>
                        {hasDates && <div style={{ fontSize: 11, fontFamily: "monospace", color: c.dateDebut ? T.pageText : T.pageTer }}>{c.dateDebut ? fmt(c.dateDebut) : "—"}</div>}
                        {hasDates && <div style={{ fontSize: 11, fontFamily: "monospace", color: c.dateFin ? T.pageText : T.pageTer }}>{c.dateFin ? fmt(c.dateFin) : "—"}</div>}
                        {hasMat && <div style={{ fontSize: 11, fontFamily: "monospace", color: c.matricule ? T.pageText : T.pageTer, fontWeight: c.matricule ? 500 : 400 }}>{c.matricule || "—"}</div>}
                        {extraColDefs.map(ec => (<div key={ec.key} style={{ fontSize: 12, color: T.pageSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.extraData?.[ec.extraKey] || <span style={{ color: T.pageTer }}>—</span>}</div>))}
                        <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}><button onClick={() => setModal(c)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => e.currentTarget.style.background = "rgba(55,53,47,0.1)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}><Edit2 style={{ width: 11, height: 11 }} /></button><button onClick={() => delCand(c.id)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,76,71,0.1)"; e.currentTarget.style.color = "#d44c47"; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.pageTer; }}><Trash2 style={{ width: 11, height: 11 }} /></button></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {allExtraKeys.length > 0 && extraColDefs.length === 0 && <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderTop: `1px solid ${T.pageBdr}`, background: "rgba(55,53,47,0.015)" }}><Settings style={{ width: 11, height: 11, color: T.pageTer }} /><span style={{ fontSize: 11, color: T.pageTer }}>{allExtraKeys.length} colonne{allExtraKeys.length > 1 ? "s" : ""} masquée{allExtraKeys.length > 1 ? "s" : ""} — <button onClick={() => setShowColPicker(true)} style={{ fontSize: 11, color: T.accent, border: "none", background: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>Afficher via Colonnes</button></span></div>}
          </div>
        );
      })()}
    </div>
  );
}

// ── Fonction utilitaire partagée ──────────────────────────────────────────
// À placer EN DEHORS de vos composants (niveau global)
const exportToWord = (htmlContent, filename = "document") => {
  const html = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8">
        <meta name:progid content="Word.Document">
        <meta name:ProgId content="Word.Document">
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
          * {
            font-family: 'Calibri', Arial, sans-serif;
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          td, th {
            border: 0.5pt solid #000;
            padding: 4px 8px;
            font-size: 10pt;
            color: #000;
            line-height: 1.3;
            vertical-align: middle;
          }
          th {
            font-weight: bold;
            text-align: center;
          }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function DownloadAllModal({ candidats, tasks, mode, globalEntreprise = "", globalLogoUrl = "", onClose }) {
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [done, setDone] = useState(false);
  const [entreprise, setEntreprise] = useState(globalEntreprise || "");
  const [logoUrl, setLogoUrl] = useState(globalLogoUrl || "");
  const [format, setFormat] = useState("pdf"); // "pdf" ou "word"
  const logoInputRef = useRef(null);

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  const themes = useMemo(() =>
    [...new Set(candidats.map(c => c.theme).filter(Boolean))].sort(),
    [candidats]
  );

  const totalCount = useMemo(() => {
    if (mode === "EMARGEMENTS") {
      let n = 0;
      themes.forEach(theme => {
        const groupes = [...new Set(candidats.filter(c => c.theme === theme).map(c => String(c.groupe || "1")))];
        n += groupes.length;
      });
      return n;
    }
    return themes.length;
  }, [mode, themes, candidats]);

  const pct = totalCount > 0 ? Math.round((progress.current / totalCount) * 100) : 0;

  // ── UTILITAIRES DE CALCUL ──

  const classifyCSP = (csp = "") => {
    const v = (csp || "").toLowerCase();
    if (["ingénieurs","cadre","cadres","manager"].some(k => v.includes(k))) return "C";
    if (["superviseur","maîtrise","technicien","employé","employe"].some(k => v.includes(k))) return "E";
    return "O"; // Ouvrier par défaut
  };

  const getWorkDays = (start, end) => {
    if (!start) return [];
    let current = new Date(start + "T00:00:00");
    const endDate = new Date((end || start) + "T00:00:00");
    const days = [];
    while (current <= endDate) {
      if (![0, 6].includes(current.getDay())) days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  // ── GÉNÉRATION PDF (COPIE CONFORME IMAGE 1) ──

  const generatePresencePDF = (theme, grp, grpCands) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

  // 1. Données de planification
  const task = tasks.find(
    (t) => t.group?.trim() === theme?.trim() && String(t.groupe) === String(grp)
  );
  const workDays = getWorkDays(task?.start, task?.end);

  // 2. Logo
  if (logoUrl) {
    try { doc.addImage(logoUrl, "PNG", 15, 10, 30, 12); } catch (e) {}
  }

  // 3. Titre
  doc.setFontSize(13);
  doc.setFont("helvetica", "bolditalic");
  doc.text("LISTE DE PRESENCE PAR ACTION ET PAR GROUPE", pageWidth / 2, 18, { align: "center" });

  // 4. Bloc d'informations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Entreprise", 15, 32);
  doc.text("Thème de l'action", 15, 38);
  doc.text("Jours de réalisation", 15, 44);

  doc.setFont("helvetica", "normal");
  doc.text(`: ${entreprise || "________________"}`, 55, 32);
  doc.text(`: ${theme}`, 55, 38);
  
  const dateStr = workDays.length > 0
      ? `: ${workDays.map((d) => String(d.getDate()).padStart(2, "0")).join("-")}/${String(workDays[0].getMonth() + 1).padStart(2, "0")}/${workDays[0].getFullYear()}`
      : ": ________________";
  doc.text(dateStr, 55, 44);

  doc.setFont("helvetica", "bold");
  doc.text(`G ${grp}`, pageWidth - 20, 38, { align: "right" });

  // 5. Tableau
  const head = [
    [
      { content: "Nom", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "Prénom", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "N° CIN", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "N°CNSS", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "C.S.P", colSpan: 3, styles: { halign: "center" } },
      ...workDays.map((d) => ({
        content: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        rowSpan: 2,
        styles: { halign: "center", valign: "middle" },
      })),
    ],
    ["C", "E", "O"],
  ];

  const body = grpCands.map((c) => {
    const csp = classifyCSP(c.extraData?.csp || c.csp || "");
    return [
      (c.nom || "").toUpperCase(),
      c.prenom || "",
      c.cin || c.extraData?.cin || "",
      "", // CNSS Vide
      csp === "C" ? "X" : "",
      csp === "E" ? "X" : "",
      csp === "O" ? "X" : "",
      ...workDays.map(() => ""),
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { bottom: 45 }, // Espace réservé pour le footer
    head: head,
    body: body,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1 },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold", width: 38 },
      4: { halign: "bold", width: 7 },
      5: { halign: "center", width: 7 },
      6: { halign: "center", width: 7 },
    },
  });

  // 6. FOOTER
const footerY = pageHeight - 20;

doc.setFontSize(8.5);
doc.setFont("helvetica", "normal");

// Légende
doc.text("(*) C.S.P : Catégorie socio-professionnelle", 15, footerY - 16);
doc.text("C: Cadre – E: Employé – O: Ouvrier",          15, footerY - 11);

// Espace de ~5mm entre les deux blocs

// Bloc gauche — signatures organisme
doc.text("Cachet de l'organisme de formation",           15, footerY);
doc.text("et identité du signataire",                    15, footerY + 5);

// Bloc droit — aligné bord droit du tableau
doc.text("Cachet et signature du responsable",   pageWidth - 15, footerY,     { align: "right" });
doc.text("de formation de l'entreprise",          pageWidth - 15, footerY + 5, { align: "right" });

  doc.save(`Presence_${theme.substring(0, 20).trim()}_G${grp}.pdf`);
};

  // ── GÉNÉRATION WORD ──

const generatePresenceWord = (theme, grp, grpCands) => {
  const task = tasks.find(
    t => t.group?.trim() === theme?.trim() && String(t.groupe) === String(grp)
  );

  const workDays = getWorkDays(task?.start, task?.end);

  const dateStr = workDays.length > 0
    ? `${workDays.map(d => d.getDate()).join('-')}/${workDays[0].getMonth() + 1}/${workDays[0].getFullYear()}`
    : "________________";

  // ── Calcul dynamique de la hauteur utile ──────────────────────────
  // Page A4 paysage en pt : 841.9 x 595.3
  // Marges : haut 1cm ≈ 28.3pt, bas 1.5cm ≈ 42.5pt
  // Hauteur utile totale ≈ 595.3 - 28.3 - 42.5 = 524.5pt
  const PAGE_HEIGHT_PT = 524;

  // Hauteur estimée du contenu (header + infos + tableau)
  const HEADER_PT   = 50;   // logo + titre
  const INFOS_PT    = 55;   // 3 lignes infos + br
  const TH_PT       = 40;   // 2 lignes thead
  const ROW_PT      = 18;   // hauteur d'une ligne candidat
  const FOOTER_PT   = 70;   // footer (légende + cachets)

  const contentHeight = HEADER_PT + INFOS_PT + TH_PT + (grpCands.length * ROW_PT);
  const remainingHeight = PAGE_HEIGHT_PT - contentHeight;
  // On donne au moins 10pt d'espace avant le footer
  const spacerHeight = Math.max(remainingHeight - FOOTER_PT, 10);

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        /* Définition de la page */
        @page Section1 {
          size: 841.9pt 595.3pt; /* A4 Paysage */
          mso-page-orientation: landscape;
          margin: 1.0cm 1.0cm 1.0cm 1.0cm;
          
          /* C'est ici qu'on lie le footer */
          mso-footer: f1;
        }
        div.Section1 { page: Section1; }

        /* Style spécifique pour que Word reconnaisse le footer */
        p.MsoFooter, li.MsoFooter, div.MsoFooter {
          margin: 0in;
          margin-bottom: .0001pt;
          mso-pagination: widow-orphan;
          font-size: 10.0pt;
        }

        /* Identifiant du bloc footer */
        #f1 { mso-element: footer; }

        body { font-family: Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; width: 100%; }
        .main-table th, .main-table td { border: 0.5pt solid #000; padding: 4px 6px; }
        .header-bg { background-color: #DCE6F1; font-weight: bold; }
        .text-center { text-align: center; }
        .text-bold { font-weight: bold; }
        .title { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="Section1">
        
        <!-- CONTENU PRINCIPAL -->
        <table style="margin-bottom:8px; border:none;">
          <tr>
            <td style="width:20%; border:none;">
              ${logoUrl ? `<img src="${logoUrl}" width="140">` : "<b>SAFRAN</b>"}
            </td>
            <td class="title" style="width:60%; border:none;">
              LISTE DE PRESENCE PAR ACTION ET PAR GROUPE
            </td>
            <td style="width:20%; border:none;"></td>
          </tr>
        </table>

        <table style="margin-bottom:10px; border:none;">
          <tr>
            <td style="width:130px; font-weight:bold; border:none;">Entreprise</td>
            <td style="border:none;">: <span class="text-bold">${entreprise || 'SAFRAN'}</span></td>
            <td style="text-align:right; font-weight:bold; border:none;">G ${grp}</td>
          </tr>
          <tr>
            <td style="font-weight:bold; border:none;">Thème de l'action</td>
            <td colspan="2" style="border:none;">: <span class="text-bold">${theme.toUpperCase()}</span></td>
          </tr>
          <tr>
            <td style="font-weight:bold; border:none;">Jours de réalisation</td>
            <td colspan="2" style="border:none;">: <span class="text-bold">${dateStr}</span></td>
          </tr>
        </table>

        <table class="main-table">
          <thead>
            <tr class="header-bg">
              <th rowspan="2" style="width:160px;">Nom</th>
              <th rowspan="2" style="width:140px;">Prénom</th>
              <th rowspan="2" style="width:80px;">N° CIN</th>
              <th rowspan="2" style="width:80px;">N°CNSS</th>
              <th colspan="3" class="text-center" style="font-size:8pt;">C.S.P</th>
              ${workDays.map(d => `<th rowspan="2" class="text-center" style="width:85px;">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}</th>`).join('')}
            </tr>
            <tr class="header-bg">
              <th style="width:25px;" class="text-center">C</th>
              <th style="width:25px;" class="text-center">E</th>
              <th style="width:25px;" class="text-center">O</th>
            </tr>
          </thead>
          <tbody>
            ${grpCands.map(c => `
              <tr>
                <td class="text-bold" style="font-size:9pt;">${(c.nom || "").toUpperCase()}</td>
                <td style="font-size:9pt;">${c.prenom || ""}</td>
                <td>${c.cin || ""}</td>
                <td></td>
                <td class="text-center">${classifyCSP(c.extraData?.csp) === 'C' ? 'X' : ''}</td>
                <td class="text-center">${classifyCSP(c.extraData?.csp) === 'E' ? 'X' : ''}</td>
                <td class="text-center">${classifyCSP(c.extraData?.csp) === 'O' ? 'X' : ''}</td>
                ${workDays.map(() => '<td></td>').join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- PIED DE PAGE (DÉFINITION) -->
        <div style="mso-element:footer" id="f1">
          <p class="MsoFooter">
            <span style="font-size:9pt;">(*) C.S.P : Catégorie socio-professionnelle &nbsp;&nbsp; C: Cadre – E: Employé – O: Ouvrier</span>
          </p>
          <table style="width:100%; border:none; margin-top:10pt;">
            <tr>
              <td style="width:50%; text-align:left; border:none; font-size:10pt;">
                <b>Cachet de l'organisme de formation</b><br/>
                et identité du signataire
              </td>
              <td style="width:50%; text-align:right; border:none; font-size:10pt;">
                <b>Cachet et signature du responsable</b><br/>
                de formation de l'entreprise
              </td>
            </tr>
          </table>
        </div>

      </div>
    </body>
    </html>`;

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8"
  });

  saveAs(blob, `Presence_${theme}_G${grp}.doc`);
};


  // ── LOGIQUE DE BOUCLE ──

  const handleStart = async () => {
    setDone(false);
    let current = 0;

    for (const theme of themes) {
      const themeCands = candidats.filter(c => c.theme === theme);
      const grps = [...new Set(themeCands.map(c => String(c.groupe || "1")))].sort();

      for (const g of grps) {
        current++;
        setProgress({ current, total: totalCount, label: `${theme} - G${g}` });
        const cands = themeCands.filter(c => String(c.groupe || "1") === g);

        if (format === "pdf") generatePresencePDF(theme, g, cands);
        else generatePresenceWord(theme, g, cands);
        
        await delay(600);
      }
    }
    setDone(true);
  };

  // ── Remplacez uniquement le return() de DownloadAllModal ──

  const btnBase = { border: "none", background: "none", cursor: "pointer", fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", width: 460, borderRadius: 8, border: "1px solid #e3e3e2", boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>

        {/* ── En-tête ── */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#f7f7f5", border: "1px solid #e3e3e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardCheck size={14} color="#37352f" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#37352f", letterSpacing: "-0.01em" }}>Génération des émargements</span>
          </div>
          <button onClick={onClose} style={{ ...btnBase, width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#9b9a97" }}>
            <X size={14} />
          </button>
        </div>

        {/* ── Corps ── */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {progress.current === 0 ? (
            <>
              {/* Logo + Entreprise */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div
                  onClick={() => logoInputRef.current.click()}
                  style={{ width: 56, height: 56, border: "1px dashed #d3d3d1", borderRadius: 6, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fafaf9", flexShrink: 0, gap: 3 }}
                >
                  {logoUrl
                    ? <img src={logoUrl} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 5 }} />
                    : <>
                        <ImageIcon size={16} color="#b7b6b2" />
                        <span style={{ fontSize: 9, color: "#b7b6b2", fontWeight: 500 }}>Logo</span>
                      </>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b6b6b", marginBottom: 5 }}>Nom de l'entreprise</label>
                  <input
                    value={entreprise}
                    onChange={e => setEntreprise(e.target.value)}
                    placeholder="Ex : SAFRAN Maroc…"
                    style={{ width: "100%", boxSizing: "border-box", padding: "8px 11px", border: "1px solid #e3e3e2", borderRadius: 6, fontSize: 13, color: "#37352f", outline: "none", fontFamily: "inherit" }}
                  />
                  <p style={{ fontSize: 11, color: "#b7b6b2", margin: "5px 0 0" }}>Apparaîtra sur chaque liste d'émargement</p>
                </div>
                <input type="file" ref={logoInputRef} onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) { const reader = new FileReader(); reader.onload = (ev) => setLogoUrl(ev.target.result); reader.readAsDataURL(file); }
                }} style={{ display: "none" }} accept="image/*" />
              </div>

              {/* Format */}
              <div style={{ borderTop: "1px solid #f0f0ee", paddingTop: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b6b6b", marginBottom: 8 }}>Format de sortie</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    {
                      key: "pdf",
                      label: "Fichier PDF",
                      sub: "Impression directe",
                      activeColor: "#0f7ddb",
                      activeBg: "#f0f7ff",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d44c47" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                      ),
                    },
                    {
                      key: "word",
                      label: "Fichier Word",
                      sub: "Éditable",
                      activeColor: "#2b579a",
                      activeBg: "#f0f4fa",
                      icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2b579a" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                        </svg>
                      ),
                    },
                  ].map(({ key, label, sub, activeColor, activeBg, icon }) => {
                    const active = format === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setFormat(key)}
                        style={{ ...btnBase, padding: "10px 12px", borderRadius: 6, border: `${active ? "1.5px" : "1px"} solid ${active ? activeColor : "#e3e3e2"}`, background: active ? activeBg : "#fff", display: "flex", alignItems: "center", gap: 8, textAlign: "left", transition: "all 0.12s" }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 5, background: active ? "#fff" : "#f7f7f5", border: "1px solid #e3e3e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: active ? activeColor : "#37352f" }}>{label}</div>
                          <div style={{ fontSize: 10, color: active ? activeColor : "#9b9a97", opacity: active ? 0.8 : 1 }}>{sub}</div>
                        </div>
                        {active && (
                          <div style={{ width: 14, height: 14, borderRadius: "50%", background: activeColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Résumé */}
              <div style={{ background: "#fafaf9", border: "1px solid #f0f0ee", borderRadius: 6, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9b9a97" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 12, color: "#6b6b6b" }}>
                  <b style={{ color: "#37352f", fontWeight: 600 }}>{totalCount} listes</b> seront générées — une par groupe et par thème
                </span>
              </div>
            </>
          ) : (
            /* ── Progression ── */
            <div style={{ padding: "4px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 500, color: "#37352f" }}>{progress.label}</span>
                <span style={{ color: "#9b9a97" }}>{progress.current} / {totalCount}</span>
              </div>
              <div style={{ height: 4, background: "#f0f0ee", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", background: done ? "#3b6d11" : "#37352f", width: `${pct}%`, transition: "width 0.3s ease", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 11, color: "#9b9a97" }}>{pct}% complété</span>
                {done && (
                  <span style={{ fontSize: 12, color: "#3b6d11", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Tous les documents générés
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid #f0f0ee", display: "flex", justifyContent: "flex-end", gap: 8, background: "#fafaf9" }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, padding: "7px 14px", borderRadius: 6, border: "1px solid #e3e3e2", background: "#fff", fontSize: 13, fontWeight: 500, color: "#37352f" }}
          >
            {done ? "Fermer" : "Annuler"}
          </button>
          {progress.current === 0 && (
            <button
              onClick={handleStart}
              disabled={!entreprise.trim()}
              style={{
                ...btnBase,
                padding: "7px 16px",
                borderRadius: 6,
                border: `1px solid ${!entreprise.trim() ? "#d3d3d1" : "#0a6bc4"}`,
                background: !entreprise.trim() ? "#e9e9e7" : "#0f7ddb",
                fontSize: 13,
                fontWeight: 500,
                color: !entreprise.trim() ? "#9b9a97" : "#fff",
                cursor: !entreprise.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "background 0.12s",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Télécharger les {totalCount} listes
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

function AttendanceDesigner({ doc, candidats, tasks = [], onClose }) {
  const printRef = useRef(null);
  const [showDownloadAll, setShowDownloadAll] = useState(false);


  const parts = doc.nom.split(" - ");
  const theme = parts[1] ? parts[1].trim() : (doc.nom || "");
  const grp = parts[2] ? parts[2].trim().replace("G", "") : "1";

  const list = candidats.filter(c =>
    (c.theme === theme || doc.nom.includes(c.theme || "")) &&
    String(c.groupe) === String(grp)
  );

  // Récupération des infos
  const findExtra = (key) => {
    for (const c of list) {
      const val = c.extraData?.[key] || c[key] || "";
      if (val && String(val).trim()) return String(val).trim();
    }
    return "";
  };

  const [entreprise, setEntreprise] = useState(findExtra("entreprise") || "");
  const [logoUrl, setLogoUrl] = useState(findExtra("logoUrl") || "");
  const logoInputRef = useRef(null);

  // Calcul des jours de formation depuis les tasks
  const task = tasks.find(t =>
  t.group?.toLowerCase().trim() === theme?.toLowerCase().trim() &&
  String(t.groupe || "1") === String(grp)
);

  const getWorkDays = () => {
  // Chercher la task de plusieurs façons
  const task = tasks.find(t =>
    t.group?.toLowerCase().trim() === theme?.toLowerCase().trim() &&
    String(t.groupe || "1") === String(grp)
  );

  console.log("theme:", theme, "grp:", grp);
  console.log("tasks disponibles:", tasks.map(t => ({ group: t.group, groupe: t.groupe })));
  console.log("task trouvée:", task);

  if (!task?.start) {
    // Fallback : chercher les dates depuis les candidats
    const dateDebut = list[0]?.dateDebut || list[0]?.extraData?.dateDebut;
    const dateFin = list[0]?.dateFin || list[0]?.extraData?.dateFin;
    console.log("Fallback dates:", dateDebut, dateFin);
    if (!dateDebut) return [];
    
    const start = dateDebut;
    const end = dateFin || dateDebut;
    const localWd = [6, 0];
    const localSh = true;
    let current = new Date(start + "T00:00:00");
    const endDate = new Date(end + "T00:00:00");
    const days = [];
    let safety = 0;
    while (current <= endDate && safety < 60) {
      safety++;
      if (!isOff(current, localWd, localSh, [])) days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }

  const localWd = [6, 0];
  const localSh = true;
  let current = new Date(task.start + "T00:00:00");
  const end = new Date((task.end || task.start) + "T00:00:00");
  const days = [];
  let safety = 0;
  while (current <= end && safety < 60) {
    safety++;
    if (!isOff(current, localWd, localSh, [])) days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

  const workDays = getWorkDays();

const handleExportWord = () => {
  const task = tasks.find(
    (t) => t.group?.trim() === theme?.trim() && String(t.groupe) === String(grp)
  );
  
  const workDays = getWorkDays(); 

  const dateStr = workDays.length > 0
    ? `${workDays.map(d => String(d.getDate()).padStart(2, '0')).join('-')}/${String(workDays[0].getMonth() + 1).padStart(2, '0')}/${workDays[0].getFullYear()}`
    : "________________";

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 841.9pt 595.3pt; 
          mso-page-orientation: landscape;
          margin: 1.2cm 1.2cm 1.2cm 1.2cm;
          mso-footer-margin: 35.4pt;
          mso-footer: f1; 
        }
        div.Section1 { page: Section1; }

        body { font-family: Arial, sans-serif; font-size: 10pt; }
        table { border-collapse: collapse; width: 100%; }
        .no-border { border: none !important; }
        
        .main-table th, .main-table td { border: 0.5pt solid black; padding: 4px 6px; font-size: 9pt; }
        .header-bg { background-color: #DCE6F1; font-weight: bold; text-align: center; }
        
        .title { font-size: 14pt; font-weight: bold; text-align: center; font-style: italic; text-transform: uppercase; }
        
        /* FOOTER FIXÉ EN BAS */
        #f1 { mso-element: footer; }
        p.MsoFooter { margin: 0; font-size: 9pt; line-height: 1.3; }
        .sig-text { font-size: 10pt; }
      </style>
    </head>
    <body>
      <div class="Section1">
        
        <!-- HEADER -->
        <table class="no-border" style="margin-bottom:15px;">
          <tr>
            <td class="no-border" style="width:20%;">
              ${logoUrl ? `<img src="${logoUrl}" width="120">` : "<b>LOGO</b>"}
            </td>
            <td class="no-border" style="width:60%;">
              <div class="title">LISTE DE PRESENCE PAR ACTION ET PAR GROUPE</div>
            </td>
            <td class="no-border" style="width:20%;"></td>
          </tr>
        </table>

        <!-- INFOS -->
        <table class="no-border" style="margin-bottom:10px;">
          <tr>
            <td class="no-border" style="width:140px; font-weight:bold;">Entreprise</td>
            <td class="no-border">: ${entreprise || "________________"}</td>
            <td class="no-border" style="text-align:right; font-weight:bold;">G ${grp}</td>
          </tr>
          <tr>
            <td class="no-border" style="font-weight:bold;">Thème de l'action</td>
            <td class="no-border" colspan="2">: ${theme}</td>
          </tr>
          <tr>
            <td class="no-border" style="font-weight:bold;">Jours de réalisation</td>
            <td class="no-border" colspan="2">: ${dateStr}</td>
          </tr>
        </table>

        <!-- TABLEAU PRINCIPAL -->
        <table class="main-table">
          <thead>
            <tr class="header-bg">
              <th rowspan="2">Nom</th>
              <th rowspan="2">Prénom</th>
              <th rowspan="2">N° CIN</th>
              <th rowspan="2">N°CNSS</th>
              <th colspan="3">C.S.P</th>
              ${workDays.map(d => `<th rowspan="2">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</th>`).join('')}
            </tr>
            <tr class="header-bg">
              <th width="25">C</th><th width="25">E</th><th width="25">O</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(c => {
              const csp = classifyCSP(c.extraData?.csp || c.csp || "");
              return `
                <tr>
                  <td style="font-weight:bold;">${(c.nom || "").toUpperCase()}</td>
                  <td>${c.prenom || ""}</td>
                  <td align="center">${c.cin || ""}</td>
                  <td align="center"></td>
                  <td align="center">${csp === "C" ? "X" : ""}</td>
                  <td align="center">${csp === "E" ? "X" : ""}</td>
                  <td align="center">${csp === "O" ? "X" : ""}</td>
                  ${workDays.map(() => `<td></td>`).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- FOOTER (Exactement comme l'image) -->
        <div style="mso-element:footer" id="f1">
          <!-- Légendes à gauche -->
          <p class="MsoFooter">(*) C.S.P : Catégorie socio-professionnelle</p>
          <p class="MsoFooter">C: Cadre – E: Employé – O: Ouvrier</p>
          
          <br/>

          <!-- Blocs de signatures -->
          <table class="no-border" style="width:100%;">
            <tr>
              <td class="no-border sig-text" style="width:50%; text-align:left; vertical-align:top;">
                Cachet de l'organisme de formation<br/>
                et identité du signataire
              </td>
              <td class="no-border sig-text" style="width:50%; text-align:right; vertical-align:top;">
                Cachet et signature du responsable<br/>
                de formation de l'entreprise
              </td>
            </tr>
          </table>
        </div>

      </div>
    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Liste_Presence_${theme}_G${grp}.doc`;
  link.click();
};

  const generatePresencePDF = () => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 2. Logo
  if (logoUrl) {
    try { doc.addImage(logoUrl, "PNG", 15, 10, 30, 12); } catch (e) {}
  }

  // 3. Titre
  doc.setFontSize(13);
  doc.setFont("helvetica", "bolditalic");
  doc.text("LISTE DE PRESENCE PAR ACTION ET PAR GROUPE", pageWidth / 2, 18, { align: "center" });

  // 4. Bloc d'informations
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Entreprise",          15, 32);
  doc.text("Thème de l'action",   15, 38);
  doc.text("Jours de réalisation",15, 44);

  doc.setFont("helvetica", "normal");
  doc.text(`: ${entreprise || "________________"}`, 55, 32);
  doc.text(`: ${theme}`, 55, 38);

  const dateStr = workDays.length > 0
    ? `: ${workDays.map((d) => String(d.getDate()).padStart(2, "0")).join("-")}/${String(workDays[0].getMonth() + 1).padStart(2, "0")}/${workDays[0].getFullYear()}`
    : ": ________________";
  doc.text(dateStr, 55, 44);

  doc.setFont("helvetica", "bold");
  doc.text(`G ${grp}`, pageWidth - 20, 38, { align: "right" });

  // 5. Tableau
  const head = [
    [
      { content: "Nom",     rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "Prénom",  rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "N° CIN",  rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "N°CNSS",  rowSpan: 2, styles: { halign: "center", valign: "middle" } },
      { content: "C.S.P", colSpan: 3, styles: { halign: "center" } },
      ...workDays.map((d) => ({
        content: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        rowSpan: 2,
        styles: { halign: "center", valign: "middle" },
      })),
    ],
    ["C", "E", "O"],
  ];

  const body = list.map((c) => {
    const csp = classifyCSP(c.extraData?.csp || c.csp || "");
    return [
      (c.nom || "").toUpperCase(),
      c.prenom || "",
      c.cin || c.extraData?.cin || "",
      "",
      csp === "C" ? "X" : "",
      csp === "E" ? "X" : "",
      csp === "O" ? "X" : "",
      ...workDays.map(() => ""),
    ];
  });

  autoTable(doc, {
    startY: 48,
    margin: { bottom: 45 },
    head: head,
    body: body,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1 },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold", width: 38 },
      1: { fontStyle: "bold" },
      4: { halign: "center", width: 7 },
      5: { halign: "center", width: 7 },
      6: { halign: "center", width: 7 },
    },
  });

  // 6. FOOTER
  const footerY = pageHeight - 20;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");

  // Légende
  doc.text("(*) C.S.P : Catégorie socio-professionnelle", 15, footerY - 16);
  doc.text("C: Cadre – E: Employé – O: Ouvrier",          15, footerY - 11);

  // Bloc gauche — même marge que la légende
  doc.text("Cachet de l'organisme de formation", 15, footerY);
  doc.text("et identité du signataire",           15, footerY + 5);

  // Bloc droit — aligné bord droit
  doc.text("Cachet et signature du responsable", pageWidth - 15, footerY,     { align: "right" });
  doc.text("de formation de l'entreprise",        pageWidth - 15, footerY + 5, { align: "right" });

  doc.save(`Presence_${theme.substring(0, 20).trim()}_G${grp}.pdf`);
};

  const formatDateHeader = (d) => {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const joursLabel = workDays.length > 0
    ? workDays.map(d => `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getDate()}`).join(" ")
    : findExtra("dates") || "—";

  // Dates formatées pour l'en-tête
  const joursHeader = workDays.length > 0
    ? workDays.map(d =>
        `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`
      ).join(" · ")
    : "—";

  const joursInfoLine = workDays.length > 0
  ? (() => {
      const last = workDays[workDays.length - 1];
      const mm = String(last.getMonth() + 1).padStart(2, "0");
      const yyyy = last.getFullYear();
      const days = workDays.map(d => String(d.getDate()).padStart(2, "0")).join("-");
      return `: ${days}/${mm}/${yyyy}`;
    })()
  : `: ${findExtra("dates") || "________________"}`;

  const classifyCSP = (csp = "") => {
    const v = (csp || "").toLowerCase();
    if (["ingénieurs","cadre","cadres","manager"].some(k => v.includes(k))) return "C";
    if (["superviseur","maîtrise","technicien","employé"].some(k => v.includes(k))) return "E";
    if (["ouvrier","opérateur"].some(k => v.includes(k))) return "O";
    return "C";
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Liste de présence - ${theme}</title>
          <style>
            * { font-family: Arial, sans-serif !important; box-sizing: border-box; }
            @page { size: A4 landscape; margin: 10mm 15mm; }
            body { margin: 0; padding: 0; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #000 !important; font-size: 8.5pt; color: #000; vertical-align: middle; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  // Couleur bleue claire pour l'en-tête du tableau (comme dans l'image)
  const headerBg = "#dce6f1";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "stretch", justifyContent: "center",
        fontFamily: "-apple-system,'Segoe UI',sans-serif",
      }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", width: "100%", maxWidth: 1300,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        margin: 16, borderRadius: 8, overflow: "hidden",
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height: 52, borderBottom: "1px solid #ebebeb",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, flexShrink: 0,
          background: "#fafafa",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(68,131,97,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#448361" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#37352f" }}>
              Liste de présence — G{grp}
            </div>
            <div style={{ fontSize: 11, color: "#9b9a97" }}>
              {theme} · {list.length} participant{list.length > 1 ? "s" : ""}
            </div>
          </div>

          {/* Champ entreprise */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "#9b9a97", whiteSpace: "nowrap" }}>Entreprise :</span>
            <input
              value={entreprise}
              onChange={e => setEntreprise(e.target.value)}
              placeholder="Ex: SAFRAN"
              style={{
                padding: "5px 8px", borderRadius: 4, fontSize: 12,
                border: "1px solid rgba(55,53,47,0.2)", outline: "none",
                fontFamily: "inherit", width: 120, color: "#37352f",
              }}
            />
          </div>

          {/* Upload logo */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleLogoUpload}
          />
          <button
            onClick={() => logoInputRef.current?.click()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 4,
              border: "1px solid rgba(55,53,47,0.2)",
              background: logoUrl ? "rgba(68,131,97,0.07)" : "#fff",
              color: logoUrl ? "#448361" : "#9b9a97",
              cursor: "pointer", fontSize: 12, fontWeight: 500,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            {logoUrl ? "Logo ✓" : "Logo"}
          </button>

          {/* Bouton Imprimer */}
          <button
  onClick={generatePresencePDF}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 18px", borderRadius: 4,
    border: "none", background: "#448361",
    color: "#fff", cursor: "pointer",
    fontSize: 13, fontWeight: 600,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "#336b4b"}
  onMouseLeave={e => e.currentTarget.style.background = "#448361"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
  Télécharger PDF
</button>

          <button
  onClick={() => setShowDownloadAll(true)}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(68,131,97,0.4)",
    background: "rgba(68,131,97,0.08)",
    color: "#448361", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(68,131,97,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(68,131,97,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
  Télécharger tous
</button>


          {/* Dans la TOP BAR, après le bouton Imprimer */}
<button
  onClick={handleExportWord}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(68,131,97,0.4)",
    background: "rgba(68,131,97,0.08)",
    color: "#448361", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(68,131,97,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(68,131,97,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  Word
</button>

          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, border: "none",
              background: "transparent", cursor: "pointer", color: "#9b9a97",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f1f1f0"; e.currentTarget.style.color = "#37352f"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9b9a97"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── ZONE APERÇU ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#e8e8e8", padding: "40px" }}>
          <div
  ref={printRef}
  style={{
    width: "277mm", minHeight: "190mm",
    margin: "0 auto", background: "#fff",
    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    boxSizing: "border-box",
    padding: "12mm 15mm",
    fontFamily: "Arial, sans-serif",
    color: "#000",
    fontSize: "10px",
    position: "relative",   // ← ajouter
    paddingBottom: "30mm",  // ← espace réservé pour le footer
  }}
>
            {/* ── EN-TÊTE : Logo + Titre ── */}
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "10px" }}>
              {/* Logo à gauche */}
              <div style={{ width: "25%", paddingTop: 4 }}>
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ height: 65, objectFit: "contain" }} />
                  : entreprise
                    ? <div style={{ fontSize: "16px", fontWeight: "bold", color: "#003366" }}>{entreprise}</div>
                    : <div style={{ width: 80, height: 40, border: "1px dashed #ccc", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#aaa" }}>Logo</div>
                }
              </div>
              {/* Titre centré */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold", fontStyle: "italic", letterSpacing: "0.02em" }}>
                  LISTE DE PRESENCE PAR ACTION ET PAR GROUPE
                </div>
              </div>
              <div style={{ width: "25%" }} />
            </div>

            {/* ── BLOC INFO ── */}
            <div style={{ marginBottom: "10px", fontSize: "10px", lineHeight: "1.7" }}>
              <div>
                <span style={{ fontWeight: "bold", display: "inline-block", width: "145px" }}>Entreprise</span>
                <span>: {entreprise || "________________"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: "bold", display: "inline-block", width: "145px" }}>Thème de l'action</span>
                  <span>: {theme}</span>
                </div>
                <div style={{ marginLeft: "20px", fontWeight: "bold" }}>
                  G {grp}
                </div>
              </div>
              <div>
                <span style={{ fontWeight: "bold", display: "inline-block", width: "145px" }}>Jours de réalisation</span>
                <span>{joursInfoLine || ": ________________"}</span>
              </div>
            </div>

            {/* ── TABLEAU ── */}
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "9px", border: "1px solid #000",
              marginBottom: "12px",
            }}>
              <thead>
                {/* Ligne 1 : en-têtes avec CSP groupé */}
                <tr>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", verticalAlign: "middle", width: "13%" }}>Nom</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", verticalAlign: "middle", width: "11%" }}>Prénom</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", verticalAlign: "middle", width: "9%" }}>N° CIN</th>
                  <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", verticalAlign: "middle", width: "9%" }}>N°CNSS</th>
                  <th colSpan={3} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", width: "12%" }}>C.S.P</th>
                  {workDays.map((d, i) => (
                    <th key={i} rowSpan={2} style={{
                      border: "1px solid #000", padding: "4px 3px",
                      background: headerBg, textAlign: "center", verticalAlign: "middle",
                      fontSize: "8px", whiteSpace: "nowrap",
                    }}>
                      {formatDateHeader(d)}
                    </th>
                  ))}
                  {workDays.length === 0 && (
                    <th rowSpan={2} style={{ border: "1px solid #000", padding: "4px 6px", background: headerBg, textAlign: "center", verticalAlign: "middle" }}>
                      Date
                    </th>
                  )}
                </tr>
                {/* Ligne 2 : C / E / O */}
                <tr>
                  {["C", "E", "O"].map(l => (
                    <th key={l} style={{
                      border: "1px solid #000", padding: "3px 2px",
                      background: headerBg, textAlign: "center",
                      fontSize: "8px", width: "4%",
                    }}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => {
                  const csp = classifyCSP(c.extraData?.csp || c.csp || "");
                  return (
                    <tr key={i}>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", fontWeight: "bold" }}>
                        {(c.nom || "").toUpperCase()}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px" }}>{c.prenom || ""}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{c.cin || ""}</td>
                      <td style={{ border: "1px solid #000", padding: "4px 6px", textAlign: "center" }}>{c.cnss || ""}</td>
                      {/* CSP : C / E / O */}
                      <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center" }}>
                        {csp === "C" ? "X" : ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center" }}>
                        {csp === "E" ? "X" : ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px 2px", textAlign: "center" }}>
                        {csp === "O" ? "X" : ""}
                      </td>
                      {/* Colonnes dates (vides pour signature) */}
                      {workDays.map((_, di) => (
                        <td key={di} style={{ border: "1px solid #000", padding: "4px 3px", minWidth: "22px" }} />
                      ))}
                      {workDays.length === 0 && (
                        <td style={{ border: "1px solid #000", padding: "4px 6px" }} />
                      )}
                    </tr>
                  );
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7 + Math.max(workDays.length, 1)} style={{
                      textAlign: "center", padding: "16px", color: "#aaa",
                      fontStyle: "italic", border: "1px solid #000",
                    }}>
                      Aucun participant trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            

            {/* ── FOOTER : Cachets ── */}
{/* ── FOOTER FIXE EN BAS ── */}
<div
  className="footer"
  style={{
    position: "absolute",
    bottom: "12mm",
    left: "15mm",
    right: "15mm",
  }}
>
  {/* Note CSP */}
  <div style={{ fontSize: "11px", lineHeight: "1.6", marginBottom: "10px" }}>
    <div>(*) C.S.P : Catégorie socio-professionnelle</div>
    <div>C: Cadre – E: Employé – O: Ouvrier</div>
  </div>

  {/* Cachets */}
  <div style={{
    paddingTop: "6px",
    display: "flex",
    justifyContent: "space-between",
  }}>
    <div style={{ textAlign: "center", fontSize: "11px", lineHeight: "1.6" }}>
      <div>Cachet de l'organisme de formation</div>
      <div>et identité du signataire</div>
    </div>
    <div style={{ textAlign: "center", fontSize: "11px", lineHeight: "1.6" }}>
      <div>Cachet et signature du responsable</div>
      <div>de formation de l'entreprise</div>
    </div>
  </div>
</div>

          </div>
        </div>
      </div>
      {showDownloadAll && (
  <DownloadAllModal
    mode="EMARGEMENTS"
    candidats={candidats}
    tasks={tasks}
    globalEntreprise={entreprise}
    onClose={() => setShowDownloadAll(false)}
  />
)}
    </div>
  );
}

function FicheTechniqueDesigner({ doc, candidats, tasks, onClose }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [groupsPerPage, setGroupsPerPage] = useState(5);
    const [showDownloadAll, setShowDownloadAll] = useState(false);


  const parts = doc.nom.split(" - ");
  const theme = parts[1] ? parts[1].trim() : (doc.nom || "");
  const grp = parts[2] ? parts[2].trim().replace("G", "") : "";

  const allThemeCandidats = candidats.filter(c =>
    c.theme === theme || doc.nom.includes(c.theme || "")
  );

  const findExtraData = (key) => {
    for (const c of allThemeCandidats) {
      const val = c.extraData?.[key] || c[key] || "";
      if (val && String(val).trim()) return String(val).trim();
    }
    return "";
  };

  const classifyCSP = (csp = "") => {
    const v = (csp || "").toLowerCase().trim();
    if (["ingénieurs et cadres", "ingénieur", "cadre", "cadres", "managers", "manager"].some(k => v.includes(k))) return "cadres";
    if (["superviseurs", "agents de maitrise", "agents de maîtrise", "technicien", "techniciens", "employé", "employe"].some(k => v.includes(k))) return "employes";
    if (["ouvrier", "ouvriers", "opérateur", "operateur"].some(k => v.includes(k))) return "ouvriers";
    return "cadres";
  };

  const nbCadres = allThemeCandidats.filter(c => classifyCSP(c.extraData?.csp) === "cadres").length;
  const nbEmployes = allThemeCandidats.filter(c => classifyCSP(c.extraData?.csp) === "employes").length;
  const nbOuvriers = allThemeCandidats.filter(c => classifyCSP(c.extraData?.csp) === "ouvriers").length;
  const hasCsp = allThemeCandidats.some(c => c.extraData?.csp);
  const cadresFallback = hasCsp ? String(nbCadres) : String(allThemeCandidats.length);

  const [form, setForm] = useState({
    domaine: findExtraData("domaine") || "Technique",
    theme: theme,
    objectif: findExtraData("objectif"),
    contenu: findExtraData("contenu"),
    cadres: cadresFallback,
    employes: String(nbEmployes),
    ouvriers: String(nbOuvriers),
    cabinet: findExtraData("cabinet"),
    cnss: findExtraData("cnss"),
    typeFormation: findExtraData("typeFormation") || "Intra-entreprise",
    cout: findExtraData("cout") || "",
    lieu: findExtraData("lieu") || "",
    heureDebut: "09:00",
    heureFin: "17:00",
    formateur: findExtraData("formateur"),
  });

  const groupeRows = useMemo(() => {
    const uniqueGroupNumbers = [...new Set(allThemeCandidats.map(c => String(c.groupe || "1")))].sort((a, b) => Number(a) - Number(b));
    return uniqueGroupNumbers.map(gNum => {
      const candsInGrp = allThemeCandidats.filter(c => String(c.groupe || "1") === gNum);
      const task = tasks.find(t =>
        (t.group?.toLowerCase().trim() === theme?.toLowerCase().trim()) &&
        String(t.groupe || "1") === gNum
      );
      return {
        groupe: gNum,
        effectif: candsInGrp.length,
        dateDebut: task?.start || (candsInGrp[0]?.dateDebut) || "",
        dateFin: task?.end || (candsInGrp[0]?.dateFin) || "",
        halfDay: task?.halfDay || false,
        slot: task?.slot || "matin"
      };
    });
  }, [allThemeCandidats, tasks, theme]);

  const totalPages = Math.ceil(groupeRows.length / groupsPerPage);
  const currentGroups = groupeRows.slice((currentPage - 1) * groupsPerPage, currentPage * groupsPerPage);

  const currentCandidats = allThemeCandidats.filter(c =>
    currentGroups.some(g => String(g.groupe) === String(c.groupe || "1"))
  );
  const total = currentCandidats.length;
  const cadresCurrent = currentCandidats.filter(c => classifyCSP(c.extraData?.csp) === "cadres").length;
  const employesCurrent = currentCandidats.filter(c => classifyCSP(c.extraData?.csp) === "employes").length;
  const ouvriersCurrent = currentCandidats.filter(c => classifyCSP(c.extraData?.csp) === "ouvriers").length;

  const prixUnitaire = parseFloat(String(form.cout || "0").replace(/\s/g, "").replace(",", ".")) || 0;

  const totalJours = currentGroups.reduce((acc, grp) => {
    if (!grp.dateDebut || !grp.dateFin) return acc;
    const localWd = [6, 0];
    const localSh = true;
    let current = new Date(grp.dateDebut + "T00:00:00");
    const end = new Date(grp.dateFin + "T00:00:00");
    let jours = 0;
    let safety = 0;
    while (current <= end && safety < 100) {
      safety++;
      if (!isOff(current, localWd, localSh, [])) jours++;
      current.setDate(current.getDate() + 1);
    }
    return acc + (grp.halfDay ? jours * 0.5 : jours);
  }, 0);

  const coutTotalPage = prixUnitaire * totalJours;
  const coutAffiche = coutTotalPage.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const printRef = useRef(null);
  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => { setCurrentPage(1); }, [theme]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Fiche technique - ${form.theme || 'Document'}</title>
          <style>
            * { font-family: 'Calibri', 'Candara', 'Segoe UI', Arial, sans-serif !important; box-sizing: border-box; }
            @page { size: A4; margin: 0 !important; }
            body { margin: 0; padding: 0; background-color: #fff; }
            .print-wrapper { padding: 15mm 20mm; }
            table { border-collapse: collapse; width: 100%; border: 0.5pt solid #000 !important; margin-bottom: 0px; }
            td, th { border: 0.5pt solid #000 !important; padding: 4px 8px; font-size: 11pt; color: #000; line-height: 1.2; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>
          <div class="print-wrapper">${content}</div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); win.close(); }, 600);
  };

  const iS = {
    width: "100%", padding: "5px 8px", borderRadius: 3,
    border: `1px solid rgba(55,53,47,0.2)`, fontSize: 12,
    color: T.pageText, outline: "none", fontFamily: "inherit",
    background: "#fff", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 700, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "stretch", justifyContent: "center",
      fontFamily: "-apple-system,'Segoe UI',sans-serif"
    }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", width: "100%", maxWidth: 1300, display: "flex",
        flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        margin: 16, borderRadius: 8, overflow: "hidden"
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height: 52, borderBottom: `1px solid ${T.pageBdr}`, display: "flex",
          alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0, background: "#fafafa"
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: "#d9730d",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <ClipboardCheck style={{ width: 14, height: 14, color: "#fff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.pageText }}>
              Fiche d'identification de l'action de formation — F2
            </div>
            <div style={{ fontSize: 11, color: T.pageSub }}>{doc.nom}</div>
          </div>

          {allThemeCandidats.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 4, background: "rgba(68,131,97,0.1)", border: "1px solid rgba(68,131,97,0.25)",
              flexWrap: "wrap"
            }}>
              <CheckCircle2 style={{ width: 12, height: 12, color: "#448361", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#448361", fontWeight: 600 }}>Auto-rempli :</span>
              {hasCsp && <span style={{ fontSize: 10, color: "#448361" }}>CSP ✓</span>}
              {form.lieu && <span style={{ fontSize: 10, color: "#448361" }}>Lieu ✓</span>}
              {form.cout && <span style={{ fontSize: 10, color: "#448361" }}>Coût ✓</span>}
              {form.objectif && <span style={{ fontSize: 10, color: "#448361" }}>Objectif ✓</span>}
              {form.cabinet && <span style={{ fontSize: 10, color: "#448361" }}>Cabinet ✓</span>}
            </div>
          )}

          <button onClick={handlePrint} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 18px", borderRadius: 4, border: "none", background: "#d9730d",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600
          }}>
            <Printer style={{ width: 13, height: 13 }} /> Imprimer / PDF
          </button>

                    <button
  onClick={() => setShowDownloadAll(true)}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(68,131,97,0.4)",
    background: "rgba(68,131,97,0.08)",
    color: "#448361", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(68,131,97,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(68,131,97,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
  Télécharger tous
</button>
          {/* Dans la TOP BAR, après le bouton Imprimer */}
<button
  onClick={() => exportToWord(
    printRef.current?.innerHTML || "",
    `FicheTechnique_${form.theme || "F2"}`
  )}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(15,125,219,0.4)",
    background: "rgba(15,125,219,0.08)",
    color: "#0f7ddb", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(15,125,219,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(15,125,219,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  Word
</button>
          <button onClick={onClose} style={{
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageSub
          }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── PANNEAU GAUCHE ── */}
          <div style={{
            width: 300, borderRight: `1px solid ${T.pageBdr}`, overflowY: "auto",
            padding: 16, background: "#fafafa", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 12
          }}>

            <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Informations de la fiche
            </div>

            {[
              ["Domaine", "domaine"],
              ["Thème", "theme"],
              ["Coût HT (MAD)", "cout"],
              ["Lieu", "lieu"],
              ["Heure début", "heureDebut"],
              ["Heure fin", "heureFin"],
              ["Cabinet / Organisme", "cabinet"],
              ["N° CNSS", "cnss"],
              ["Formateur", "formateur"],
            ].map(([label, key]) => (
              <div key={key}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.pageTer, marginBottom: 3 }}>
                  {label}
                  {form[key] && key !== "theme" && key !== "heureDebut" && key !== "heureFin" && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#448361", flexShrink: 0 }} />
                  )}
                </div>
                <input value={form[key]} onChange={e => upd(key, e.target.value)} style={iS} />
              </div>
            ))}

            <div>
              <div style={{ fontSize: 10, color: T.pageTer, marginBottom: 3 }}>Type de formation</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Intra-entreprise", "Inter-entreprises"].map(v => (
                  <button key={v} onClick={() => upd("typeFormation", v)} style={{
                    flex: 1, padding: "5px", fontSize: 11, borderRadius: 3,
                    border: `1.5px solid ${form.typeFormation === v ? T.accent : T.pageBdr}`,
                    background: form.typeFormation === v ? `${T.accent}10` : "#fff",
                    color: form.typeFormation === v ? T.accent : T.pageSub,
                    cursor: "pointer", fontFamily: "inherit",
                    fontWeight: form.typeFormation === v ? 700 : 400,
                  }}>{v}</button>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: T.pageBdr }} />

            {/* ── PAGINATION ── */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Pagination
            </div>

            <div>
              <div style={{ fontSize: 10, color: T.pageTer, marginBottom: 6 }}>
                Groupes par fiche (page)
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => { setGroupsPerPage(n); setCurrentPage(1); }}
                    style={{
                      flex: 1, padding: "5px 0", fontSize: 12, borderRadius: 3,
                      border: `1.5px solid ${groupsPerPage === n ? T.accent : T.pageBdr}`,
                      background: groupsPerPage === n ? `${T.accent}10` : "#fff",
                      color: groupsPerPage === n ? T.accent : T.pageSub,
                      cursor: "pointer", fontFamily: "inherit",
                      fontWeight: groupsPerPage === n ? 700 : 400,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.pageTer, marginTop: 5 }}>
                → {groupeRows.length} groupe{groupeRows.length > 1 ? "s" : ""} · {totalPages} fiche{totalPages > 1 ? "s" : ""} au total
              </div>
            </div>

            <div style={{ height: 1, background: T.pageBdr }} />

            {/* ── EFFECTIF ── */}
            <div style={{ fontSize: 11, fontWeight: 700, color: T.pageSub, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Effectif
            </div>

            {[["Cadres", "cadres"], ["Employés", "employes"], ["Ouvriers", "ouvriers"]].map(([label, key]) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: T.pageTer, marginBottom: 3 }}>{label}</div>
                <input type="number" min={0} value={form[key]} onChange={e => upd(key, e.target.value)} style={iS} />
              </div>
            ))}

            <div style={{
              padding: "8px 10px", borderRadius: 4,
              background: "rgba(217,115,13,0.08)", border: `1px solid rgba(217,115,13,0.3)`,
              fontSize: 12, fontWeight: 600, color: "#d9730d"
            }}>
              Total : {total} participant{total > 1 ? "s" : ""}
            </div>

            <div style={{ height: 1, background: T.pageBdr }} />

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.pageTer, marginBottom: 3 }}>
                Objectif
                {form.objectif && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#448361", flexShrink: 0 }} />}
              </div>
              <textarea value={form.objectif} onChange={e => upd("objectif", e.target.value)}
                rows={4} style={{ ...iS, resize: "vertical" }} />
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: T.pageTer, marginBottom: 3 }}>
                Contenu indicatif
                {form.contenu && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#448361", flexShrink: 0 }} />}
              </div>
              <textarea value={form.contenu} onChange={e => upd("contenu", e.target.value)}
                rows={5} style={{ ...iS, resize: "vertical" }}
                placeholder="- Item 1&#10;- Item 2" />
            </div>
          </div>

          {/* ── ZONE APERÇU ── */}
          <div style={{ flex: 1, overflowY: "auto", background: "#e8e8e8", padding: "40px" }}>

            {totalPages > 1 && (
              <div style={{
                maxWidth: "794px", margin: "0 auto 16px auto",
                background: "#ffffff", borderRadius: "8px",
                border: "1px solid #ebebeb", overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 14px", borderBottom: "1px solid #f0f0f0", background: "#fafafa",
                }}>
                  <span style={{ fontSize: "11px", color: "#888", textTransform: "uppercase", fontWeight: "500" }}>
                    Document multi-pages — <strong style={{ color: "#d9730d" }}>{groupeRows.length} groupes</strong>
                  </span>
                  <span style={{ fontSize: "11px", color: "#d9730d", fontWeight: "600" }}>
                    {currentPage} / {totalPages}
                  </span>
                </div>
                <div style={{ display: "flex", overflowX: "auto", scrollbarWidth: "none" }}>
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const active = currentPage === i + 1;
                    return (
                      <button key={i} onClick={() => setCurrentPage(i + 1)} style={{
                        flex: "1 0 auto", padding: "9px 12px", border: "none",
                        borderBottom: active ? "2px solid #d9730d" : "2px solid transparent",
                        background: active ? "#fff8f3" : "transparent",
                        color: active ? "#d9730d" : "#666",
                        cursor: "pointer", fontWeight: active ? "600" : "400",
                        fontSize: "12px", whiteSpace: "nowrap", outline: "none",
                      }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.color = "#d9730d"; e.currentTarget.style.background = "#fdf5ef"; }}}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#666"; e.currentTarget.style.background = "transparent"; }}}
                      >
                        Partie {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div ref={printRef} style={{
              width: "210mm", minHeight: "297mm", margin: "0 auto", background: "#fff",
              boxShadow: "0 4px 24px rgba(0,0,0,0.15)", boxSizing: "border-box",
              padding: "15mm 20mm", fontFamily: "Arial, sans-serif", color: "#000"
            }}>

              {/* ══ EN-TÊTE ══ */}
              <div style={{ textAlign: "left", marginBottom: "2px" }}>
                <div style={{ fontSize: "13px", fontWeight: "bold" }}>Contrats Spéciaux de Formation</div>
              </div>
              <div style={{ textAlign: "center", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
                Formulaire F2
              </div>
              <div style={{ height: "5px", background: "#000", width: "100%", margin: "4px 0 8px 0" }} />
              <div style={{ textAlign: "center", fontSize: "11px", marginBottom: "10px" }}>
                Fiche d'identification de l'action de formation
              </div>

              {/* ══ BLOC 1 : IDENTIFICATION ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10.5px", border: "0.25pt solid #000" }}>
                <tbody>
                  <tr><td style={{ border: "0.25pt solid #000", fontWeight: "bold", padding: "4px 6px", color: "#003366" }}>Domaine de Formation : (selon la NDF*)</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{form.domaine || "Technique"}</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", fontWeight: "bold", padding: "4px 6px", color: "#003366" }}>Thème de l'Action :</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", padding: "4px 6px", fontWeight: "bold" }}>{form.theme}</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", fontWeight: "bold", padding: "4px 6px", color: "#003366" }}>Objectif (compétence visée) :</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", padding: "4px 6px", verticalAlign: "top", whiteSpace: "pre-wrap" }}>{form.objectif}</td></tr>
                  <tr><td style={{ border: "0.25pt solid #000", fontWeight: "bold", padding: "4px 6px", color: "#003366" }}>Contenu indicatif</td></tr>
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "8px 10px", verticalAlign: "top", whiteSpace: "pre-wrap", height: "160px" }}>
                      {(form.contenu || "").split('\n').map((line, i) => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        const formattedLine = trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
                        return <div key={i} style={{ marginBottom: "3px", lineHeight: "1.3" }}>{formattedLine}</div>;
                      })}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ══ BLOC 2 : EFFECTIF ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10.5px", border: "0.25pt solid #000" }}>
                <tbody>
                  <tr>
                    <td colSpan="4" style={{ border: "0.25pt solid #000", color: "#003366", fontWeight: "bold", padding: "4px 6px" }}>
                      Effectif global de la population concernée :
                    </td>
                  </tr>
                  <tr style={{ textAlign: "center" }}>
                    <td style={{ border: "0.25pt solid #000", width: "25%", padding: "3px 6px" }}>Cadres</td>
                    <td style={{ border: "0.25pt solid #000", width: "25%", padding: "3px 6px" }}>Employés</td>
                    <td style={{ border: "0.25pt solid #000", width: "25%", padding: "3px 6px" }}>Ouvriers</td>
                    <td style={{ border: "0.25pt solid #000", width: "25%", padding: "3px 6px" }}>Total</td>
                  </tr>
                  <tr style={{ textAlign: "center", fontWeight: "bold" }}>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{cadresCurrent}</td>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{employesCurrent}</td>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{ouvriersCurrent}</td>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{total}</td>
                  </tr>
                </tbody>
              </table>

              {/* ══ BLOC 3 : ORGANISME ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10.5px", border: "0.25pt solid #000" }}>
                <tbody>
                  <tr>
                    <td colSpan="2" style={{ border: "0.25pt solid #000", fontWeight: "bold", padding: "4px 6px", color: "#003366" }}>
                      Organisme de Formation :
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px", width: "25%" }}>Raison sociale :</td>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{form.cabinet}</td>
                  </tr>
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>N°CNSS :</td>
                    <td style={{ border: "0.25pt solid #000", padding: "4px 6px" }}>{form.cnss}</td>
                  </tr>
                </tbody>
              </table>

              {/* ══ BLOC 4 : TYPE DE FORMATION ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10.5px", border: "0.25pt solid #000" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "5px 6px", width: "32%" }}>Type de formation :</td>
                    <td style={{ border: "0.25pt solid #000", padding: "5px 6px" }}>
                      <span style={{ marginRight: "30px" }}>
                        <span style={{
                          display: "inline-block", width: "14px", height: "11px",
                          border: "1pt solid #000", background: form.typeFormation === "Intra-entreprise" ? "#000" : "transparent",
                          marginRight: "6px", verticalAlign: "middle"
                        }} />
                        Intra-entreprise
                      </span>
                      <span>
                        <span style={{
                          display: "inline-block", width: "14px", height: "11px",
                          border: "1pt solid #000", background: form.typeFormation === "Inter-entreprises" ? "#000" : "transparent",
                          marginRight: "6px", verticalAlign: "middle"
                        }} />
                        Inter-entreprises
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ══ BLOC 5 : COÛT HT ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "10.5px", border: "0.25pt solid #000" }}>
                <colgroup>
                  <col style={{ width: "32%" }} />
                  <col style={{ width: "68%" }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "5px 6px", fontWeight: "bold", color: "#003366", textAlign: "center" }}>
                      Coût de la Formation HT :
                    </td>
                    <td style={{ border: "0.25pt solid #000", padding: "5px 6px", fontWeight: "bold" }}>
                      {coutAffiche} MAD
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ══ BLOC 6 : TABLEAU DES GROUPES ══ */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px", border: "0.25pt solid #000" }}>
                <colgroup>
                  <col style={{ width: "11%" }} />
                  <col style={{ width: "9%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "34%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Groupe Module</th>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Effectif</th>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Les Dates</th>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Heure Début</th>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Heure fin</th>
                    <th style={{ border: "0.25pt solid #000", padding: "4px", fontWeight: "normal", textAlign: "center" }}>Lieu</th>
                  </tr>
                </thead>
                <tbody>
                  {currentGroups.map((grp, i) => {
                    let hDebut = form.heureDebut;
                    let hFin = form.heureFin;
                    if (grp.halfDay) {
                      if (grp.slot === "matin") { hDebut = "09:00"; hFin = "12:00"; }
                      else if (grp.slot === "après-midi") { hDebut = "14:00"; hFin = "17:00"; }
                    }

                    const renderF2Dates = () => {
                      if (!grp.dateDebut) return "—";
                      const localWd = [6, 0];
                      const localSh = true;
                      if (!grp.dateFin || grp.dateDebut === grp.dateFin) {
                        const d = new Date(grp.dateDebut + "T00:00:00");
                        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      }
                      let current = new Date(grp.dateDebut + "T00:00:00");
                      const end = new Date(grp.dateFin + "T00:00:00");
                      const workDays = [];
                      let safety = 0;
                      while (current <= end && safety < 100) {
                        safety++;
                        if (!isOff(current, localWd, localSh, [])) workDays.push(new Date(current));
                        current.setDate(current.getDate() + 1);
                      }
                      if (workDays.length === 0) return "—";
                      const lastDate = workDays[workDays.length - 1];
                      const monthYear = `/${String(lastDate.getMonth() + 1).padStart(2, '0')}/${lastDate.getFullYear()}`;
                      const dayNumbers = workDays.slice(0, -1).map(d => String(d.getDate()).padStart(2, '0')).join(";");
                      const lastDayNumber = String(lastDate.getDate()).padStart(2, '0');
                      return `${dayNumbers}${dayNumbers ? ";" : ""}${lastDayNumber}${monthYear}`;
                    };

                    return (
                      <tr key={i}>
                        <td style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center" }}>
                          {String(grp.groupe).padStart(2, "0")}
                        </td>
                        <td style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center" }}>
                          {grp.effectif}
                        </td>
                        <td style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center" }}>
                          {renderF2Dates()}
                        </td>
                        <td style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center" }}>{hDebut}</td>
                        <td style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center" }}>{hFin}</td>
                        {i === 0 && (
                          <td rowSpan={groupsPerPage + 1} style={{
                            border: "0.25pt solid #000", padding: "5px 6px",
                            verticalAlign: "top", textAlign: "left", fontSize: "9.5px"
                          }}>
                            {form.lieu}
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {/* Lignes vides */}
                  {currentGroups.length < groupsPerPage && Array.from({ length: groupsPerPage - currentGroups.length }).map((_, idx) => (
                    <tr key={`empty-${idx}`}>
                      <td style={{ border: "0.25pt solid #000", height: "20px" }} />
                      <td style={{ border: "0.25pt solid #000" }} />
                      <td style={{ border: "0.25pt solid #000" }} />
                      <td style={{ border: "0.25pt solid #000" }} />
                      <td style={{ border: "0.25pt solid #000" }} />
                    </tr>
                  ))}

                  {/* Ligne pause déjeuner */}
                  <tr>
                    <td style={{ border: "0.25pt solid #000", padding: "4px" }} />
                    <td style={{ border: "0.25pt solid #000", padding: "4px" }} />
                    <td style={{ border: "0.25pt solid #000", padding: "4px" }} />
                    <td colSpan="2" style={{ border: "0.25pt solid #000", padding: "4px", textAlign: "center", fontSize: "9.5px" }}>
                      Pause déjeunée de 12 h à 14 h
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>
        </div>
      </div>
      {showDownloadAll && (
  <DownloadAllModal
    mode="FICHES_F2"
    candidats={allThemeCandidats}
    tasks={tasks}
    onClose={() => setShowDownloadAll(false)}
  />
)}
    </div>
  );
}

function RecapitulatifDesigner({ doc, candidats, tasks, onClose }) {
  const printRef = useRef(null);

  const rows = useMemo(() => {
  return tasks.map(t => {
    const sample = candidats.find(
      c => c.theme === t.group && String(c.groupe) === String(t.groupe)
    );

    const formatDates = (start, end) => {
      if (!start) return "—";

      // ← Formatage local avec année 4 chiffres TOUJOURS
      const fmtFull = (dateStr) => {
        const d = new Date(dateStr + "T00:00:00");
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      };

      if (!end || start === end) return fmtFull(start);

      const localWd = [6, 0];
      const localSh = true;
      let current = new Date(start + "T00:00:00");
      const endDate = new Date(end + "T00:00:00");
      const days = [];
      while (current <= endDate) {
        if (!isOff(current, localWd, localSh, [])) days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      if (days.length === 0) return fmtFull(start);

      const last = days[days.length - 1];
      // ← Année 4 chiffres forcée ici aussi
      const monthYear = `/${String(last.getMonth() + 1).padStart(2, "0")}/${last.getFullYear()}`;
      return days.map(d => String(d.getDate()).padStart(2, "0")).join(";") + monthYear;
    };

    return {
      theme: t.group,
      dates: formatDates(t.start, t.end),
      cabinet: sample?.extraData?.cabinet || sample?.cabinet || "—",
      cnss: sample?.extraData?.cnss || sample?.cnss || "—",
    };
  }).sort((a, b) => a.theme.localeCompare(b.theme));
}, [tasks, candidats]);

  const handlePrint = () => {
  const content = printRef.current?.innerHTML;
  if (!content) return;
  const win = window.open("", "_blank");
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Récapitulatif des actions</title>
        <style>
          * { font-family: Arial, sans-serif !important; box-sizing: border-box; }
          @page { size: A4; margin: 15mm 20mm; }
          body { margin: 0; padding: 0; background: #fff; }
          table { border-collapse: collapse; width: 100%; }
          td, th {
            border: 1px solid #000 !important;
            padding: 5px 7px;
            font-size: 9pt;
            color: #000;
            line-height: 1.3;
            vertical-align: middle;
          }
          th { font-weight: normal; text-align: center; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 500);
};

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "stretch", justifyContent: "center",
        fontFamily: "-apple-system,'Segoe UI',sans-serif",
      }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", width: "100%", maxWidth: 1000,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        margin: 16, borderRadius: 8, overflow: "hidden",
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height: 52, borderBottom: "1px solid #ebebeb",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, flexShrink: 0,
          background: "#fafafa",
        }}>

          {/* Icône bleue — reproduit exactement l'icône "Récapitulatif" de l'app */}
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(26,115,232,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {/* Icône clipboard avec liste — style de l'onglet Récapitulatif */}
            <svg
              width="15" height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a73e8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </div>

          {/* Titre + sous-titre */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#37352f" }}>
              Fiche récapitulative des actions de formation — Modèle 1
            </div>
            <div style={{ fontSize: 11, color: "#9b9a97" }}>
              {rows.length} action{rows.length > 1 ? "s" : ""} · {tasks.length} groupe{tasks.length > 1 ? "s" : ""}
            </div>
          </div>

          {/* Badge compteur — bleu au lieu d'orange */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 4,
            background: "rgba(26,115,232,0.07)",
            border: "1px solid rgba(26,115,232,0.2)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: 11, color: "#1a73e8", fontWeight: 600 }}>
              {rows.length} thème{rows.length > 1 ? "s" : ""} chargé{rows.length > 1 ? "s" : ""}
            </span>
          </div>

          {/* Bouton Imprimer — bleu pour rester cohérent avec l'icône */}
          <button
            onClick={handlePrint}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 18px", borderRadius: 4,
              border: "none", background: "#1a73e8",
              color: "#fff", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#1558b0"}
            onMouseLeave={e => e.currentTarget.style.background = "#1a73e8"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimer / PDF
          </button>

          {/* Dans la TOP BAR, après le bouton Imprimer */}
<button
  onClick={() => exportToWord(
    printRef.current?.innerHTML || "",
    `Recapitulatif_Modele1`
  )}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(26,115,232,0.4)",
    background: "rgba(26,115,232,0.08)",
    color: "#1a73e8", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(26,115,232,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(26,115,232,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  Word
</button>

          {/* Bouton Fermer */}
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: 4, border: "none",
              background: "transparent", cursor: "pointer", color: "#9b9a97",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f1f1f0"; e.currentTarget.style.color = "#37352f"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9b9a97"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── ZONE APERÇU ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#e8e8e8", padding: "40px" }}>
          {/* ══ ZONE D'IMPRESSION ══ */}
<div
  ref={printRef}
  style={{
    width: "210mm", minHeight: "297mm",
    margin: "0 auto", background: "#fff",
    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
    boxSizing: "border-box",
    padding: "15mm 20mm",
    fontFamily: "Arial, sans-serif",
    color: "#000",
  }}
>
  {/* ── TITRE ── */}
  <div style={{
    fontSize: "14px",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: "20px",
    lineHeight: "1.3",
  }}>
    Récapitulatif des actions et organismes de formation
  </div>

  {/* ── TABLE 1 : Bloc Modèle 1 ── */}
  <table style={{
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #000",
    marginBottom: "8px",
  }}>
    <tbody>
      <tr>
        <td style={{
          border: "1px solid #000",
          padding: "8px 10px",
          textAlign: "center",
          fontSize: "10px",
          lineHeight: "1.8",
        }}>
          <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "2px" }}>
            Modèle 1
          </div>
          <div style={{ fontWeight: "normal" }}>
            Fiche récapitulative des Actions de Formation et des Organismes de Formation leur correspondant
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  {/* ── TABLE 2 : En-têtes + Données ── */}
  <table style={{
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "9px",
    border: "1px solid #000",
    marginTop: "0",
  }}>
    <colgroup>
      <col style={{ width: "38%" }} />
      <col style={{ width: "24%" }} />  {/* plus large pour les dates complètes */}
      <col style={{ width: "22%" }} />
      <col style={{ width: "16%" }} />
    </colgroup>
    <thead>
      <tr>
        <th style={{
          border: "1px solid #000",
          padding: "6px 8px",
          textAlign: "center",
          fontWeight: "normal",
          fontSize: "9px",
          verticalAlign: "middle",
        }}>
          Thème de l'action
        </th>
        <th style={{
          border: "1px solid #000",
          padding: "6px 8px",
          textAlign: "center",
          fontWeight: "normal",
          fontSize: "9px",
          verticalAlign: "middle",
        }}>
          Dates de réalisation
        </th>
        <th style={{
          border: "1px solid #000",
          padding: "6px 8px",
          textAlign: "center",
          fontWeight: "normal",
          fontSize: "9px",
          verticalAlign: "middle",
        }}>
          Organismes de formation
        </th>
        <th style={{
          border: "1px solid #000",
          padding: "6px 8px",
          textAlign: "center",
          fontWeight: "normal",
          fontSize: "9px",
          verticalAlign: "middle",
        }}>
          N° CNSS de l'organisme
        </th>
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          <td style={{
            border: "1px solid #000",
            padding: "5px 8px",
            fontSize: "9px",
            verticalAlign: "middle",
            wordBreak: "break-word",
          }}>
            {r.theme}
          </td>
          <td style={{
            border: "1px solid #000",
            padding: "5px 8px",
            textAlign: "center",
            fontSize: "9px",
            verticalAlign: "middle",
            whiteSpace: "nowrap",   /* ← empêche les dates de se couper */
          }}>
            {r.dates}
          </td>
          <td style={{
            border: "1px solid #000",
            padding: "5px 8px",
            textAlign: "center",
            fontSize: "9px",
            verticalAlign: "middle",
          }}>
            {r.cabinet}
          </td>
          <td style={{
            border: "1px solid #000",
            padding: "5px 8px",
            textAlign: "center",
            fontSize: "9px",
            verticalAlign: "middle",
          }}>
            {r.cnss}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
        </div>

      </div>
    </div>
  );
}

function SyntheseCoutsDesigner({ doc, candidats, tasks, onClose }) {
  const printRef = useRef(null);

  const [raisonSociale, setRaisonSociale] = useState(
    candidats[0]?.extraData?.entreprise || candidats[0]?.entreprise || ""
  );
  const [activite, setActivite] = useState(
    candidats[0]?.extraData?.activite || candidats[0]?.activite || ""
  );
  const [responsable, setResponsable] = useState(
    candidats[0]?.extraData?.responsable || candidats[0]?.responsable || ""
  );
  const annee = new Date().getFullYear();

  const classifyCSP = (csp = "") => {
    const v = (csp || "").toLowerCase();
    if (["ingénieurs","cadre","cadres","manager"].some(k => v.includes(k))) return "C";
    if (["superviseur","maîtrise","technicien","employé","employe"].some(k => v.includes(k))) return "E";
    if (["ouvrier","opérateur","operateur"].some(k => v.includes(k))) return "O";
    return "C";
  };

  const rows = useMemo(() => {
    const stats = {};
    candidats.forEach(c => {
      const theme = c.theme || "Sans titre";
      const domaine = c.extraData?.domaine || c.domaine || "—";
      const key = `${domaine}|||${theme}`;
      if (!stats[key]) {
        stats[key] = {
          domaine,
          theme,
          candidatsSet: new Set(),
          groupesSet: new Set(),
          cSet: new Set(), eSet: new Set(), oSet: new Set(),
          organisme: c.extraData?.cabinet || c.cabinet || "—",
          coutUnitaire: parseFloat(
            String(c.extraData?.cout || c.cout || "0").replace(/\s/g,'').replace(',','.')
          ) || 0,
          jours: c.jours || 0,
        };
      }
      const cId = c.matricule || `${c.nom}-${c.prenom}`;
      stats[key].candidatsSet.add(cId);
      stats[key].groupesSet.add(c.groupe);
      const csp = classifyCSP(c.extraData?.csp || c.csp || "");
      if (csp === "C") stats[key].cSet.add(cId);
      else if (csp === "E") stats[key].eSet.add(cId);
      else if (csp === "O") stats[key].oSet.add(cId);
    });

    return Object.values(stats).map(s => {
      const nbrGroupes = s.groupesSet.size;
      const nbrJours = s.jours;
      const coutTotal = (s.coutUnitaire * nbrJours) * nbrGroupes;
      return {
        domaine: s.domaine,
        theme: s.theme,
        effectif: s.candidatsSet.size,
        nbrGroupe: nbrGroupes,
        nbC: s.cSet.size,
        nbE: s.eSet.size,
        nbO: s.oSet.size,
        organisme: s.organisme,
        coutTotal,
      };
    }).sort((a, b) =>
      a.domaine.localeCompare(b.domaine) || a.theme.localeCompare(b.theme)
    );
  }, [candidats]);

  const effectifTotal = useMemo(() => {
    const ids = new Set();
    candidats.forEach(c => ids.add(c.matricule || `${c.nom}-${c.prenom}`));
    return ids.size;
  }, [candidats]);

  const grandTotal = rows.reduce((sum, r) => sum + r.coutTotal, 0);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Synthèse des coûts</title>
          <style>
            * { font-family: Arial, sans-serif !important; box-sizing: border-box; }
@page { size: A4 portrait; margin: 10mm 12mm; }
            body { margin: 0; padding: 0; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #000 !important; font-size: 8pt; color: #000; vertical-align: middle; padding: 4px 5px; }
            th { font-weight: bold; text-align: center; background-color: #f2c94c !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const iS = {
    padding: "4px 8px", borderRadius: 4, fontSize: 12,
    border: "1px solid rgba(55,53,47,0.2)", outline: "none",
    fontFamily: "inherit", color: "#37352f", background: "#fff",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "stretch", justifyContent: "center",
        fontFamily: "-apple-system,'Segoe UI',sans-serif",
      }}
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: "#fff", width: "100%", maxWidth: 1200,
        display: "flex", flexDirection: "column",
        boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
        margin: 16, borderRadius: 8, overflow: "hidden",
      }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height: 52, borderBottom: "1px solid #ebebeb",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, flexShrink: 0,
          background: "#fafafa",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "rgba(68,131,97,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#448361" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
              <line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#37352f" }}>
              Synthèse des actions de formation
            </div>
            <div style={{ fontSize: 11, color: "#9b9a97" }}>
              {rows.length} formation{rows.length > 1 ? "s" : ""} · {effectifTotal} participants
            </div>
          </div>

          {/* Champs éditables */}
          <input value={raisonSociale} onChange={e => setRaisonSociale(e.target.value)}
            placeholder="Raison sociale" style={{ ...iS, width: 150 }} />
          <input value={activite} onChange={e => setActivite(e.target.value)}
            placeholder="Activité" style={{ ...iS, width: 120 }} />
          <input value={responsable} onChange={e => setResponsable(e.target.value)}
            placeholder="Responsable formation" style={{ ...iS, width: 180 }} />

          {/* Badge total */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px", borderRadius: 4,
            background: "rgba(68,131,97,0.08)",
            border: "1px solid rgba(68,131,97,0.25)",
            whiteSpace: "nowrap",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="#448361" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span style={{ fontSize: 11, color: "#448361", fontWeight: 600 }}>
              {grandTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} MAD
            </span>
          </div>

          {/* Bouton Imprimer */}
          <button onClick={handlePrint} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 18px", borderRadius: 4,
            border: "none", background: "#448361",
            color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#336b4b"}
            onMouseLeave={e => e.currentTarget.style.background = "#448361"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimer / PDF
          </button>

          {/* Dans la TOP BAR, après le bouton Imprimer */}
<button
  onClick={() => exportToWord(
    printRef.current?.innerHTML || "",
    `SyntheseDesCouts_${annee}`
  )}
  style={{
    display: "flex", alignItems: "center", gap: 6,
    padding: "7px 14px", borderRadius: 4,
    border: "1px solid rgba(68,131,97,0.4)",
    background: "rgba(68,131,97,0.08)",
    color: "#448361", cursor: "pointer",
    fontSize: 13, fontWeight: 500,
  }}
  onMouseEnter={e => e.currentTarget.style.background = "rgba(68,131,97,0.15)"}
  onMouseLeave={e => e.currentTarget.style.background = "rgba(68,131,97,0.08)"}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
  Word
</button>

          {/* Fermer */}
          <button onClick={onClose} style={{
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: "#9b9a97",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#f1f1f0"; e.currentTarget.style.color = "#37352f"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9b9a97"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── ZONE APERÇU ── */}
        <div style={{ flex: 1, overflowY: "auto", background: "#e8e8e8", padding: "40px" }}>
          <div ref={printRef} style={{
            width: "210mm", minHeight: "297mm",
            margin: "0 auto", background: "#fff",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
            boxSizing: "border-box",
            padding: "10mm 12mm",
            fontFamily: "Arial, sans-serif",
            color: "#000",
          }}>

            {/* ── TITRE ── */}
            <div style={{
              textAlign: "center", fontSize: "13px",
              fontWeight: "bold", marginBottom: "8px", letterSpacing: "0.02em",
            }}>
              SYNTHESE DES ACTIONS DE FORMATION &nbsp;&nbsp; Année : {annee}
            </div>

            {/* ── BLOC INFO ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              fontSize: "10px", marginBottom: "12px", gap: "4px 20px",
            }}>
              <div>
                <span style={{ fontWeight: "bold", display: "inline-block", width: "130px" }}>RAISON SOCIALE</span>
                <span>: &nbsp;{raisonSociale || "________________"}</span>
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>ACTIVITE : </span>
                <span>{activite || "________________"}</span>
              </div>
              <div>
                <span style={{ fontWeight: "bold", display: "inline-block", width: "130px" }}>EFFECTIF TOTAL</span>
                <span>: &nbsp;{effectifTotal}</span>
              </div>
              <div>
                <span style={{ fontWeight: "bold" }}>RESPONSABLE DE FORMATION : </span>
                <span>{responsable || "________________"}</span>
              </div>
            </div>

            {/* ── TABLEAU ── */}
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: "8px", border: "1px solid #000",
            }}>
              <colgroup>
  <col style={{ width: "18%" }} />
  <col style={{ width: "38%" }} />
  <col style={{ width: "8%" }} />
  <col style={{ width: "9%" }} />
  <col style={{ width: "7%" }} />
  <col style={{ width: "7%" }} />
  <col style={{ width: "7%" }} />
  <col style={{ width: "12%" }} />
</colgroup>
              <thead>
                <tr>
                  {["Domaine", "THEME", "NBRE Grp", "EFFECTIF", "C", "E", "O", "BUDGET"].map((h, i) => (
                    <th key={i} style={{
                      border: "1px solid #000",
                      padding: "5px 4px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "8px",
                      background: "#f2c94c",
                      verticalAlign: "middle",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #000", padding: "4px 5px", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.domaine}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 5px", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.theme}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.nbrGroupe}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.effectif}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.nbC || ""}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.nbE || ""}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 3px", textAlign: "center", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.nbO || ""}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px 5px", textAlign: "right", fontSize: "8px", verticalAlign: "middle" }}>
                      {r.coutTotal
                        ? r.coutTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        : ""}
                    </td>
                  </tr>
                ))}

                {/* ── Ligne Total ── */}
                <tr>
                  <td colSpan={7} style={{
                    border: "1px solid #000", padding: "5px 7px",
                    textAlign: "right", fontWeight: "bold", fontSize: "8px",
                    background: "#fef9e7",
                  }}>
                    TOTAL GÉNÉRAL
                  </td>
                  <td style={{
                    border: "1px solid #000", padding: "5px 5px",
                    textAlign: "right", fontWeight: "bold", fontSize: "8px",
                    background: "#fef9e7",
                  }}>
                    {grandTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsView({currentUser, documents, setDocuments, wsId, showToast, candidats, tasks }) {
  const [syntheseCoutsItem, setSyntheseCoutsItem] = useState(null);
  const [recapItem, setRecapItem] = useState(null);
  const [ficheTechItem, setFicheTechItem] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState("Tous");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("table");

  const filteredByPermission = useMemo(() => {
    // Si c'est l'administrateur (propriétaire), il voit tout
    if (!currentUser?.parentId) return documents;
    
    // Sinon, on filtre selon sa liste allowedDocTypes
    const allowed = currentUser?.permissions?.allowedDocTypes || [];
    return documents.filter(doc => allowed.includes(doc.type));
  }, [documents, currentUser])

  const filtered = useMemo(() => {
    // 1. Filtrage par Permission (allowedDocTypes)
    let list = documents;
    
    // Si c'est un sous-compte (il a un parentId)
    if (currentUser?.parentId) {
      const allowed = currentUser?.permissions?.allowedDocTypes || [];
      list = documents.filter(d => allowed.includes(d.type));
    }

    // 2. Puis on applique vos filtres habituels (Recherche + Onglets type)
    return list.filter(d =>
      (filter === "Tous" || d.type === filter) &&
      (!search || d.nom.toLowerCase().includes(search.toLowerCase()))
    );
  }, [documents, currentUser, filter, search]);

  const save = async f => {
    try {
      if (modal === "new") {
        const created = norm(await apiFetch(`/workspaces/${wsId}/documents`, { method: "POST", body: f }));
        setDocuments(p => [...p, created]);
      } else {
        const updated = norm(await apiFetch(`/documents/${modal.id}`, { method: "PUT", body: f }));
        setDocuments(p => p.map(d => d.id === modal.id ? updated : d));
      }
    } catch (e) { showToast("Erreur : " + e.message); }
  };

  const delDoc = async id => {
    setDocuments(p => p.filter(d => d.id !== id));
    try { await apiFetch(`/documents/${id}`, { method: "DELETE" }); }
    catch (e) { showToast("Erreur suppression : " + e.message); }
  };

  // ── Helpers détection type ──
  const isEmargement = doc =>
    doc.type === "Émargement" ||
    doc.nom?.toLowerCase().includes("émargement") ||
    doc.nom?.toLowerCase().includes("emargement");

  const isFicheTech = doc =>
    doc.type === "Fiche technique" ||
    doc.nom?.toLowerCase().includes("fiche technique");

    const isRecap = doc => 
  doc.type === "Récapitulatif" || 
  doc.nom?.toLowerCase().includes("récapitulatif") ||
  doc.nom?.toLowerCase().includes("recapitulatif");

  const isSyntheseCouts = doc => 
  doc.type === "Synthèse des coûts" || 
  doc.nom?.toLowerCase().includes("synthèse des coûts");

  

  return (
    <div style={{ padding: "60px 40px 80px", width: "100%", boxSizing: "border-box" }}>

      {/* ── Modals — TOUS DANS LE RETURN ── */}
      {modal && (
        <DModal
          item={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {previewItem && (
        <AttendanceDesigner
          doc={previewItem}
          candidats={candidats}
          tasks={tasks}          // ← ajouter cette prop
          onClose={() => setPreviewItem(null)}
        />
      )}
      {ficheTechItem && (
        <FicheTechniqueDesigner
          doc={ficheTechItem}
          candidats={candidats}
          tasks={tasks}
          onClose={() => setFicheTechItem(null)}
        />
      )}

      {recapItem && (
  <RecapitulatifDesigner
    doc={recapItem}
    candidats={candidats}
    tasks={tasks}
    onClose={() => setRecapItem(null)}
  />
)}

{syntheseCoutsItem && (
  <SyntheseCoutsDesigner
    doc={syntheseCoutsItem}
    candidats={candidats}
    tasks={tasks}
    onClose={() => setSyntheseCoutsItem(null)}
  />
)}

      {/* ── En-tête ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <FolderOpen style={{ width: 24, height: 24, color: T.pageSub, strokeWidth: 1.6 }} />
        <h1 style={{ fontSize: 32, fontWeight: 800, color: T.pageText, letterSpacing: "-0.04em", margin: 0 }}>
          Documents
        </h1>
      </div>
      <div style={{ fontSize: 13, color: T.pageSub, marginBottom: 28 }}>
        {documents.length} document{documents.length !== 1 ? "s" : ""}
      </div>

      {/* ── Filtres & toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {[{ key: "Tous" }, ...DOC_TYPES.map(t => ({ key: t }))]
          .filter(f => f.key === "Tous" || documents.some(d => d.type === f.key))
          .map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              padding: "3px 10px", borderRadius: 4,
              border: `1px solid ${filter === f.key ? "rgba(55,53,47,0.3)" : T.pageBdr}`,
              background: filter === f.key ? "rgba(55,53,47,0.07)" : "transparent",
              color: filter === f.key ? T.pageText : T.pageSub,
              fontSize: 13, fontWeight: filter === f.key ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {f.key !== "Tous" && <DocIcon type={f.key} size={12} />}
              {f.key}
            </button>
          ))
        }
        <div style={{ height: 16, width: 1, background: T.pageBdr }} />
        <div style={{ display: "flex", border: `1px solid ${T.pageBdr}`, borderRadius: 4, overflow: "hidden" }}>
          {[["table", "≡ Table"], ["grid", "⊞ Galerie"]].map(([v, icon]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "3px 10px", border: "none",
              background: view === v ? "rgba(55,53,47,0.1)" : "transparent",
              cursor: "pointer", fontSize: 13,
              color: view === v ? T.pageText : T.pageSub, fontFamily: "inherit",
            }}>{icon}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 9px", border: `1px solid ${T.pageBdr}`, borderRadius: 4 }}>
          <Search style={{ width: 12, height: 12, color: T.pageTer }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ fontSize: 13, border: "none", outline: "none", color: T.pageText, fontFamily: "inherit", width: 100, background: "transparent" }} />
          {search && (
            <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", color: T.pageTer, display: "flex", padding: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
        <button onClick={() => setModal("new")} style={{
          display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 10px",
          fontSize: 13, fontWeight: 500, color: "#fff", background: "#37352f",
          border: "none", borderRadius: 4, cursor: "pointer", fontFamily: "inherit",
        }}
          onMouseEnter={e => e.currentTarget.style.background = "#111"}
          onMouseLeave={e => e.currentTarget.style.background = "#37352f"}
        >
          <Plus style={{ width: 13, height: 13 }} /> Nouveau
        </button>
      </div>

      {/* ── Contenu ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <FolderOpen style={{ width: 36, height: 36, color: T.pageTer, margin: "0 auto 12px", display: "block", strokeWidth: 1.4 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: T.pageText }}>Aucun document</div>
        </div>

      ) : view === "grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 8 }}>
          {filtered.map(doc => {
            const ds = DOC_STATUS.find(s => s.key === doc.statut) || DOC_STATUS[0];
            return (
              <div key={doc.id} style={{
                border: `1px solid ${T.pageBdr}`, borderRadius: 4, background: "#fff", padding: 14,
                transition: "border-color 0.1s,box-shadow 0.1s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(55,53,47,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.pageBdr; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 4, background: `${DOC_COLOR[doc.type] || "#787774"}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DocIcon type={doc.type} size={16} />
                  </div>
                  <div style={{ display: "flex", gap: 1 }}>

                    {/* ── Bouton émargement ── */}
                    {isEmargement(doc) && (
                      <button
                        onClick={() => setPreviewItem(doc)}
                        title="Aperçu avant impression"
                        style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#448361", color: "#fff", cursor: "pointer" }}
                      >
                        <Printer style={{ width: 12, height: 12 }} />
                      </button>
                    )}

                    {/* ── Bouton fiche technique ── */}
                    {isFicheTech(doc) && (
                      <button
                        onClick={() => setFicheTechItem(doc)}
                        title="Ouvrir la fiche F2"
                        style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#d9730d", color: "#fff", cursor: "pointer" }}
                      >
                        <Printer style={{ width: 12, height: 12 }} />
                      </button>
                    )}

                    {doc.lien && (
                      <a href={doc.lien} target="_blank" rel="noopener" style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, color: T.pageTer, textDecoration: "none" }}
                        onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <Link style={{ width: 10, height: 10 }} />
                      </a>
                    )}
                    <button onClick={() => setModal(doc)} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }}
                      onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Edit2 style={{ width: 10, height: 10 }} />
                    </button>
                    <button onClick={() => delDoc(doc.id)} style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,76,71,0.08)"; e.currentTarget.style.color = "#d44c47"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.pageTer; }}
                    >
                      <Trash2 style={{ width: 10, height: 10 }} />
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.pageText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                  {doc.nom}
                </div>
                <Tag label={doc.statut} scheme={{ text: ds.text, bg: ds.bg }} />
                {doc.dateDoc && (
                  <div style={{ fontSize: 11, color: T.pageTer, marginTop: 6 }}>{fmtFr(doc.dateDoc)}</div>
                )}
              </div>
            );
          })}
        </div>

      ) : (
        /* ── Vue Table ── */
        <div style={{ border: `1px solid ${T.pageBdr}`, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 80px", background: "rgba(55,53,47,0.03)", borderBottom: `1px solid ${T.pageBdr}`, padding: "0 16px" }}>
            {["Document", "Type", "Date", "Statut", ""].map(h => (
              <div key={h} style={{ padding: "7px 0", fontSize: 10, fontWeight: 600, color: T.pageTer, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>
          {filtered.map((doc, i) => {
            const ds = DOC_STATUS.find(s => s.key === doc.statut) || DOC_STATUS[0];
            return (
              <div key={doc.id} style={{
                display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr 80px",
                padding: "0 16px", borderBottom: i < filtered.length - 1 ? `1px solid ${T.pageBdr}` : "none",
                alignItems: "center", background: "#fff", transition: "background 0.06s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 4, background: `${DOC_COLOR[doc.type] || "#787774"}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <DocIcon type={doc.type} size={14} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.pageText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nom}</div>
                    {doc.notes && <div style={{ fontSize: 11, color: T.pageSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.notes}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: T.pageSub }}>{doc.type}</span>
                <span style={{ fontSize: 12, color: T.pageSub }}>{doc.dateDoc ? fmtFr(doc.dateDoc) : "—"}</span>
                <div><Tag label={doc.statut} scheme={{ text: ds.text, bg: ds.bg }} /></div>
                <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>

                  {/* ── Bouton émargement ── */}
                  {isEmargement(doc) && (
                    <button
                      onClick={() => setPreviewItem(doc)}
                      title="Aperçu avant impression"
                      style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#448361", color: "#fff", cursor: "pointer" }}
                    >
                      <Printer style={{ width: 12, height: 12 }} />
                    </button>
                  )}

                  {/* ── Bouton fiche technique ── */}
                  {isFicheTech(doc) && (
                    <button
                      onClick={() => setFicheTechItem(doc)}
                      title="Ouvrir la fiche F2"
                      style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#d9730d", color: "#fff", cursor: "pointer" }}
                    >
                      <Printer style={{ width: 12, height: 12 }} />
                    </button>
                  )}

                  {isRecap(doc) && (
  <button
    onClick={() => setRecapItem(doc)}
    title="Ouvrir le récapitulatif"
    style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#0f7ddb", color: "#fff", cursor: "pointer" }}
  >
    <Printer style={{ width: 12, height: 12 }} />
  </button>
)}

{isSyntheseCouts(doc) && (
  <button
    onClick={() => setSyntheseCoutsItem(doc)}
    title="Ouvrir la synthèse des coûts"
    style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "#448361", color: "#fff", cursor: "pointer" }}
  >
    <Printer style={{ width: 12, height: 12 }} />
  </button>
)}

                  {doc.lien && (
                    <a href={doc.lien} target="_blank" rel="noopener" style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, color: T.pageTer, textDecoration: "none" }}
                      onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <Link style={{ width: 10, height: 10 }} />
                    </a>
                  )}
                  <button onClick={() => setModal(doc)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }}
                    onMouseEnter={e => e.currentTarget.style.background = T.pageHov}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <Edit2 style={{ width: 11, height: 11 }} />
                  </button>
                  <button onClick={() => delDoc(doc.id)} style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(212,76,71,0.08)"; e.currentTarget.style.color = "#d44c47"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.pageTer; }}
                  >
                    <Trash2 style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProfileView({ currentUser, onSave, showToast }) {
  const [displayName, setDisplayName] = useState(currentUser?.displayName || currentUser?.username || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [team, setTeam] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [nuUsername, setNuUsername] = useState("");
  const [nuPassword, setNuPassword] = useState("");
  const [nuDisplayName, setNuDisplayName] = useState("");
  const [nuPerms, setNuPerms] = useState({ canImportExcel: true, canViewDocs: true });
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    if (currentUser && !currentUser.parentId && currentUser.role !== "admin") {
      setLoadingTeam(true);
      apiFetch("/auth/subusers")
        .then(res => setTeam(res))
        .catch(e => console.error(e))
        .finally(() => setLoadingTeam(false));
    }
  }, [currentUser]);

  const openTeamForm = (u = null) => {
    setEditingUser(u);
    if (u) {
      setNuDisplayName(u.displayName || "");
      setNuUsername(u.username || "");
      setNuPassword("");
      setNuPerms(u.permissions || { canImportExcel: true, canViewDocs: true });
    } else {
      setNuDisplayName(""); setNuUsername(""); setNuPassword("");
      setNuPerms({ canImportExcel: true, canViewDocs: true });
    }
    setShowTeamForm(true);
  };

  const saveTeamMember = async () => {
    if (!nuUsername || (!nuPassword && !editingUser)) return showToast("Identifiant et mot de passe requis", "error");
    try {
      if (editingUser) {
        const body = { displayName: nuDisplayName, permissions: nuPerms };
        if (nuPassword) body.password = nuPassword;
        const res = await apiFetch(`/auth/subusers/${editingUser._id}`, { method: "PUT", body });
        setTeam(team.map(t => t._id === res.user._id ? res.user : t));
        showToast("Utilisateur mis à jour", "success");
      } else {
        const body = { username: nuUsername, password: nuPassword, displayName: nuDisplayName, permissions: nuPerms };
        const res = await apiFetch("/auth/subusers", { method: "POST", body });
        setTeam([...team, res.user]);
        showToast("Utilisateur créé", "success");
      }
      setShowTeamForm(false);
    } catch (e) { showToast(e.message, "error"); }
  };

  const deleteTeamMember = async (id) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cet accès ?")) return;
    try {
      await apiFetch(`/auth/subusers/${id}`, { method: "DELETE" });
      setTeam(team.filter(t => t._id !== id));
      showToast("Accès supprimé", "success");
    } catch (e) { showToast(e.message, "error"); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(displayName.trim(), password);
      showToast("Profil mis à jour avec succès", "success");
      setPassword("");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Styles partagés ──
  const inputStyle = (field, disabled = false) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 11px",
    border: `1px solid ${disabled ? "#f0f0ee" : focusedField === field ? "#0f7ddb" : "#e3e3e2"}`,
    borderRadius: 6,
    fontSize: 13,
    color: disabled ? "#b7b6b2" : "#37352f",
    background: disabled ? "#fafaf9" : "#fff",
    outline: "none",
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "text",
    boxShadow: focusedField === field ? "0 0 0 2px rgba(15,125,219,0.14)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
  });

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    color: "#6b6b6b",
    marginBottom: 5,
  };

  const cardStyle = {
    background: "#fff",
    borderRadius: 8,
    border: "1px solid #e3e3e2",
    padding: "20px 24px",
    marginBottom: 12,
  };

  const cardTitleStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#37352f",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottom: "1px solid #f0f0ee",
  };

  const btnBase = { border: "none", background: "none", cursor: "pointer", fontFamily: "inherit" };

  const initials = currentUser
    ? (currentUser.displayName || currentUser.username || "?").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div style={{ padding: "32px 40px", maxWidth: 660, margin: "0 auto" }}>
      {/* ── En-tête page ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#37352f", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Mon profil
        </h1>
        <p style={{ fontSize: 13, color: "#9b9a97", margin: 0 }}>
          Gérez vos informations personnelles et paramètres de sécurité.
        </p>
      </div>

      {/* ── Informations personnelles ── */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Informations personnelles</div>

        {/* Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(55,53,47,0.08)", border: "1px solid rgba(55,53,47,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 600, color: "#37352f", flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#37352f", marginBottom: 2 }}>
              {currentUser?.displayName || currentUser?.username}
            </div>
            <div style={{ fontSize: 12, color: "#9b9a97" }}>
              Avatar généré automatiquement depuis votre nom d'affichage
            </div>
          </div>
        </div>

        {/* Identifiant + Rôle */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Identifiant</label>
            <input type="text" value={currentUser?.username || ""} disabled style={inputStyle("__disabled_1", true)} />
          </div>
          <div>
            <label style={labelStyle}>Rôle</label>
            <input type="text" value={currentUser?.role === "admin" ? "Administrateur" : "Utilisateur"} disabled style={inputStyle("__disabled_2", true)} />
          </div>
        </div>

        {/* Nom d'affichage */}
        <div>
          <label style={labelStyle}>Nom d'affichage</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Votre nom complet…"
            style={inputStyle("displayName")}
            onFocus={() => setFocusedField("displayName")}
            onBlur={() => setFocusedField(null)}
          />
          <p style={{ fontSize: 11, color: "#b7b6b2", margin: "5px 0 0" }}>
            Ce nom apparaîtra dans l'interface et la barre latérale.
          </p>
        </div>
      </div>

      {/* ── Sécurité ── */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Sécurité</div>
        <div>
          <label style={labelStyle}>Nouveau mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Laissez vide pour conserver l'actuel"
            style={inputStyle("password")}
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
          />
          <p style={{ fontSize: 11, color: "#b7b6b2", margin: "5px 0 0" }}>
            Entrez un nouveau mot de passe puis sauvegardez pour le modifier.
          </p>
        </div>
      </div>

      {/* ── Bouton sauvegarder ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
  onClick={save}
  disabled={saving}
  style={{
    ...btnBase,
    padding: "7px 16px",
    borderRadius: 6,
    border: `1px solid ${saving ? "#d3d3d1" : "#000"}`,
    background: saving ? "#e9e9e7" : "#000",
    fontSize: 13,
    fontWeight: 500,
    color: saving ? "#9b9a97" : "#fff",
    cursor: saving ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "background 0.12s",
  }}
  onMouseEnter={e => {
    if (!saving) e.currentTarget.style.background = "#333"; // hover gris foncé
  }}
  onMouseLeave={e => {
    if (!saving) e.currentTarget.style.background = "#000";
  }}
>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? "Sauvegarde…" : "Enregistrer les modifications"}
        </button>
      </div>

      {/* ── Gestion d'équipe ── */}
      {currentUser && !currentUser.parentId && currentUser.role !== "admin" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 10, borderBottom: "1px solid #f0f0ee" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#37352f", marginBottom: 2 }}>Gestion d'équipe</div>
              <div style={{ fontSize: 11, color: "#9b9a97" }}>Accès limités partageant vos espaces de travail</div>
            </div>
            <button
              onClick={() => openTeamForm()}
              style={{ ...btnBase, padding: "5px 12px", borderRadius: 6, border: "1px solid #e3e3e2", background: "#fff", fontSize: 12, fontWeight: 500, color: "#37352f", display: "flex", alignItems: "center", gap: 5, transition: "background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f7f7f5"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Créer un accès
            </button>
          </div>

          {loadingTeam ? (
            <div style={{ fontSize: 13, color: "#9b9a97" }}>Chargement de l'équipe…</div>
          ) : team.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", border: "1px dashed #e3e3e2", borderRadius: 6, fontSize: 13, color: "#9b9a97" }}>
              Aucun sous-compte créé pour l'instant.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0f0ee" }}>
                  <th style={{ textAlign: "left", padding: "7px 10px", fontSize: 11, fontWeight: 500, color: "#9b9a97" }}>Utilisateur</th>
                  <th style={{ textAlign: "left", padding: "7px 10px", fontSize: 11, fontWeight: 500, color: "#9b9a97" }}>Permissions</th>
                  <th style={{ padding: "7px 10px", width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {team.map((t, i) => (
                  <tr key={t._id} style={{ borderBottom: i < team.length - 1 ? "1px solid #f7f7f5" : "none" }}>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#37352f" }}>{t.displayName || "Sans nom"}</div>
                      <div style={{ fontSize: 11, color: "#9b9a97" }}>@{t.username}</div>
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {t.permissions?.canImportExcel && (
                          <span style={{ fontSize: 10, background: "#eaf3de", color: "#3b6d11", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>Excel</span>
                        )}
                        {t.permissions?.allowedDocTypes?.map(type => (
                          <span key={type} style={{ fontSize: 10, background: "#e6f1fb", color: "#185fa5", padding: "2px 7px", borderRadius: 4, fontWeight: 500 }}>{type}</span>
                        ))}
                        {(!t.permissions?.allowedDocTypes || t.permissions.allowedDocTypes.length === 0) && (
                          <span style={{ fontSize: 11, color: "#d44c47" }}>Aucun document</span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button onClick={() => openTeamForm(t)} style={{ ...btnBase, color: "#9b9a97", padding: 3, borderRadius: 4, display: "flex" }}>
                          <Edit2 style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => deleteTeamMember(t._id)} style={{ ...btnBase, color: "#d44c47", padding: 3, borderRadius: 4, display: "flex" }}>
                          <Trash2 style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal sous-compte ── */}
      {showTeamForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e3e3e2", width: "min(400px, 95vw)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", overflow: "hidden" }}>

            {/* Header modal */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0f0ee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#37352f", letterSpacing: "-0.01em" }}>
                {editingUser ? "Modifier l'accès" : "Nouvel accès"}
              </span>
              <button onClick={() => setShowTeamForm(false)} style={{ ...btnBase, width: 24, height: 24, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#9b9a97" }}>
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body modal */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={labelStyle}>Nom complet</label>
                <input type="text" value={nuDisplayName} onChange={e => setNuDisplayName(e.target.value)} placeholder="Ex : Jean Martin" style={inputStyle("nuDisplayName")} onFocus={() => setFocusedField("nuDisplayName")} onBlur={() => setFocusedField(null)} />
              </div>
              <div>
                <label style={labelStyle}>Identifiant de connexion</label>
                <input type="text" value={nuUsername} onChange={e => setNuUsername(e.target.value)} disabled={!!editingUser} placeholder="Ex : jean_reception" style={inputStyle("nuUsername", !!editingUser)} onFocus={() => !editingUser && setFocusedField("nuUsername")} onBlur={() => setFocusedField(null)} />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe {editingUser && <span style={{ color: "#b7b6b2" }}>(optionnel)</span>}</label>
                <input type="password" value={nuPassword} onChange={e => setNuPassword(e.target.value)} placeholder={editingUser ? "Laissez vide pour conserver" : "Mot de passe"} style={inputStyle("nuPassword")} onFocus={() => setFocusedField("nuPassword")} onBlur={() => setFocusedField(null)} />
              </div>

              {/* Permissions */}
              <div style={{ borderTop: "1px solid #f0f0ee", paddingTop: 14 }}>
                <label style={{ ...labelStyle, marginBottom: 10, fontSize: 12 }}>Permissions accordées</label>

                <div
                  onClick={() => setNuPerms({ ...nuPerms, canImportExcel: !nuPerms.canImportExcel })}
                  style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer", padding: "9px 11px", borderRadius: 6, border: "1px solid #f0f0ee", background: "#fafaf9" }}
                >
                  <input type="checkbox" checked={nuPerms.canImportExcel} readOnly style={{ width: 14, height: 14, accentColor: "#0f7ddb", cursor: "pointer" }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#37352f" }}>Importer des données Excel</div>
                    <div style={{ fontSize: 11, color: "#9b9a97" }}>Accès à l'assistant d'importation "3 bases"</div>
                  </div>
                </div>

                <label style={{ ...labelStyle, marginBottom: 8 }}>Types de documents consultables</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#fafaf9", padding: "11px 12px", borderRadius: 6, border: "1px solid #f0f0ee" }}>
                  {DOC_TYPES.map(type => {
                    const allowedList = nuPerms.allowedDocTypes || [];
                    const isAllowed = allowedList.includes(type);
                    return (
                      <label key={type} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={() => {
                            const nextList = isAllowed ? allowedList.filter(t => t !== type) : [...allowedList, type];
                            setNuPerms({ ...nuPerms, allowedDocTypes: nextList });
                          }}
                          style={{ width: 13, height: 13, accentColor: "#0f7ddb" }}
                        />
                        <span style={{ fontSize: 12, color: "#37352f" }}>{type}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer modal */}
            <div style={{ padding: "12px 18px", borderTop: "1px solid #f0f0ee", display: "flex", justifyContent: "flex-end", gap: 8, background: "#fafaf9" }}>
              <button onClick={() => setShowTeamForm(false)} style={{ ...btnBase, padding: "7px 14px", borderRadius: 6, border: "1px solid #e3e3e2", background: "#fff", fontSize: 13, fontWeight: 500, color: "#37352f" }}>
                Annuler
              </button>
              <button onClick={saveTeamMember} style={{ ...btnBase, padding: "7px 16px", borderRadius: 6, border: "1px solid #000000", background: "#000000", fontSize: 13, fontWeight: 500, color: "#fff", cursor: "pointer" }}>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ===========================================================
   APP ROOT
========================================================== */
export default function App() {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWs, setActiveWs] = useState(null);
  const [section, setSection] = useState("overview");
  const [sideOpen, setSideOpen] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsDataLoading, setWsDataLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);
  const [allT, setAllT] = useState({});
  const [allC, setAllC] = useState({});
  const [allD, setAllD] = useState({});
  const { show: showToast, ToastContainer } = useToast();
  const { currentUser, updateProfile, logout } = useAuth();

  const extractArray = (r, key) => {
    if (Array.isArray(r)) return r;
    if (r && Array.isArray(r[key])) return r[key];
    if (r && Array.isArray(r.data)) return r.data;
    if (r && Array.isArray(r.items)) return r.items;
    if (r && Array.isArray(r.docs)) return r.docs;
    if (r && typeof r === 'object') {
      const found = Object.values(r).find(Array.isArray);
      if (found) return found;
    }
    console.warn("Format inattendu depuis l'API:", r);
    return [];
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/workspaces");
        const ws = normArr(extractArray(res, 'workspaces'));
        setWorkspaces(ws);
        if (ws.length > 0) setActiveWs(ws[0].id);
        setApiOnline(true);
      } catch (e) {
        setApiOnline(false);
        showToast("Impossible de joindre le serveur — vérifiez que le backend tourne sur " + API_BASE, "error");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeWs) return;
    setWsDataLoading(true);
    (async () => {
      try {
        const [tasks, cands, docs] = await Promise.all([
          apiFetch(`/workspaces/${activeWs}/tasks`).then(r => {
            const all = normArr(extractArray(r, 'tasks'));
            const seen = new Map();
            all.forEach(t => {
              // Extraction intelligente du groupe pour la clé
              let grp = String(t.groupe || "").trim();
              if (!grp && t.name?.includes(" — Grp ")) grp = t.name.split(" — Grp ")[1];
              if (!grp) grp = "1";

              const key = `${(t.group || "").trim()}||${grp}`;

              // On garde la tâche la plus récente ou la première trouvée
              if (!seen.has(key)) {
                seen.set(key, t);
              }
            });
            return Array.from(seen.values());
          }),
          apiFetch(`/workspaces/${activeWs}/candidats`).then(async r => {
            // Détection pagination
            const firstPage = normArr(extractArray(r, 'candidats'));
            const total = r?.total ?? r?.count ?? null;
            const limit = r?.limit ?? firstPage.length;

            let all = [...firstPage];

            if (total && limit && total > limit) {
              const totalPages = Math.ceil(total / limit);
              const pagePromises = [];
              for (let page = 2; page <= totalPages; page++) {
                pagePromises.push(
                  apiFetch(`/workspaces/${activeWs}/candidats?page=${page}&limit=${limit}`)
                    .then(pr => normArr(extractArray(pr, 'candidats')))
                    .catch(() => [])
                );
              }
              const extraPages = await Promise.all(pagePromises);
              extraPages.forEach(p => all.push(...p));
            }

            if (!total && firstPage.length > 0 && firstPage.length <= 32) {
              try {
                const bigR = await apiFetch(`/workspaces/${activeWs}/candidats?limit=10000`);
                const bigAll = normArr(extractArray(bigR, 'candidats'));
                if (bigAll.length > firstPage.length) all = bigAll;
              } catch (e) { }
            }

            // Déduplication
            const seen = new Map();
            all.forEach(c => {
              const key = `${String(c.nom || "").trim().toLowerCase()}__${String(c.prenom || "").trim().toLowerCase()}__${(c.theme || "").trim()}__${c.groupe || ""}`;
              if (!seen.has(key)) seen.set(key, c);
            });
            return Array.from(seen.values());
          }),
          apiFetch(`/workspaces/${activeWs}/documents`).then(r => normArr(extractArray(r, 'documents'))),
        ]);
        setAllT(p => ({ ...p, [activeWs]: tasks }));
        setAllC(p => ({ ...p, [activeWs]: cands }));
        setAllD(p => ({ ...p, [activeWs]: docs }));
        setApiOnline(true);
      } catch (e) {
        setApiOnline(false);
        showToast("Erreur de chargement : " + e.message);
      }
      setWsDataLoading(false);
    })();
  }, [activeWs]);

  const ws = workspaces.find(w => w.id === activeWs);
  const currentWs = workspaces.find(w => w.id === activeWs);
  const tasks = allT[activeWs] || [], cands = allC[activeWs] || [], docs = allD[activeWs] || [];
  const mk = (setter, key) => u => setter(p => { const cur = p[key] || []; return { ...p, [key]: typeof u === "function" ? u(cur) : u }; });
  const setT = mk(setAllT, activeWs), setC = mk(setAllC, activeWs), setD = mk(setAllD, activeWs);

  const createWs = async data => {
    try {
      const raw = await apiFetch("/workspaces", {
        method: "POST",
        body: { ...data, name: data.company }
      });

      // L'API peut retourner { data: {...} } ou { workspace: {...} } ou directement l'objet
      const wsRaw = raw?.workspace || raw?.data || raw;
      const created = norm(wsRaw);

      // Forcer company depuis name si absent
      if (!created.company && created.name) created.company = created.name;

      setWorkspaces(p => [...p, created]);
      setAllT(p => ({ ...p, [created.id]: [] }));
      setAllC(p => ({ ...p, [created.id]: [] }));
      setAllD(p => ({ ...p, [created.id]: [] }));
      setActiveWs(created.id);
      setSection("overview");
    } catch (e) {
      showToast("Erreur création workspace : " + e.message);
    }
  };

  const deleteWs = async id => {
    try {
      await apiFetch(`/workspaces/${id}`, { method: "DELETE" });
      const remaining = workspaces.filter(w => w.id !== id);
      setWorkspaces(remaining);
      setAllT(p => { const n = { ...p }; delete n[id]; return n; });
      setAllC(p => { const n = { ...p }; delete n[id]; return n; });
      setAllD(p => { const n = { ...p }; delete n[id]; return n; });
      setActiveWs(remaining.length > 0 ? remaining[0].id : null);
      setSection("overview");
      showToast("Workspace supprimé", "success");
    } catch (e) { showToast("Erreur suppression workspace : " + e.message); }
  };

  // Dans App.js
const updateWs = updatedRaw => {
  const updated = norm(updatedRaw); // S'assurer que norm() gère hasExportBase
  
  setWorkspaces(prevWorkspaces => {
    // On crée un NOUVEAU tableau (important pour que React voit le changement)
    return prevWorkspaces.map(w => {
      if (w.id === updated.id) {
        return { ...w, ...updated }; // On remplace par les nouvelles données du serveur
      }
      return w;
    });
  });
};


  const navLabel = NAV.find(n => n.key === section)?.label || (section === "profile" ? "Mon Profil" : "");

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fff", gap: 12 }}>
      <Spinner size={24} color={T.accent} />
      <span style={{ fontSize: 15, color: T.pageSub, fontFamily: "-apple-system,'Segoe UI',sans-serif" }}>Connexion au serveur…</span>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#fff", fontFamily: "-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif", overflow: "hidden" }}>
      <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(55,53,47,0.18);border-radius:99px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(55,53,47,0.32);}
        input[type=date]::-webkit-calendar-picker-indicator{opacity:0.4;cursor:pointer;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <ToastContainer />
      {showCreate && <WsModal onClose={() => setShowCreate(false)} onCreate={createWs} />}
      <Sidebar workspaces={workspaces} activeWs={activeWs} onSelectWs={id => { setActiveWs(id); setSection("overview"); }} section={section} onSection={setSection} onCreateWs={() => setShowCreate(true)} open={sideOpen} apiOnline={apiOnline} currentUser={currentUser} onLogout={logout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginLeft: sideOpen ? 240 : 0, transition: "margin-left 0.2s ease", minWidth: 0, overflow: "hidden" }}>
        <div style={{ height: 44, display: "flex", alignItems: "center", padding: "0 12px", gap: 2, flexShrink: 0, borderBottom: `1px solid ${T.pageBdr}`, background: "#fff" }}>
          <button onClick={() => setSideOpen(v => !v)} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, border: "none", background: "transparent", cursor: "pointer", color: T.pageTer }} onMouseEnter={e => e.currentTarget.style.background = T.pageHov} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{sideOpen ? <PanelLeftClose style={{ width: 15, height: 15 }} /> : <PanelLeftOpen style={{ width: 15, height: 15 }} />}</button>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: T.pageSub, marginLeft: 4 }}>
            {ws && <><span style={{ color: T.pageSub }}>{ws.company}</span><ChevronRight style={{ width: 11, height: 11, color: T.pageTer, flexShrink: 0 }} /></>}
            <span style={{ color: T.pageText, fontWeight: 500 }}>{navLabel}</span>
          </div>
          {!apiOnline && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 4, background: "rgba(212,76,71,0.08)", border: `1px solid rgba(212,76,71,0.2)` }}><AlertCircle style={{ width: 12, height: 12, color: "#d44c47" }} /><span style={{ fontSize: 11, color: "#d44c47", fontWeight: 500 }}>Hors ligne</span></div>}
          {wsDataLoading && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.pageSub }}><Spinner size={13} color={T.accent} />Chargement…</div>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          <div style={{ display: section === "overview" ? "block" : "none" }}>
            <Overview ws={ws} tasks={tasks} candidats={cands} documents={docs} onSection={setSection} loading={wsDataLoading} onDeleteWs={deleteWs} onUpdateWs={updateWs} />
          </div>
          <div style={{ display: section === "gantt" ? "block" : "none" }}>
            <GanttView 
            wsWorkingDays={currentWs?.workingDays}
            wsSkipHolidays={currentWs?.skipHolidays}
wsVacances={currentWs?.vacances}
onUpdateWs={updatedWs => setWorkspaces(prev => prev.map(w => w.id === updatedWs.id ? updatedWs : w))}
  tasks={tasks} 
  setTasks={setT} 
  setCandidats={setC} // Ajouté
  setDocuments={setD} // Ajouté
  wsId={activeWs} 
  showToast={showToast} 
  candidats={cands} 
/>
          </div>
          <div style={{ display: section === "candidats" ? "block" : "none", flex: 1, overflowY: "auto", position: "relative" }}>
            <CandidatsView currentUser={currentUser} candidats={cands} setCandidats={setC} tasks={tasks} setTasks={setT} ws={ws} wsId={activeWs} showToast={showToast} setDocuments={setD} onUpdateWs={updateWs} />
          </div>
          <div style={{ display: section === "documents" ? "block" : "none", flex: 1, overflowY: "auto", position: "relative" }}>
            <DocsView currentUser={currentUser} documents={docs} candidats={cands} tasks={tasks} setDocuments={setD} wsId={activeWs} showToast={showToast} />
          </div>
          <div style={{ display: section === "profile" ? "block" : "none", flex: 1, overflowY: "auto", position: "relative" }}>
            <ProfileView currentUser={currentUser} onSave={updateProfile} showToast={showToast} />
          </div>
        </div>
      </div>
    </div>
  );
}