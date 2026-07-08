import { useEffect, useState } from "react";

type Dimensions = {
  width: number;
  height: number;
};

type MaybeDimensions = Dimensions | null;

/**
 * Hook to get the dimensions of an element
 * @param ref - The ref of the element
 * @returns The dimensions of the element
 */
export const useDimensions = (ref: React.RefObject<HTMLElement | null>) => {
  const [dimensions, setDimensions] = useState<MaybeDimensions>(null);

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [ref]);

  return dimensions;
};
