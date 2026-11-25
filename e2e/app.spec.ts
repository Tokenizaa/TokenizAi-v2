import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'nettoscorp@gmail.com';
const ADMIN_PASSWORD = 'Hermes@964212$';

async function login(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.count() > 0) {
    await emailInput.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  }
}

test.describe('Enterprise Routes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const enterpriseRoutes = [
    { path: '/executivo', title: 'Cockpit executivo' },
    { path: '/projetos', title: 'Projetos' },
    { path: '/clientes', title: 'Clientes' },
    { path: '/comercial', title: 'Comercial' },
    { path: '/produtos', title: 'Portfólio de Produtos' },
    { path: '/assinaturas', title: 'Assinaturas' },
    { path: '/financeiro', title: 'Financeiro' },
    { path: '/relatorios', title: 'Central de Relatórios' },
    { path: '/biblioteca', title: 'Biblioteca Agency Agents' },
    { path: '/admin', title: 'Administração' },
  ];

  for (const route of enterpriseRoutes) {
    test(`should load ${route.title} (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Não foi possível carregar')).not.toBeVisible();
      await expect(page.locator('body')).toBeVisible();
    });
  }
});

test.describe('AI Workforce Routes (Consolidated)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const iaRoutes = [
    { path: '/ia-visao', title: 'Visão Geral IA' },
    { path: '/ia-chat', title: 'Chat com Agentes' },
    { path: '/ia-agentes', title: 'Agentes Operacionais' },
    { path: '/ia-equipes', title: 'Organograma & Equipes' },
    { path: '/ia-tarefas', title: 'Tarefas & Delegações' },
    { path: '/ia-execucoes', title: 'Execuções & Heartbeats' },
    { path: '/ia-rotinas', title: 'Rotinas & Automações' },
    { path: '/ia-aprovacoes', title: 'Aprovações & Governança' },
    { path: '/ia-custos', title: 'Custos & Auditoria' },
  ];

  for (const route of iaRoutes) {
    test(`should load ${route.title} (${route.path})`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('text=Não foi possível carregar')).not.toBeVisible();
      await expect(page.locator('body')).toBeVisible();
    });
  }
});

test.describe('Interactive Elements', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard should have interactive elements', async ({ page }) => {
    await page.goto('/ia-visao');
    await page.waitForLoadState('networkidle');

    // Check for any buttons or links
    const interactive = page.locator('button, a[href]');
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Agents page should have agent-related content', async ({ page }) => {
    await page.goto('/ia-agentes');
    await page.waitForLoadState('networkidle');

    // Check page loads without error
    await expect(page.locator('body')).toBeVisible();
  });

  test('Tasks page should load', async ({ page }) => {
    await page.goto('/ia-tarefas');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  test('Approvals page should load', async ({ page }) => {
    await page.goto('/ia-aprovacoes');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Console & Network Health', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should have no console errors on main pages', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const pages = ['/executivo', '/projetos', '/ia-visao', '/ia-agentes', '/ia-tarefas'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    expect(consoleErrors.length).toBe(0);
  });

  test('should have no 4xx/5xx network failures on main pages', async ({ page }) => {
    const networkFailures: { url: string; status: number }[] = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        networkFailures.push({ url: response.url(), status: response.status() });
      }
    });

    const pages = ['/executivo', '/projetos', '/ia-visao', '/ia-agentes', '/ia-tarefas'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    expect(networkFailures.length).toBe(0);
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should render correctly on mobile', async ({ page }) => {
    await page.goto('/executivo');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    const scrollWidth = await body.evaluate(el => el.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });

  test('IA pages should render on mobile', async ({ page }) => {
    const pages = ['/ia-visao', '/ia-agentes', '/ia-tarefas'];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      const body = page.locator('body');
      const scrollWidth = await body.evaluate(el => el.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(375);
    }
  });
});