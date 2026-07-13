import Image from 'next/image';

// The site header. `alt` is intentionally empty: the word "SplitVise" sits right
// beside the logo, so announcing it again would just make a screen reader say the
// name twice.
export function Brand({ children }: { children?: React.ReactNode }) {
  return (
    <div className="header">
      <h1 className="brand">
        <Image
          src="/logo.png"
          alt=""
          width={400}
          height={432}
          className="brand-logo"
          priority
        />
        SplitVise
      </h1>
      <p>Smart expense splitting made simple</p>
      {children}
    </div>
  );
}
