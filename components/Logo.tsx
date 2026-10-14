const AVIF_SRCSET = "/images/bbo-logo-300.avif 300w, /images/bbo-logo-400.avif 400w, /images/bbo-logo-664.avif 664w";

/**
 * The Beyond Borders logo. Browsers get the smallest AVIF that is sharp at their screen density;
 * the WebP is a fallback for browsers without AVIF support.
 * `sizes` is the logo's rendered width, which lets the browser pick the right file.
 */
export default function Logo({ sizes, priority = false }: { sizes: string; priority?: boolean }) {
  return (
    <picture>
      <source type="image/avif" srcSet={AVIF_SRCSET} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/bbo-logo.webp"
        alt="Beyond Borders Outsourcing Services Inc."
        width={664}
        height={220}
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
      />
    </picture>
  );
}
