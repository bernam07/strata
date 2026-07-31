import { useState } from 'react';
import { getInstitution, monogram } from '../institutions';

interface InstitutionLogoProps {
  institutionId: string;
  size?: number;
}

export const InstitutionLogo = ({
  institutionId,
  size = 44,
}: InstitutionLogoProps) => {
  const institution = getInstitution(institutionId);
  const [failed, setFailed] = useState(institution.logoPath === '');

  const dimension = { width: size, height: size };

  if (failed) {
    return (
      <div
        className="flex items-center justify-center rounded-full text-sm font-bold text-white"
        style={{ ...dimension, backgroundColor: institution.brandColor }}
        aria-label={institution.displayName}
      >
        {monogram(institution.displayName)}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full neu-flat"
      style={dimension}
    >
      <img
        src={institution.logoPath}
        alt={institution.displayName}
        width={size * 0.62}
        height={size * 0.62}
        onError={() => setFailed(true)}
      />
    </div>
  );
};
