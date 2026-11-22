import React, { useState } from 'react';
import { CheckCircle2, Download, Film, X } from 'lucide-react';
import {
  AspectRatio,
  ExportRecord,
  MediaAsset,
  MusicAsset,
  MusicClip,
  SeamDividerConfig,
  SoundEffectAsset,
  SoundEffectClip,
  TextOverlay,
  VideoClip,
} from '../types/editor';
import { getCanvasDimensions } from '../data/presets';
import { exportWithWebCodecs } from '../engine/webCodecsExporter';

interface ExportModalProps {
  projectId: string;
  projectTitle: string;
  aspectRatio: AspectRatio;
  duration: number;
  baseClips: VideoClip[];
  overlayClips: VideoClip[];
  textOverlays: TextOverlay[];
  soundEffects: SoundEffectClip[];
  musicClips: MusicClip[];
  assetsById: Map<string, MediaAsset>;
  sfxById: Map<string, SoundEffectAsset>;
  musicById: Map<string, MusicAsset>;
  seamDivider?: SeamDividerConfig;
  onClose: () => void;
  onExportComplete: (record: ExportRecord) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  projectId,
  projectTitle,
  aspectRatio,
  duration,
  baseClips,
  overlayClips,
  textOverlays,
  soundEffects,
  musicClips,
  assetsById,
  sfxById,
  musicById,
  seamDivider,
  onClose,
  onExportComplete,
}) => {
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>(
    'idle'
  );
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [sizeLabel, setSizeLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const dims = getCanvasDimensions(aspectRatio, resolution);

  const handleStartExport = async () => {
    setStatus('rendering');
    setProgress(0);
    setErrorMsg('');

    try {
      const result = await exportWithWebCodecs({
        aspectRatio,
        duration,
        resolution,
        fps,
        baseClips,
        overlayClips,
        textOverlays,
        soundEffects,
        musicClips,
        assetsById,
        sfxById,
        musicById,
        seamDivider,
        onProgress: setProgress,
      });

      setDownloadUrl(result.blobUrl);
      setSizeLabel(result.sizeLabel);
      setStatus('done');

      onExportComplete({
        id: `exp-${Date.now()}`,
        projectId,
        projectTitle,
        format: 'WebM VP9',
        resolution: `${dims.width} × ${dims.height}`,
        duration,
        fileSizeLabel: result.sizeLabel,
        createdAt: 'Just now',
        downloadUrl: result.blobUrl,
      });
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error ? err.message : 'Browser video encoding failed.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#191919] border border-[#262626] rounded-xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-[#C8FF00]" />
            <h3 className="font-display text-base font-semibold text-white">
              Export Video
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'rendering'}
            className="p-1 rounded text-[#888888] hover:text-white disabled:opacity-30 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-[#090909] border border-[#262626] rounded-lg px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-[#888888]">Output Sequence</span>
            <span className="font-mono-tabular text-white">
              {dims.width} × {dims.height} · {duration.toFixed(1)}s
            </span>
          </div>

          {status === 'idle' && (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#888888] block">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['720p', '1080p'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        resolution === res
                          ? 'bg-[#222222] border-[#C8FF00] text-white font-semibold'
                          : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                      }`}
                    >
                      {res === '720p' ? '720p Fast' : '1080p Full HD'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-[#888888] block">
                  Frame Rate
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([30, 60] as const).map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFps(rate)}
                      className={`py-2 px-3 rounded-lg border text-xs font-mono-tabular transition-colors cursor-pointer ${
                        fps === rate
                          ? 'bg-[#222222] border-[#C8FF00] text-white font-semibold'
                          : 'bg-[#090909] border-[#262626] text-[#888888] hover:text-white'
                      }`}
                    >
                      {rate} FPS
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartExport}
                className="w-full py-2.5 px-4 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] text-sm font-bold transition-colors cursor-pointer"
              >
                Render & Export Video
              </button>
            </>
          )}

          {status === 'rendering' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white">
                  Compositing video, text & sound effects...
                </span>
                <span className="font-mono-tabular text-[#C8FF00] font-bold">
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full bg-[#090909] rounded-full overflow-hidden border border-[#262626]">
                <div
                  className="h-full bg-[#C8FF00] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'done' && downloadUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-sm text-[#C8FF00] font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Render complete ({sizeLabel})</span>
              </div>

              <video
                src={downloadUrl}
                controls
                playsInline
                className="w-full max-h-56 rounded-lg bg-black border border-[#262626]"
              />

              <div className="flex gap-2">
                <a
                  href={downloadUrl}
                  download={`${projectTitle
                    .toLowerCase()
                    .replace(/\s+/g, '-')}.webm`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#C8FF00] hover:bg-[#b5e600] text-[#090909] text-sm font-bold transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Video</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-lg bg-[#262626] hover:bg-[#333333] text-xs font-medium text-white cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <p className="text-xs text-[#EF4444]">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="w-full py-2 px-4 rounded-lg bg-[#262626] text-white text-xs font-medium cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
