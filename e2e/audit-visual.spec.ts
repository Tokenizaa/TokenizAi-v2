import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (k: string) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  if (!m) return null;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
};
const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');
const adminEmail = getEnv('E2E_ADMIN_EMAIL');
const adminPassword = getEnv('E2E_ADMIN_PASSWORD');

const SCREENSHOT_DIR = '/tmp/audit-screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const rotas = [
  // Enterprise
  { path: '/executivo', nome: 'Cockpit executivo' },
  { path: '/projetos', nome: 'Projetos' },
  { path: '/clientes', nome: 'Clientes' },
  { path: '/comercial', nome: 'Comercial' },
  { path: '/produtos', nome: 'Portfólio de Produtos' },
  { path: '/assinaturas', nome: 'Assinaturas' },
  { path: '/financeiro', nome: 'Financeiro' },
  { path: '/relatorios', nome: 'Central de Relatórios' },
  { path: '/biblioteca', nome: 'Biblioteca Agency Agents' },
  { path: '/admin', nome: 'Administração' },
  // IA Workforce
  { path: '/ia-visao', nome: 'Visão Geral IA' },
  { path: '/ia-inbox', nome: 'Inbox' },
  { path: '/ia-chat', nome: 'Chat com Agentes' },
  { path: '/ia-agentes', nome: 'Agentes Operacionais' },
  { path: '/ia-agentes/xyz', nome: 'Agente Detalhe (/:agentId)' },
  { path: '/ia-equipes', nome: 'Organograma & Equipes' },
  { path: '/ia-tarefas', nome: 'Tarefas & Delegações' },
  { path: '/ia-tarefas/xyz', nome: 'Tarefa Detalhe (/:taskId)' },
  { path: '/ia-execucoes', nome: 'Execuções & Heartbeats' },
  { path: '/ia-rotinas', nome: 'Rotinas & Automações' },
  { path: '/ia-aprovacoes', nome: 'Aprovações & Governança' },
  { path: '/ia-aprovacoes/xyz', nome: 'Aprovação Detalhe (/:approvalId)' },
  { path: '/ia-custos', nome: 'Custos & Auditoria' },
  { path: '/ia-metas', nome: 'Metas / Goals' },
  { path: '/ia-skills', nome: 'Skills' },
  { path: '/ia-conectores', nome: 'Connectors' },
  { path: '/ia-atividade', nome: 'Atividade' },
  { path: '/ia-artefatos', nome: 'Artifacts' },
];

const resultados: any[] = [];

test.beforeAll(async () => {
  if (!supabaseUrl || !supabaseAnonKey || !adminEmail || !adminPassword) {
    throw new Error(
      'Configure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD no ambiente E2E.',
    );
  }
});

async function loginAndInject(page: any) {
  // Login via Supabase REST API
  const resp = await page.request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    data: { email: adminEmail, password: adminPassword },
    headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
  });
  const data = await resp.json();
  const accessToken = data.access_token;
  if (!accessToken) throw new Error(`Login falhou: ${JSON.stringify(data)}`);

  // Injeta token no window
  await page.evaluate((token: string) => {
    (window as any).__e2eAccessToken = token;
  }, accessToken);
}

for (const rota of rotas) {
  test(`Auditoria visual: ${rota.nome} (${rota.path})`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkFailed: string[] = [];
    const apiCalls: any[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('requestfailed', req => {
      networkFailed.push(req.url());
    });

    page.on('response', res => {
      const url = res.url();
      if (url.includes('/api/')) {
        apiCalls.push({ method: res.request().method(), url: url.replace(`http://localhost:3000`, ''), status: res.status() });
      }
    });

    await loginAndInject(page);

    await page.goto(`http://localhost:3000${rota.path}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const title = await page.title();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const url = page.url();

    // Classificar
    let estado: string;
    let origem: string;
    if (bodyText.includes('Não foi possível carregar')) {
      estado = 'ERRO';
      origem = 'erro_renderizacao';
    } else if (bodyText.includes('Entrar na plataforma') && bodyText.length < 300) {
      estado = 'ERRO';
      origem = 'nao_autenticado';
    } else if (bodyText.trim().length > 100) {
      estado = 'APROVADA';
      if (bodyText.includes('em memória') || bodyText.includes('demonstrativa')) {
        origem = 'dados_locais_memoria';
      } else if (bodyText.includes('Hermes') || bodyText.toLowerCase().includes('supabase')) {
        origem = 'backend_integracao';
      } else {
        origem = 'conteudo_visivel';
      }
    } else if (bodyText.trim().length > 0) {
      estado = 'PARCIAL';
      origem = 'conteudo_limitado';
    } else {
      estado = 'VAZIA';
      origem = 'sem_conteudo';
    }

    // Screenshot
    const shotName = rota.path.replace(/\//g, '_').replace(/:/g, '_');
    const shotPath = path.join(SCREENSHOT_DIR, `${shotName}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    resultados.push({
      rota: rota.path,
      nome: rota.nome,
      estado,
      origem,
      title,
      bodyText: bodyText.slice(0, 300),
      screenshot: shotPath,
      consoleErrors: consoleErrors.slice(0, 5),
      networkFailed: networkFailed.slice(0, 5),
      apiCalls: apiCalls.slice(0, 8),
    });
  });
}

test.afterAll(() => {
  // Escreve relatório
  const report = ['# Auditoria Visual TokenizAi V2', '', '| Rota | Nome | Estado | Origem Dados | Título | Console | Rede |', '|------|------|--------|--------------|--------|---------|------|'];
  for (const r of resultados) {
    report.push(`| ${r.rota} | ${r.nome} | ${r.estado} | ${r.origem} | ${r.title} | ${r.consoleErrors.length} erros | ${r.networkFailed.length} falhas |`);
  }
  report.push('');
  report.push('## Detalhes por rota');
  for (const r of resultados) {
    report.push(`### ${r.nome} (${r.rota})`);
    report.push(`- Estado: ${r.estado}`);
    report.push(`- Origem: ${r.origem}`);
    report.push(`- Título: ${r.title}`);
    report.push(`- Texto: ${r.bodyText}`);
    report.push(`- Screenshot: ${r.screenshot}`);
    if (r.consoleErrors.length > 0) report.push(`- Console errors: ${r.consoleErrors.join('; ')}`);
    if (r.networkFailed.length > 0) report.push(`- Network failed: ${r.networkFailed.join('; ')}`);
    report.push(`- API calls: ${r.apiCalls.map((a: { method: string; url: string; status: number }) => `${a.method} ${a.url}->${a.status}`).join('; ')}`);
    report.push('');
  }
  fs.writeFileSync('/tmp/audit-relatorio.md', report.join('\n'));
  console.log('Relatorio escrito em /tmp/audit-relatorio.md');
  console.log(`Total: ${resultados.length} rotas`);
  const aprovadas = resultados.filter(r => r.estado === 'APROVADA').length;
  const vazias = resultados.filter(r => r.estado === 'VAZIA').length;
  const erros = resultados.filter(r => r.estado === 'ERRO').length;
  const parciais = resultados.filter(r => r.estado === 'PARCIAL').length;
  console.log(`Aprovadas: ${aprovadas}, Vazias: ${vazias}, Erros: ${erros}, Parciais: ${parciais}`);
});
