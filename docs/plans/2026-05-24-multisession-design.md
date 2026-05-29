# C1b: Multisession & Session Recovery Plan

> **Datum:** 2026-05-24  
> **Stav:** implementační plán po C1a Multiuser Foundation progress  
> **Jazyk plánu:** čeština  
> **Primární cíl:** udělat z tmuxu robustní, bezpečně izolovaný backend detail pro perzistentní multisession DeckTerm a současně doplnit serverové session recovery API/protokol, UI pro aktivní/odpojené session a granularitu oprávnění `attach` vs. `write`.

---

## 1. Kontext a závazná architektonická rozhodnutí

Tento plán navazuje na rozpracovanou C1a větev. C1a už posunula DeckTerm od ad-hoc single-user kontroly k základům multiuser modelu:

- identita aktéra je řešena přes `backend/services/foundation-actors.ts`,
- SQLite foundation DB obsahuje `users`, `project_roots`, `terminal_sessions`, `audit_events`, `auth_identities`, `scoped_grants`,
- vytváření terminálu zapisuje `terminal_sessions`,
- WebSocket attach už používá persisted terminal session metadata přes `authorizeTerminalAttach`,
- existuje explicitní bootstrap/admin flow a auditování allow/deny rozhodnutí.

Výstupy z MoA jsou pro C1b závazné:

1. **tmux je implementační detail backendu**  
   Frontend ani autorizace nesmí parsovat tmux session names. Identita terminálu a owner metadata žijí v SQLite (`terminal_sessions`) přes opaque terminal IDs. Operace nad terminálem musí jít přes čistý backend interface.

2. **tmux session names musí být opaque**  
   Aktuální tvar `deckterm_p4174_ownerId_terminalId` je nevhodný: leakne owner/user info do `ps`/tmux listingu a svádí k autorizaci parsováním názvu. Cíl: `deckterm_<instance>_<opaqueTerminalId>` nebo hash bez user dat.

3. **tmux musí používat izolovaný socket/server**  
   Nepoužívat default tmux user server. Použít např. `tmux -S /tmp/deckterm/<instance>.sock ...` nebo `tmux -L deckterm-<instance> ...`, ideálně s directory `0700`.

4. **bezpečnostní hranice je aplikační, ne OS-level**  
   Dokumentovat a v UI/admin docs vysvětlit, že všechny sessions běží pod stejným Bun Unix uživatelem. Multiuser permissions v DeckTermu neznamenají unixovou izolaci procesů, souborů ani secrets.

5. **granulární autorizace**  
   `terminal.attach` = monitoring/read-only připojení.  
   `terminal.write` = interaktivní vstup.  
   Linked View s input sharing nesmí být implicitně povolený jen přes `terminal.attach`.

6. **session recovery UX a protokoly**  
   UI musí ukazovat aktivní/odpojené session, explicitní reconnect trigger, čisté stavy a reconnect protokol včetně `last-event-id` nebo obdobného cursoru.

---

## 2. Detailní analýza současného kódu

### 2.1 `backend/server.ts`

Relevantní aktuální stav:

- `Terminal` je in-memory runtime objekt v `terminals: Map<string, Terminal>`.
- `Terminal` obsahuje `ownerId`, `ownerEmail`, `sessionName`, scrollback buffer, runtime state (`running`, `agentName`, `agentState`) a tmux pipe metadata.
- `TMUX_BACKEND` přepíná raw Bun PTY vs tmux backend.
- `TMUX_SESSION_NAMESPACE` se odvozuje z `TMUX_SESSION_NAMESPACE` nebo portu (`p4174`), prefix je `deckterm_<namespace>`.
- `recoverTmuxSessions()` při startu:
  - volá `tmux list-sessions` bez izolovaného socketu,
  - filtruje podle prefixu,
  - parsuje `ownerId` a `terminalId` z tmux session name,
  - obnoví runtime in-memory `Terminal` přes `createManagedTerminal()` s `ownerEmail: "recovered"`.
- `createOwnedTerminal()` generuje `id = crypto.randomUUID()` a při tmux backendu volá `buildTmuxSessionName({ namespace, ownerId, terminalId: id })`.
- `createManagedTerminal()` při tmux backendu:
  - vytváří tmux session přes `tmux new-session ...`,
  - vypíná status bar,
  - synchronizuje size,
  - používá `pipe-pane` do `/tmp/deckterm-tmux-pipes/<sessionName>.log`,
  - připojuje se přes `tmux attach-session -t <sessionName>`.
- Všechny tmux příkazy (`list-sessions`, `new-session`, `display-message`, `capture-pane`, `pipe-pane`, `resize-window`, `resize-pane`, `attach-session`, `kill-session`, `set-option`) jdou na default tmux server.
- HTTP `/api/terminals`:
  - `POST` vyžaduje `terminal.create` a `root.use`, vytvoří terminál a zapíše `terminal_sessions`,
  - `GET` stále filtruje `Array.from(terminals.values()).filter((t) => t.ownerId === ownerId)`, tj. nezobrazuje terminaly sdílené grantem a nečte serverový session katalog jako zdroj pravdy,
  - `DELETE` a `resize` používají `requireTerminalSessionAccess(... terminal.manage)`.
- `POST /api/terminals/:id/linked-view`:
  - autorizuje jen `terminal.attach` k source terminálu,
  - vytvoří nový in-memory `Terminal` se stejným `sessionName`,
  - tím fakticky vznikne další interaktivní view, ale `terminal.write` capability zatím neexistuje.
- WebSocket `/ws/terminals/:id`:
  - autentizuje aktéra,
  - kontroluje bootstrap,
  - kontroluje existenci in-memory terminálu,
  - zajišťuje DB row, pokud chybí,
  - autorizuje `terminal.attach`, audit allow/deny,
  - ve `message()` následně bez další autorizace přijímá `input`, `resize`, raw string i binary input.
- Reconnect lifecycle už existuje:
  - server posílá `reconnect_lifecycle` fáze `replay-start`, `replay-complete`, `ready`,
  - klient posílá `resume-ready`,
  - tmux backend replayuje `capture-pane`, raw backend replayuje in-memory scrollback.
- `handoffTmuxSession()` při tmux backendu zavírá cizí sockety pro stejný `sessionName`, aby se nebil tmux attach; to je v konfliktu s cílem „monitorovací attach“/multi-view bez implicitního takeoveru.
- SIGINT/SIGTERM zabíjí všechny `term.proc`, což u tmux attach procesu nemusí nutně zabít tmux session, ale chování je dnes nečisté a recovery spoléhá na tmux sessions z default serveru.

### 2.2 `backend/tmux-session-names.ts`

Současný stav:

```ts
export function buildTmuxSessionName({ namespace, ownerId, terminalId }) {
  const prefix = getTmuxSessionPrefix(namespace);
  const safeOwnerId = sanitizeTmuxToken(ownerId, {
    fallback: "anonymous",
    maxLength: 20,
  });
  return `${prefix}_${safeOwnerId}_${String(terminalId || "").trim()}`;
}

export function parseTmuxSessionName(sessionName, prefix) {
  // vrací { ownerId, terminalId }
}
```

Problémy:

- `ownerId` je součástí tmux názvu a může leakovat identitu.
- Recovery aktuálně parsuje ownera z názvu a tím míchá backend runtime detail s autorizací/session modelem.
- Test `backend/tmux-session-names.test.ts` explicitně očekává owner v názvu, musí být změněn.

### 2.3 `backend/services/foundation-state.ts`

Aktuální schema a helpery jsou dobrý základ, ale C1b potřebuje migraci:

- `ScopedGrantCapability` obsahuje jen `terminal.create`, `terminal.attach`, `terminal.manage`, `root.use`.
- `terminal_sessions` obsahuje `id`, `actor_user_id`, `root_id`, `cwd`, `status`, timestamps.
- Neobsahuje backend metadata (`backend_type`, `backend_session_id/name`, `socket_name/path`, `recovery_generation`, `last_event_id`, `detached_at`, `active_connection_count`).
- Neexistuje tabulka pro jednotlivá klientská připojení/views.
- Neexistuje event log pro recovery cursor (`last-event-id`).

### 2.4 `backend/services/foundation-authorization.ts`

Aktuální stav:

- `authorizeTerminalSessionAccess()` povoluje ownera nebo grant pro `terminal.attach`/`terminal.manage`.
- `authorizeTerminalAttach()` je wrapper na `terminal.attach`.
- `getRouteCapability()` zná `POST /api/terminals`, `DELETE`, `resize`, WebSocket attach.

C1b rozšíření:

- přidat `terminal.write`,
- oddělit attach/read-only od write/input,
- zvážit zvláštní `terminal.reconnect` není nutné, pokud je reconnect forma attach; rozhodující je write mode,
- route capability registry musí pokrýt nové endpointy: session list, recovery, linked view mode.

### 2.5 `web/app.js` a frontend recovery

Aktuální stav:

- `ReconnectingWebSocket` umí automatické reconnect retry, heartbeat, `reconnect_lifecycle`, `session_handoff`, `terminal_state`, `exit`, `terminal_dead`.
- `SessionRegistry` ukládá lokální mapu `deckterm-session-registry` v `localStorage` s `workspaceId`, `cwd`, `tabNum`.
- `TerminalManager.checkExistingTerminals()` volá `/api/terminals`, čistí lokální registry podle server terminal IDs a reconnectuje nalezené terminaly.
- `web/bootstrap-routing.js` seskupuje `serverTerminals` podle `sharedSessionKey`, ale `shouldBootstrapLinkedView()` dnes vždy vrací `false`.
- UI neukazuje explicitní seznam active/detached sessions; recovery je implicitní při loadu.
- Klient při inputu vždy posílá `{ type: "input" }`; neumí read-only attach.

---

## 3. Cílová architektura C1b

### 3.1 Terminal identity a persistence

- Primární identita terminálu: `terminal_sessions.id` (`crypto.randomUUID()` nebo obdobný opaque ID).
- Vlastník: `terminal_sessions.actor_user_id`.
- Backend session reference: uložená v DB, ne parsovaná z tmux názvu.
- Tmux session name: opaque runtime locator, např. `deckterm_p4174_<terminalIdWithoutDashes>` nebo `deckterm_p4174_<shortHash>`. Nesmí obsahovat email, username, Cloudflare `sub` ani jiné user info.
- Autorizace smí používat pouze DB metadata a granty, nikdy tmux name.

### 3.2 Backend abstraction

Zavést rozhraní pro terminálový backend a tím izolovat tmux operace:

```ts
type TerminalBackendMode = "raw" | "tmux";

type TerminalBackendSession = {
  terminalId: string;
  backendMode: TerminalBackendMode;
  backendSessionName?: string;
  cwd: string;
  cols: number;
  rows: number;
};

interface TerminalBackend {
  mode: TerminalBackendMode;
  createSession(
    input: CreateBackendSessionInput,
  ): Promise<TerminalBackendSession>;
  attach(input: AttachBackendSessionInput): Promise<AttachedTerminalProcess>;
  capture(input: CaptureBackendSessionInput): Promise<string>;
  resize(input: ResizeBackendSessionInput): Promise<void>;
  write(input: WriteBackendSessionInput): Promise<void>;
  listRecoverable(): Promise<TerminalBackendSession[]>;
  recover(input: RecoverBackendSessionInput): Promise<TerminalBackendSession>;
  kill(input: KillBackendSessionInput): Promise<void>;
}
```

Prakticky lze začít menší třídou `TmuxTerminalBackend` + `RawBunTerminalBackend`, ale cíl je stejný: `server.ts` nemá skládat tmux CLI argumenty napříč celým souborem.

### 3.3 Izolovaný tmux socket

Používat wrapper pro tmux command:

```ts
const TMUX_SOCKET_DIR =
  process.env.TMUX_SOCKET_DIR || join(DECKTERM_STATE_DIR, "tmux");
const TMUX_SOCKET_PATH =
  process.env.TMUX_SOCKET_PATH ||
  join(TMUX_SOCKET_DIR, `${TMUX_SESSION_NAMESPACE}.sock`);

function tmuxArgs(args: string[]) {
  return ["tmux", "-S", TMUX_SOCKET_PATH, ...args];
}
```

Požadavky:

- `TMUX_SOCKET_DIR` vytvořit `0700`.
- nepoužívat `/tmp` bez per-instance owner-only directory; pokud `/tmp`, pak `/tmp/deckterm/<instance>` s `0700` a kontrolou ownera.
- všechny tmux příkazy musí jít přes wrapper.
- testy musí dokazovat, že každý tmux command obsahuje `-S <socket>` nebo `-L deckterm-<instance>`.

### 3.4 Read-only attach vs write attach

Cílový model:

- `terminal.attach`: uživatel může vidět metadata a output stream, obnovit viewport/snapshot, ale nesmí posílat input ani resize ovlivňující sdílenou session.
- `terminal.write`: uživatel může posílat input. Lze vlastníkovi implicitně povolit podle owner pravidla, nebo přes grant.
- `terminal.manage`: kill/resize/administrativní operace.

Doporučení pro MVP:

- Owner má implicitně `attach`, `write`, `manage` pro svůj terminál.
- Admin/global grant může mít `terminal.attach`, `terminal.write`, `terminal.manage` wildcard.
- Linked View defaultně vytvořit jako read-only, pokud aktér nemá `terminal.write`; UI musí indikovat „Monitor only“.
- Interaktivní „take control“ vyžaduje explicitní `terminal.write` grant nebo owner/admin.

### 3.5 Session catalog a recovery API

`/api/terminals` dnes vrací jen in-memory terminály vlastníka. C1b má zavést serverový katalog session:

- `GET /api/sessions` nebo rozšířené `GET /api/terminals?scope=visible&includeDetached=1`
- vrací active/detached/ended sessions, ke kterým má actor `terminal.attach` nebo je owner,
- pro každou session vrací bezpečná metadata:
  - `id`, `cwd`, `rootId`, `ownerDisplay`, `status`, `connectionState`, `createdAt`, `updatedAt`, `detachedAt`, `backendMode`, `running`, `agentName`, `agentState`, `canAttach`, `canWrite`, `canManage`, `activeConnectionCount`, `lastEventId`.
- nevracet `sessionName` ani tmux socket/name do frontend API.

Doporučené endpointy:

```http
GET  /api/sessions
GET  /api/sessions/:id
POST /api/sessions/:id/reconnect
POST /api/sessions/:id/attach-view       // mode: "read" | "write"
POST /api/sessions/:id/detach-client     // volitelné pro explicitní detach UX
DELETE /api/sessions/:id                 // manage/kill
```

Pro kompatibilitu může `/api/terminals` zůstat alias na aktivní sessions, ale nová UI logika by měla používat `sessions`.

---

## 4. Datový model a migrace

### 4.1 Rozšířit `ScopedGrantCapability`

Přidat:

```ts
export type ScopedGrantCapability =
  | "terminal.create"
  | "terminal.attach"
  | "terminal.write"
  | "terminal.manage"
  | "root.use";
```

Admin default grants doplnit o `terminal.write`.

### 4.2 Migrace `terminal_sessions`

Doporučená migrace v `foundation-state.ts`:

```sql
ALTER TABLE terminal_sessions ADD COLUMN backend_type TEXT NOT NULL DEFAULT 'raw';
ALTER TABLE terminal_sessions ADD COLUMN backend_session_ref TEXT;
ALTER TABLE terminal_sessions ADD COLUMN backend_socket_ref TEXT;
ALTER TABLE terminal_sessions ADD COLUMN detached_at TEXT;
ALTER TABLE terminal_sessions ADD COLUMN last_event_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE terminal_sessions ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';
```

Poznámky:

- `backend_session_ref` je pro server interní; nevracet frontendům.
- `backend_socket_ref` může být jen namespace nebo socket ID; pokud obsahuje path, držet server-only.
- `status`: rozšířit minimálně na `active`, `detached`, `ended`. Pokud nechceme měnit enum hned, `detached` lze odvodit z active session bez websocketů, ale pro UX je explicitní status lepší.

### 4.3 Event log pro recovery cursor

Pro `last-event-id` potřebujeme sekvenční log výstupu/control událostí:

```sql
CREATE TABLE IF NOT EXISTS terminal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- output | state | exit | lifecycle
  data_blob BLOB,
  data_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(terminal_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_terminal_events_terminal_id_id
  ON terminal_events(terminal_id, id);
```

MVP alternativa: tmux `capture-pane` + `last_event_id` pouze pro future extension. Doporučení: event log zavést už v C1b, protože jinak `last-event-id` nebude skutečný cursor a reconnection bude pořád heuristický.

Retention:

- output eventy limitovat `TERMINAL_EVENT_MAX_BYTES` a/nebo `TERMINAL_EVENT_MAX_ROWS_PER_SESSION`,
- pro tmux lze ukládat jen control/state eventy a output replay řešit capture-pane; přesto `last_event_id` pomůže klientovi rozlišit „mám aktuální snapshot“.

### 4.4 Client connections / views

Doporučená tabulka:

```sql
CREATE TABLE IF NOT EXISTS terminal_clients (
  id TEXT PRIMARY KEY,
  terminal_id TEXT NOT NULL,
  actor_user_id TEXT,
  mode TEXT NOT NULL,              -- read | write
  connected_at TEXT NOT NULL,
  disconnected_at TEXT,
  last_seen_at TEXT NOT NULL,
  user_agent TEXT,
  client_instance_id TEXT,
  FOREIGN KEY(terminal_id) REFERENCES terminal_sessions(id) ON DELETE CASCADE
);
```

MVP lze držet online clients in-memory a auditovat connect/disconnect, ale pro „active/detached“ UX po restartu je DB tabulka užitečná. Pokud zvolíme MVP bez tabulky, dokumentovat trade-off.

---

## 5. Backend implementační kroky

### Úkol 1: Přepsat tmux session names na opaque a odstranit owner parsing

**Soubory:**

- `backend/tmux-session-names.ts`
- `backend/tmux-session-names.test.ts`
- `backend/server.ts` nebo nová backend abstraction vrstva

**Kroky:**

1. Změnit API:

```ts
buildTmuxSessionName({ namespace, terminalId })
parseTmuxSessionName(sessionName, prefix) -> { terminalId } | null
```

2. Název generovat např.:

```ts
const opaqueTerminalId = sanitizeTmuxToken(terminalId, { maxLength: 48 });
return `${prefix}_${opaqueTerminalId}`;
```

UUID s pomlčkami lze buď zachovat, nebo normalizovat. Důležité je, aby neobsahoval ownera.

3. `recoverTmuxSessions()` nesmí získávat ownera z názvu. Recovery flow:
   - z názvu získat pouze terminalId,
   - vyhledat `terminal_sessions.id = terminalId`,
   - pokud DB row chybí, označit jako orphan a **nepřipojovat automaticky**; logovat a nabídnout admin cleanup později,
   - owner metadata brát z DB.

4. Aktualizovat testy:
   - `buildTmuxSessionName` neobsahuje ownerId ani email,
   - parser vrací pouze terminalId,
   - owner-like string se nesmí objevit v názvu.

**Acceptance criteria:**

- `ps`/`tmux list-sessions` neobsahuje DeckTerm user/email/sub.
- Autorizace funguje i bez ownera v tmux name.

### Úkol 2: Zavést izolovaný tmux socket wrapper

**Soubory:**

- nový `backend/services/tmux-backend.ts` nebo `backend/tmux-runner.ts`
- `backend/server.ts`
- test `backend/tmux-backend.test.ts` nebo rozšířit tmux tests

**Kroky:**

1. Vytvořit helper `createTmuxRunner({ socketPath })`.
2. Před prvním tmux command vytvořit socket dir `0700`.
3. Nahradit všechny `Bun.spawn(["tmux", ...])` voláním runneru.
4. Přesunout `TMUX_PIPE_DIR` pod state dir nebo per-instance tmp dir:
   - doporučení: `${DECKTERM_STATE_DIR}/tmux/pipes`, permissions `0700`.
5. Ujistit se, že `pipe-pane` command nepoužívá nequotovaný path náchylný na shell injection. Aktuální `cat >> ${pipePath}` je command string interpretovaný shellem tmuxem; použít bezpečný quoting nebo pevný path s validovaným názvem.

**Acceptance criteria:**

- Žádný tmux příkaz v kódu nejde na default server.
- Prod/dev instance na různých portech se nekříží.
- Socket/pipe soubory nejsou world-readable.

### Úkol 3: Vytvořit terminal backend interface a omezit tmux detail v `server.ts`

**Soubory:**

- nový `backend/services/terminal-backend.ts`
- nový `backend/services/tmux-terminal-backend.ts`
- nový `backend/services/raw-terminal-backend.ts` nebo minimální adapter
- `backend/server.ts`

**Kroky:**

1. Vyříznout tmux helpery z `server.ts` do backend service:
   - `getTmuxSessionInfo`, `captureTmuxPane`, `syncTmuxSessionSize`, `hideTmuxStatusBar`, `ensureTmuxPipeCapture`, `readTmuxPipeDelta`, `killTmuxSessionIfLast`, `recoverTmuxSessions`.
2. `server.ts` má volat abstraktní operace:
   - `terminalBackend.create(...)`, `terminalBackend.attach(...)`, `terminalBackend.capture(...)`, `terminalBackend.resize(...)`, `terminalBackend.kill(...)`, `terminalBackend.listRecoverable()`.
3. DB update (`recordTerminalSession`) musí být blízko orchestrace v server/session service, ne uvnitř tmux runneru.
4. Přidat unit testy pro backend selection `TMUX_BACKEND=1/0`.

**Acceptance criteria:**

- Frontend API payloady neobsahují tmux identifiers.
- V autorizaci není žádný tmux parser.
- `server.ts` je orchestrace, ne tmux CLI implementace.

### Úkol 4: Přidat `terminal.write` capability a WebSocket mode

**Soubory:**

- `backend/services/foundation-state.ts`
- `backend/services/foundation-authorization.ts`
- `backend/server.ts`
- testy `backend/foundation-c1.test.ts`, nový `backend/terminal-write-authorization.test.ts`

**Kroky:**

1. Přidat capability `terminal.write` do typů a admin seed grantů.
2. Přidat helper:

```ts
authorizeTerminalWrite(db, { actorUserId, terminalId });
```

Pravidla:

- owner allow,
- exact/wildcard `terminal.write` grant allow,
- jinak deny `missing_capability`.

3. WebSocket upgrade přijme query:

```text
/ws/terminals/:id?clientId=...&mode=read|write&lastEventId=...
```

Default:

- pro vlastníka: `write`, pokud povoleno,
- pro non-ownera: `read`, pokud má attach bez write,
- explicitní `mode=write` vyžaduje `terminal.write`.

4. Rozšířit `TerminalWsData` o:

```ts
mode: "read" | "write";
actorUserId: string;
```

5. V `websocket.message()`:
   - `ping` povolit vždy,
   - `resume-ready` povolit vždy,
   - `input`/raw/binary povolit jen `mode === "write"` a auditovat deny rate-limited způsobem,
   - `resize` rozdělit: client viewport resize pro read-only nesmí měnit sdílenou session; pro write/manage mode může volat backend resize. MVP: read-only resize ignorovat nebo poslat jen lokální fit bez server resize.
6. `POST /api/terminals/:id/linked-view` přijme body `{ mode?: "read" | "write" }` a rozhoduje podle capabilities.

**Acceptance criteria:**

- Uživatel s `terminal.attach` bez `terminal.write` vidí output, ale input se neprovede.
- Linked View není implicitně write-capable.
- Deny write pokusy jsou auditované.

### Úkol 5: Serverový session catalog a recovery endpointy

**Soubory:**

- nový `backend/services/terminal-sessions.ts`
- `backend/server.ts`
- testy pro API

**Kroky:**

1. Přidat query helpery:
   - `listVisibleTerminalSessions(db, actorUserId)`
   - `getVisibleTerminalSession(db, actorUserId, terminalId)`
   - `updateTerminalSessionRuntime(db, ...)`
   - `markTerminalDetached/Active/Ended`.
2. `GET /api/sessions` vrací DB + runtime merge:
   - DB row jako základ,
   - pokud je in-memory `Terminal`, doplnit runtime state a socket count,
   - pokud je tmux backend a in-memory chybí, pokusit se recoverovat konkrétní session z tmux backendu.
3. `POST /api/sessions/:id/reconnect`:
   - autorizuje `terminal.attach`, volitelně `terminal.write` podle mode,
   - pokud in-memory runtime chybí a backend ref existuje, zavolá backend recover,
   - vrátí session metadata a WS URL parameters (`mode`, `lastEventId`), ne tmux name.
4. `/api/terminals` dočasně ponechat jako kompatibilní wrapper na `GET /api/sessions?activeOnly=1`, ale rozšířit tak, aby zahrnoval i grantem viditelné sessions, nejen `ownerId === actor`.

**Acceptance criteria:**

- Po restartu serveru se tmux sessions objeví v `GET /api/sessions` podle DB ownership/grantů.
- Orphan tmux session bez DB row není viditelná běžným uživatelům.
- Frontend má jednoznačný zdroj pro active/detached list.

### Úkol 6: Reconnect protocol s `lastEventId`

**Soubory:**

- `backend/server.ts`
- `backend/services/terminal-events.ts`
- `web/app.js`

**Kroky:**

1. Zavést server event log helper:
   - `appendTerminalEvent(terminalId, kind, data)` vrací monotonic `id`,
   - `listTerminalEventsAfter(terminalId, lastEventId, limit)`.
2. Při outputu (`appendScrollback`/broadcast) ukládat event nebo alespoň update `last_event_id`.
3. WS connect query:
   - `lastEventId=123` pro delta replay,
   - bez cursoru fallback na snapshot (`tmux capture-pane` nebo in-memory scrollback).
4. Server po connect pošle:

```json
{ "type": "reconnect_lifecycle", "phase": "replay-start", "fromEventId": 123 }
{ "type": "terminal_event", "id": 124, "kind": "output", "data": "..." }
{ "type": "reconnect_lifecycle", "phase": "replay-complete", "lastEventId": 130, "requiresRedraw": false }
{ "type": "reconnect_lifecycle", "phase": "ready", "lastEventId": 130 }
```

5. Klient ukládá `lastEventId` per terminal do `SessionRegistry`.
6. Stávající raw string output držet kvůli kompatibilitě, ale pro nové clients preferovat structured eventy za query `protocol=v2`. MVP může event log zavést interně a stále posílat raw output.

**Acceptance criteria:**

- Klient může explicitně říct, odkud chce replay.
- Reconnect stavy jsou deterministické; žádný nekonečný „connected but waiting“ stav.

---

## 6. Frontend / UX plán

### 6.1 Session drawer / panel

Přidat UI prvek „Sessions“:

- skupiny:
  - **Active here** – session otevřené v tomto browser klientu,
  - **Active elsewhere** – session s aktivními connections jiného clienta,
  - **Detached** – běží backend/tmux session, žádný websocket,
  - **Ended** – volitelně poslední ukončené, jen pokud produktově žádoucí.
- akce:
  - `Reconnect` (read/write podle capabilities),
  - `Open read-only`,
  - `Take control` / `Request write` pokud `canWrite`,
  - `Kill` pokud `canManage`.

### 6.2 Vizuální stavy terminálu

Na tab/tile doplnit badges:

- `read-only`,
- `write enabled`,
- `detached`,
- `active elsewhere`,
- `reconnecting`,
- `recovering snapshot`,
- `permission denied`.

Read-only terminal musí mít input disabled nebo input handler musí zobrazit jasnou hlášku „Read-only session – nemáte `terminal.write` oprávnění“.

### 6.3 Úprava `SessionRegistry`

Rozšířit uložená data:

```js
{
  terminalId,
  workspaceId,
  cwd,
  tabNum,
  mode: "read" | "write",
  lastEventId,
  lastKnownStatus,
  backendMode,
  updatedAt
}
```

Lokální registry zůstává jen layout/cache. Pravda o existenci a oprávnění session je server.

### 6.4 Bootstrap flow

`checkExistingTerminals()` nahradit/rozšířit:

1. `GET /api/sessions`.
2. Sloučit server sessions s local layout cache.
3. Automaticky reconnectovat jen sessions, které:
   - patří tomuto uživateli a byly lokálně otevřené, nebo
   - mají explicitní „autoReconnect“ flag v local registry.
4. Ostatní ukázat v Sessions panelu, neotevírat automaticky bez kontextu.
5. `BootstrapRouting.shouldBootstrapLinkedView()` aktualizovat tak, aby nepředpokládal implicitní write linked view.

---

## 7. Bezpečnostní poznámky a non-goals

### 7.1 Explicitní OS-level warning

Do dokumentace/admin statusu přidat:

> DeckTerm multiuser permissions izolují přístup v aplikaci. Terminálové procesy však běží pod stejným Unix uživatelem jako Bun server. Uživatel s přístupem k terminálu může na OS úrovni vidět/ovlivnit zdroje dostupné tomuto Unix účtu. Pro tvrdou izolaci tenantů je potřeba kontejnery/VM/samostatní OS uživatelé; to není součást C1b.

### 7.2 Další bezpečnostní opatření v C1b

- tmux socket/pipe dirs `0700`, soubory ne world-readable,
- owner/user data nikdy do tmux name,
- auditovat attach/write/manage deny,
- rate-limitovat opakované denied WS input audity,
- nevracet backend session refs do frontend API,
- orphan tmux sessions viditelné jen adminovi nebo cleanup jobu.

### 7.3 Non-goals pro C1b

- Plná OS/container izolace.
- Permission editor UI pro správu grantů.
- Vlastní login/password.
- Kompletní file/git/task permission redesign.
- Kolaborativní CRDT terminal input; C1b řeší read/write capability, ne multi-cursor shell.

---

## 8. Testovací strategie

### 8.1 Unit testy

Přidat/aktualizovat:

- `backend/tmux-session-names.test.ts`
  - opaque names bez ownera,
  - parser vrací pouze terminalId,
  - namespace sanitization.
- `backend/tmux-backend.test.ts`
  - tmux runner vždy používá izolovaný socket,
  - socket dir permissions.
- `backend/foundation-c1.test.ts`
  - `terminal.write` grant seeded pro admina,
  - owner implicit write,
  - non-owner attach without write denies input.
- `backend/terminal-sessions.test.ts`
  - list visible sessions podle owner/grant,
  - detached status,
  - DB recovery metadata.
- `web/bootstrap-routing.test.js`
  - session grouping bez tmux names,
  - read-only linked view flow,
  - local saved session preference.

### 8.2 Integration testy

Scénáře:

1. **tmux opaque recovery**
   - vytvořit session s `TMUX_BACKEND=1`,
   - ověřit tmux list neobsahuje owner,
   - restartovat server,
   - `GET /api/sessions` vrátí session ownerovi přes DB.

2. **attach vs write**
   - user A vytvoří terminal,
   - user B dostane `terminal.attach` bez `terminal.write`,
   - B otevře WS `mode=read`, vidí output,
   - B pošle input, server deny/ignoruje a audit rows obsahují `terminal.write deny`,
   - po grantnutí `terminal.write` B může poslat input.

3. **isolated tmux socket**
   - dev/prod namespace se nekříží,
   - `tmux -S socketA list-sessions` nevidí socketB sessions.

4. **orphan safety**
   - tmux session existuje, ale DB row chybí,
   - běžný user ji nevidí,
   - log/admin cleanup ji označí jako orphan.

### 8.3 Doporučené příkazy

```bash
PATH=$HOME/.bun/bin:$PATH bun test \
  ./backend/foundation-actors.test.ts \
  ./backend/foundation-c1.test.ts \
  ./backend/foundation-bootstrap.test.ts \
  ./backend/tmux-session-names.test.ts \
  ./backend/tmux-client-size.test.ts

PATH=$HOME/.bun/bin:$PATH bun run test:unit

cd tests && PW_BASE_URL=http://127.0.0.1:4174 \
  npx playwright test reconnect-tab-status.spec.ts onboarding.spec.ts workspace-signals.spec.ts \
  --workers=1 --reporter=line
```

Pozor: podle `AGENTS.md` E2E vždy proti portu `4174`, nikdy proti produkčnímu `4173`.

---

## 9. Doporučené pořadí implementace

1. **Stabilizovat C1a commit**
   - dostat současné uncommitted C1a změny do zeleného stavu,
   - ideálně commitnout C1a samostatně před C1b.

2. **Bezpečný tmux základ**
   - opaque session names,
   - isolated socket wrapper,
   - aktualizovat tests.

3. **Backend abstraction**
   - přesunout tmux helpery ze `server.ts`,
   - sjednotit raw/tmux operace za interface.

4. **DB migrace a session catalog**
   - rozšířit `terminal_sessions`,
   - přidat `terminal_events` a volitelně `terminal_clients`,
   - přidat `/api/sessions`.

5. **Granulární auth**
   - `terminal.write`,
   - WS `mode=read|write`,
   - input deny enforcement.

6. **Recovery protocol v2**
   - `lastEventId`, lifecycle structured events,
   - frontend SessionRegistry update.

7. **UI Sessions panel**
   - aktivní/detached sessions,
   - read-only badge,
   - explicitní reconnect/take-control.

8. **Hardening a cleanup**
   - orphan cleanup,
   - idle/detached policy,
   - docs warning o OS-level hranicích.

---

## 10. Rizika a mitigace

| Riziko                                                                                 |                            Dopad | Mitigace                                                                                                       |
| -------------------------------------------------------------------------------------- | -------------------------------: | -------------------------------------------------------------------------------------------------------------- |
| Změna tmux names rozbije recovery starých sessions                                     |                          střední | Přidat jednorázovou backward-compatible recovery větev pro legacy prefix jen v dev/admin cleanup, ne pro auth. |
| Read-only attach s tmux `attach-session` pořád vytváří plně interaktivní attach proces |                           vysoký | Server musí blokovat input; dlouhodobě preferovat capture/pipe stream pro read-only místo tmux attach.         |
| Více attach clients mění velikost tmux pane                                            |                          střední | Resize povolit jen write/manage clientovi; read-only klient lokálně fituje bez server resize.                  |
| Event log příliš roste                                                                 |                          střední | Retention limity, tmux capture jako snapshot, kompakce starších output eventů.                                 |
| OS-level multiuser očekávání                                                           | vysoký bezpečnostní/product risk | Výrazný warning v docs/onboarding/admin statusu.                                                               |
| C1a je stále uncommitted                                                               |                          střední | Nezačínat velký C1b refactor bez odděleného C1a checkpointu.                                                   |

---

## 11. Rozhodnutí schválená Lukášem (2026-05-24)

Všechna klíčová rozhodnutí byla prodiskutována a schválena:

1. **Read-only vs. Interaktivní Linked View (Otázka #1):**
   - **Rozhodnutí:** Ano, pro non-owner uživatele s přístupem pouze `terminal.attach` bude zobrazení automaticky read-only. Zápis (`terminal.write`) musí být explicitně udělen.

2. **Izolace a Take Control (Otázka #2):**
   - **Rozhodnutí:** Každý uživatel/aktér má mít vlastní dedikované sezení dle své Cloudflare OTP identity. Do budoucna se navíc plánuje plná kontejnerizace jednotlivých uživatelských profilů. Více souběžných zapisovatelů do jedné session od různých uživatelů není výchozí stav; pro stejného přihlášeného uživatele (např. více otevřených oken) platí standardní sdílení nebo znovupřipojení.

3. **Životnost osiřelých sessions (Otázka #3):**
   - **Rozhodnutí:** Osiřelá (orphaned/detached) tmux sezení se budou **automaticky zabíjet po 8 hodinách neaktivity**, aby se nekumulovala na serveru a šetřila se paměť a výkon.

4. **Persistence oken po reloadu (Otázka #4):**
   - **Rozhodnutí:** Zachová se stávající plně funkční chování na frontendu – po reloadu se automaticky obnovují a otevírají sezení, která běžela předtím. Backend toto podpoří stabilní perzistencí v DB a plynulým znovupřipojením (reconnect).
