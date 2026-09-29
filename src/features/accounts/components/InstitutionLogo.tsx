import { useEffect, useMemo, useState } from 'react';
import { getInstitution, monogram } from '../institutions';

interface InstitutionLogoProps {
  institutionId: string;
  size?: number;
}

const failedLogoUrls = new Set<string>();

export const InstitutionLogo = ({
  institutionId,
  size = 44,
}: InstitutionLogoProps) => {
  const institution = getInstitution(institutionId);

  const candidates = useMemo(() => {
    const raw: string[] = [];
    if (institution.logoPath) raw.push(institution.logoPath);
    const pngFallback = `/institutions/${institution.id}.png`;
    const svgFallback = `/institutions/${institution.id}.svg`;
    if (!raw.includes(pngFallback)) raw.push(pngFallback);
    if (!raw.includes(svgFallback)) raw.push(svgFallback);
    return raw.filter((url) => !failedLogoUrls.has(url));
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
        className="flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ ...dimension, backgroundColor: institution.brandColor }}
        aria-label={institution.displayName}
      >
        {monogram(institution.displayName)}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full neu-flat"
      style={dimension}
    >
      <img
        src={src}
        alt={institution.displayName}
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => {
          failedLogoUrls.add(src);
          setIndex((current) => current + 1);
        }}
      />
    </div>
  );
};
