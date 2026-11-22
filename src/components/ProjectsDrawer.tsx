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
    <div className="fixed inset-0 z-50 bg-black/75 flex justify-start">
      <div className="w-full max-w-md bg-[#191919] border-r border-[#262626] h-full flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-4 h-4 text-[#C8FF00]" />
            <h2 className="font-display text-base font-semibold text-white">
              Klivaro Projects
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#888888] hover:text-white hover:bg-[#262626] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-[#262626]">
          <button
            type="button"
            onClick={() => {
              onCreateProject('split-50');
              onClose();
            }}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Clip Project</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-2.5">
            <p className="text-[11px] font-medium text-[#888888]">
              Saved Sequences ({projects.length})
            </p>
            {projects.map((proj) => {
              const isActive = proj.id === activeProjectId;
              return (
                <div
                  key={proj.id}
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 transition-colors ${
                    isActive
                      ? 'bg-[#222222] border-[#C8FF00]'
                      : 'bg-[#090909] border-[#262626] hover:border-[#333333]'
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
                        className="w-10 h-14 rounded object-cover bg-[#090909] border border-[#262626] shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-[#090909] border border-[#262626] shrink-0 flex items-center justify-center">
                        <Film className="w-4 h-4 text-[#888888]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {proj.title}
                      </p>
                      <p className="text-xs text-[#888888] font-mono-tabular mt-0.5">
                        {proj.aspectRatio} · {proj.updatedAt}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      title="Duplicate"
                      className="p-1.5 rounded text-[#888888] hover:text-white hover:bg-[#262626] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {projects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        title="Delete"
                        className="p-1.5 rounded text-[#888888] hover:text-[#EF4444] hover:bg-[#262626] cursor-pointer"
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
            <div className="space-y-2.5 pt-4 border-t border-[#262626]">
              <p className="text-[11px] font-medium text-[#888888]">
                Recent Exports
              </p>
              {exportsList.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-[#090909] border border-[#262626] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {exp.projectTitle}
                    </p>
                    <p className="text-[11px] text-[#888888] font-mono-tabular">
                      {exp.resolution} · {exp.fileSizeLabel}
                    </p>
                  </div>
                  {exp.downloadUrl && (
                    <a
                      href={exp.downloadUrl}
                      download={`${exp.projectTitle
                        .toLowerCase()
                        .replace(/\s+/g, '-')}.webm`}
                      className="p-1.5 rounded bg-[#262626] hover:bg-[#C8FF00] hover:text-[#090909] text-white transition-colors shrink-0"
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
