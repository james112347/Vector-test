import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuthActions } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isConnectionError, setIsConnectionError] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [missingSync, setMissingSync] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsConnectionError(false);
    setPendingApproval(false);
    setMissingSync(false);
    setIsLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email o password non validi';
      if (message === 'PENDING_APPROVAL') {
        setPendingApproval(true);
      } else if (message === 'MISSING_PASSWORD_SYNC') {
        setMissingSync(true);
      } else if (message.includes('connettersi') || message.includes('connessione') || message.includes('network') || message.includes('fetch')) {
        setIsConnectionError(true);
        setError(message);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Password dimenticata?</CardTitle>
            <CardDescription>
              Ecco come recuperare l'accesso al tuo account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Contatta l'amministratore
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    L'amministratore puo reimpostare la tua password e darti una password temporanea.
                    Una volta effettuato l'accesso, potrai cambiarla dalle Impostazioni.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se hai gia accesso all'app, puoi usare la chat di feedback per inviare la richiesta direttamente.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="px-6 pb-6">
            <Button className="w-full h-12 text-base" onClick={() => setForgotMode(false)}>
              Torna al login
            </Button>
          </CardFooter>
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
                  onClick={() => setForgotMode(true)}
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

            {missingSync && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Sincronizzazione necessaria
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                      Per usare Vector da segnalibro o schermata Home, accedi prima una volta dal browser Safari/Chrome. I tuoi dati verranno sincronizzati automaticamente e il segnalibro funzionera.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isConnectionError && error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      Errore di connessione
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      Verifica la connessione internet e riprova.
                    </p>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-8 text-xs"
                      disabled={isLoading}
                    >
                      Riprova
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && !isConnectionError && (
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
