import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/register">
            <Button variant="outline">← Torna alla Registrazione</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Termini e Condizioni</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Ultimo aggiornamento: 11 febbraio 2026
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">Termini di Servizio</h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizzando Vector, accetti di monitorare i tuoi livelli di energia
                e fornire informazioni sulle tue attivita quotidiane, stile di vita e benessere.
                Questo servizio e progettato per aiutarti a comprendere i tuoi pattern energetici
                e ricevere raccomandazioni personalizzate.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Informativa sulla Privacy</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                La tua privacy e importante per noi. Ecco come gestiamo i tuoi dati:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>I dati principali sono conservati localmente sul tuo dispositivo tramite IndexedDB</li>
                <li>Alcuni dati (email, stato approvazione) vengono sincronizzati con il nostro server per la gestione degli account</li>
                <li>I dati sanitari raccolti tramite dispositivi wearable vengono elaborati da Sahha, un servizio terzo conforme alle normative sulla salute</li>
                <li>Mantieni la piena proprieta dei tuoi dati</li>
                <li>Puoi esportare o eliminare i tuoi dati in qualsiasi momento</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Raccolta Dati</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Raccogliamo le seguenti categorie di informazioni per fornirti
                un monitoraggio personalizzato della salute e dell'energia:
              </p>

              <h3 className="text-base font-semibold mt-4 mb-2">Dati del profilo personale</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Al completamento della registrazione, ti chiediamo di compilare un questionario iniziale che include:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Informazioni anagrafiche:</strong> nome, anno di nascita, genere</li>
                <li><strong>Dati fisici:</strong> altezza, peso</li>
                <li><strong>Occupazione:</strong> tipo (studente, lavoratore, ecc.), tipologia di lavoro, ore settimanali, tipo di orario (fisso, turni, flessibile)</li>
                <li><strong>Abitudini:</strong> livello di attivita fisica, ore di sonno, fumo, alcol, caffeina</li>
                <li><strong>Valutazione energia di base:</strong> livelli iniziali di energia fisica, mentale ed emotiva, pattern energetico giornaliero, livello di stress</li>
                <li><strong>Obiettivi:</strong> il tuo obiettivo principale (energia, sonno, fitness, stress, benessere)</li>
                <li><strong>Note aggiuntive:</strong> eventuali condizioni mediche o note personali (facoltativo)</li>
              </ul>

              <h3 className="text-base font-semibold mt-4 mb-2">Registrazioni giornaliere</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Livelli di energia: fisica, mentale ed emotiva (scala 1-10)</li>
                <li>Ore di lavoro/studio previste per la giornata</li>
                <li>Note giornaliere sullo stato di benessere</li>
                <li>Storico e trend nel tempo</li>
              </ul>

              <h3 className="text-base font-semibold mt-4 mb-2">Dati sanitari da dispositivi</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Se colleghi un dispositivo wearable (es. Apple Watch, Fitbit) tramite il servizio Sahha, raccogliamo:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Sonno:</strong> durata totale, tempo a letto, debito di sonno, regolarita, orari inizio/fine, sonno REM/profondo/leggero (se disponibile)</li>
                <li><strong>Attivita:</strong> passi, calorie bruciate, ore attive, piani saliti</li>
                <li><strong>Segni vitali:</strong> frequenza cardiaca a riposo, HRV, saturazione ossigeno, frequenza respiratoria</li>
                <li><strong>Corpo:</strong> peso, indice di massa corporea, VO2 Max</li>
                <li><strong>Scores di benessere:</strong> punteggi calcolati per sonno, attivita, benessere, prontezza e salute mentale</li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Utilizzo dei Dati da parte dell'Amministratore</h2>
              <p className="text-muted-foreground leading-relaxed">
                L'amministratore dell'applicazione ha accesso a una dashboard che mostra
                i dati aggregati e individuali degli utenti, inclusi profili personali,
                registrazioni energetiche e dati sanitari. Questo accesso e utilizzato
                esclusivamente per migliorare il servizio, personalizzare le raccomandazioni
                e monitorare l'efficacia del programma di benessere.
                Nessun dato viene condiviso con terze parti a scopi commerciali.
              </p>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">I Tuoi Diritti</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Hai i seguenti diritti riguardo ai tuoi dati:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong>Diritto di accesso:</strong> puoi visualizzare tutti i dati
                  memorizzati in qualsiasi momento attraverso l'interfaccia dell'app
                </li>
                <li>
                  <strong>Diritto di esportazione:</strong> puoi esportare i tuoi dati
                  in formato leggibile
                </li>
                <li>
                  <strong>Diritto alla cancellazione:</strong> puoi eliminare definitivamente
                  il tuo account e tutti i dati associati
                </li>
                <li>
                  <strong>Diritto di revoca:</strong> puoi smettere di usare il
                  servizio in qualsiasi momento
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Servizi Terzi</h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Vector utilizza i seguenti servizi terzi:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong>Sahha:</strong> per l'elaborazione dei dati sanitari provenienti
                  dai dispositivi wearable. I dati vengono trasmessi in forma anonimizzata
                  al profilo associato al tuo account
                </li>
                <li>
                  <strong>Supabase:</strong> per la sincronizzazione degli account tra dispositivi
                  e la gestione delle approvazioni utente
                </li>
                <li>
                  <strong>Funzionalita AI (opzionali):</strong> per l'analisi dei pattern energetici.
                  Nessuna informazione personale viene inclusa nelle richieste AI.
                  Puoi disabilitare le funzionalita AI in qualsiasi momento
                </li>
              </ul>
            </section>

            <Separator />

            <section>
              <h2 className="text-xl font-semibold mb-3">Modifiche ai Termini</h2>
              <p className="text-muted-foreground leading-relaxed">
                Potremmo aggiornare questi termini periodicamente. Sarai informato di
                eventuali modifiche significative attraverso l'app. L'uso continuato di
                Vector dopo tali modifiche costituisce accettazione dei nuovi termini.
              </p>
            </section>

            <div className="mt-8 p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground">
                Cliccando "Registrati" nella pagina di registrazione, confermi di aver
                letto, compreso e accettato questi Termini e Condizioni, inclusa la
                raccolta dei dati del profilo personale e dei dati sanitari.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
