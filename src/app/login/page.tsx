import { LoginForm } from '@/components/LoginForm';
import { Brand } from '@/components/Brand';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="auth">
      <div className="auth-card">
        <Brand />
        <h1>Split the bill, keep the friends.</h1>
        <p className="lede">
          Trips, rent, dinners. Record who paid, and SplitVise works out who owes whom with the
          fewest transfers.
        </p>
        <LoginForm next={next ?? '/'} />
      </div>
    </div>
  );
}
