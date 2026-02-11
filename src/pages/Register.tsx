import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Separator } from '../components/ui/separator';
import { useAuthActions } from '../contexts/AuthContext';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const { register } = useAuthActions();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La password deve essere di almeno 8 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }

    if (!hasAcceptedTerms) {
      setError('Devi accettare i Termini e Condizioni per registrarti');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, hasAcceptedTerms);
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione fallita');
    } finally {
      setIsLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <CardTitle className="text-xl">Registrazione completata!</CardTitle>
            <CardDescription className="text-base mt-2">
              Il tuo account è in attesa di approvazione da parte dell'amministratore.
              Riceverai accesso non appena il tuo account sarà verificato.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Puoi provare ad accedere più tardi per verificare lo stato.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={() => navigate('/login')}
            >
              Torna al Login
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
          <CardTitle className="text-xl">Crea il tuo account</CardTitle>
          <CardDescription>Inizia il tuo percorso di monitoraggio energetico</CardDescription>
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
                placeholder="Almeno 8 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Reinserisci la password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 text-base"
              />
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="terms"
                checked={hasAcceptedTerms}
                onCheckedChange={(checked) => setHasAcceptedTerms(checked === true)}
                disabled={isLoading}
                className="mt-0.5 w-5 h-5"
              />
              <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
                Accetto i{' '}
                <button
                  type="button"
                  onClick={() => setShowTerms(!showTerms)}
                  className="text-primary hover:underline font-medium"
                >
                  Termini e Condizioni
                </button>
              </Label>
            </div>

            {showTerms && (
              <div className="rounded-lg border border-border bg-muted/50 max-h-60 overflow-y-auto p-4 space-y-4 text-sm">
                <h3 className="font-semibold text-base">Termini di Servizio</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Utilizzando Vector, accetti di monitorare i tuoi livelli di energia
                  e fornire informazioni sulle tue attivita quotidiane, stile di vita e benessere.
                </p>

                <Separator />

                <h3 className="font-semibold text-base">Privacy e Raccolta Dati</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>I dati sono conservati localmente e sincronizzati per la gestione account</li>
                  <li>Dopo la registrazione compili un profilo: dati personali, occupazione, turni/orari, abitudini (fumo, alcol, caffeina), energia di base e obiettivi</li>
                  <li>Registriamo livelli di energia giornalieri e ore di lavoro</li>
                  <li>Se colleghi un wearable: dati sonno (durata, REM, profondo), attivita, segni vitali</li>
                  <li>L'amministratore puo visualizzare i tuoi dati per migliorare il servizio</li>
                </ul>

                <Separator />

                <h3 className="font-semibold text-base">I Tuoi Diritti</h3>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li><strong>Accesso:</strong> Puoi visualizzare tutti i dati memorizzati</li>
                  <li><strong>Esportazione:</strong> Puoi esportare i tuoi dati</li>
                  <li><strong>Cancellazione:</strong> Puoi eliminare account e dati</li>
                  <li><strong>Revoca:</strong> Puoi smettere di usare il servizio in qualsiasi momento</li>
                </ul>

                <Separator />

                <h3 className="font-semibold text-base">Servizi Terzi</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Vector utilizza Sahha per i dati wearable, Supabase per la sincronizzazione account,
                  e funzionalita AI opzionali per l'analisi dei pattern energetici.
                </p>

                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-xs text-center text-muted-foreground">
                    Cliccando "Registrati" confermi di aver letto e accettato questi Termini e Condizioni,
                    inclusa la raccolta dei dati del profilo personale e sanitari.
                  </p>
                </div>

                <Link to="/terms" className="block text-center text-xs text-primary hover:underline mt-2">
                  Leggi i Termini completi
                </Link>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 px-6 pt-6 pb-6">
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isLoading || !hasAcceptedTerms}
            >
              {isLoading ? 'Creazione account...' : 'Registrati'}
            </Button>
            <p className="text-sm text-muted-foreground text-center pb-2">
              Hai già un account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Accedi
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
