import { useState, useEffect, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { validateResetToken, resetPasswordWithToken } from '../lib/auth';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setValidating(false);
      return;
    }
    validateResetToken(email, token)
      .then(valid => {
        setTokenValid(valid);
        setValidating(false);
      })
      .catch(() => setValidating(false));
  }, [token, email]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Le password non corrispondono.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPasswordWithToken(email, token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verifica del link in corso...</p>
        </div>
      </div>
    );
  }

  // Invalid or missing token
  if (!tokenValid && !success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Link non valido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">
                    {!token || !email
                      ? 'Link di reset mancante o incompleto.'
                      : 'Il link di reset e scaduto o e gia stato utilizzato.'}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                    Richiedi un nuovo link dalla pagina di login.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-6 pb-6">
            <Link to="/login" className="w-full">
              <Button className="w-full h-12 text-base">Vai al login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Password aggiornata!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    La tua password e stata reimpostata con successo.
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    Ora puoi accedere con la nuova password.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-6 pb-6">
            <Link to="/login" className="w-full">
              <Button className="w-full h-12 text-base">Vai al login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Reimposta password</CardTitle>
          <CardDescription>
            Imposta una nuova password per <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
                autoFocus
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
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3 px-6 pt-6 pb-6">
            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? 'Aggiornamento...' : 'Imposta nuova password'}
            </Button>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
            >
              Torna al login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
