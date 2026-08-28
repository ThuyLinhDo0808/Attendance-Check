import React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const EvidencePlayer = ({ evidenceFileId }) => {
  if (!evidenceFileId) return null;

  const drivePreviewUrl = `https://drive.google.com/file/d/${evidenceFileId}/preview`;
  const driveViewUrl = `https://drive.google.com/file/d/${evidenceFileId}/view`;

  return (
    <div className="mt-2 text-left group">
      <div className="flex justify-between items-center mb-1">
        <div className="text-xs font-semibold text-slate-600">Evidence:</div>
        <a 
          href={driveViewUrl} 
          target="_blank" 
          rel="noreferrer" 
          className="hidden group-hover:flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowTopRightOnSquareIcon className="w-3 h-3"/> Open in new tab
        </a>
      </div>
      <div className="relative w-full overflow-hidden rounded border border-slate-200 bg-slate-100 shadow-sm" style={{ paddingTop: '56.25%' }}>
        <iframe 
          src={drivePreviewUrl} 
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="autoplay"
          title="Video evidence"
        ></iframe>
      </div>
    </div>
  );
};

export default EvidencePlayer;