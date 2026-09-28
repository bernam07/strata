import { useEffect, useMemo, useState } from 'react';
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

  const candidates = useMemo(() => {
    const list = [`/institutions/${institution.id}.png`];
    if (institution.logoPath) list.push(institution.logoPath);
    return list;
  }, [institution.id, institution.logoPath]);

  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [institutionId]);
  const dimension = { width: size, height: size };
  const src = candidates[index];

  if (!src) {
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
        src={src}
        alt={institution.displayName}
        className="h-full w-full object-cover"
        onError={() => setIndex((current) => current + 1)}
      />
    </div>
  );
};
