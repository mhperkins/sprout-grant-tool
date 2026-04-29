"use client";

/**
 * GrantManagerV2.jsx  — Sprout Society Grant Manager
 * Clean rewrite: Supabase-native storage, no window.storage dependency.
 *
 * Tables used:
 *   sprout_grants   → id (text PK), data (jsonb), updated_at (timestamptz)
 *   sprout_profile  → id (text PK), data (jsonb), updated_at (timestamptz)
 *   sprout_contacts → id (text PK), data (jsonb), updated_at (timestamptz)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

/* ─── Utility functions — defined first so every component can use them ─────── */

const uid = () => Math.random().toString(36).slice(2, 10);

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.round(diff / 86400000);
};

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
};

const fmtMoney = (val) => {
  const n = Number(val);
  if (!n) return "—";
  return "$" + n.toLocaleString();
};

const completion = (questions = []) => {
  const total    = questions.length;
  const answered = questions.filter(q => (q.draft || "").trim().length > 20).length;
  const gaps     = questions.filter(q => /\[.+?\]/.test(q.draft || "")).length;
  return { total, answered, gaps };
};

const countGaps = (text = "") => (text.match(/\[.+?\]/g) || []).length;

/* ─── Brand Styles (Sprout Society 2023 Identity Guide) ────────────────────── */
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --black:      #030000;
    --white:      #F7F7F6;
    --cyan:       #73C4D6;
    --fuchsia:    #E10098;
    --acid:       #C6C902;
    --banana:     #FAD100;
    --cyan-lt:    #C7E7EF;
    --acid-lt:    #E9E99A;
    --fuchsia-lt: #FFCDF0;
    --banana-lt:  #FEF4C1;
    --g50:  #F9FAFB; --g100: #F3F4F6; --g200: #E5E7EB;
    --g300: #D1D5DB; --g400: #9CA3AF; --g600: #4B5563; --g800: #1F2937;
    --sh-sm: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04);
    --sh:    0 4px 14px rgba(0,0,0,0.08);
    --sh-lg: 0 12px 40px rgba(0,0,0,0.13);
  }

  body { font-family: 'Lato', sans-serif; background: var(--white); color: var(--black); line-height: 1.5; }
  .app { display: flex; height: 100vh; overflow: hidden; }
  /* ── Sidebar ── */
  .sb { width: 216px; min-width: 216px; background: var(--black); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; z-index: 100; }
  .sb-brand { padding: 20px 18px 16px; border-bottom: 1px solid rgba(247,247,246,0.07); }
  .sb-name  { font-size: 11px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; color: var(--white); }
  .sb-sub   { font-size: 9px; color: var(--cyan); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; }
  .sb-nav   { padding: 10px; flex: 1; }
  .sb-sect  { font-size: 8px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(247,247,246,0.22); padding: 0 8px; margin: 14px 0 4px; }
  .sb-item  { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; cursor: pointer; color: rgba(247,247,246,0.5); font-size: 12px; font-weight: 700; transition: all 0.12s; margin-bottom: 1px; letter-spacing: 0.02em; }
  .sb-item:hover { background: rgba(247,247,246,0.07); color: var(--white); }
  .sb-item.on    { background: var(--cyan); color: var(--black); }
  .sb-badge { margin-left: auto; background: var(--fuchsia); color: #fff; border-radius: 10px; padding: 1px 6px; font-size: 9px; font-weight: 900; min-width: 18px; text-align: center; }
  .sb-item.on .sb-badge { background: var(--black); color: var(--white); }
  .sb-foot  { padding: 12px 18px 16px; border-top: 1px solid rgba(247,247,246,0.06); margin-top: auto; }
  .sb-foot-txt { font-size: 8px; color: rgba(247,247,246,0.18); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; line-height: 1.7; }

  /* ── Layout ── */
  .main  { margin-left: 216px; flex: 1; overflow-y: auto; height: 100vh; }  .page  { padding: 30px 32px; max-width: 1100px; }
  .pg-hd { margin-bottom: 24px; display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .pg-ttl { font-size: 23px; font-weight: 900; letter-spacing: -0.01em; }
  .pg-sub { font-size: 12px; color: var(--g600); margin-top: 3px; }

  /* ── Stats ── */
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 22px; }
  .stat  { background: #fff; border-radius: 10px; padding: 15px 17px; border: 1.5px solid var(--g200); }
  .stat-lbl  { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--g400); margin-bottom: 5px; }
  .stat-val  { font-size: 25px; font-weight: 900; color: var(--black); }
  .stat-meta { font-size: 11px; color: var(--g600); margin-top: 2px; }

  /* ── Pipeline table ── */
  .pipe-wrap { background: #fff; border-radius: 12px; border: 1.5px solid var(--g200); overflow-x: auto; box-shadow: var(--sh-sm); }
  .gt-name   { font-size: 13px; font-weight: 700; color: var(--black); margin-bottom: 1px; }
  .gt-funder { font-size: 11px; color: var(--g400); }
  .gt-amt    { font-size: 13px; font-weight: 700; }
  .dl-urgent { color: #C00; font-weight: 700; font-size: 11px; }
  .dl-soon   { color: #885500; font-weight: 700; font-size: 11px; }
  .dl-ok     { color: var(--g600); font-size: 11px; }
  .dl-na     { color: var(--g400); font-size: 11px; }
  .dl-day    { font-size: 10px; font-weight: 700; }
.pipe-row { display: flex; align-items: center; gap: 12px; padding: 13px 16px; border-bottom: 1px solid var(--g100); cursor: pointer; transition: background 0.1s; }
.pipe-row:hover { background: rgba(115,196,214,0.06); }
.pipe-head { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-bottom: 1.5px solid var(--g200); background: var(--g50); }
.pipe-head span { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--g400); }
.col-name     { flex: 2; min-width: 0; }
.col-status   { flex: 1.2; min-width: 0; }
.col-amount   { width: 80px; flex-shrink: 0; }
.col-deadline { width: 100px; flex-shrink: 0; }
.col-progress { flex: 1.5; min-width: 80px; }
.col-brief    { width: 70px; flex-shrink: 0; }
.col-next     { flex: 2; min-width: 0; font-size: 11px; color: var(--g600); }
.col-actions  { width: 60px; flex-shrink: 0; }


  /* ── Tags ── */
  .tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap; }
  .t-not_started { background: var(--banana-lt); color: #7a5c00; }
  .t-in_progress  { background: var(--cyan-lt); color: #155e6e; }
  .t-submitted    { background: var(--fuchsia-lt); color: #800055; }
  .t-awarded      { background: var(--acid-lt); color: #3a3d00; }
  .t-rejected     { background: var(--g100); color: var(--g600); }
  .t-future       { background: var(--g200); color: var(--g600); }

  /* ── Buttons ── */
  .btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 7px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; font-family: 'Lato', sans-serif; transition: all 0.12s; letter-spacing: 0.02em; white-space: nowrap; }
  .btn-blk:hover  { background: var(--g800); transform: translateY(-1px); }
  .btn-blk   { background: var(--black); color: var(--white); }
  .btn-cyan  { background: var(--cyan); color: var(--black); }
  .btn-cyan:hover  { filter: brightness(1.07); }
  .btn-acid  { background: var(--acid); color: var(--black); }
  .btn-acid:hover  { filter: brightness(1.07); }
  .btn-fuch  { background: var(--fuchsia); color: #fff; }
  .btn-fuch:hover  { filter: brightness(1.1); }
  .btn-ghost { background: transparent; color: var(--g600); border: 1.5px solid var(--g200); }
  .btn-ghost:hover { border-color: var(--g400); color: var(--black); }
  .btn-danger { background: #FEE2E2; color: #B91C1C; }
  .btn-danger:hover { background: #FECACA; }
  .btn-sm { padding: 5px 10px; font-size: 11px; border-radius: 5px; }
  .btn-xs { padding: 3px 7px; font-size: 10px; border-radius: 4px; }
  .btn:disabled { opacity: 0.38; cursor: not-allowed; transform: none !important; filter: none !important; }

  /* ── Forms ── */
  .fg  { margin-bottom: 13px; }
  .fl  { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g600); margin-bottom: 4px; }
  .fi,.fs,.fta { width: 100%; padding: 8px 11px; border: 1.5px solid var(--g200); border-radius: 6px; font-size: 13px; font-family: 'Lato', sans-serif; color: var(--black); background: #fff; outline: none; transition: border-color 0.12s; }
  .fi:focus,.fs:focus,.fta:focus { border-color: var(--cyan); box-shadow: 0 0 0 2px rgba(115,196,214,0.15); }
  .fta  { resize: vertical; min-height: 80px; line-height: 1.6; }
  .frow  { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
  .frow3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 11px; }
  .form-hint { font-size: 11px; color: var(--g400); margin-top: 3px; }

  /* ── Cards ── */
  .card    { background: #fff; border-radius: 11px; border: 1.5px solid var(--g200); margin-bottom: 12px; box-shadow: var(--sh-sm); }
  .card-hd { padding: 13px 17px; border-bottom: 1px solid var(--g100); display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .card-ttl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g600); }
  .card-bd { padding: 15px 17px; }

  /* ── Workspace header ── */
  .ws-hd    { background: #fff; border-radius: 12px; border: 1.5px solid var(--g200); padding: 18px 22px; margin-bottom: 14px; box-shadow: var(--sh-sm); }
  .ws-top   { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
  .ws-name  { font-size: 19px; font-weight: 900; letter-spacing: -0.01em; }
  .ws-funder { font-size: 12px; color: var(--g600); margin-top: 2px; }
  .ws-meta  { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; padding-top: 10px; border-top: 1px solid var(--g100); }
  .ws-mi    { font-size: 11px; color: var(--g600); }
  .ws-mi strong { color: var(--black); font-weight: 700; }
  .ws-mi a  { color: var(--cyan); font-weight: 700; text-decoration: none; }
  .ws-mi a:hover { text-decoration: underline; }

  /* ── Framing banner ── */
  .framing     { background: linear-gradient(to right, rgba(199,231,239,0.5), rgba(199,231,239,0.05)); border: 1.5px solid var(--cyan); border-radius: 10px; padding: 13px 16px; margin-bottom: 16px; }
  .framing-lbl { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: var(--g600); margin-bottom: 4px; }
  .framing-txt { font-size: 12px; line-height: 1.7; color: var(--black); }

  /* ── Tabs ── */
  .tabs { display: flex; border-bottom: 2px solid var(--g200); margin-bottom: 18px; gap: 1px; }
  .tab  { padding: 8px 14px; border: none; background: transparent; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--g400); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: 'Lato', sans-serif; transition: all 0.12s; }
  .tab:hover { color: var(--black); }
  .tab.on    { color: var(--black); border-bottom-color: var(--cyan); }

  /* ── Completion tracker ── */
  .tracker  { background: #fff; border-radius: 10px; border: 1.5px solid var(--g200); padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; box-shadow: var(--sh-sm); }
  .tr-stat  { font-size: 11px; color: var(--g600); }
  .tr-stat strong { color: var(--black); font-weight: 900; }
  .tr-bar   { flex: 1; min-width: 80px; height: 5px; background: var(--g200); border-radius: 3px; overflow: hidden; }
  .tr-fill  { height: 100%; border-radius: 3px; background: linear-gradient(to right, var(--cyan), var(--acid)); transition: width 0.4s ease; }
  .tr-gaps  { background: var(--banana-lt); color: #7a5c00; border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 700; }
  .tr-tools { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; align-items: center; }

  /* ── Question editor ── */
  .qe          { background: #fff; border-radius: 11px; border: 1.5px solid var(--g200); margin-bottom: 12px; transition: border-color 0.15s, box-shadow 0.15s; }
  .qe:focus-within { border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(115,196,214,0.12); }
  .qe-hd       { padding: 13px 16px 8px; }
  .qe-cat      { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--g400); margin-bottom: 4px; }
  .qe-q        { font-size: 13px; font-weight: 700; color: var(--black); line-height: 1.5; }
  .qe-hint     { font-size: 11px; color: var(--g600); font-style: italic; margin-top: 3px; }
  .qe-bd       { padding: 2px 16px 0; }
  .qe-ta       { width: 100%; border: none; outline: none; resize: none; font-size: 13px; font-family: 'Lato', sans-serif; line-height: 1.75; color: var(--black); min-height: 110px; background: transparent; padding: 6px 0 8px; }
  .qe-ft       { padding: 7px 16px; border-top: 1px solid var(--g100); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .cc          { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
  .cc-ok       { color: var(--g400); background: var(--g100); }
  .cc-warn     { color: #885500; background: var(--banana-lt); }
  .cc-over     { color: #B91C1C; background: #FEE2E2; }
  .gap-badge   { background: var(--banana-lt); color: #7a5c00; border-radius: 4px; padding: 2px 6px; font-size: 9px; font-weight: 700; }
  .qe-actions  { display: flex; gap: 5px; margin-left: auto; }

  /* ── Tasks ── */
  .task      { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--g100); }
  .task:last-child { border-bottom: none; }
  .task-chk  { width: 17px; height: 17px; border-radius: 50%; border: 2px solid var(--g300); cursor: pointer; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 8px; transition: all 0.12s; }
  .task-chk.done { background: var(--acid); border-color: var(--acid); color: var(--black); }
  .task-info { flex: 1; min-width: 0; }
  .task-txt  { font-size: 13px; line-height: 1.5; }
  .task-txt.done { text-decoration: line-through; color: var(--g400); }
  .task-meta { display: flex; gap: 8px; align-items: center; margin-top: 2px; }
  .task-due  { font-size: 10px; color: var(--g400); }
  .pri-high  { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #B91C1C; background: #FEE2E2; padding: 1px 5px; border-radius: 3px; }
  .pri-med   { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #854D0E; background: var(--banana-lt); padding: 1px 5px; border-radius: 3px; }
  .pri-low   { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #166534; background: #DCFCE7; padding: 1px 5px; border-radius: 3px; }

  /* ── Contacts ── */
  .contact-card { background: #fff; border-radius: 10px; border: 1.5px solid var(--g200); padding: 13px 15px; margin-bottom: 8px; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .c-name  { font-size: 13px; font-weight: 700; margin-bottom: 1px; }
  .c-meta  { font-size: 11px; color: var(--g600); }
  .c-notes { font-size: 11px; color: var(--g400); margin-top: 4px; font-style: italic; }

  /* ── Research Brief ── */
  .brief-empty      { border: 2px dashed var(--g300); border-radius: 12px; padding: 36px 24px; text-align: center; }
  .brief-empty-ico  { font-size: 28px; margin-bottom: 8px; }
  .brief-empty-ttl  { font-size: 14px; font-weight: 900; color: var(--black); margin-bottom: 6px; }
  .brief-empty-txt  { font-size: 12px; color: var(--g600); max-width: 380px; margin: 0 auto 18px; line-height: 1.6; }
  .brief-body       { font-size: 12.5px; line-height: 1.75; color: var(--black); white-space: pre-wrap; word-break: break-word; }
  .brief-meta       { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--g400); margin-bottom: 10px; }
  .brief-status.has  { background: rgba(198,201,2,0.15); color: #5a5c00; border-radius: 20px; padding: 3px 9px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .brief-status.none { background: var(--g100); color: var(--g600); border-radius: 20px; padding: 3px 9px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .brief-actions    { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }

  /* ── Import ── */
  .import-tabs { display: flex; gap: 0; margin-bottom: 16px; background: var(--g100); border-radius: 8px; padding: 3px; width: fit-content; }
  .import-tab  { padding: 6px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; color: var(--g600); transition: all 0.12s; border: none; background: transparent; font-family: 'Lato', sans-serif; }
  .import-tab.on { background: #fff; color: var(--black); box-shadow: var(--sh-sm); }
  .import-zone   { border: 2px dashed var(--g300); border-radius: 12px; padding: 20px; background: #fff; transition: border-color 0.15s; }
  .import-zone.active { border-color: var(--cyan); }
  .import-ta  { width: 100%; min-height: 240px; border: none; outline: none; font-size: 12px; font-family: 'Courier New', monospace; line-height: 1.6; color: var(--black); background: transparent; resize: vertical; }
  .import-lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g400); margin-bottom: 8px; display: block; }
  .preview-card   { background: linear-gradient(to bottom right, rgba(115,196,214,0.08), rgba(198,201,2,0.05)); border: 1.5px solid var(--cyan); border-radius: 12px; padding: 18px 20px; margin-top: 14px; }
  .preview-name   { font-size: 16px; font-weight: 900; margin-bottom: 4px; }
  .preview-funder { font-size: 12px; color: var(--g600); margin-bottom: 10px; }
  .preview-row    { display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 6px; }
  .preview-item   { font-size: 11px; color: var(--g600); }
  .preview-item strong { color: var(--black); font-weight: 700; }

  /* ── Modal ── */
  .mover { position: fixed; inset: 0; background: rgba(3,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 400; padding: 20px; animation: fIn 0.15s ease; }
  @keyframes fIn { from { opacity: 0; } to { opacity: 1; } }
  .modal      { background: #fff; border-radius: 14px; width: 100%; max-width: 540px; max-height: 88vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.18); animation: sUp 0.18s ease; }
  .modal-wide { max-width: 680px; }
  @keyframes sUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .m-hd  { padding: 17px 21px 13px; border-bottom: 1px solid var(--g200); display: flex; justify-content: space-between; align-items: center; }
  .m-ttl { font-size: 14px; font-weight: 900; }
  .m-close { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--g400); padding: 0 3px; line-height: 1; }
  .m-close:hover { color: var(--black); }
  .m-bd  { padding: 17px 21px; }
  .m-ft  { padding: 13px 21px; border-top: 1px solid var(--g200); display: flex; justify-content: flex-end; gap: 8px; }

  /* ── Misc ── */
  .export-area { background: var(--g50); border-radius: 8px; padding: 14px; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.9; white-space: pre-wrap; word-break: break-word; max-height: 500px; overflow-y: auto; color: var(--black); border: 1.5px solid var(--g200); }
  .toast  { position: fixed; bottom: 22px; right: 22px; padding: 11px 17px; border-radius: 8px; font-size: 13px; font-weight: 700; z-index: 9999; box-shadow: var(--sh-lg); animation: tIn 0.22s ease; }
  .t-ok   { background: var(--black); color: var(--white); }
  .t-err  { background: #B91C1C; color: #fff; }
  @keyframes tIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .empty      { text-align: center; padding: 52px 20px; }
  .empty-ico  { font-size: 34px; margin-bottom: 12px; }
  .empty-ttl  { font-size: 15px; font-weight: 900; color: var(--g600); margin-bottom: 6px; }
  .empty-txt  { font-size: 12px; color: var(--g400); max-width: 300px; margin: 0 auto 16px; line-height: 1.6; }
  .v-item     { background: var(--g50); border-radius: 7px; padding: 10px 12px; margin-bottom: 7px; cursor: pointer; border: 1.5px solid transparent; transition: all 0.12s; }
  .v-item:hover { border-color: var(--cyan); background: rgba(115,196,214,0.06); }
  .v-meta     { font-size: 9px; color: var(--g400); margin-bottom: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
  .v-prev     { font-size: 11px; color: var(--g600); line-height: 1.5; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .add-row    { background: var(--g50); border-radius: 8px; padding: 12px; border: 1.5px dashed var(--g300); margin-top: 10px; }
  .notes-ta   { width: 100%; min-height: 200px; padding: 12px; border: 1.5px solid var(--g200); border-radius: 8px; font-size: 13px; font-family: 'Lato', sans-serif; line-height: 1.7; color: var(--black); background: #fff; outline: none; resize: vertical; }
  .notes-ta:focus { border-color: var(--cyan); box-shadow: 0 0 0 2px rgba(115,196,214,0.15); }
  .sect-lbl   { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--g600); margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid var(--g200); }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: var(--g300); border-radius: 5px; }
  @media (max-width: 820px) {
    .main { margin-left: 0; }
    .sb   { display: none; }
    .stats { grid-template-columns: 1fr 1fr; }
    .frow,.frow3 { grid-template-columns: 1fr; }
    .page { padding: 18px; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const STATUS_LABELS = {
  not_started: "Not Started", in_progress: "In Progress",
  submitted:   "Submitted",   awarded:     "Awarded 🏆",
  rejected:    "Not Funded",  future:      "Future Pipeline",
};

const DEFAULT_ORG = {
  orgName: "Sprout Society Inc.", legalName: "Sprout Society Inc.",
  ein: "83-1298420", address: "449 Troutman St, Brooklyn NY 11237",
  website: "sproutsociety.org", founded: "2019",
  annualBudget: "", numStaff: "", numVolunteers: "",
  mission: "Building community and peer connection for mental wellness; combating the loneliness epidemic.",
  programs: "Free community space for events and groups; peer support resources and third-space programming; fundraising support for community orgs; online calendar/portal for community builders.",
  population: "Adults experiencing loneliness, isolation, or depression; young adults 19–35; Brooklyn/NYC residents; underserved communities.",
  serviceArea: "Brooklyn, NY / New York City",
  outcomes: "", contactName: "", contactTitle: "", contactEmail: "", contactPhone: "",
  instagram: "https://www.instagram.com/sproutsocietyorg/",
};

const TEMPLATE_QUESTIONS = {
  general: [
    { category: "narrative", question: "Please describe your organization's mission, history, and the community you serve.", hint: "Write accessibly — for community members, not grant professionals.", charLimit: 2000 },
    { category: "narrative", question: "What specific programs or activities will this grant support?", hint: "Be concrete about what happens on the ground.", charLimit: 1500 },
    { category: "impact",    question: "How will you measure the success of this work? What outcomes do you expect?", hint: "Use specific numbers where possible.", charLimit: 1000 },
    { category: "equity",    question: "How does your work address racial equity or serve underserved communities?", hint: "Be specific about which communities and how programs reach them.", charLimit: 1000 },
    { category: "budget",    question: "Please provide a budget narrative for how grant funds will be used.", hint: "Break down by line item: space, programming, outreach, staff, etc.", charLimit: 1500 },
  ],
  foundation: [
    { category: "narrative",  question: "Describe your organization and its primary activities.", hint: "Lead with community impact, not clinical outcomes.", charLimit: 2000 },
    { category: "narrative",  question: "What is the specific project or program this grant would fund?", hint: "Be concrete. Name the place, the people, the frequency.", charLimit: 1500 },
    { category: "impact",     question: "Who will benefit from this funding and how?", hint: "Use participant numbers and specific outcomes.", charLimit: 1000 },
    { category: "financials", question: "What is your organization's annual budget and primary funding sources?", hint: "Include grants, earned revenue, and donations.", charLimit: 800 },
    { category: "budget",     question: "Provide an itemized budget for this request.", hint: "Every line item should map to a program activity.", charLimit: 1200 },
  ],
};

/* ─── Supabase storage helpers ───────────────────────────────────────────────── */
// sprout_grants   → each row is one grant: { id: grant.id, data: grant }
// sprout_profile  → single row: { id: "profile", data: orgProfile }
// sprout_contacts → single row: { id: "contacts", data: contactsArray }

const dbGetGrants = async () => {
  try {
    const { data, error } = await supabase.from("sprout_grants").select("data");
    if (error || !data) return [];
    return data.map(r => r.data).filter(Boolean);
  } catch { return []; }
};

const dbSetGrants = async (grantsArray) => {
  try {
    // Upsert every grant in the array
    for (const g of grantsArray) {
      await supabase
        .from("sprout_grants")
        .upsert({ id: g.id, data: g, updated_at: new Date().toISOString() }, { onConflict: "id" });
    }
    // Delete rows that are no longer in the array
    if (grantsArray.length > 0) {
      const ids = grantsArray.map(g => g.id);
      await supabase.from("sprout_grants").delete().not("id", "in", `(${ids.map(i => `"${i}"`).join(",")})`);
    }
  } catch {}
};

const dbDeleteGrant = async (id) => {
  try {
    await supabase.from("sprout_grants").delete().eq("id", id);
  } catch {}
};

const dbGetProfile = async () => {
  try {
    const { data, error } = await supabase.from("sprout_profile").select("data").eq("id", "profile").maybeSingle();
    if (error || !data) return null;
    return data.data;
  } catch { return null; }
};

const dbSetProfile = async (profile) => {
  try {
    await supabase
      .from("sprout_profile")
      .upsert({ id: "profile", data: profile, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {}
};

const dbGetContacts = async () => {
  try {
    const { data, error } = await supabase.from("sprout_contacts").select("data").eq("id", "contacts").maybeSingle();
    if (error || !data) return null;
    return data.data;
  } catch { return null; }
};

const dbSetContacts = async (contacts) => {
  try {
    await supabase
      .from("sprout_contacts")
      .upsert({ id: "contacts", data: contacts, updated_at: new Date().toISOString() }, { onConflict: "id" });
  } catch {}
};

/* ─── Small shared components ────────────────────────────────────────────────── */

function StatusTag({ status }) {
  return <span className={`tag t-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

function DeadlineCell({ date }) {
  const d = daysUntil(date);
  if (d === null) return <span className="dl-na">—</span>;
  const cls   = d <= 14 ? "dl-urgent" : d <= 45 ? "dl-soon" : "dl-ok";
  const label = d < 0 ? "Past" : d === 0 ? "Today!" : `${d}d`;
  return (
    <div>
      <div className={cls}>{fmtDate(date)}</div>
      <div className={`dl-day ${cls}`}>{d < 0 ? "Past deadline" : `${label} left`}</div>
    </div>
  );
}

function CharCounter({ text, limit }) {
  if (!limit) return null;
  const len = (text || "").length;
  const pct = len / limit;
  const cls = pct >= 1 ? "cc-over" : pct >= 0.8 ? "cc-warn" : "cc-ok";
  return <span className={`cc ${cls}`}>{len.toLocaleString()} / {limit.toLocaleString()}</span>;
}

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="mover" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="m-hd">
          <span className="m-ttl">{title}</span>
          <button className="m-close" onClick={onClose}>×</button>
        </div>
        <div className="m-bd">{children}</div>
        {footer && <div className="m-ft">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────────────── */
function Sidebar({ view, setView, grants }) {
  const urgentCount = grants.filter(g => {
    const d = daysUntil(g.deadline);
    return d !== null && d <= 30 && g.status === "in_progress";
  }).length;

  return (
    <nav className="sb">
      <div className="sb-brand">
        <div className="sb-name">Sprout Society</div>
        <div className="sb-sub">Grant Manager v2</div>
      </div>
      <div className="sb-nav">
        <div className="sb-sect">Workspace</div>
        {[
          { id: "pipeline", label: "Grant Pipeline", icon: "📋", badge: urgentCount || null },
          { id: "import",   label: "Add Grant",      icon: "＋" },
        ].map(({ id, label, icon, badge }) => (
          <div key={id} className={`sb-item ${view === id ? "on" : ""}`} onClick={() => setView(id)}>
            <span>{icon}</span><span>{label}</span>
            {badge && <span className="sb-badge">{badge}</span>}
          </div>
        ))}
        <div className="sb-sect">Organization</div>
        {[
          { id: "contacts", label: "Funder Contacts", icon: "👥" },
          { id: "profile",  label: "Org Profile",     icon: "🏢" },
        ].map(({ id, label, icon }) => (
          <div key={id} className={`sb-item ${view === id ? "on" : ""}`} onClick={() => setView(id)}>
            <span>{icon}</span><span>{label}</span>
          </div>
        ))}
      </div>
      <div className="sb-foot">
        <div className="sb-foot-txt">Sprout Society Inc.<br />EIN 83-1298420<br />449 Troutman St, Brooklyn NY</div>
      </div>
    </nav>
  );
}

/* ─── Pipeline View ──────────────────────────────────────────────────────────── */
function PipelineView({ grants, onOpen, onImport, onDelete }) {
  const active     = grants.filter(g => !["awarded","rejected"].includes(g.status));
  const totalAsk   = grants.reduce((s, g) => s + (Number(g.amount) || 0), 0);
  const inProgress = grants.filter(g => g.status === "in_progress").length;
  const upcoming   = grants.filter(g => { const d = daysUntil(g.deadline); return d !== null && d <= 30 && d > 0; }).length;

  const sorted = [...grants].sort((a, b) => {
    const da = daysUntil(a.deadline) ?? 9999;
    const db = daysUntil(b.deadline) ?? 9999;
    return da - db;
  });

  return (
    <div className="page">
      <div className="pg-hd">
        <div>
          <div className="pg-ttl">Grant Pipeline</div>
          <div className="pg-sub">All grants in one view — sorted by deadline</div>
        </div>
        <button className="btn btn-blk" onClick={onImport}>＋ Add Grant</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-lbl">Active Grants</div><div className="stat-val">{active.length}</div><div className="stat-meta">of {grants.length} total</div></div>
        <div className="stat"><div className="stat-lbl">Total Ask</div><div className="stat-val" style={{ fontSize: 20 }}>{fmtMoney(totalAsk)}</div><div className="stat-meta">across all funders</div></div>
        <div className="stat"><div className="stat-lbl">In Progress</div><div className="stat-val" style={{ color: "var(--cyan)" }}>{inProgress}</div><div className="stat-meta">being written now</div></div>
        <div className="stat"><div className="stat-lbl">Due Soon</div><div className="stat-val" style={{ color: upcoming > 0 ? "#C00" : "var(--black)" }}>{upcoming}</div><div className="stat-meta">within 30 days</div></div>
      </div>

      {grants.length === 0 ? (
        <div className="empty">
          <div className="empty-ico">🌱</div>
          <div className="empty-ttl">No grants yet</div>
          <div className="empty-txt">Import a grant profile from Claude or build one manually to get started.</div>
          <button className="btn btn-blk" onClick={onImport}>Add Your First Grant</button>
        </div>
      ) : (
<div className="pipe-wrap">
  <div className="pipe-head">
    <span className="col-name">Grant / Funder</span>
    <span className="col-status">Status</span>
    <span className="col-amount">Amount</span>
    <span className="col-deadline">Deadline</span>
    <span className="col-progress">Progress</span>
    <span className="col-brief">Brief</span>
    <span className="col-next">Next Action</span>
    <span className="col-actions"></span>
  </div>
  {sorted.map(g => {
    const { answered, total, gaps } = completion(g.questions || []);
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    const nextTask = (g.tasks || []).find(t => !t.done);
    return (
      <div key={g.id} className="pipe-row" onClick={() => onOpen(g.id)}>
        <div className="col-name">
          <div className="gt-name">{g.grantName}</div>
          <div className="gt-funder">{g.funder}</div>
        </div>
        <div className="col-status"><StatusTag status={g.status} /></div>
        <div className="col-amount"><span className="gt-amt">{fmtMoney(g.amount)}</span></div>
        <div className="col-deadline"><DeadlineCell date={g.deadline} /></div>
        <div className="col-progress">
          {total > 0 ? (
            <>
              <div style={{ fontSize: 10, color: "var(--g600)", marginBottom: 4 }}>
                {answered}/{total} answered {gaps > 0 && <span className="gap-badge">{gaps} gaps</span>}
              </div>
              <div style={{ height: 4, background: "var(--g200)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--acid)" : "var(--cyan)", borderRadius: 2, transition: "width 0.4s" }} />
              </div>
            </>
          ) : <span style={{ fontSize: 11, color: "var(--g400)" }}>No questions</span>}
        </div>
        <div className="col-brief">
          {(g.funderBrief || g.funderBriefDocUrl)
            ? <span style={{ fontSize: 11, fontWeight: 700, color: "#5a5c00", background: "rgba(198,201,2,0.15)", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>✓ Linked</span>
            : <span style={{ fontSize: 11, color: "var(--g400)" }}>—</span>}
        </div>
        <div className="col-next" style={{ fontSize: 11, color: "var(--g600)" }}>
          {nextTask ? nextTask.text : <span style={{ color: "var(--g400)" }}>—</span>}
        </div>
        <div className="col-actions" onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-danger btn-xs"
            onClick={e => { e.stopPropagation(); if (window.confirm("Delete this grant?")) onDelete(g.id); }}
          >Del</button>
        </div>
      </div>
    );
  })}
</div>   
     
      )}
    </div>
  );
}

/* ─── Question Editor ────────────────────────────────────────────────────────── */
function QuestionEditor({ q, onChange, onDelete, showGaps, onImportAnswer, onViewHistory }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({ question: q.question, hint: q.hint || "", category: q.category || "", charLimit: q.charLimit || "" });
  const gaps = countGaps(q.draft);

  const handleChange = (e) => {
    onChange({ ...q, draft: e.target.value });
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const saveEdit = () => {
    onChange({ ...q, ...draft, charLimit: draft.charLimit ? Number(draft.charLimit) : undefined });
    setEditing(false);
  };

  if (editing) return (
    <div className="qe" style={{ background: "#fffdf0", border: "1.5px solid var(--banana)" }}>
      <div className="qe-hd">
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--g400)", marginBottom: 8 }}>Editing Question</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input style={{ border: "1.5px solid var(--g200)", borderRadius: 6, padding: "6px 10px", fontSize: 13, fontWeight: 700, width: "100%" }}
            value={draft.question} onChange={e => setDraft(d => ({ ...d, question: e.target.value }))} placeholder="Question text" />
          <input style={{ border: "1.5px solid var(--g200)", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%" }}
            value={draft.hint} onChange={e => setDraft(d => ({ ...d, hint: e.target.value }))} placeholder="Hint (optional)" />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ border: "1.5px solid var(--g200)", borderRadius: 6, padding: "6px 10px", fontSize: 12, flex: 1 }}
              value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} placeholder="Category (e.g. narrative, impact)" />
            <input style={{ border: "1.5px solid var(--g200)", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: 120 }}
              type="number" value={draft.charLimit} onChange={e => setDraft(d => ({ ...d, charLimit: e.target.value }))} placeholder="Char limit" />
          </div>
        </div>
      </div>
      <div className="qe-ft" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-xs" onClick={() => setEditing(false)}>Cancel</button>
        <button className="btn btn-xs" style={{ background: "var(--banana)", color: "var(--black)" }} onClick={saveEdit}>Save</button>
      </div>
    </div>
  );

  return (
    <div className="qe">
      <div className="qe-hd">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1 }}>
            {q.category && <div className="qe-cat">{q.category}</div>}
            <div className="qe-q">{q.question}</div>
            {q.hint && <div className="qe-hint">💡 {q.hint}</div>}
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)}>✏ Edit</button>
            <button className="btn btn-danger btn-xs" onClick={() => onDelete(q.id)}>🗑</button>
          </div>
        </div>
      </div>
      <div className="qe-bd">
        <textarea className="qe-ta" value={q.draft || ""} onChange={handleChange} placeholder="Start writing your answer here…" rows={4} />
      </div>
      <div className="qe-ft">
        <CharCounter text={q.draft} limit={q.charLimit} />
        {gaps > 0 && showGaps && <span className="gap-badge">⚠ {gaps} gap{gaps > 1 ? "s" : ""} to fill</span>}
        <div className="qe-actions">
          <button className="btn btn-ghost btn-xs" onClick={() => onViewHistory(q)}>⏮ History</button>
          <button className="btn btn-ghost btn-xs" onClick={() => onImportAnswer(q)}>📋 Paste</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Workspace View ─────────────────────────────────────────────────────────── */
function WorkspaceView({ grant, onBack, onUpdate, showToast, onDelete }) {
  const [activeTab,      setActiveTab]      = useState("questions");
  const [showGaps,       setShowGaps]       = useState(false);
  const [importAnswerQ,  setImportAnswerQ]  = useState(null);
  const [historyQ,       setHistoryQ]       = useState(null);
  const [importText,     setImportText]     = useState("");
  const [addingTask,     setAddingTask]     = useState(false);
  const [newTask,        setNewTask]        = useState({ text: "", priority: "med", dueDate: "" });
  const [addingContact,  setAddingContact]  = useState(false);
  const [newContact,     setNewContact]     = useState({ name: "", title: "", email: "", notes: "" });
  const [editingHeader,  setEditingHeader]  = useState(false);
  const [headerDraft,    setHeaderDraft]    = useState({});
  const [confirmDelete,  setConfirmDelete]  = useState(false);
  const [briefPasting,   setBriefPasting]   = useState(false);
  const [briefPasteText, setBriefPasteText] = useState("");
  const [briefDocUrl,    setBriefDocUrl]    = useState("");
  const [draftImporting, setDraftImporting] = useState(false);
  const [draftJson,      setDraftJson]      = useState("");
  const [draftParseErr,  setDraftParseErr]  = useState("");
  const { answered, total, gaps } = completion(grant.questions || []);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const stamp = () => ({ updatedAt: new Date().toISOString() });
  const updateQuestions = (questions) => onUpdate({ ...grant, questions, ...stamp() });
  const updateTasks     = (tasks)     => onUpdate({ ...grant, tasks,     ...stamp() });
  const updateContacts  = (contacts)  => onUpdate({ ...grant, contacts,  ...stamp() });

  const handleQChange = (updatedQ) => {
    updateQuestions((grant.questions || []).map(q => q.id === updatedQ.id ? updatedQ : q));
  };

  const handleImportAnswer = () => {
    if (!importText.trim()) return;
    const questions = (grant.questions || []).map(q => {
      if (q.id !== importAnswerQ.id) return q;
      const versions = [{ text: q.draft || "", savedAt: new Date().toISOString() }, ...(q.versions || [])].slice(0, 3);
      return { ...q, draft: importText.trim(), versions };
    });
    updateQuestions(questions);
    setImportAnswerQ(null); setImportText("");
    showToast("Answer imported ✓");
  };

  const handleRollback = (version) => {
    const questions = (grant.questions || []).map(q => {
      if (q.id !== historyQ.id) return q;
      const versions = [{ text: q.draft || "", savedAt: new Date().toISOString() }, ...(q.versions || [])].slice(0, 3);
      return { ...q, draft: version.text, versions };
    });
    updateQuestions(questions);
    setHistoryQ(null);
    showToast("Rolled back to previous version");
  };
const handleDraftImport = () => {
    let parsed;
    try {
      parsed = JSON.parse(draftJson);
    } catch {
      setDraftParseErr("Invalid JSON — check formatting and try again.");
      return;
    }
    const incoming = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    if (!incoming.length) {
      setDraftParseErr("No questions found in JSON.");
      return;
    }
    const updated = (grant.questions || []).map((q, i) => {
      const match = incoming.find(iq => iq.id === q.id) || incoming[i];
      if (!match || !match.draft) return q;
      const versions = [{ text: q.draft || "", savedAt: new Date().toISOString() }, ...(q.versions || [])].slice(0, 3);
      return { ...q, draft: match.draft, versions };
    });
    updateQuestions(updated);
    setDraftImporting(false);
    setDraftJson("");
    setDraftParseErr("");
    showToast("Draft answers imported ✓");
  };
  const toggleTask  = (id) => updateTasks((grant.tasks || []).map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTask  = (id) => updateTasks((grant.tasks || []).filter(t => t.id !== id));

  const addTask = () => {
    if (!newTask.text.trim()) return;
    updateTasks([...(grant.tasks || []), { ...newTask, id: uid(), done: false }]);
    setNewTask({ text: "", priority: "med", dueDate: "" });
    setAddingTask(false);
    showToast("Task added ✓");
  };

  const addContact = () => {
    if (!newContact.name.trim()) return;
    updateContacts([...(grant.contacts || []), { ...newContact, id: uid() }]);
    setNewContact({ name: "", title: "", email: "", notes: "" });
    setAddingContact(false);
    showToast("Contact added ✓");
  };

  const exportText = () => {
    const lines = [
      "=".repeat(56),
      `GRANT APPLICATION: ${grant.grantName}`,
      `FUNDER: ${grant.funder}`,
      `AMOUNT: ${fmtMoney(grant.amount)}`,
      `DEADLINE: ${fmtDate(grant.deadline)}`,
      `STATUS: ${STATUS_LABELS[grant.status] || grant.status}`,
      "=".repeat(56), "",
    ];
    (grant.questions || []).forEach((q, i) => {
      lines.push(`QUESTION ${i + 1} [${(q.category || "").toUpperCase()}]`);
      lines.push(q.question);
      lines.push("─".repeat(40));
      lines.push(q.draft || "(No answer yet)");
      lines.push("");
    });
    return lines.join("\n");
  };

  const saveHeaderEdits = () => {
    onUpdate({ ...grant, ...headerDraft, ...stamp() });
    setEditingHeader(false);
    showToast("Grant details saved ✓");
  };

  const d = daysUntil(grant.deadline);
  const deadlineCls = d !== null ? (d <= 14 ? "#C00" : d <= 45 ? "#885500" : "var(--g600)") : "var(--g400)";

  return (
    <div className="page">
      <div style={{ marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back to Pipeline</button>
      </div>

      {/* Header */}
      <div className="ws-hd">
        <div className="ws-top">
          <div>
            <div className="ws-name">{grant.grantName}</div>
            <div className="ws-funder">{grant.funder}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusTag status={grant.status} />
            <button className="btn btn-ghost btn-sm" onClick={() => { setHeaderDraft({ grantName: grant.grantName, funder: grant.funder, amount: grant.amount, deadline: grant.deadline, status: grant.status, applicationUrl: grant.applicationUrl }); setEditingHeader(true); }}>✏ Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>🗑 Delete</button>
          </div>
        </div>
        <div className="ws-meta">
          <span className="ws-mi"><strong>Amount:</strong> {fmtMoney(grant.amount)}</span>
          <span className="ws-mi" style={{ color: deadlineCls }}><strong>Deadline:</strong> {fmtDate(grant.deadline)}{d !== null && ` (${d < 0 ? "past" : `${d}d`})`}</span>
          {grant.applicationUrl && <span className="ws-mi"><strong>Portal:</strong> <a href={grant.applicationUrl} target="_blank" rel="noreferrer">{grant.applicationUrl}</a></span>}
        </div>
      </div>

      {/* Framing banner */}
      {grant.framingNotes && (
        <div className="framing">
          <div className="framing-lbl">📌 Framing Notes</div>
          <div className="framing-txt">{grant.framingNotes}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {[
          { id: "questions", label: `Questions (${total})` },
          { id: "tasks",     label: `Tasks (${(grant.tasks || []).filter(t => !t.done).length})` },
          { id: "brief",     label: (grant.funderBrief || grant.funderBriefDocUrl) ? "📋 Research Brief" : "Research Brief" },
          { id: "contacts",  label: "Contacts" },
          { id: "notes",     label: "Notes" },
          { id: "export",    label: "Export" },
        ].map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? "on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Questions ── */}
      {activeTab === "questions" && (
        <>
          <div className="tracker">
            <div className="tr-stat"><strong>{answered}</strong> of <strong>{total}</strong> answered</div>
            <div className="tr-bar"><div className="tr-fill" style={{ width: `${pct}%` }} /></div>
            <div className="tr-stat"><strong>{pct}%</strong> complete</div>
            {gaps > 0 && <div className="tr-gaps">⚠ {gaps} gap{gaps > 1 ? "s" : ""} to fill</div>}
<div className="tr-tools">
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", color: showGaps ? "var(--black)" : "var(--g600)" }}>
                <input type="checkbox" checked={showGaps} onChange={e => setShowGaps(e.target.checked)} style={{ accentColor: "var(--banana)" }} />
                Show gaps
              </label>
              <button className="btn btn-ghost btn-sm" onClick={() => { setDraftJson(""); setDraftParseErr(""); setDraftImporting(true); }}>
                📥 Import Draft
              </button>
            </div>          </div>
{(grant.questions || []).length === 0 ? (
            <div className="empty">
              <div className="empty-ico">📝</div>
              <div className="empty-ttl">No questions yet</div>
              <div className="empty-txt">Import a full grant profile from Claude to populate questions automatically.</div>
            </div>
          ) : (
            (grant.questions || []).map(q => (
              <QuestionEditor key={q.id} q={q} showGaps={showGaps} onChange={handleQChange}
                onDelete={(id) => updateQuestions((grant.questions || []).filter(q => q.id !== id))}
                onImportAnswer={setImportAnswerQ} onViewHistory={setHistoryQ} />
            ))
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
            onClick={() => updateQuestions([...(grant.questions || []), { id: uid(), category: "narrative", question: "New question", hint: "", draft: "", versions: [] }])}>
            ＋ Add Question
          </button>        </>
      )}

      {/* ── Tasks ── */}
      {activeTab === "tasks" && (
        <div className="card">
          <div className="card-hd">
            <span className="card-ttl">Tasks & Next Steps</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingTask(true)}>＋ Add Task</button>
          </div>
          <div className="card-bd">
            {(grant.tasks || []).length === 0 && !addingTask && (
              <div className="empty" style={{ padding: "28px 0" }}>
                <div className="empty-txt">No tasks yet. Add action items and reminders here.</div>
              </div>
            )}
            {(grant.tasks || []).map(t => (
              <div key={t.id} className="task">
                <div className={`task-chk ${t.done ? "done" : ""}`} onClick={() => toggleTask(t.id)}>{t.done && "✓"}</div>
                <div className="task-info">
                  <div className={`task-txt ${t.done ? "done" : ""}`}>{t.text}</div>
                  <div className="task-meta">
                    {t.priority && <span className={`pri-${t.priority}`}>{t.priority}</span>}
                    {t.dueDate   && <span className="task-due">Due {fmtDate(t.dueDate)}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => deleteTask(t.id)} style={{ flexShrink: 0, marginTop: 2 }}>✕</button>
              </div>
            ))}
            {addingTask && (
              <div className="add-row">
                <div className="fg">
                  <label className="fl">Task</label>
                  <input className="fi" value={newTask.text} onChange={e => setNewTask({ ...newTask, text: e.target.value })} placeholder="e.g. Email program officer before May 1" autoFocus />
                </div>
                <div className="frow">
                  <div className="fg">
                    <label className="fl">Priority</label>
                    <select className="fs" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                      <option value="high">High</option>
                      <option value="med">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="fg">
                    <label className="fl">Due Date</label>
                    <input type="date" className="fi" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-blk btn-sm" onClick={addTask}>Add Task</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAddingTask(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Research Brief ── */}
      {activeTab === "brief" && (
        <div className="card">
          <div className="card-hd">
            <span className="card-ttl">Funder Research Brief</span>
            <div style={{ display: "flex", gap: 8 }}>
              {(grant.funderBrief || grant.funderBriefDocUrl) ? (
                <>
                  {grant.funderBriefDocUrl && (
                    <a href={grant.funderBriefDocUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">🔗 Open Doc</a>
                  )}
                  {grant.funderBrief && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(grant.funderBrief); showToast("Brief copied ✓"); }}>📋 Copy</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setBriefPasteText(grant.funderBrief || ""); setBriefDocUrl(grant.funderBriefDocUrl || ""); setBriefPasting(true); }}>✏ Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => { onUpdate({ ...grant, funderBrief: "", funderBriefDocUrl: "", funderBriefUpdatedAt: null, ...stamp() }); showToast("Brief cleared"); }}>✕ Clear</button>
                </>
              ) : (
                <button className="btn btn-cyan btn-sm" onClick={() => { setBriefPasteText(""); setBriefDocUrl(""); setBriefPasting(true); }}>＋ Paste Brief</button>
              )}
            </div>
          </div>
          <div className="card-bd">
            {!(grant.funderBrief || grant.funderBriefDocUrl) ? (
              <div className="brief-empty">
                <div className="brief-empty-ico">🔍</div>
                <div className="brief-empty-ttl">No research brief linked yet</div>
                <div className="brief-empty-txt">
                  Paste the completed Funder Research Brief here to keep all your research alongside the application. Claude writes the brief in the conversation — paste it in once it's done.
                </div>
                <button className="btn btn-blk" onClick={() => { setBriefPasteText(""); setBriefDocUrl(""); setBriefPasting(true); }}>Paste Research Brief</button>
              </div>
            ) : (
              <>
                <div className="brief-actions">
                  <span className="brief-status has">✓ Brief linked</span>
                  {grant.funderBriefDocUrl && (
                    <a href={grant.funderBriefDocUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)", textDecoration: "none" }}>🔗 Open Google Doc →</a>
                  )}
                  {grant.funderBriefUpdatedAt && (
                    <span className="brief-meta">Last updated {new Date(grant.funderBriefUpdatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  )}
                </div>
                {grant.funderBrief && <div className="brief-body">{grant.funderBrief}</div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Grant Contacts ── */}
      {activeTab === "contacts" && (
        <div className="card">
          <div className="card-hd">
            <span className="card-ttl">Grant Contacts</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingContact(true)}>＋ Add Contact</button>
          </div>
          <div className="card-bd">
            {(grant.contacts || []).length === 0 && !addingContact && (
              <div className="empty" style={{ padding: "28px 0" }}>
                <div className="empty-txt">No contacts yet. Add program officers and funder contacts here.</div>
              </div>
            )}
            {(grant.contacts || []).map((c, i) => (
              <div key={c.id || i} className="contact-card">
                <div>
                  <div className="c-name">{c.name}</div>
                  <div className="c-meta">{[c.title, c.email].filter(Boolean).join(" · ")}</div>
                  {c.notes && <div className="c-notes">{c.notes}</div>}
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => updateContacts((grant.contacts || []).filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            {addingContact && (
              <div className="add-row">
                <div className="frow">
                  <div className="fg"><label className="fl">Name</label><input className="fi" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} autoFocus /></div>
                  <div className="fg"><label className="fl">Title</label><input className="fi" value={newContact.title} onChange={e => setNewContact({ ...newContact, title: e.target.value })} /></div>
                </div>
                <div className="fg"><label className="fl">Email</label><input type="email" className="fi" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} /></div>
                <div className="fg"><label className="fl">Notes</label><input className="fi" value={newContact.notes} onChange={e => setNewContact({ ...newContact, notes: e.target.value })} placeholder="e.g. Confirm which program area to file under" /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-blk btn-sm" onClick={addContact}>Add Contact</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAddingContact(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {activeTab === "notes" && (
        <div className="card">
          <div className="card-hd"><span className="card-ttl">Notes</span></div>
          <div className="card-bd">
            <textarea
              className="notes-ta"
              value={grant.notes || ""}
              onChange={e => onUpdate({ ...grant, notes: e.target.value, ...stamp() })}
              placeholder="Free-form notes about this grant, strategy, conversations, etc."
            />
          </div>
        </div>
      )}

      {/* ── Export ── */}
      {activeTab === "export" && (
        <div className="card">
          <div className="card-hd">
            <span className="card-ttl">Export Answers</span>
            <button className="btn btn-blk btn-sm" onClick={() => { navigator.clipboard.writeText(exportText()); showToast("Copied to clipboard ✓"); }}>
              📋 Copy All
            </button>
          </div>
          <div className="card-bd">
            <p style={{ fontSize: 12, color: "var(--g600)", marginBottom: 12 }}>Copy this block and paste directly into the funder's portal.</p>
            <pre className="export-area">{exportText()}</pre>
          </div>
        </div>
      )}

      {/* ── Import Answer Modal ── */}
      {importAnswerQ && (
        <Modal title="Paste Answer from Claude" onClose={() => { setImportAnswerQ(null); setImportText(""); }}
          footer={<>
            <button className="btn btn-ghost btn-sm" onClick={() => { setImportAnswerQ(null); setImportText(""); }}>Cancel</button>
            <button className="btn btn-blk btn-sm" onClick={handleImportAnswer} disabled={!importText.trim()}>Import Answer</button>
          </>}
        >
          <p style={{ fontSize: 12, color: "var(--g600)", marginBottom: 12 }}><strong>{importAnswerQ.question}</strong></p>
          <p style={{ fontSize: 11, color: "var(--g400)", marginBottom: 10 }}>Copy the answer from your Claude conversation and paste it below. The current draft will be saved to version history.</p>
          <textarea className="fta" value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste answer here…" rows={8} autoFocus />
          {importAnswerQ.charLimit && <div style={{ marginTop: 6 }}><CharCounter text={importText} limit={importAnswerQ.charLimit} /></div>}
        </Modal>
      )}

      {/* ── Version History Modal ── */}
      {historyQ && (
        <Modal title="Version History" onClose={() => setHistoryQ(null)}>
          <p style={{ fontSize: 12, color: "var(--g600)", marginBottom: 14 }}><strong>{historyQ.question}</strong></p>
          {(historyQ.versions || []).length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--g400)" }}>No previous versions saved yet. Versions are saved when you import an answer.</p>
          ) : (
            (historyQ.versions || []).map((v, i) => (
              <div key={i} className="v-item" onClick={() => handleRollback(v)}>
                <div className="v-meta">Version {(historyQ.versions || []).length - i} · {new Date(v.savedAt).toLocaleString()}</div>
                <div className="v-prev">{v.text || "(empty)"}</div>
                <div style={{ fontSize: 10, color: "var(--cyan)", marginTop: 5, fontWeight: 700 }}>Click to restore →</div>
              </div>
            ))
          )}
        </Modal>
      )}

      {/* ── Edit Header Modal ── */}
      {editingHeader && (
        <Modal title="Edit Grant Details" onClose={() => setEditingHeader(false)}
          footer={<>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingHeader(false)}>Cancel</button>
            <button className="btn btn-blk btn-sm" onClick={saveHeaderEdits}>Save Changes</button>
          </>}
          wide
        >
          <div className="frow">
            <div className="fg"><label className="fl">Grant Name</label><input className="fi" value={headerDraft.grantName || ""} onChange={e => setHeaderDraft({ ...headerDraft, grantName: e.target.value })} /></div>
            <div className="fg"><label className="fl">Funder</label><input className="fi" value={headerDraft.funder || ""} onChange={e => setHeaderDraft({ ...headerDraft, funder: e.target.value })} /></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Amount ($)</label><input type="number" className="fi" value={headerDraft.amount || ""} onChange={e => setHeaderDraft({ ...headerDraft, amount: e.target.value })} /></div>
            <div className="fg"><label className="fl">Deadline</label><input type="date" className="fi" value={headerDraft.deadline || ""} onChange={e => setHeaderDraft({ ...headerDraft, deadline: e.target.value })} /></div>
          </div>
          <div className="fg">
            <label className="fl">Status</label>
            <select className="fs" value={headerDraft.status || "not_started"} onChange={e => setHeaderDraft({ ...headerDraft, status: e.target.value })}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Application URL</label>
            <input type="url" className="fi" value={headerDraft.applicationUrl || ""} onChange={e => setHeaderDraft({ ...headerDraft, applicationUrl: e.target.value })} placeholder="https://…" />
          </div>
        </Modal>
      )}

      {/* ── Paste Brief Modal ── */}
      {briefPasting && (
        <Modal title="Funder Research Brief" onClose={() => { setBriefPasting(false); setBriefPasteText(""); setBriefDocUrl(""); }}
          footer={<>
            <button className="btn btn-ghost btn-sm" onClick={() => { setBriefPasting(false); setBriefPasteText(""); setBriefDocUrl(""); }}>Cancel</button>
            <button className="btn btn-acid btn-sm"
              disabled={!briefPasteText.trim() && !briefDocUrl.trim()}
              onClick={() => {
                onUpdate({ ...grant, funderBrief: briefPasteText.trim(), funderBriefDocUrl: briefDocUrl.trim(), funderBriefUpdatedAt: new Date().toISOString(), ...stamp() });
                setBriefPasting(false); setBriefPasteText(""); setBriefDocUrl("");
                showToast("Research brief saved ✓");
              }}
            >Save Brief</button>
          </>}
          wide
        >
          <div className="fg" style={{ marginBottom: 14 }}>
            <label className="fl">Google Doc URL <span style={{ fontWeight: 400, color: "var(--g400)" }}>(optional)</span></label>
            <input className="fi" type="url" value={briefDocUrl} onChange={e => setBriefDocUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" />
          </div>
          <div className="fg">
            <label className="fl">Brief text <span style={{ fontWeight: 400, color: "var(--g400)" }}>(paste from Claude)</span></label>
            <textarea className="notes-ta" style={{ minHeight: 300 }} value={briefPasteText} onChange={e => setBriefPasteText(e.target.value)} placeholder="Paste the full Funder Research Brief here…" autoFocus={!briefDocUrl} />
            <p style={{ fontSize: 11, color: "var(--g400)", marginTop: 6 }}>{(briefPasteText || "").length.toLocaleString()} characters</p>
          </div>
        </Modal>
      )}

      {/* ── Confirm Delete Modal ── */}
      {confirmDelete && (
        <Modal title="Delete Grant?" onClose={() => setConfirmDelete(false)}
          footer={<>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn btn-danger btn-sm" onClick={() => { setConfirmDelete(false); onDelete(grant.id); }}>Yes, Delete</button>
          </>}
        >
          <p style={{ fontSize: 13 }}>Are you sure you want to delete <strong>{grant.grantName}</strong>? This cannot be undone.</p>
        </Modal>
      )}
      {draftImporting && (
        <Modal
          title="Import Draft Answers from Claude"
          onClose={() => { setDraftImporting(false); setDraftJson(""); setDraftParseErr(""); }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setDraftImporting(false); setDraftJson(""); setDraftParseErr(""); }}>Cancel</button>
            <button className="btn btn-acid" onClick={handleDraftImport} disabled={!draftJson.trim()}>Import Answers</button>
          </>}
        >
          <p style={{ fontSize: 12, color: "var(--g600)", marginBottom: 12, lineHeight: 1.6 }}>
            Paste the questions JSON from Claude. Answers are matched by <code>id</code>, or by position if IDs don't match. Existing drafts are saved to version history before being overwritten.
          </p>
          <span className="import-lbl">Questions Draft JSON</span>
          <div className="import-zone" style={{ marginBottom: 8 }}>
            <textarea
              className="import-ta"
              style={{ minHeight: 220 }}
              value={draftJson}
              onChange={e => { setDraftJson(e.target.value); setDraftParseErr(""); }}
              placeholder={`[\n  { "id": "amber_q1", "draft": "In 2018, Danielle…" },\n  { "id": "amber_q2", "draft": "A $10,000 grant would…" }\n]`}
              autoFocus
            />
          </div>
          {draftParseErr && <p style={{ fontSize: 12, color: "#B91C1C" }}>⚠ {draftParseErr}</p>}
          <p style={{ fontSize: 11, color: "var(--g400)", marginTop: 8, lineHeight: 1.6 }}>
            JSON can be an array <code>[ ]</code> or an object with a <code>questions</code> key. Only the <code>draft</code> field is imported — question text, hints, and limits are unchanged.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ─── Import View ────────────────────────────────────────────────────────────── */
function ImportView({ onImport, showToast }) {
  const [mode,       setMode]       = useState("json");
  const [jsonText,   setJsonText]   = useState("");
  const [parsed,     setParsed]     = useState(null);
  const [parseError, setParseError] = useState("");
  const [template,   setTemplate]   = useState("general");
  const [manual,     setManual]     = useState({ funder: "", grantName: "", amount: "", deadline: "", status: "not_started", applicationUrl: "", framingNotes: "" });

const handleParse = () => {
  setParseError("");
  try {
    const raw = JSON.parse(jsonText.trim());
    const items = Array.isArray(raw) ? raw : [raw];
    const first = items[0];
    if (!first?.funder && !first?.grantName) throw new Error("Missing required fields: funder, grantName");
    const normalize = (obj) => ({
      ...obj,
      questions: (obj.questions || []).map(q => ({ ...q, id: q.id || uid(), draft: q.draft || "", versions: q.versions || [] })),
      tasks:     (obj.tasks     || []).map(t => ({ ...t, id: t.id || uid() })),
      contacts:  (obj.contacts  || []).map(c => ({ ...c, id: c.id || uid() })),
    });
    setParsed(items.map(normalize));
  } catch (e) { setParseError(e.message); setParsed(null); }
};

const handleImportJSON = () => {
  if (!parsed) return;
  const profiles = parsed.map(obj => ({
    ...obj,
    id: obj.id || uid(),
    questions: obj.questions || [],
    tasks:     obj.tasks     || [],
    contacts:  obj.contacts  || [],
    notes:     obj.notes     || "",
    funderBrief: obj.funderBrief || "",
    funderBriefUpdatedAt: obj.funderBriefUpdatedAt || null,
    createdAt:  obj.createdAt || new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  }));
  onImport(profiles);
  setJsonText(""); setParsed(null);
  showToast(`${profiles.length} grant${profiles.length > 1 ? "s" : ""} imported ✓`);
};
  const handleManualImport = () => {
    if (!manual.funder.trim() || !manual.grantName.trim()) { showToast("Funder and grant name are required", "err"); return; }
    const qs = TEMPLATE_QUESTIONS[template] || [];
    const profile = {
      ...manual,
      id: uid(),
      amount: Number(manual.amount) || 0,
      questions: qs.map(q => ({ ...q, id: uid(), draft: "", versions: [] })),
      tasks: [], contacts: [], notes: "",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    onImport(profile);
    setManual({ funder: "", grantName: "", amount: "", deadline: "", status: "not_started", applicationUrl: "", framingNotes: "" });
    showToast(`"${profile.grantName}" created ✓`);
  };

  return (
    <div className="page">
      <div className="pg-hd">
        <div>
          <div className="pg-ttl">Add a Grant</div>
          <div className="pg-sub">Import a profile from Claude or build one manually</div>
        </div>
      </div>

      <div className="import-tabs">
        <button className={`import-tab ${mode === "json" ? "on" : ""}`} onClick={() => setMode("json")}>📥 Import from Claude</button>
        <button className={`import-tab ${mode === "manual" ? "on" : ""}`} onClick={() => setMode("manual")}>✍ Manual Build</button>
      </div>

      {/* ── JSON Import ── */}
      {mode === "json" && (
        <div className="card">
          <div className="card-hd"><span className="card-ttl">Paste Grant Profile JSON</span></div>
          <div className="card-bd">
            <div style={{ background: "linear-gradient(to right, rgba(115,196,214,0.1), rgba(198,201,2,0.05))", border: "1.5px solid var(--cyan)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 12, lineHeight: 1.7, color: "var(--g800)" }}>
              <strong>How to use:</strong> In this conversation, ask Claude to <em>"build a grant profile JSON for [funder name]"</em>. Claude will generate a complete profile. Copy the JSON output, paste it below, and click Import.
            </div>
            <span className="import-lbl">Grant Profile JSON</span>
            <div className={`import-zone ${jsonText ? "active" : ""}`}>
              <textarea
                className="import-ta"
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setParsed(null); setParseError(""); }}
                placeholder={`{\n  "id": "bko_microgrant_2026",\n  "funder": "Brooklyn Org",\n  "grantName": "Microgrant Summer 2026",\n  "amount": 10000,\n  "deadline": "2026-05-31",\n  "status": "in_progress",\n  ...\n}`}
              />
            </div>
            {parseError && <p style={{ fontSize: 12, color: "#B91C1C", marginTop: 8 }}>⚠ {parseError}</p>}
{parsed && (
  <div className="preview-card">
    {parsed.map((g, i) => (
      <div key={i} style={{ borderBottom: i < parsed.length - 1 ? "1px solid var(--g100)" : "none", paddingBottom: i < parsed.length - 1 ? 10 : 0, marginBottom: i < parsed.length - 1 ? 10 : 0 }}>
        <div className="preview-name">{g.grantName}</div>
        <div className="preview-funder">{g.funder}</div>
        <div className="preview-row">
          <span className="preview-item"><strong>Amount:</strong> {fmtMoney(g.amount)}</span>
          <span className="preview-item"><strong>Deadline:</strong> {fmtDate(g.deadline)}</span>
          <span className="preview-item"><strong>Questions:</strong> {(g.questions || []).length}</span>
          <span className="preview-item"><strong>Tasks:</strong> {(g.tasks || []).length}</span>
        </div>
        {g.framingNotes && <p style={{ fontSize: 11, color: "var(--g600)", marginTop: 4, fontStyle: "italic" }}>📌 {g.framingNotes.slice(0, 120)}{g.framingNotes.length > 120 ? "…" : ""}</p>}
      </div>
    ))}
    {parsed.length > 1 && <p style={{ fontSize: 11, color: "var(--g600)", marginTop: 8, fontWeight: 700 }}>→ {parsed.length} grants will be imported</p>}
  </div>
)}            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {!parsed
                ? <button className="btn btn-cyan" onClick={handleParse} disabled={!jsonText.trim()}>Preview Import</button>
                : <button className="btn btn-acid" onClick={handleImportJSON}>✓ Import Grant Profile</button>}
              {(jsonText || parsed) && <button className="btn btn-ghost btn-sm" onClick={() => { setJsonText(""); setParsed(null); setParseError(""); }}>Clear</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Manual Build ── */}
      {mode === "manual" && (
        <div className="card">
          <div className="card-hd"><span className="card-ttl">Build Grant Manually</span></div>
          <div className="card-bd">
            <div className="frow">
              <div className="fg"><label className="fl">Grant Name *</label><input className="fi" value={manual.grantName} onChange={e => setManual({ ...manual, grantName: e.target.value })} placeholder="e.g. Microgrant Summer 2026" /></div>
              <div className="fg"><label className="fl">Funder *</label><input className="fi" value={manual.funder} onChange={e => setManual({ ...manual, funder: e.target.value })} placeholder="e.g. Brooklyn Org" /></div>
            </div>
            <div className="frow3">
              <div className="fg"><label className="fl">Amount ($)</label><input type="number" className="fi" value={manual.amount} onChange={e => setManual({ ...manual, amount: e.target.value })} /></div>
              <div className="fg"><label className="fl">Deadline</label><input type="date" className="fi" value={manual.deadline} onChange={e => setManual({ ...manual, deadline: e.target.value })} /></div>
              <div className="fg">
                <label className="fl">Status</label>
                <select className="fs" value={manual.status} onChange={e => setManual({ ...manual, status: e.target.value })}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="fg"><label className="fl">Application URL</label><input type="url" className="fi" value={manual.applicationUrl} onChange={e => setManual({ ...manual, applicationUrl: e.target.value })} placeholder="https://…" /></div>
            <div className="fg"><label className="fl">Framing Notes</label><textarea className="fta" value={manual.framingNotes} onChange={e => setManual({ ...manual, framingNotes: e.target.value })} placeholder="Key framing guidance for this funder: tone, focus areas, language to avoid…" rows={3} /></div>
            <div className="fg">
              <label className="fl">Pre-load question template</label>
              <select className="fs" value={template} onChange={e => setTemplate(e.target.value)}>
                <option value="general">General Foundation (5 questions)</option>
                <option value="foundation">Standard Foundation (5 questions)</option>
                <option value="none">No template — start blank</option>
              </select>
              <p className="form-hint">You can edit or add questions after creating the grant.</p>
            </div>
            <button className="btn btn-blk" onClick={handleManualImport}>Create Grant Workspace</button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, background: "#fff", border: "1.5px solid var(--g200)", borderRadius: 11, padding: "16px 18px", fontSize: 12, lineHeight: 1.8, color: "var(--g600)" }}>
        <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--g800)" }}>Grant Profile JSON Format</strong>
        <p style={{ marginTop: 6 }}>When asking Claude to build a profile, say: <em>"Build a grant profile JSON for [Funder Name]. Use the Sprout Society grant profile format from the handoff doc."</em></p>
        <p>Required fields: <code>funder</code>, <code>grantName</code>, <code>deadline</code>, <code>status</code></p>
        <p>Optional: <code>questions[]</code>, <code>tasks[]</code>, <code>contacts[]</code>, <code>framingNotes</code>, <code>applicationUrl</code>, <code>amount</code>, <code>funderBrief</code></p>
      </div>
    </div>
  );
}

/* ─── Contacts View ──────────────────────────────────────────────────────────── */
function ContactsView({ contacts, onUpdate, showToast }) {
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ name: "", org: "", title: "", email: "", phone: "", notes: "", lastContact: "" });

  const add = () => {
    if (!nc.name.trim()) return;
    onUpdate([...contacts, { ...nc, id: uid() }]);
    setNc({ name: "", org: "", title: "", email: "", phone: "", notes: "", lastContact: "" });
    setAdding(false);
    showToast("Contact added ✓");
  };

  return (
    <div className="page">
      <div className="pg-hd">
        <div>
          <div className="pg-ttl">Funder Contacts</div>
          <div className="pg-sub">Program officers, grant managers, and funder relationships</div>
        </div>
        <button className="btn btn-blk" onClick={() => setAdding(true)}>＋ Add Contact</button>
      </div>

      {contacts.length === 0 && !adding && (
        <div className="empty">
          <div className="empty-ico">👥</div>
          <div className="empty-ttl">No contacts yet</div>
          <div className="empty-txt">Track program officers, grant managers, and key funder relationships here.</div>
          <button className="btn btn-blk" onClick={() => setAdding(true)}>Add First Contact</button>
        </div>
      )}

      {adding && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-hd"><span className="card-ttl">New Contact</span></div>
          <div className="card-bd">
            <div className="frow">
              <div className="fg"><label className="fl">Name *</label><input className="fi" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} autoFocus /></div>
              <div className="fg"><label className="fl">Organization</label><input className="fi" value={nc.org} onChange={e => setNc({ ...nc, org: e.target.value })} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label className="fl">Title</label><input className="fi" value={nc.title} onChange={e => setNc({ ...nc, title: e.target.value })} /></div>
              <div className="fg"><label className="fl">Email</label><input type="email" className="fi" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label className="fl">Phone</label><input className="fi" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} /></div>
              <div className="fg"><label className="fl">Last Contact</label><input type="date" className="fi" value={nc.lastContact} onChange={e => setNc({ ...nc, lastContact: e.target.value })} /></div>
            </div>
            <div className="fg"><label className="fl">Notes</label><textarea className="fta" value={nc.notes} onChange={e => setNc({ ...nc, notes: e.target.value })} placeholder="Relationship notes, preferences, conversation history…" rows={2} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-blk btn-sm" onClick={add}>Add Contact</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {contacts.map((c, i) => (
        <div key={c.id || i} className="contact-card">
          <div style={{ flex: 1 }}>
            <div className="c-name">{c.name}</div>
            <div className="c-meta">{[c.title, c.org, c.email, c.phone].filter(Boolean).join(" · ")}</div>
            {c.lastContact && <div className="c-meta" style={{ marginTop: 2 }}>Last contact: {fmtDate(c.lastContact)}</div>}
            {c.notes && <div className="c-notes">{c.notes}</div>}
          </div>
          <button className="btn btn-ghost btn-xs" onClick={() => { onUpdate(contacts.filter((_, j) => j !== i)); showToast("Contact removed"); }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ─── Org Profile View ───────────────────────────────────────────────────────── */
function OrgProfileView({ profile, onUpdate, showToast }) {
  const [draft, setDraft] = useState(profile);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setDraft(prev => ({ ...prev, [k]: v }));

  const save = () => {
    onUpdate(draft);
    setSaved(true);
    showToast("Org profile saved ✓");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="page">
      <div className="pg-hd">
        <div>
          <div className="pg-ttl">Org Profile</div>
          <div className="pg-sub">Sprout Society details — auto-fill common grant fields</div>
        </div>
        <button className="btn btn-acid" onClick={save}>{saved ? "✓ Saved!" : "Save Profile"}</button>
      </div>

      <div className="card">
        <div className="card-hd"><span className="card-ttl">Organization Details</span></div>
        <div className="card-bd">
          <div className="sect-lbl">Legal Identity</div>
          <div className="frow">
            <div className="fg"><label className="fl">Legal Name</label><input className="fi" value={draft.legalName || ""} onChange={e => set("legalName", e.target.value)} /></div>
            <div className="fg"><label className="fl">EIN / Tax ID</label><input className="fi" value={draft.ein || ""} onChange={e => set("ein", e.target.value)} /></div>
          </div>
          <div className="frow3">
            <div className="fg"><label className="fl">Founded</label><input className="fi" value={draft.founded || ""} onChange={e => set("founded", e.target.value)} /></div>
            <div className="fg"><label className="fl">Annual Budget</label><input className="fi" value={draft.annualBudget || ""} onChange={e => set("annualBudget", e.target.value)} placeholder="e.g. $120,000" /></div>
            <div className="fg"><label className="fl">Service Area</label><input className="fi" value={draft.serviceArea || ""} onChange={e => set("serviceArea", e.target.value)} /></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Address</label><input className="fi" value={draft.address || ""} onChange={e => set("address", e.target.value)} /></div>
            <div className="fg"><label className="fl">Website</label><input className="fi" value={draft.website || ""} onChange={e => set("website", e.target.value)} /></div>
          </div>
          <div className="frow3">
            <div className="fg"><label className="fl">Staff Count</label><input className="fi" value={draft.numStaff || ""} onChange={e => set("numStaff", e.target.value)} placeholder="e.g. 2 FTE" /></div>
            <div className="fg"><label className="fl">Volunteers</label><input className="fi" value={draft.numVolunteers || ""} onChange={e => set("numVolunteers", e.target.value)} /></div>
            <div className="fg"><label className="fl">Instagram</label><input className="fi" value={draft.instagram || ""} onChange={e => set("instagram", e.target.value)} /></div>
          </div>

          <div className="sect-lbl">Mission & Programs</div>
          <div className="fg"><label className="fl">Mission Statement</label><textarea className="fta" value={draft.mission || ""} onChange={e => set("mission", e.target.value)} rows={3} /></div>
          <div className="fg"><label className="fl">Programs</label><textarea className="fta" value={draft.programs || ""} onChange={e => set("programs", e.target.value)} rows={3} /></div>
          <div className="fg"><label className="fl">Population Served</label><textarea className="fta" value={draft.population || ""} onChange={e => set("population", e.target.value)} rows={2} /></div>
          <div className="fg"><label className="fl">Outcomes / Impact</label><textarea className="fta" value={draft.outcomes || ""} onChange={e => set("outcomes", e.target.value)} rows={2} placeholder="e.g. Events hosted last year, people served, peer groups running…" /></div>

          <div className="sect-lbl">Primary Contact</div>
          <div className="frow">
            <div className="fg"><label className="fl">Name</label><input className="fi" value={draft.contactName || ""} onChange={e => set("contactName", e.target.value)} /></div>
            <div className="fg"><label className="fl">Title</label><input className="fi" value={draft.contactTitle || ""} onChange={e => set("contactTitle", e.target.value)} /></div>
          </div>
          <div className="frow">
            <div className="fg"><label className="fl">Email</label><input type="email" className="fi" value={draft.contactEmail || ""} onChange={e => set("contactEmail", e.target.value)} /></div>
            <div className="fg"><label className="fl">Phone</label><input className="fi" value={draft.contactPhone || ""} onChange={e => set("contactPhone", e.target.value)} /></div>
          </div>
        </div>
      </div>

      <div style={{ background: "linear-gradient(to right, rgba(198,201,2,0.1), rgba(198,201,2,0.02))", border: "1.5px solid var(--acid)", borderRadius: 10, padding: "13px 16px", fontSize: 12, lineHeight: 1.7, color: "var(--g800)" }}>
        <strong>Open items that block BKO submission:</strong> Annual expenses figure, founder name, key milestones since 2019, staff count, volunteer count, events hosted in past year, people through the doors, peer groups running (count + frequency), orgs/events on the portal, race/equity programming example, income breakdown.
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [view,            setView]           = useState("pipeline");
  const [grants,          setGrants]         = useState([]);
  const [orgProfile,      setOrgProfile]     = useState(DEFAULT_ORG);
  const [contacts,        setContacts]       = useState([]);
  const [selectedGrantId, setSelectedGrantId] = useState(null);
  const [toast,           setToast]          = useState(null);
  const [loading,         setLoading]        = useState(true);

  // ── Bootstrap: load all data from Supabase on mount ──
  useEffect(() => {
    (async () => {
      const [g, p, c] = await Promise.all([dbGetGrants(), dbGetProfile(), dbGetContacts()]);
      if (g && g.length) setGrants(g);
      if (p) setOrgProfile(p);
      if (c) setContacts(c);
      setLoading(false);
    })();
  }, []);

  const showToast = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Grant mutations ──
  const saveGrants = useCallback(async (updated) => {
    setGrants(updated);
    await dbSetGrants(updated);
  }, []);

const handleImport = useCallback((profileOrProfiles) => {
  const profiles = Array.isArray(profileOrProfiles) ? profileOrProfiles : [profileOrProfiles];
  const updated = [...grants];
  profiles.forEach(profile => {
    const idx = updated.findIndex(g => g.id === profile.id);
    if (idx >= 0) updated[idx] = profile;
    else updated.push(profile);
  });
  saveGrants(updated);
  if (profiles.length === 1) {
    setSelectedGrantId(profiles[0].id);
    setView("workspace");
  } else {
    setView("pipeline");
  }
}, [grants, saveGrants]);

const handleUpdate = useCallback((updated) => {
  const all = grants.map(g => g.id === updated.id ? updated : g);
  setGrants(all);
  dbSetGrants(all);
}, [grants]);

  const handleDelete = useCallback(async (id) => {
    const remaining = grants.filter(g => g.id !== id);
    setGrants(remaining);
    await dbDeleteGrant(id);
    setSelectedGrantId(null);
    setView("pipeline");
    showToast("Grant deleted");
  }, [grants, showToast]);

  const handleOpen = useCallback((id) => {
    setSelectedGrantId(id);
    setView("workspace");
  }, []);

  // ── Profile & contacts mutations ──
  const saveProfile = useCallback(async (updated) => {
    setOrgProfile(updated);
    await dbSetProfile(updated);
  }, []);

  const saveContacts = useCallback(async (updated) => {
    setContacts(updated);
    await dbSetContacts(updated);
  }, []);

  const selectedGrant = grants.find(g => g.id === selectedGrantId);
  const effectiveView = (view === "workspace" && !selectedGrant) ? "pipeline" : view;

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Lato, sans-serif", color: "#9CA3AF", flexDirection: "column", gap: 12 }}>
          <div style={{ width: 28, height: 28, border: "2.5px solid #E5E7EB", borderTopColor: "#73C4D6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Loading…</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <Sidebar
          view={effectiveView === "workspace" ? "pipeline" : effectiveView}
          setView={(v) => { setSelectedGrantId(null); setView(v); }}
          grants={grants}
        />
        <main className="main">
          {effectiveView === "pipeline" && (
            <PipelineView grants={grants} onOpen={handleOpen} onImport={() => setView("import")} onDelete={handleDelete} />
          )}
          {effectiveView === "workspace" && selectedGrant && (
            <WorkspaceView
              grant={selectedGrant}
              onBack={() => setView("pipeline")}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              showToast={showToast}
            />
          )}
          {effectiveView === "import" && (
            <ImportView onImport={handleImport} showToast={showToast} />
          )}
          {effectiveView === "contacts" && (
            <ContactsView contacts={contacts} onUpdate={saveContacts} showToast={showToast} />
          )}
          {effectiveView === "profile" && (
            <OrgProfileView profile={orgProfile} onUpdate={saveProfile} showToast={showToast} />
          )}
        </main>
        {toast && <div className={`toast t-${toast.type}`}>{toast.msg}</div>}
      </div>
    </>
  );
}