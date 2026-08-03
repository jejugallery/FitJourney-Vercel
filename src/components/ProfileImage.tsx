import type { ImgHTMLAttributes, SyntheticEvent } from 'react';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
}

export default function ProfileImage({ src, fallbackSrc, onError, ...props }: Props) {
  const initialSrc = src || fallbackSrc;
  if (!initialSrc) return null;

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (fallbackSrc && image.dataset.fallbackApplied !== 'true') {
      image.dataset.fallbackApplied = 'true';
      image.src = fallbackSrc;
      return;
    }
    image.style.display = 'none';
    onError?.(event);
  };

  return <img {...props} src={initialSrc} onError={handleError} />;
}
