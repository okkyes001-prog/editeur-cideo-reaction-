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
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-start">
      <div className="w-full max-w-md bg-[#0F0F13] border-r border-[#22222A] h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-[#F97316]" />
            <h2 className="font-display text-base font-semibold text-white">
              KlipDeck Projects
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#A1A1AA] hover:text-white hover:bg-[#1C1C24] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#22222A]">
          <button
            type="button"
            onClick={() => {
              onCreateProject('split-50');
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Clip Project</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium text-[#71717A]">
              Saved Sequences ({projects.length})
            </p>
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 transition-colors ${
                    isActive
                      ? 'bg-[#18181F] border-[#F97316]/60'
                      : 'bg-[#121217] border-[#22222A] hover:border-[#343442]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectProject(proj.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {proj.thumbnailUrl ? (
                      <img
                        src={proj.thumbnailUrl}
                        alt={proj.title}
                        referrerPolicy="no-referrer"
                        className="w-10 h-14 rounded object-cover bg-[#09090B] border border-[#27272F] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-[#09090B] border border-[#27272F] shrink-0 flex items-center justify-center">
                        <Film className="w-4 h-4 text-[#52525B]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {proj.title}
                      </p>
                      <p className="text-xs text-[#71717A] font-mono-tabular mt-0.5">
                        {proj.aspectRatio} · {proj.updatedAt}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      title="Duplicate"
                      className="p-1.5 rounded text-[#A1A1AA] hover:text-white hover:bg-[#22222A] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        title="Delete"
                        className="p-1.5 rounded text-[#A1A1AA] hover:text-[#EF4444] hover:bg-[#22222A] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {exportsList.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-[#22222A]">
              <p className="text-[11px] font-medium text-[#71717A]">
                Recent Exports
              </p>
              {exportsList.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-[#121217] border border-[#22222A] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {exp.projectTitle}
                    </p>
                    <p className="text-[11px] text-[#71717A] font-mono-tabular">
                      {exp.resolution} · {exp.fileSizeLabel}
                    </p>
                  </div>
                  {exp.downloadUrl && (
                    <a
                      href={exp.downloadUrl}
                      download={`${exp.projectTitle
                        .toLowerCase()
                        .replace(/\s+/g, '-')}.webm`}
                      className="p-1.5 rounded bg-[#1D1D25] hover:bg-[#F97316] text-white transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" onClick={onClose} />
    </div>
  );
};
