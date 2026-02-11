import { useAuthState } from '../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';

export default function Dashboard() {
  const { user } = useAuthState();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ciao, {user?.email}</h1>
        <p className="text-muted-foreground mt-1">
          La tua dashboard energetica personalizzata
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dashboard Energia</CardTitle>
          <CardDescription>
            Monitora i tuoi livelli di energia su tre dimensioni
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            La dashboard apparirà qui. Tracking attivo dalla Fase 3.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-600 dark:text-blue-400">
              Energia Fisica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Prossimamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-600 dark:text-green-400">
              Energia Mentale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Prossimamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-amber-600 dark:text-amber-400">
              Energia Emotiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Prossimamente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
