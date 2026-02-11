import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthActions } from '../contexts/AuthContext';
import { resetDatabase } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setPendingApproval(false);
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email o password non validi';
      if (message === 'PENDING_APPROVAL') {
        setPendingApproval(true);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    await resetDatabase();
    setShowReset(false);
    setError('');
    setPendingApproval(false);
    navigate('/register');
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Benvenuto su Vector</CardTitle>
          <CardDescription>Accedi per monitorare la tua energia</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Inserisci la password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 text-base"
              />
            </div>

            {pendingApproval && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Account in attesa di approvazione
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Il tuo account non è ancora stato approvato dall'amministratore.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Non hai un account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Registrati
              </Link>
            </p>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Password dimenticata? Resetta accessi
            </button>
          </CardFooter>
        </form>

        {showReset && (
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 space-y-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Conferma reset completo
              </p>
              <p className="text-xs text-red-700 dark:text-red-400">
                Questo eliminerà tutti gli account e i dati dal dispositivo. Dovrai registrarti di nuovo.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-9 flex-1"
                  onClick={handleReset}
                >
                  Resetta tutto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 flex-1"
                  onClick={() => setShowReset(false)}
                >
                  Annulla
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
