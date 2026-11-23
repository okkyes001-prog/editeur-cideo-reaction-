import React from 'react';
import { Copy, Download, Film, FolderOpen, Plus, Trash2, X } from 'lucide-react';
import { ClipProject, ExportRecord, OverlayLayoutPreset } from '../types/editor';

interface ProjectsDrawerProps {
  projects: ClipProject[];
  activeProjectId: string;
  exportsList: ExportRecord[];
  onSelectProject: (id: string) => void;
  onCreateProject: (preset?: OverlayLayoutPreset) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onClose: () => void;
}

export const ProjectsDrawer: React.FC<ProjectsDrawerProps> = ({
  projects,
  activeProjectId,
  exportsList,
  onSelectProject,
  onCreateProject,
  onDuplicateProject,
  onDeleteProject,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-14 left-3 w-[320px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-5rem)] rounded-xl border border-[#2a2a2e] bg-[#141416]/95 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
      >
        <div className="px-3.5 py-2.5 bg-[#1a1a1d]/90 border-b border-[#262626] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-[#C8FF00]" />
            <h2 className="font-display text-xs font-semibold text-white">
              Klivaro Projects
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close projects"
            className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-2.5 border-b border-[#262626] shrink-0">
          <button
            type="button"
            onClick={() => {
              onCreateProject('split-50');
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] text-[11px] font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Clip Project</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-[#888888] px-0.5">
              Saved Sequences ({projects.length})
            </p>
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  className={`rounded-lg border p-2 flex items-center justify-between gap-2 transition-colors ${
                    isActive
                      ? 'bg-[#222222] border-[#C8FF00]'
                      : 'bg-[#090909]/80 border-[#262626] hover:border-[#333333]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(proj.id);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {proj.thumbnailUrl ? (
                      <img
                        src={proj.thumbnailUrl}
                        alt={proj.title}
                        referrerPolicy="no-referrer"
                        className="w-8 h-11 rounded object-cover bg-[#090909] border border-[#262626] shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-11 rounded bg-[#090909] border border-[#262626] shrink-0 flex items-center justify-center">
                        <Film className="w-3.5 h-3.5 text-[#888888]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {proj.title}
                      </p>
                      <p className="text-[10px] text-[#888888] font-mono-tabular mt-0.5">
                        9:16 · {proj.updatedAt}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      title="Duplicate"
                      className="p-1 rounded text-[#888888] hover:text-white hover:bg-[#262626] cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        title="Delete"
                        className="p-1 rounded text-[#888888] hover:text-[#EF4444] hover:bg-[#262626] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {exportsList.length > 0 && (
            <div className="space-y-1.5 pt-2.5 border-t border-[#262626]">
              <p className="text-[10px] font-medium text-[#888888] px-0.5">
                Recent Exports
              </p>
              {exportsList.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-[#090909]/80 border border-[#262626] rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-white truncate">
                      {exp.projectTitle}
                    </p>
                    <p className="text-[10px] text-[#888888] font-mono-tabular">
                      {exp.resolution} · {exp.fileSizeLabel}
                    </p>
                  </div>
                  {exp.downloadUrl && (
                    <a
                      href={exp.downloadUrl}
                      download={`${exp.projectTitle
                        .toLowerCase()
                        .replace(/\s+/g, '-')}.${
                        exp.format.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
                      }`}
                      className="p-1 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-white transition-colors shrink-0"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
