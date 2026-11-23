import { useState } from 'react';
import {
  BrandKit,
  ClipProject,
  ExportRecord,
  MediaAsset,
  MusicAsset,
  OverlayLayoutPreset,
  SoundEffectAsset,
} from './types/editor';
import {
  BUILTIN_MUSIC_ASSETS,
  BUILTIN_SFX_ASSETS,
  DEFAULT_BRAND_KIT,
  INITIAL_EXPORTS,
  INITIAL_PROJECTS,
  OVERLAY_LAYOUT_PRESETS,
} from './data/presets';
import { EditorWorkspace } from './components/EditorWorkspace';
import { ProjectsDrawer } from './components/ProjectsDrawer';

export default function App() {
  const [projects, setProjects] = useState<ClipProject[]>(INITIAL_PROJECTS);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [sfxAssets, setSfxAssets] =
    useState<SoundEffectAsset[]>(BUILTIN_SFX_ASSETS);
  const [musicAssets, setMusicAssets] =
    useState<MusicAsset[]>(BUILTIN_MUSIC_ASSETS);
  const [exportsList, setExportsList] =
    useState<ExportRecord[]>(INITIAL_EXPORTS);
  const [brandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [showProjectsDrawer, setShowProjectsDrawer] = useState(false);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const handleCreateProject = (presetId: OverlayLayoutPreset = 'split-50') => {
    const preset =
      OVERLAY_LAYOUT_PRESETS.find((p) => p.id === presetId) ||
      OVERLAY_LAYOUT_PRESETS[0];

    const newProject: ClipProject = {
      id: `proj-${Date.now()}`,
      title: `New ${preset.label}`,
      category: presetId.startsWith('split') ? 'Split Screen' : 'PiP Overlay',
      aspectRatio: '9:16',
      updatedAt: 'Just now',
      thumbnailUrl: '',
      baseClips: [],
      overlayClips: [],
      textOverlays: [],
      soundEffects: [],
      musicClips: [],
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
  };

  const handleDuplicateProject = (projectId: string) => {
    const source = projects.find((p) => p.id === projectId);
    if (!source) return;
    const copy: ClipProject = {
      ...JSON.parse(JSON.stringify(source)),
      id: `proj-${Date.now()}`,
      title: `${source.title} Copy`,
      updatedAt: 'Just now',
    };
    setProjects((prev) => [copy, ...prev]);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) return;
    const remaining = projects.filter((p) => p.id !== projectId);
    setProjects(remaining);
    if (activeProjectId === projectId) {
      setActiveProjectId(remaining[0].id);
    }
  };

  const handleUpdateProject = (updated: ClipProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  return (
    <>
      <EditorWorkspace
        key={activeProject.id}
        project={activeProject}
        assets={assets}
        sfxAssets={sfxAssets}
        musicAssets={musicAssets}
        brandKit={brandKit}
        onUpdateProject={handleUpdateProject}
        onAddAssets={(newAssets) =>
          setAssets((prev) => [...newAssets, ...prev])
        }
        onAddSfxAssets={(newSfx) =>
          setSfxAssets((prev) => [...newSfx, ...prev])
        }
        onAddMusicAssets={(newMusic) =>
          setMusicAssets((prev) => [...newMusic, ...prev])
        }
        onExportComplete={(record) =>
          setExportsList((prev) => {
            const next = [record, ...prev];
            let liveBlobs = 0;
            return next.map((item) => {
              if (!item.downloadUrl?.startsWith('blob:')) return item;
              liveBlobs++;
              if (liveBlobs <= 3) return item;
              try {
                URL.revokeObjectURL(item.downloadUrl);
              } catch {
                // Ignore revoke failure
              }
              return { ...item, downloadUrl: undefined };
            });
          })
        }
        onOpenProjects={() => setShowProjectsDrawer(true)}
      />

      {showProjectsDrawer && (
        <ProjectsDrawer
          projects={projects}
          activeProjectId={activeProject.id}
          exportsList={exportsList}
          onSelectProject={(id) => setActiveProjectId(id)}
          onCreateProject={handleCreateProject}
          onDuplicateProject={handleDuplicateProject}
          onDeleteProject={handleDeleteProject}
          onClose={() => setShowProjectsDrawer(false)}
        />
      )}
    </>
  );
}
