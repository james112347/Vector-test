import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { useAuthState } from '../contexts/AuthContext';
import { useDarkMode } from '../lib/useDarkMode';
import { getAllUsers, approveUser, revokeUser, deleteUser, isAdminEmail } from '../lib/auth';
import type { User } from '../db/schema';

export default function Settings() {
  const { user: currentUser } = useAuthState();
  const { isDark, toggleDark } = useDarkMode();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const loadUsers = async () => {
    const all = await getAllUsers();
    setUsers(all);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleApprove = async (userId: number) => {
    setActionLoading(userId);
    await approveUser(userId);
    await loadUsers();
    setActionLoading(null);
  };

  const handleRevoke = async (userId: number) => {
    setActionLoading(userId);
    await revokeUser(userId);
    await loadUsers();
    setActionLoading(null);
  };

  const handleDelete = async (userId: number) => {
    setActionLoading(userId);
    await deleteUser(userId);
    setConfirmDelete(null);
    await loadUsers();
    setActionLoading(null);
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
        </CardContent>
      </Card>

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
                          onClick={() => handleApprove(u.id!)}
                          disabled={actionLoading === u.id}
                        >
                          Approva
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 flex-1"
                          onClick={() => handleDelete(u.id!)}
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
                              onClick={() => handleDelete(u.id!)}
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
                              onClick={() => handleRevoke(u.id!)}
                              disabled={actionLoading === u.id}
                            >
                              Sospendi
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-9 flex-1"
                              onClick={() => setConfirmDelete(u.id!)}
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
