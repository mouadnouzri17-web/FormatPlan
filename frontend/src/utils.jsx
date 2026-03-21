import React from "react";
import { FileText, BarChart2, User, Receipt, Presentation, File } from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   API CONFIG
══════════════════════════════════════════════════════════ */
export const API_BASE = (typeof import_meta_env !== "undefined" && import_meta_env?.VITE_API_URL) || "https://sparkling-empathy-production-05b3.up.railway.app/api";

export function norm(o) {
  if (!o) return o;
  const out = { ...o, id: o._id || o.id };
  if (out.extraData && typeof out.extraData === "object" && !Array.isArray(out.extraData)) {} else { out.extraData = {}; }
  return out;
}
export const normArr = a => (Array.isArray(a) ? a :[]).map(norm);

export async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
    body: opts.body !== undefined ? (typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
══════════════════════════════════════════════════════════ */
export const T = {
  sidebarBg:"#ffffff",sidebarText:"#37352f",sidebarSub:"#787774",
  sidebarHov:"rgba(55,53,47,0.06)",sidebarSel:"rgba(55,53,47,0.10)",
  sidebarBdr:"rgba(55,53,47,0.09)",pageBg:"#ffffff",pageText:"#37352f",
  pageSub:"#6b6b6b",pageTer:"#9b9a97",pageBdr:"rgba(55,53,47,0.09)",
  pageHov:"rgba(55,53,47,0.04)",pageInput:"rgba(55,53,47,0.04)",accent:"#0f7ddb",
  tagGray:  {text:"#787774",bg:"rgba(227,226,224,0.5)",bd:"rgba(55,53,47,0.1)"},
  tagBrown: {text:"#9f6b53",bg:"rgba(238,224,218,0.5)",bd:"rgba(159,107,83,0.2)"},
  tagOrange:{text:"#d9730d",bg:"rgba(250,222,201,0.5)",bd:"rgba(217,115,13,0.2)"},
  tagYellow:{text:"#cb912f",bg:"rgba(253,236,200,0.5)",bd:"rgba(203,145,47,0.2)"},
  tagGreen: {text:"#448361",bg:"rgba(219,237,219,0.5)",bd:"rgba(68,131,97,0.2)"},
  tagBlue:  {text:"#337ea9",bg:"rgba(211,229,239,0.5)",bd:"rgba(51,126,169,0.2)"},
  tagPurple:{text:"#9065b0",bg:"rgba(232,222,238,0.5)",bd:"rgba(144,101,176,0.2)"},
  tagPink:  {text:"#c14c8a",bg:"rgba(245,224,233,0.5)",bd:"rgba(193,76,138,0.2)"},
  tagRed:   {text:"#d44c47",bg:"rgba(253,224,220,0.5)",bd:"rgba(212,76,71,0.2)"},
};
export const PALETTE_CYCLE=["tagPurple","tagOrange","tagGreen","tagBlue","tagRed","tagPink","tagBrown","tagYellow"];
const grpMap={};let grpIdx=0;
export function grpTag(g){if(!g)return T.tagGray;if(!grpMap[g]){grpMap[g]=T[PALETTE_CYCLE[grpIdx%PALETTE_CYCLE.length]];grpIdx++;}return grpMap[g];}
export function Tag({label,scheme}){const s=scheme||T.tagGray;return(<span style={{display:"inline-flex",alignItems:"center",padding:"1px 7px",borderRadius:3,fontSize:11,fontWeight:500,color:s.text,background:s.bg,whiteSpace:"nowrap",letterSpacing:"0.01em",lineHeight:1.6}}>{label}</span>);}

/* ═══════════════════════════════════════════════════════════
   HOLIDAYS & DATE HELPERS
══════════════════════════════════════════════════════════ */
export const HRAW=[["2025-01-01","Nouvel An"],["2025-01-11","Manifeste"],["2025-01-14","Nouvel An Amazigh"],["2025-03-31","Aïd Al Fitr",1],["2025-04-01","Aïd Al Fitr J2",1],["2025-05-01","Fête du Travail"],["2025-06-06","Aïd Al Adha",1],["2025-06-07","Aïd Al Adha J2",1],["2025-06-27","1er Moharram",1],
  ["2025-07-30","Fête du Trône"],["2025-08-14","Oued Eddahab"],["2025-08-20","Révolution du Roi"],["2025-08-21","Fête de la Jeunesse"],["2025-09-05","Aïd Al Mawlid",1],["2025-09-06","Aïd Al Mawlid J2",1],
  ["2025-11-06","Marche Verte"],["2025-11-18","Fête de l'Indépendance"],["2026-01-01","Nouvel An"],["2026-01-11","Manifeste"],["2026-01-14","Nouvel An Amazigh"],["2026-03-20","Aïd Al Fitr",1],["2026-03-21","Aïd Al Fitr J2",1],["2026-05-01","Fête du Travail"],["2026-05-27","Aïd Al Adha",1],["2026-05-28","Aïd Al Adha J2",1],["2026-06-17","1er Moharram",1],
  ["2026-07-30","Fête du Trône"],["2026-08-14","Oued Eddahab"],["2026-08-20","Révolution du Roi"],["2026-08-21","Fête de la Jeunesse"],["2026-08-25","Aïd Al Mawlid",1],["2026-08-26","Aïd Al Mawlid J2",1],
  ["2026-11-06","Marche Verte"],["2026-11-18","Fête de l'Indépendance"],
];
export const HMAP={};HRAW.forEach(([d,t,r])=>{HMAP[d]={title:t,religious:!!r};});
export const MFR=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
export const pd=s=>s instanceof Date?s:new Date(s+"T00:00:00");
export const ad=(d,n)=>{const r=d instanceof Date?new Date(d):new Date(d+"T00:00:00");r.setDate(r.getDate()+n);return r;};
export const gdb=(a,b)=>Math.round((b-a)/864e5);
export const d2s=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const fmt=s=>{if(!s)return"—";const d=pd(s);return`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(-2)}`;};
export const fmtFr=s=>{if(!s)return"—";const d=pd(s);return`${d.getDate()} ${MFR[d.getMonth()].slice(0,3).toLowerCase()}. ${d.getFullYear()}`;};
export const uid=()=>Math.random().toString(36).slice(2,9);
export function isVac(d,vacs){if(!vacs||!vacs.length)return false;const ds=d2s(d);return vacs.some(v=>v.start&&v.end&&ds>=v.start&&ds<=v.end);}
export function isOff(d,wd,sh,vacs=[]){return wd.includes(d.getDay())||(sh&&!!HMAP[d2s(d)])||isVac(d,vacs);}
export function calcWD(s,e,wd,sh,vacs=[]){if(!s||!e)return 1;const sd=pd(s),ed=pd(e);if(sd>ed)return 1;let c=0,cur=new Date(sd);while(cur<=ed){if(!isOff(cur,wd,sh,vacs))c++;cur.setDate(cur.getDate()+1);}return Math.max(1,c);}
export function addWD(start,n,wd,sh,vacs=[]){if(!start)return start;let cur=pd(start),s=0;while(isOff(cur,wd,sh,vacs)&&s++<60)cur=ad(cur,1);let rem=Math.max(1,Math.round(n))-1;while(rem>0){cur=ad(cur,1);if(!isOff(cur,wd,sh,vacs))rem--;}return d2s(cur);}
export function snap(ds,wd,sh,vacs=[]){let d=pd(ds),s=0;while(isOff(d,wd,sh,vacs)&&s++<60)d=ad(d,1);return d2s(d);}
export function autoProgress(task,wd,sh,vacs=[]){const now=new Date();now.setHours(0,0,0,0);const s=pd(task.start),e=pd(task.end),tot=calcWD(task.start,task.end,wd,sh,vacs);if(now<s)return{pct:0,elapsed:0,total:tot};if(now>e)return{pct:100,elapsed:tot,total:tot};const el=Math.min(tot,calcWD(task.start,d2s(now),wd,sh,vacs));return{pct:tot>0?Math.round(el/tot*100):0,elapsed:el,total:tot};}
export function moveSnap(os,oe,delta,wd,sh,vacs=[]){const w=calcWD(os,oe,wd,sh,vacs),ns=snap(d2s(ad(pd(os),delta)),wd,sh,vacs);return{start:ns,end:addWD(ns,w,wd,sh,vacs)};}
export function rezEnd(os,oe,delta,wd,sh,vacs=[]){const raw=d2s(ad(pd(oe),delta)),min=addWD(os,1,wd,sh,vacs);return snap(pd(raw)<pd(min)?min:raw,wd,sh,vacs);}
export function rezStart(os,oe,delta,wd,sh,vacs=[]){const raw=d2s(ad(pd(os),delta)),max=d2s(ad(pd(oe),-1));return snap(pd(raw)>=pd(oe)?max:raw,wd,sh,vacs);}
export function distributeBalanced(candidates, perGroup) {
  const pg = Math.max(1, parseInt(perGroup) || 15);
  const total = candidates.length;
  const nbGroups = Math.ceil(total / pg);
  const baseSize = Math.floor(total / nbGroups);
  const remainder = total % nbGroups;
  const result =[];
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

export function fmtRangeShort(ws){if(!ws)return"";if(ws.startDate&&ws.endDate){const s=pd(ws.startDate),e=pd(ws.endDate);return`${String(s.getDate()).padStart(2,"0")}/${String(s.getMonth()+1).padStart(2,"0")} → ${String(e.getDate()).padStart(2,"0")}/${String(e.getMonth()+1).padStart(2,"0")}/${e.getFullYear().toString().slice(-2)}`;}return"";}
export function fmtRange(ws){if(!ws)return"";if(ws.startDate&&ws.endDate)return`${fmtFr(ws.startDate)} → ${fmtFr(ws.endDate)}`;return"";}

/* ═══════════════════════════════════════════════════════════
   CONSTANTS (GANTT, CANDIDATS, DOCS)
══════════════════════════════════════════════════════════ */
export const ZOOMS=[{label:"Semaine",days:7,cw:96},{label:"2 semaines",days:14,cw:52},{label:"Mois",days:30,cw:28},{label:"Trimestre",days:90,cw:13}];
export const GCOLS=[{key:"group",label:"Thème",w:280},{key:"groupe",label:"Grp",w:52},{key:"wdays",label:"Jours",w:52},{key:"start",label:"Début",w:88},{key:"prog",label:"Avancement",w:100},{key:"end",label:"Fin",w:88}];
export const CHDR={group:"flex-start",groupe:"center",wdays:"center",start:"center",prog:"flex-start",end:"center"};
export const GTOT=GCOLS.reduce((s,c)=>s+c.w,0);
export const RH=34;
export const C_STATUS=[{key:"Reçu",...T.tagGray},{key:"En cours",...T.tagYellow},{key:"Retenu",...T.tagGreen},{key:"Refusé",...T.tagRed}];
export const DOC_TYPES=["Contrat","Rapport","CV","Facture","Présentation","Autre"];
export const DOC_ICON={Contrat:FileText,Rapport:BarChart2,CV:User,Facture:Receipt,Présentation:Presentation,Autre:File};
export const DOC_COLOR={Contrat:"#337ea9",Rapport:"#9065b0",CV:"#448361",Facture:"#cb912f",Présentation:"#c14c8a",Autre:"#787774"};
export function DocIcon({type,size=15,style={}}){const Icon=DOC_ICON[type]||File;const color=DOC_COLOR[type]||"#787774";return<Icon style={{width:size,height:size,color,strokeWidth:1.8,flexShrink:0,...style}}/>;}
export const DOC_STATUS=[{key:"Reçu",...T.tagGray},{key:"En attente",...T.tagYellow},{key:"Validé",...T.tagGreen},{key:"Rejeté",...T.tagRed}];