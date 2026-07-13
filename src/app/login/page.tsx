import { LoginForm } from '@/components/LoginForm';
import { Brand } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="container">
      <ThemeToggle />

      <Brand />

      <div className="auth-shell">
        <div className="section">
          <h2>Sign in</h2>
          <LoginForm next={next ?? '/'} />
        </div>
      </div>
    </div>
  );
}
