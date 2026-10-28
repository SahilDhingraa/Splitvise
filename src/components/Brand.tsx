import Image from 'next/image';

// The logo and wordmark. `alt` is intentionally empty: the word "SplitVise" sits
// right beside the logo, so announcing it again would just make a screen reader
// say the name twice.
export function Brand() {
  return (
    <div className="brand">
      <Image src="/logo.png" alt="" width={400} height={432} className="mark" priority />
      <span className="wordmark">SplitVise</span>
    </div>
  );
}
