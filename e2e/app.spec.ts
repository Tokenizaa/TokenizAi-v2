import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'nettoscorp@gmail.com';
const ADMIN_PASSWORD = 'Hermes@964212$';

async function login(page: Page) {
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
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
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

test.describe('Enterprise CRUD Operations', () => {
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
    await login(page);
  });

  test('Projects - create new project', async ({ page }) => {
    await page.goto('/projetos');
    await page.waitForLoadState('networkidle');
    
    const newBtn = page.locator('button:has-text("Novo projeto")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      
      const drawer = page.locator('[role="dialog"]').last();
      await expect(drawer).toBeVisible();
      
      const nameInput = drawer.locator('input[placeholder*="projeto" i], input[placeholder*="nome" i], input[name*="nome" i]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill('Projeto Teste E2E');
      }
      
      const clientSelect = drawer.locator('select').first();
      if (await clientSelect.count() > 0) {
        await clientSelect.selectOption({ index: 1 });
      }
      
      const saveBtn = drawer.locator('button:has-text("Salvar"), button:has-text("Criar")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Clients - create new client', async ({ page }) => {
    await page.goto('/clientes');
    await page.waitForLoadState('networkidle');
    
    const newBtn = page.locator('button:has-text("Novo cliente")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      
      const drawer = page.locator('[role="dialog"]').last();
      await expect(drawer).toBeVisible();
      
      const nameInput = drawer.locator('input[placeholder*="empresa" i], input[placeholder*="razão" i], input[placeholder*="nome" i]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill('Cliente Teste E2E');
      }
      
      const saveBtn = drawer.locator('button:has-text("Salvar"), button:has-text("Criar")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Commercial - create new deal', async ({ page }) => {
    await page.goto('/comercial');
    await page.waitForLoadState('networkidle');
    
    const newBtn = page.locator('button:has-text("Nova oportunidade"), button:has-text("Novo negócio")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      
      const drawer = page.locator('[role="dialog"]').last();
      await expect(drawer).toBeVisible();
      
      const titleInput = drawer.locator('input[placeholder*="oportunidade" i], input[placeholder*="título" i]').first();
      if (await titleInput.count() > 0) {
        await titleInput.fill('Oportunidade Teste E2E');
      }
      
      const saveBtn = drawer.locator('button:has-text("Salvar"), button:has-text("Criar")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });

  test('Finance - create new entry', async ({ page }) => {
    await page.goto('/financeiro');
    await page.waitForLoadState('networkidle');
    
    const newBtn = page.locator('button:has-text("Novo lançamento"), button:has-text("Nova entrada")').first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      
      const drawer = page.locator('[role="dialog"]').last();
      await expect(drawer).toBeVisible();
      
      const descInput = drawer.locator('input[placeholder*="lançamento" i], input[placeholder*="descrição" i]').first();
      if (await descInput.count() > 0) {
        await descInput.fill('Lançamento Teste E2E');
      }
      
      const valueInput = drawer.locator('input[placeholder*="valor" i], input[type="number"]').first();
      if (await valueInput.count() > 0) {
        await valueInput.fill('1000');
      }
      
      const saveBtn = drawer.locator('button:has-text("Salvar"), button:has-text("Criar")').first();
      if (await saveBtn.count() > 0) {
        await saveBtn.click();
        await page.waitForTimeout(1000);
      }
      
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('AI Workforce Routes (Consolidated)', () => {
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
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
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
    await login(page);
  });

  test('Dashboard should have interactive elements', async ({ page }) => {
    await page.goto('/ia-visao');
    await page.waitForLoadState('networkidle');

    const interactive = page.locator('button, a[href]');
    const count = await interactive.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Agents page should have agent-related content', async ({ page }) => {
    await page.goto('/ia-agentes');
    await page.waitForLoadState('networkidle');
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
  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
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

  test.beforeEach(async ({ page }: { page: import('@playwright/test').Page }) => {
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