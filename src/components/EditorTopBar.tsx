import React from 'react';
import {
  ChevronDown,
  Download,
  Layers,
  Redo2,
  Undo2,
} from 'lucide-react';
import { AspectRatio } from '../types/editor';
import { CREATOR_AVATAR_URL } from '../data/presets';

interface EditorTopBarProps {
  title: string;
  aspectRatio?: AspectRatio;
  canUndo: boolean;
  canRedo: boolean;
  onOpenProjects: () => void;
  onTitleChange: (nextTitle: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  title,
  canUndo,
  canRedo,
  onOpenProjects,
  onTitleChange,
  onUndo,
  onRedo,
  onOpenExport,
}) => {
  return (
    <header className="h-12 px-4 bg-[#090909] border-b border-[#262626] flex items-center justify-between gap-4 shrink-0">
      {/* Left: Klivaro Brand + Project Switcher + Inline Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenProjects}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#191919] transition-colors shrink-0 cursor-pointer"
          title="Switch or create projects"
        >
          <div className="w-6 h-6 rounded-md bg-[#C8FF00] flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-[#090909]" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-white whitespace-nowrap">
            Klivaro
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#888888]" />
        </button>

        <span className="text-[#262626]" aria-hidden="true">
          /
        </span>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Project title"
          className="bg-transparent border border-transparent hover:border-[#262626] focus:border-[#C8FF00] focus:bg-[#191919] rounded-md px-2 py-1 text-xs font-medium text-white outline-none w-40 sm:w-56 truncate transition-colors"
        />
      </div>

      {/* Center: Fixed 9:16 Vertical Format Indicator */}
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-[#191919] border border-[#262626] rounded-lg">
        <span className="w-2 h-3 rounded-[2px] border border-[#C8FF00]" />
        <span className="text-[11px] font-mono-tabular font-semibold text-white">
          9:16
        </span>
        <span className="text-[10px] text-[#888888]">Reels / TikTok</span>
      </div>

      {/* Right: Undo / Redo + Export CTA + Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-md text-[#888888] hover:text-white hover:bg-[#191919] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-md text-[#888888] hover:text-white hover:bg-[#191919] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <img
          src={CREATOR_AVATAR_URL}
          alt="Studio account"
          referrerPolicy="no-referrer"
          className="w-7 h-7 rounded-full object-cover border border-[#262626] hidden sm:block ml-1 shrink-0"
        />
      </div>
    </header>
  );
};
