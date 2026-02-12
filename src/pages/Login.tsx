import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthActions } from '../contexts/AuthContext';
import { resetUserPassword } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (newPassword.length < 6) {
      setResetError('La password deve essere di almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Le password non corrispondono.');
      return;
    }

    setIsLoading(true);
    try {
      await resetUserPassword(resetEmail, newPassword);
      setResetSuccess(true);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Errore durante il reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const exitForgotMode = () => {
    setForgotMode(false);
    setResetEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setResetSuccess(false);
    if (resetSuccess) {
      setEmail(resetEmail);
    }
  };

  if (forgotMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Recupera password</CardTitle>
            <CardDescription>
              Inserisci la tua email e imposta una nuova password
            </CardDescription>
          </CardHeader>

          {resetSuccess ? (
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      Password aggiornata!
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Ora puoi accedere con la nuova password.
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nuova password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Minimo 6 caratteri"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Conferma nuova password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Ripeti la password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="h-12 text-base"
                  />
                </div>
                {resetError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{resetError}</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col space-y-3 px-6 pt-6 pb-6">
                <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                  {isLoading ? 'Aggiornamento...' : 'Imposta nuova password'}
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
