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
  aspectRatio: AspectRatio;
  canUndo: boolean;
  canRedo: boolean;
  onOpenProjects: () => void;
  onTitleChange: (nextTitle: string) => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  title,
  aspectRatio,
  canUndo,
  canRedo,
  onOpenProjects,
  onTitleChange,
  onAspectRatioChange,
  onUndo,
  onRedo,
  onOpenExport,
}) => {
  return (
    <header className="h-12 px-4 bg-[#0F0F13] border-b border-[#22222A] flex items-center justify-between gap-4 shrink-0">
      {/* Left: KlipDeck Brand + Project Switcher + Inline Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenProjects}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#18181F] transition-colors shrink-0 cursor-pointer"
          title="Switch or create projects"
        >
          <div className="w-6 h-6 rounded-md bg-[#F97316] flex items-center justify-center shrink-0">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-white whitespace-nowrap">
            KlipDeck
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
        </button>

        <span className="text-[#27272F]" aria-hidden="true">
          /
        </span>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          aria-label="Project title"
          className="bg-transparent border border-transparent hover:border-[#27272F] focus:border-[#F97316] focus:bg-[#09090B] rounded-md px-2 py-1 text-xs font-medium text-[#E4E4E7] outline-none w-40 sm:w-56 truncate transition-colors"
        />
      </div>

      {/* Center: Format Selector */}
      <div className="hidden md:flex items-center gap-0.5 p-0.5 bg-[#09090B] border border-[#22222A] rounded-lg">
        {(['9:16', '1:1', '16:9'] as AspectRatio[]).map((ratio) => (
          <button
            key={ratio}
            type="button"
            onClick={() => onAspectRatioChange(ratio)}
            className={`px-3 py-1 text-[11px] font-mono-tabular rounded-md transition-colors cursor-pointer whitespace-nowrap ${
              aspectRatio === ratio
                ? 'bg-[#22222B] text-white'
                : 'text-[#71717A] hover:text-[#E4E4E7]'
            }`}
          >
            {ratio}
          </button>
        ))}
      </div>

      {/* Right: Undo / Redo + Export CTA + Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-md text-[#A1A1AA] hover:text-white hover:bg-[#18181F] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-md text-[#A1A1AA] hover:text-white hover:bg-[#18181F] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onOpenExport}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ml-1"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <img
          src={CREATOR_AVATAR_URL}
          alt="Studio account"
          referrerPolicy="no-referrer"
          className="w-7 h-7 rounded-full object-cover border border-[#27272F] hidden sm:block ml-1 shrink-0"
        />
      </div>
    </header>
  );
};
