import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useAuthState } from '../contexts/AuthContext';
import { useDarkMode } from '../lib/useDarkMode';
import { useAppSettings } from '../lib/useAppSettings';
import { isNotificationSupported, requestNotificationPermission, getNotificationPermission } from '../lib/notifications';
import { getAllUsers, approveUser, revokeUser, deleteUser, isAdminEmail, changePassword } from '../lib/auth';
import { getAllUserActivity, type UserActivity } from '../lib/useActivityTracker';
import { getSahhaQR, saveSahhaQR, deleteSahhaQR } from '../lib/qr-config';
import { Input } from '../components/ui/input';
import type { User } from '../db/schema';

export default function Settings() {
  const { user: currentUser } = useAuthState();
  const { isDark, toggleDark } = useDarkMode();
  const { settings, update: updateSettings } = useAppSettings();
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [activityData, setActivityData] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const navigate = useNavigate();

  const loadUsers = async () => {
    try {
      setLoadError('');
      const all = await getAllUsers();
      setUsers(all);
    } catch (e) {
      console.error('Load users failed:', e);
      setLoadError('Errore nel caricamento utenti. Controlla la connessione.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    if (currentUser?.isAdmin) {
      getAllUserActivity().then(setActivityData);
    }
  }, [currentUser?.isAdmin]);

  const handleApprove = async (userId: number, email: string) => {
    setActionLoading(userId);
    setActionError('');
    try {
      await approveUser(userId, email);
      await loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore durante l\'approvazione.';
      setActionError(msg);
      console.error('Approve failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId: number, email: string) => {
    setActionLoading(userId);
    setActionError('');
    try {
      await revokeUser(userId, email);
      await loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore durante la sospensione.';
      setActionError(msg);
      console.error('Revoke failed:', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: number, email: string) => {
    setActionLoading(userId);
    setActionError('');
    try {
      await deleteUser(userId, email);
      setConfirmDelete(null);
      await loadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Errore durante l\'eliminazione.';
      setActionError(msg);
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
          {isNotificationSupported() && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifiche</p>
                  <p className="text-sm text-muted-foreground">
                    {getNotificationPermission() === 'denied'
                      ? 'Bloccate dal browser - abilita dalle impostazioni'
                      : 'Ricevi avvisi su nuovi feedback'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!settings.notificationsEnabled) {
                      const granted = await requestNotificationPermission();
                      if (granted) updateSettings({ notificationsEnabled: true });
                    } else {
                      updateSettings({ notificationsEnabled: false });
                    }
                  }}
                  disabled={getNotificationPermission() === 'denied'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                    settings.notificationsEnabled ? 'bg-primary' : 'bg-muted'
                  } ${getNotificationPermission() === 'denied' ? 'opacity-40' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-sm text-muted-foreground">Modifica la password del tuo account</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => { setShowChangePassword(!showChangePassword); setPwdError(''); setPwdSuccess(false); }}>
              {showChangePassword ? 'Annulla' : 'Cambia'}
            </Button>
          </div>
          {showChangePassword && (
            <div className="space-y-3 pt-1">
              <Input
                type="password"
                placeholder="Password attuale"
                value={currentPwd}
                onChange={e => setCurrentPwd(e.target.value)}
                disabled={pwdLoading}
                className="h-10"
              />
              <Input
                type="password"
                placeholder="Nuova password (min 6 caratteri)"
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                disabled={pwdLoading}
                className="h-10"
              />
              <Input
                type="password"
                placeholder="Conferma nuova password"
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                disabled={pwdLoading}
                className="h-10"
              />
              {pwdError && <p className="text-xs text-red-600 dark:text-red-400">{pwdError}</p>}
              {pwdSuccess && <p className="text-xs text-green-600 dark:text-green-400">Password aggiornata con successo!</p>}
              <Button
                size="sm"
                className="w-full h-10"
                disabled={pwdLoading || !currentPwd || !newPwd || !confirmPwd}
                onClick={async () => {
                  setPwdError('');
                  setPwdSuccess(false);
                  if (newPwd !== confirmPwd) { setPwdError('Le password non corrispondono.'); return; }
                  if (newPwd.length < 6) { setPwdError('La password deve avere almeno 6 caratteri.'); return; }
                  setPwdLoading(true);
                  try {
                    await changePassword(currentUser!.id!, currentPwd, newPwd);
                    setPwdSuccess(true);
                    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
                  } catch (e) {
                    setPwdError(e instanceof Error ? e.message : 'Errore durante il cambio password.');
                  } finally {
                    setPwdLoading(false);
                  }
                }}
              >
                {pwdLoading ? 'Aggiornamento...' : 'Aggiorna password'}
              </Button>
            </div>
          )}
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
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Termini e Condizioni</p>
              <p className="text-sm text-muted-foreground">Privacy, dati raccolti e diritti</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => navigate('/terms', { state: { from: 'settings' } })}>
              Consulta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Install Help Modal */}
      {showInstallHelp && <InstallHelpModal onClose={() => setShowInstallHelp(false)} />}

      {/* Come funziona il sistema */}
      <HowItWorksSection />

      {/* Sahha QR Code Section */}
      <SahhaQRSection isAdmin={!!currentUser?.isAdmin} />

      {/* Novità e Aggiornamenti */}
      <ChangelogSection />

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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Gestione Accessi</h2>
              <p className="text-muted-foreground mt-1 text-sm">Approva, revoca o elimina gli utenti</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => { setLoading(true); loadUsers(); if (currentUser?.isAdmin) getAllUserActivity().then(setActivityData); }}
              disabled={loading}
            >
              {loading ? 'Caricamento...' : 'Ricarica'}
            </Button>
          </div>

          {actionError && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{actionError}</p>
            </div>
          )}

          {loadError && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Gli utenti su Supabase potrebbero non essere visibili. Prova a ricaricare.
              </p>
            </div>
          )}

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
                  {approvedUsers.map(u => {
                    const activity = activityData.find(a => a.email === u.email);
                    return (
                      <div key={u.id} className="p-3 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{u.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                          {activity && (
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-xs font-medium">{activity.total_sessions} sessioni</p>
                              <p className="text-[10px] text-muted-foreground">
                                {activity.total_minutes >= 60
                                  ? `${Math.floor(activity.total_minutes / 60)}h ${activity.total_minutes % 60}m`
                                  : `${activity.total_minutes}m`
                                } totali
                              </p>
                            </div>
                          )}
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
                    );
                  })}
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

function HowItWorksSection() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <CardTitle className="text-base">Come funziona Vector</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Dati, calcolo scientifico e intelligenza artificiale</p>
              </div>
            </div>
            <svg
              className={`w-5 h-5 text-muted-foreground transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <Separator className="mb-3" />

          {/* 1. Data Input */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <p className="text-sm font-semibold">Dati in ingresso</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vector raccoglie dati da piu fonti per costruire un quadro completo della tua energia:
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: 'Profilo e routine', desc: 'Eta, peso, cronotipo, orari sveglia/letto/pasti/lavoro' },
                { label: 'Quick check-in', desc: 'Qualita sonno, umore, stress, focus, acqua, caffeina, pasti, attivita' },
                { label: 'Energy log giornaliero', desc: 'Livelli fisico/mentale/emotivo (1-10), ore lavoro' },
                { label: 'Food scanner', desc: 'Calorie, macronutrienti (proteine/carboidrati/grassi), indice glicemico' },
                { label: 'Sahha Health', desc: 'Biomarker da wearable: frequenza cardiaca, HRV, passi, durata sonno' },
                { label: 'Screen time', desc: 'Minuti di utilizzo app, sessioni, pause schermo' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-[11px] font-medium">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Calcolo Scientifico */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">2</span>
              </div>
              <p className="text-sm font-semibold">Calcolo scientifico (Energy Score 0-100)</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Il punteggio energetico e calcolato in tempo reale come somma di 4 componenti (0-25 ciascuna),
              basate su modelli scientifici validati:
            </p>
            <div className="space-y-2">
              <ComponentExplainer
                color="#6366f1"
                title="Ritmo circadiano (0-25)"
                model="Modello Borbely Two-Process"
                desc="Process C (orologio biologico 24h) + Process S (pressione omeostatica del sonno). Include cicli ultradiani BRAC di 90-100min, calo post-prandiale dopo i pasti, e risposta cortisolo mattutino (CAR). Il cronotipo (Leone/Orso/Lupo/Delfino) determina la fase del ritmo."
              />
              <ComponentExplainer
                color="#8b5cf6"
                title="Sonno (0-25)"
                model="Modello Van Dongen"
                desc="Qualita percepita, durata effettiva vs ottimale (8h), debito di sonno cumulativo degli ultimi 7 giorni con peso di recenza. Considera pisolini (recupero parziale), impatto alcol sulla qualita del sonno, e punteggio readiness da Sahha."
              />
              <ComponentExplainer
                color="#22c55e"
                title="Stile di vita (0-25)"
                model="Ganio 2011, Nehlig 2018, POMS"
                desc="Idratazione (ml/kg peso corporeo), bilancio macronutrienti, farmacocinetica caffeina (emivita 5h, effetto su A2A adenosina), attivita fisica (boost acuto POMS), impatto fumo (vasocostrizione) e alcol, affaticamento da schermo."
              />
              <ComponentExplainer
                color="#f59e0b"
                title="Carico allostatico (0-25)"
                model="Modello McEwen"
                desc="Ore di lavoro, stress percepito e trend 7 giorni, umore e trend emotivo, HRV come proxy di recupero autonomico (SDNN), giorni consecutivi con energia bassa (indicatore burnout), focus cognitivo."
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1 italic">
              Quando piu componenti sono critici insieme, si applica una penalita di interazione
              moltiplicativa (fino a -15 punti) perche la fatica si amplifica in modo non lineare.
            </p>
          </div>

          {/* 3. Curva Predittiva */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-green-600 dark:text-green-400">3</span>
              </div>
              <p className="text-sm font-semibold">Curva predittiva (12 ore)</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La curva energetica proietta il tuo livello di energia nelle prossime 12 ore.
              Combina il ritmo circadiano del tuo cronotipo, la pressione del sonno crescente,
              il decadimento della caffeina (emivita 5h), i cali post-prandiali previsti
              e il trascinamento del debito di sonno.
            </p>
          </div>

          {/* 4. Machine Learning */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">4</span>
              </div>
              <p className="text-sm font-semibold">Machine Learning (Intelligence)</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dopo 3+ giorni di dati, il motore ML analizza i tuoi pattern:
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { label: 'Analisi trend', desc: 'La tua energia sta migliorando, e stabile o in calo?' },
                { label: 'Rilevamento pattern', desc: 'Es: "quando dormi meno di 6h, il fisico cala del 30% il giorno dopo"' },
                { label: 'Correlazioni', desc: 'Quali fattori impattano di piu la tua energia (sonno, stress, attivita...)' },
                { label: 'Previsione crash', desc: 'Allarme se i pattern indicano un probabile crollo energetico imminente' },
                { label: 'Report settimanale', desc: 'Voto A-F con analisi dettagliata e consigli personalizzati' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-[11px] font-medium">{item.label}</span>
                    <span className="text-[11px] text-muted-foreground"> — {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Sistema di Orientamento */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">5</span>
              </div>
              <p className="text-sm font-semibold">Sistema di orientamento</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In base al tuo stato energetico attuale, il sistema sceglie da un catalogo di 50+
              attivita quella piu adatta. Confronta il tuo livello di energia con il carico cognitivo
              e fisico richiesto da ogni attivita, la durata, e il tuo profilo.
              Il consiglio "Cosa fare adesso" in home viene da questo motore.
            </p>
          </div>

          {/* 6. Bottleneck */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">6</span>
              </div>
              <p className="text-sm font-semibold">Identificazione colli di bottiglia</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Il sistema analizza tutti i fattori e identifica il punto debole piu critico:
              sonno, idratazione, nutrizione, stress, sovraccarico lavorativo, sedentarieta,
              caffeina tardiva, affaticamento da schermo, rischio burnout o debito di sonno.
              Per ogni collo di bottiglia fornisce un consiglio azionabile specifico.
            </p>
          </div>

          {/* 7. Privacy */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <p className="text-sm font-semibold">Privacy e dati</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tutti i calcoli avvengono in locale sul tuo dispositivo (offline-first).
              I dati sono salvati in IndexedDB e sincronizzati con il cloud solo per
              backup e accesso multi-device. Nessun dato viene condiviso con terze parti.
              L'IA (Groq) riceve solo dati aggregati e anonimi per generare consigli.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ComponentExplainer({
  color,
  title,
  model,
  desc,
}: {
  color: string;
  title: string;
  model: string;
  desc: string;
}) {
  return (
    <div className="rounded-md bg-muted/30 border border-border/50 p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-semibold">{title}</span>
      </div>
      <p className="text-[10px] text-muted-foreground/70 italic mb-0.5">
        Basato su: {model}
      </p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

function SahhaQRSection({ isAdmin }: { isAdmin: boolean }) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showShareMode, setShowShareMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSahhaQR().then(url => { setQrImage(url); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine (JPG, PNG, ecc.)');
      return;
    }

    setUploading(true);
    setError('');
    try {
      // Compress and convert to base64
      const dataUrl = await compressImage(file, 800, 0.85);
      await saveSahhaQR(dataUrl);
      setQrImage(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setUploading(true);
    try {
      await deleteSahhaQR();
      setQrImage(null);
    } catch {
      setError('Errore durante la rimozione.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return null;
  if (!qrImage && !isAdmin) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <CardTitle className="text-lg">Registrazione Sahha</CardTitle>
          </div>
          <CardDescription>QR per collegare l'account Sahha dei partecipanti</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {qrImage ? (
            <>
              {/* Tip banner: show to another user */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Devi mostrare questo QR a un altro utente
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Un utente che deve registrarsi su Sahha deve inquadrare questo codice dal <strong>suo</strong> telefono con l'app Sahha.
                      Tocca il pulsante qui sotto per mostrarglielo a schermo intero.
                    </p>
                  </div>
                </div>
              </div>

              {/* Show to friend button */}
              <Button
                className="w-full h-11"
                onClick={() => setShowShareMode(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Mostra QR a un altro utente
              </Button>

              {/* Compact QR preview */}
              <button
                onClick={() => setShowFullscreen(true)}
                className="w-full flex flex-col items-center py-2"
              >
                <div className="bg-white rounded-xl p-2 shadow-sm border border-border">
                  <img
                    src={qrImage}
                    alt="QR Code Sahha"
                    className="w-32 h-32 object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Tocca per ingrandire</p>
              </button>

              {/* Admin controls */}
              {isAdmin && (
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Sostituisci QR
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-9"
                    onClick={handleDelete}
                    disabled={uploading}
                  >
                    Rimuovi
                  </Button>
                </div>
              )}
            </>
          ) : isAdmin ? (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Carica il codice QR del tuo progetto Sahha per permettere agli utenti di registrarsi.
              </p>
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-10"
              >
                {uploading ? 'Caricamento...' : 'Carica QR Code'}
              </Button>
            </div>
          ) : null}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </CardContent>
      </Card>

      {/* Fullscreen QR Modal */}
      {showFullscreen && qrImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img
              src={qrImage}
              alt="QR Code Sahha"
              className="w-full aspect-square object-contain"
            />
            <p className="text-center text-sm text-gray-600 mt-3">
              Inquadra con l'app Sahha
            </p>
            <button
              onClick={() => setShowFullscreen(false)}
              className="w-full mt-4 py-2.5 text-sm font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Share Mode: guided fullscreen for showing QR to another user */}
      {showShareMode && qrImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowShareMode(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-green-600 text-white px-5 py-4">
              <h3 className="text-base font-semibold">Mostra questo QR all'altro utente</h3>
              <p className="text-green-100 text-xs mt-1">
                L'altro utente deve inquadrarlo con l'app Sahha dal suo telefono
              </p>
            </div>

            {/* Steps for the OTHER user */}
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Istruzioni per l'altro utente:
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold shrink-0">1</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Scarica l'app <strong>Sahha</strong> sul tuo telefono (
                    <a href="https://apps.apple.com/app/sahha/id1615682279" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 underline">iOS</a>
                    {' / '}
                    <a href="https://play.google.com/store/apps/details?id=com.sahha.android" target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 underline">Android</a>)
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold shrink-0">2</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Apri Sahha e tocca <strong>"Join a Project"</strong> o <strong>"Scansiona QR"</strong>
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold shrink-0">3</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Inquadra il codice QR qui sotto con la fotocamera di Sahha
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center px-5 pb-4">
              <div className="bg-white rounded-xl p-4 shadow-md border border-gray-200">
                <img
                  src={qrImage}
                  alt="QR Code Sahha"
                  className="w-56 h-56 object-contain"
                />
              </div>
            </div>

            {/* Hint */}
            <div className="mx-5 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-700 dark:text-amber-300 text-center">
                Tieni fermo lo schermo mentre l'altro utente inquadra il QR
              </p>
            </div>

            <div className="px-5 pb-5">
              <button
                onClick={() => setShowShareMode(false)}
                className="w-full py-2.5 text-sm font-medium rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function compressImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas non supportato')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Errore lettura file'));
    reader.readAsDataURL(file);
  });
}

const CHANGELOG = [
  {
    version: '1.5',
    date: '12 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Notifiche precise con timestamp, vibrazione e navigazione al tocco' },
      { type: 'new' as const, text: 'Badge contatore notifiche non lette sull\'icona app' },
      { type: 'new' as const, text: 'Tocca una notifica per aprire direttamente la pagina giusta' },
      { type: 'fix' as const, text: 'Pulsante assistenza alzato per non sovrapporsi alla barra' },
    ],
  },
  {
    version: '1.4',
    date: '11 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Popup richiesta attivazione notifiche' },
      { type: 'new' as const, text: 'Invio rapido dopo condivisione allegato in chat' },
      { type: 'new' as const, text: 'Allegati screenshot e video nella chat assistenza' },
      { type: 'fix' as const, text: 'Chat non si sovrappone alla tastiera su iOS' },
    ],
  },
  {
    version: '1.3',
    date: '10 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Termini e condizioni consultabili dalle impostazioni' },
      { type: 'new' as const, text: 'Sincronizzazione dati cross-device per segnalibro/PWA' },
      { type: 'new' as const, text: 'Sync automatica dati Sahha da webhook (app chiusa)' },
      { type: 'fix' as const, text: 'Login da segnalibro funziona senza sync preventiva' },
    ],
  },
  {
    version: '1.2',
    date: '9 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Notifiche feedback in tempo reale con Supabase Realtime' },
      { type: 'new' as const, text: 'Dashboard admin con widget e gestione utenti' },
      { type: 'new' as const, text: 'IA completa: quick tip, analisi settimanale, previsioni energia' },
      { type: 'fix' as const, text: 'Utenti mancanti nella lista e tracking attività corretto' },
    ],
  },
  {
    version: '1.1',
    date: '8 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Chat IA per feedback e assistenza con invio ad admin' },
      { type: 'new' as const, text: 'Popup periodici sul pulsante chat con messaggi variati' },
      { type: 'new' as const, text: 'Auto-refresh energia e toggle nelle impostazioni' },
      { type: 'fix' as const, text: 'Popup aggiornamento app migliorato e informativo' },
    ],
  },
  {
    version: '1.0',
    date: '7 Feb 2025',
    entries: [
      { type: 'new' as const, text: 'Tracking energetico con dashboard, log e storico' },
      { type: 'new' as const, text: 'Integrazione Sahha Health per dati wearable' },
      { type: 'new' as const, text: 'Sistema approvazione utenti e gestione accessi' },
      { type: 'new' as const, text: 'Micro check-in e algoritmo IA per calcolo energia' },
    ],
  },
];

function ChangelogSection() {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const changelogRef = useRef<HTMLDivElement>(null);
  const visibleEntries = expanded ? CHANGELOG : CHANGELOG.slice(0, 2);

  // Auto-scroll when arriving from update notification or "Scopri le novità"
  useEffect(() => {
    const shouldScroll =
      (location.state as any)?.scrollToChangelog ||
      location.hash === '#changelog';
    if (shouldScroll && changelogRef.current) {
      setTimeout(() => {
        changelogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [location]);

  return (
    <Card ref={changelogRef} id="changelog">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <CardTitle className="text-lg">Novità e Aggiornamenti</CardTitle>
          </div>
          <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
            v{CHANGELOG[0].version}
          </span>
        </div>
        <CardDescription>Tutte le correzioni e le nuove funzionalità</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleEntries.map((release, i) => (
          <div key={release.version}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-baseline justify-between mb-2.5">
              <h4 className="text-sm font-bold">Versione {release.version}</h4>
              <span className="text-[11px] text-muted-foreground">{release.date}</span>
            </div>
            <div className="space-y-1.5">
              {release.entries.map((entry, j) => (
                <div key={j} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    entry.type === 'new'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {entry.type === 'new' ? 'NUOVO' : 'FIX'}
                  </span>
                  <p className="text-sm text-muted-foreground">{entry.text}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {CHANGELOG.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-sm text-primary hover:text-primary/80 font-medium py-2 transition-colors"
          >
            {expanded ? 'Mostra meno' : `Mostra tutte le versioni (${CHANGELOG.length})`}
          </button>
        )}
      </CardContent>
    </Card>
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
