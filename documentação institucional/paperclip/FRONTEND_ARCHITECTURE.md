# Paperclip — Engenharia Reversa: Arquitetura do Frontend

> **Data:** 21 de novembro de 2026  
> **Versão analisada:** 0.3.1  
> **Diretório:** `/home/lg/workspace/NettosCorp/NettosCorp/paperclip/ui`

---

## 1. Stack e Estrutura Geral

| Item | Tecnologia | Versão |
|------|------------|--------|
| **Framework** | React | 19.2.8 |
| **Build Tool** | Vite | 8.2.2 |
| **Router** | React Router DOM | 7.18.4 |
| **State/Query** | TanStack Query | 5.102.8 |
| **Styling** | Tailwind CSS | 4.3.3 |
| **UI Primitives** | Radix UI + @base-ui/react | 1.6.7 / 1.7.0 |
| **Icons** | Lucide React | 1.48.0 |
| **i18n** | i18next + react-i18next | 26.4.2 / 17.0.15 |
| **Editors** | CodeMirror 6, Lexical, MDXEditor | 6.0.2 / 0.48.0 / 4.2.3 |
| **Terminal** | xterm.js | 6.0.0 |
| **Charts** | Recharts (via ActivityCharts) | — |
| **Testing** | Vitest + Playwright | 5.0.3 / 1.62.1 |
| **Storybook** | Storybook 10 | 10.6.0 |

---

## 2. Estrutura de Diretórios

```
ui/
├── src/
│   ├── components/          # 300+ componentes (UI primitives + features)
│   │   ├── ui/              # Radix/Base UI wrappers (Button, Dialog, etc.)
│   │   ├── agents/          # Agent-specific components
│   │   ├── chat/            # Chat composers, threads, messages
│   │   ├── cases/           # Case management UI
│   │   ├── artifacts/       # File viewers, diffs, markdown
│   │   ├── transcripts/     # Run transcripts, logs
│   │   └── ... (40+ subdirs)
│   ├── pages/               # 80+ páginas (lazy-loaded routes)
│   │   ├── apps/            # Apps marketplace, connections
│   │   ├── audit/           # Company activity, audit hub
│   │   ├── tools/           # Advanced tools, profiles
│   │   └── ...
│   ├── hooks/               # 100+ custom hooks
│   │   ├── use*.ts          # Query hooks, mutations, state
│   │   └── use*.test.tsx    # Testes dos hooks
│   ├── context/             # 17 React Context providers
│   │   ├── CompanyContext.tsx
│   │   ├── LiveUpdatesProvider.tsx
│   │   ├── ThemeContext.tsx
│   │   └── ...
│   ├── adapters/            # Adapter UI components (12 adapters)
│   │   ├── registry.ts      # AdapterDisplayRegistry
│   │   ├── dynamic-loader.ts
│   │   └── claude-local/, codex-local/, hermes/, etc.
│   ├── api/                 # TanStack Query wrappers
│   │   ├── companies-query.ts
│   │   ├── issues-query.ts
│   │   └── ...
│   ├── lib/                 # Utilitários compartilhados
│   │   ├── router.tsx       # React Router wrapper + hooks
│   │   ├── query-client.ts  # QueryClient factory + connectivity
│   │   ├── live-reconcile.ts
│   │   └── ...
│   ├── i18n/                # i18next config + translations
│   ├── plugins/             # Plugin system UI
│   │   ├── bridge-init.ts
│   │   └── launchers/
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── storybook/               # Storybook config
├── tests/                   # E2E + component tests
├── vite.config.ts           # Vite config (multiple configs)
└── package.json
```

---

## 3. Sistema de Rotas

### 3.1 Arquitetura de Roteamento (`ui/src/App.tsx`)

```typescript
// Lazy-loaded routes com Suspense
const Issues = lazy(() => import("./pages/Issues").then(m => ({ default: m.Issues })));
const AgentDetail = lazy(() => import("./pages/AgentDetailPage"));

// Route guards (componentes de gate)
<Route element={<CloudManagedPageGate />}>
  <Route path="company/import" element={<CompanyImport />} />
</Route>

// Feature flags controlam rotas
const mergedTasks = streamlinedUiEnabled && combinedInboxTasksEnabled;
```

**Total de rotas:** ~120+ rotas definidas em `App.tsx`

### 3.2 Padrões de Roteamento

| Padrão | Exemplo | Uso |
|--------|---------|-----|
| **Lazy + Suspense** | `lazy(() => import(...))` | Code splitting por feature |
| **Route Guards** | `<CloudManagedPageGate>` | Permissão por feature flag |
| **Redirects legados** | `<Navigate to="/new-path" replace />` | Migração de URLs |
| **Nested routes** | `/company/settings/*` | Settings agrupados |
| **Optional params** | `/issues/:issueId?` | Detail views |

### 3.3 Feature Flags de Roteamento

| Flag | Controla | Hook |
|------|----------|------|
| `streamlinedUiEnabled` | Shell unificado vs legacy | `useStreamlinedUiEnabled` |
| `combinedInboxTasksEnabled` | Inbox + TaskList merged | `useCombinedInboxTasksEnabled` |
| `chatConnectorsEnabled` | Chat connectors experimentais | `useChatConnectorsEnabled` |
| `hiddenSettings` | Páginas ocultas (members, export, secrets) | `useHiddenSettings` |

---

## 4. Layout Principal

### 4.1 Estrutura (`ui/src/components/Layout.tsx` + `Layout.production.tsx`)

```
<BrowserRouter>
  <QueryClientProvider>
    <ThemeProvider>
      <CompanyProvider>
        <LiveUpdatesProvider>
          <DialogProvider>
            <SidebarProvider>
              <PanelProvider>
                <ToastProvider>
                  <TooltipProvider>
                    <PluginLauncherProvider>
                      <AppErrorBoundary>
                        <SentryGate>
                          <Routes>...</Routes>
                        </SentryGate>
                      </AppErrorBoundary>
                    </PluginLauncherProvider>
                  </TooltipProvider>
                </ToastProvider>
              </PanelProvider>
            </SidebarProvider>
          </DialogProvider>
        </LiveUpdatesProvider>
      </CompanyProvider>
    </ThemeProvider>
  </QueryClientProvider>
</BrowserRouter>
```

### 4.2 Componentes de Layout Principais

| Componente | Responsabilidade |
|------------|------------------|
| `Layout` / `Layout.production` | Shell principal, sidebar, header, outlet |
| `BreadcrumbBar` | Navegação contextual (issue, agent, company) |
| `SidebarContext` | Estado da sidebar (aberto/fechado, largura) |
| `PanelContext` | Painéis laterais (chat, artifacts, details) |
| `ConnectionStatusBanner` | Status de conectividade (online/offline/reconnecting) |
| `PageLoadTracker` | Métricas de performance de navegação |

---

## 5. Componentes Compartilhados (Design System)

### 5.1 Primitives (`ui/src/components/ui/`)

| Componente | Base | Descrição |
|------------|------|-----------|
| `Button` | Radix Slot | Variants: default, outline, ghost, destructive |
| `Dialog` | Radix Dialog | Modal acessível, portal |
| `DropdownMenu` | Radix DropdownMenu | Menus contextuais |
| `Tooltip` | Radix Tooltip | Hover/focus tooltips |
| `ScrollArea` | Radix ScrollArea | Scroll customizado |
| `Tabs` | Radix Tabs | Abas controladas |
| `Select` | Radix Select | Select acessível |
| `Checkbox` | Radix Checkbox | Checkbox styled |
| `RadioGroup` | Radix RadioGroup | Radio buttons |
| `Switch` | Radix Switch | Toggle switch |
| `Avatar` | Radix Avatar | User/agent avatars |
| `Separator` | Radix Separator | Divisores visuais |

### 5.2 Componentes Compostos Principais

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `AgentConfigForm` | `AgentConfigForm.tsx` (213KB) | Form massivo de configuração de agent |
| `IssueChatThread` | `IssueChatThread.tsx` (242KB) | Thread de chat completo com streaming |
| `AgentDetail` | `AgentDetail.tsx` (170KB) | Detail page de agent com tabs |
| `CompanySkills` | `CompanySkills.tsx` (237KB) | Gerenciamento de skills da company |
| `WorkspaceFileBrowser` | `WorkspaceFileBrowser.tsx` (44KB) | File tree + editor |
| `Secrets` | `Secrets.tsx` (203KB) | Secret management UI |
| `SkillStudio` | `SkillStudio.tsx` (132KB) | IDE para criar skills |

---

## 6. Gerenciamento de Estado

### 6.1 TanStack Query (Server State)

```typescript
// ui/src/lib/query-client.ts
const queryClient = createAppQueryClient({
  connectivity,
  reportError: captureQueryException,
  notifyMutationError: pushMutationErrorToast,
}, {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
  },
});
```

**Padrões:**
- `staleTime: 30s` — cache agressivo
- `gcTime: 5min` — limpeza automática
- `refetchOnWindowFocus` — sync ao voltar tab
- **Connectivity-aware** — pausa queries offline, replay mutations

### 6.2 React Context (Client State)

| Context | Arquivo | Estado Gerenciado |
|---------|---------|-------------------|
| `CompanyContext` | `CompanyContext.tsx` | Company atual, membership, roles |
| `LiveUpdatesProvider` | `LiveUpdatesProvider.tsx` (100KB) | WebSocket fanout, cache reconciliation, read receipts |
| `ThemeContext` | `ThemeContext.tsx` | Dark/light/system, CSS variables |
| `SidebarContext` | `SidebarContext.tsx` | Sidebar state, width, pinned |
| `DialogContext` | `DialogContext.tsx` | Dialog stack, nested dialogs |
| `PanelContext` | `PanelContext.tsx` | Side panels (chat, artifacts, details) |
| `ToastContext` | `ToastContext.tsx` | Toast notifications globais |
| `PrimaryAgentProvider` | `PrimaryAgentProvider.tsx` | Agent primário selecionado |
| `BreadcrumbContext` | `BreadcrumbContext.tsx` | Breadcrumb trail dinâmico |
| `DesignSandboxContext` | `DesignSandboxContext.tsx` | Design sandbox state |

### 6.3 Custom Hooks (100+)

| Categoria | Exemplos |
|-----------|----------|
| **Query hooks** | `useCompany`, `useIssues`, `useAgents`, `useAgentDetail` |
| **Mutation hooks** | `useUpdateIssueMutation`, `useCreateAgentMutation` |
| **UI state** | `useDialogActions`, `useSidebarOrder`, `usePageSettled` |
| **Feature flags** | `useStreamlinedUiEnabled`, `useHiddenSettings` |
| **Auth/Connectivity** | `useCloudInstance`, `useResilientFetch` |
| **Performance** | `useDurableAutosave`, `useDurableSubmit`, `useRecentTasks` |

---

## 7. Comunicação com APIs

### 7.1 Camada de API (`ui/src/api/`)

```typescript
// Pattern: React Query wrappers com tipos inferidos
export function useCompany(companyId: string) {
  return useQuery({
    queryKey: ["company", companyId],
    queryFn: () => fetch(`/api/company/${companyId}`).then(r => r.json()),
  });
}
```

**Arquivos principais:**
- `companies-query.ts` — Company, memberships, settings
- `issues-query.ts` — Issues, comments, attachments
- `agents-query.ts` — Agents, configs, runs
- `chat-query.ts` — Chat channels, messages, deliveries
- `workspaces-query.ts` — Execution workspaces, snapshots
- `skills-query.ts` — Skills, sources, studio
- `secrets-query.ts` — Secrets, proposals
- `mcp-query.ts` — MCP apps, skills, connections

### 7.2 Real-time (LiveUpdatesProvider)

- **WebSocket** conectado ao server `/api/live-events`
- **Fanout** para múltiplas abas (BroadcastChannel)
- **Reconciliation** de cache: merge otimista + server-authoritative
- **Read receipts** para chat messages
- **Task index** para inbox updates

---

## 8. Autenticação no Frontend

### 8.1 Better Auth Integration

```typescript
// Server-side: better-auth.ts
// Client-side: usa cookies HttpOnly + CSRF token
```

**Fluxo:**
1. Login redirect → `/auth/signin` (server-rendered)
2. Callback → set HttpOnly cookies
3. Frontend lê session via `useCompany` / `useAccountIdentity`
4. Workspace login handoff para CLI/agents

### 8.2 Guards de Acesso

| Guard | Componente | Verifica |
|-------|------------|----------|
| `CloudManagedPageGate` | Páginas cloud-only | `useCloudInstance` |
| `HiddenSettingsPageGate` | Settings ocultos | `useHiddenSettings` |
| `IsolatedWorkspacesRouteGate` | Workspaces isolados | Feature flag |
| `ShellConfigurationGate` | Shell config | Deployment mode |

---

## 9. Navegação e Organização dos Módulos

### 9.1 Módulos Principais (Pages)

| Módulo | Rotas Principais | Descrição |
|--------|------------------|-----------|
| **Dashboard** | `/dashboard`, `/dashboard/live` | Overview, metrics, activity |
| **Inbox** | `/inbox` | Combined inbox + task list |
| **Issues** | `/issues`, `/issues/:id` | Issue tracker, chat, documents |
| **Agents** | `/agents`, `/agents/:id` | Agent directory, detail, config |
| **Cases** | `/cases`, `/cases/:id` | Case management, handoffs |
| **Companies** | `/companies`, `/company/settings/*` | Multi-company, settings |
| **Projects** | `/projects`, `/projects/:id` | Project workspaces |
| **Routines** | `/routines`, `/routines/:id` | Automation routines |
| **Skills** | `/skills`, `/skill-studio` | Skill catalog, IDE |
| **Secrets** | `/company/settings/secrets` | Secret management |
| **Apps** | `/apps/*` | Marketplace, connections, gateways |
| **MCP** | `/mcp/*` | MCP connect, apps, skills |
| **Costs** | `/costs` | Cost accounting, budgets |
| **Audit** | `/audit/*` | Company activity, audit hub |

### 9.2 Lazy Loading Strategy

```typescript
// Todas as pages são lazy-loaded
const Issues = lazy(loadIssues);
const AgentDetail = lazy(() => import("./pages/AgentDetailPage"));

// Shared chunks para pages relacionadas
const IssueDetail = lazy(loadIssueDetail); // Cacheado para navegação rápida
```

---

## 10. Estratégia de Carregamento e Code Splitting

### 10.1 Vite Config (`ui/vite.config.ts`)

```typescript
// Manual chunks para otimização
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-query': ['@tanstack/react-query'],
  'vendor-ui': ['@radix-ui/*', 'lucide-react', 'clsx', 'tailwind-merge'],
  'vendor-editors': ['codemirror', '@codemirror/*', 'lexical', '@lexical/*'],
  'vendor-ai': ['ai', '@ai-sdk/*'],
}
```

### 10.2 Chunk Load Recovery

```typescript
// ui/src/lib/chunk-load-recovery.ts
startChunkLoadRecovery(); // Retry automático em falhas de chunk
```

### 10.3 Service Worker Updates

```typescript
// ui/src/lib/service-worker-updates.ts
startServiceWorkerUpdates({
  canReload: () => connectivity.online && noPendingMutations,
});
```

---

## 11. Incorporação de Dois Conjuntos de Páginas (Unificação)

### 11.1 Estratégia Recomendada: Feature Modules Lazy-Loaded

```
ui/
├── src/
│   ├── modules/
│   │   ├── defesai-saude/      # Módulo B2C (beneficiário)
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── routes.tsx      # Exporta rotas do módulo
│   │   └── enterprise/         # Módulo B2B (admin/org)
│   │       ├── pages/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── routes.tsx
│   ├── App.tsx                 # Compõe módulos dinamicamente
│   └── lib/module-registry.ts  # Registro de módulos ativos
```

### 11.2 Compartilhamento de Infraestrutura

| Compartilhado | Como |
|---------------|------|
| **Design System** | `ui/src/components/ui/*` — primitives Radix/Tailwind |
| **Query Client** | `createAppQueryClient()` — singleton no `main.tsx` |
| **Auth/Company** | `CompanyContext` — provider único |
| **Real-time** | `LiveUpdatesProvider` — fanout global |
| **Theme/i18n** | `ThemeContext`, `i18n` — config global |
| **Router** | `react-router-dom` — rotas compostas em `App.tsx` |

### 11.3 Isolamento de Módulos

- **Routes:** Cada módulo exporta `createRoutes()` → composto no `App.tsx`
- **State:** Module-scoped query keys (`['defesai', ...]`, `['enterprise', ...]`)
- **Components:** Shared via `ui/src/components/` + module-specific em `modules/*/components/`
- **Permissions:** Route guards por módulo (`<DefesaiGate>`, `<EnterpriseGate>`)

---

## 12. Evidências de Investigação

| Item | Fonte | Tipo |
|------|-------|------|
| Package.json + deps | `ui/package.json` | Código |
| Main entry | `ui/src/main.tsx` | Código |
| App routes | `ui/src/App.tsx` (887 linhas) | Código |
| Components dir | `ls ui/src/components/` | Execução |
| Pages dir | `ls ui/src/pages/` | Execução |
| Hooks dir | `ls ui/src/hooks/` | Execução |
| Context dir | `ls ui/src/context/` | Execução |
| Adapters UI | `ls ui/src/adapters/` | Execução |
| Vite config | `ui/vite.config.ts` | Código |
| Query client | `ui/src/lib/query-client.ts` | Código |
| Live updates | `ui/src/context/LiveUpdatesProvider.tsx` | Código |

---

*Documento baseado em inspeção direta de código e estrutura de arquivos. Nenhuma suposição sobre comportamento em runtime sem evidência.*