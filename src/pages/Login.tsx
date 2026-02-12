import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthActions } from '../contexts/AuthContext';
import { requestPasswordReset } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
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

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!resetEmail.trim()) {
      setResetError('Inserisci la tua email.');
      return;
    }

    setIsLoading(true);
    try {
      await requestPasswordReset(resetEmail);
      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Errore durante l\'invio.');
    } finally {
      setIsLoading(false);
    }
  };

  const exitForgotMode = () => {
    setForgotMode(false);
    setResetEmail('');
    setResetError('');
    setResetSuccess(false);
  };

  if (forgotMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Recupera password</CardTitle>
            <CardDescription>
              Ti invieremo un link per reimpostare la password
            </CardDescription>
          </CardHeader>

          {resetSuccess ? (
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Email inviata!
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Se l'indirizzo e registrato, riceverai un'email con il link per reimpostare
                      la password. Controlla anche la cartella spam.
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-2">
                      Il link scade tra 1 ora.
                    </p>
                  </div>
                </div>
              </div>
              <Button className="w-full h-12 text-base" onClick={exitForgotMode}>
                Torna al login
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handlePasswordReset}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email del tuo account</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="tu@esempio.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 text-base"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Riceverai un'email con un link per creare una nuova password.
                </p>
                {resetError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{resetError}</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pt-6 pb-6">
                <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Invio in corso...
                    </span>
                  ) : (
                    'Invia link di reset'
                  )}
                </Button>
                <button
                  type="button"
                  onClick={exitForgotMode}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Torna al login
                </button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    );
  }

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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => { setForgotMode(true); setResetEmail(email); }}
                  className="text-xs text-primary hover:underline"
                >
                  Password dimenticata?
                </button>
              </div>
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
          <CardFooter className="flex flex-col space-y-4 px-6 pt-6 pb-6">
            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Non hai un account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Registrati
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
