import React from 'react';

const EvidencePlayer = ({ evidenceFileId }) => {
  if (!evidenceFileId) return null;

  const drivePreviewUrl = `https://drive.google.com/file/d/${evidenceFileId}/preview`;

  return (
    <div className="mt-2 text-left">
      <div className="text-xs font-semibold text-slate-600 mb-1">Bằng chứng:</div>
      <div className="relative w-full overflow-hidden rounded border border-slate-200" style={{ paddingTop: '56.25%' }}>
        <iframe 
          src={drivePreviewUrl} 
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="autoplay"
          title="Video bằng chứng"
        ></iframe>
      </div>
    </div>
  );
};

export default EvidencePlayer;