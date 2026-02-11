import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useAuthState } from '../contexts/AuthContext';
import { useDarkMode } from '../lib/useDarkMode';
import { useAppSettings } from '../lib/useAppSettings';
import { getAllUsers, approveUser, revokeUser, deleteUser, isAdminEmail } from '../lib/auth';
import type { User } from '../db/schema';

export default function Settings() {
  const { user: currentUser } = useAuthState();
  const { isDark, toggleDark } = useDarkMode();
  const { settings, update: updateSettings } = useAppSettings();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const navigate = useNavigate();

  const loadUsers = async () => {
    const all = await getAllUsers();
    setUsers(all);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleApprove = async (userId: number, email: string) => {
    setActionLoading(userId);
    try {
      await approveUser(userId, email);
      await loadUsers();
    } catch (e) {
      console.error('Approve failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: number, email: string) => {
    setActionLoading(userId);
    try {
      await revokeUser(userId, email);
      await loadUsers();
    } catch (e) {
      console.error('Revoke failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: number, email: string) => {
    setActionLoading(userId);
    try {
      await deleteUser(userId, email);
      setConfirmDelete(null);
      await loadUsers();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingUsers = users.filter(u => !u.isApproved);
  const approvedUsers = users.filter(u => u.isApproved && !isAdminEmail(u.email));
  const adminUser = users.find(u => isAdminEmail(u.email));

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Gestisci il tuo account e le preferenze</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground truncate">{currentUser?.email}</p>
            </div>
            {currentUser?.isAdmin && (
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium shrink-0 ml-2">
                Admin
              </span>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tema</p>
              <p className="text-sm text-muted-foreground">{isDark ? 'Scuro' : 'Chiaro'}</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={toggleDark}>
              {isDark ? 'Passa a Chiaro' : 'Passa a Scuro'}
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Aggiornamento automatico</p>
              <p className="text-sm text-muted-foreground">Ricarica i dati quando torni nell'app</p>
            </div>
            <button
              onClick={() => updateSettings({ autoRefresh: !settings.autoRefresh })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                settings.autoRefresh ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Installa App</p>
              <p className="text-sm text-muted-foreground">Aggiungi alla schermata Home</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setShowInstallHelp(true)}>
              Istruzioni
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Install Help Modal */}
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}

      {/* Admin Dashboard Link */}
      {currentUser?.isAdmin && (
        <Card>
          <CardContent className="py-4">
            <Button
              className="w-full h-12 text-base"
              onClick={() => navigate('/admin')}
            >
              Dashboard Utenti
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Visualizza profili, energia e dati salute degli utenti
            </p>
          </CardContent>
        </Card>
      )}

      {/* Access Management - Admin Only */}
      {currentUser?.isAdmin && (
        <>
          <Separator />
          <div>
            <h2 className="text-xl font-bold">Gestione Accessi</h2>
            <p className="text-muted-foreground mt-1 text-sm">Approva, revoca o elimina gli utenti</p>
          </div>

          {/* Pending Users */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0"></span>
                In attesa ({pendingUsers.length})
              </CardTitle>
              <CardDescription>Utenti che attendono approvazione</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessun utente in attesa
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map(u => (
                    <div key={u.id} className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                      <div className="mb-2">
                        <p className="text-sm font-medium truncate">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-9 flex-1"
                          onClick={() => handleApprove(u.id!, u.email)}
                          disabled={actionLoading === u.id}
                        >
                          Approva
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 flex-1"
                          onClick={() => handleDelete(u.id!, u.email)}
                          disabled={actionLoading === u.id}
                        >
                          Rifiuta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin */}
          {adminUser && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0"></span>
                  Amministratore
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{adminUser.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(adminUser.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium shrink-0 ml-2">
                    Proprietario
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approved Users */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block shrink-0"></span>
                Utenti attivi ({approvedUsers.length})
              </CardTitle>
              <CardDescription>Utenti con accesso approvato</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessun altro utente attivo
                </p>
              ) : (
                <div className="space-y-3">
                  {approvedUsers.map(u => (
                    <div key={u.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {confirmDelete === u.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-9 flex-1"
                              onClick={() => handleDelete(u.id!, u.email)}
                              disabled={actionLoading === u.id}
                            >
                              Conferma eliminazione
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 flex-1"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Annulla
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 flex-1"
                              onClick={() => handleRevoke(u.id!, u.email)}
                              disabled={actionLoading === u.id}
                            >
                              Sospendi
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-9 flex-1"
                              onClick={() => setConfirmDelete(u.id ?? null)}
                              disabled={actionLoading === u.id}
                            >
                              Elimina
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {loading && currentUser?.isAdmin && (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Caricamento utenti...</p>
        </div>
      )}
    </div>
  );
}

function getPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function InstallHelpModal({ onClose }: { onClose: () => void }) {
  const platform = getPlatform();
  const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Installa Vector</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Chiudi">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isInstalled ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium">Vector e gia installata!</p>
            <p className="text-xs text-muted-foreground mt-1">Stai usando l'app dalla schermata Home.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Segui questi passaggi per aggiungere Vector alla schermata Home:
            </p>

            {platform === 'ios' && (
              <div className="space-y-3">
                <Step n={1}>
                  Tocca il pulsante <strong>Condividi</strong>{' '}
                  <ShareIcon />{' '}
                  in basso nella barra di Safari
                </Step>
                <Step n={2}>
                  Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong>
                </Step>
                <Step n={3}>
                  Tocca <strong>"Aggiungi"</strong> in alto a destra
                </Step>
              </div>
            )}

            {platform === 'android' && (
              <div className="space-y-3">
                <Step n={1}>
                  Tocca il menu{' '}
                  <DotsIcon />{' '}
                  (tre puntini) in alto a destra in Chrome
                </Step>
                <Step n={2}>
                  Tocca <strong>"Aggiungi a schermata Home"</strong> o <strong>"Installa app"</strong>
                </Step>
                <Step n={3}>
                  Conferma toccando <strong>"Installa"</strong>
                </Step>
              </div>
            )}

            {platform === 'desktop' && (
              <div className="space-y-3">
                <Step n={1}>
                  In Chrome, clicca l'icona di installazione{' '}
                  <DownloadIcon />{' '}
                  nella barra degli indirizzi
                </Step>
                <Step n={2}>
                  Clicca <strong>"Installa"</strong> nel popup
                </Step>
              </div>
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {isInstalled ? 'Chiudi' : 'Ho capito'}
        </button>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">{n}</span>
      <p className="text-sm">{children}</p>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="inline w-4 h-4 -mt-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
