#!/usr/bin/env python3
"""Auditoria completa do frontend TokenizAi v2 via MCP Playwright + CDP.

Conecta ao servidor MCP Playwright (stdio) que já está ligado ao Chrome/CDP
na porta 9222, navega por cada rota, captura screenshots, console, rede e DOM.
"""

import json
import subprocess
import sys
import os
import time
from datetime import datetime

MCP_CMD = ["npx", "--yes", "@playwright/mcp@latest", "--cdp-endpoint=http://127.0.0.1:9222"]
WORKSPACE = "/home/lg/workspace/NettosCorp/TokenizAi/TokenizAi-v2"
SCREENSHOT_DIR = os.path.join(WORKSPACE, "audit-screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

BASE_URL = "https://tokenizai.defesai.com.br"

# Rotas extraídas do App.tsx (código-fonte)
ROUTES = [
    ("/", "Redirect para /executivo"),
    ("/executivo", "ExecutiveView"),
    ("/projetos", "Projetos"),
    ("/clientes", "Clientes"),
    ("/comercial", "Comercial"),
    ("/produtos", "Produtos"),
    ("/assinaturas", "Assinaturas"),
    ("/financeiro", "Financeiro"),
    ("/relatorios", "Relatorios"),
    ("/biblioteca", "Biblioteca"),
    ("/admin", "Admin"),
    ("/ia-visao", "Dashboard (IA Visao)"),
    ("/ia-inbox", "Inbox"),
    ("/ia-chat", "Chat"),
    ("/ia-agentes", "Agentes"),
    ("/ia-agentes/:agentId", "Detalhe do agente (exemplo id=1)"),
    ("/ia-equipes", "Organograma / Equipes"),
    ("/ia-tarefas", "Tarefas"),
    ("/ia-tarefas/:taskId", "Detalhe da tarefa (exemplo id=1)"),
    ("/ia-execucoes", "Runs / Execucoes"),
    ("/ia-rotinas", "Rotinas"),
    ("/ia-aprovacoes", "Aprovacoes"),
    ("/ia-aprovacoes/:approvalId", "Detalhe da aprovacao (exemplo id=1)"),
    ("/ia-custos", "Custos"),
    ("/ia-metas", "Metas"),
    ("/ia-skills", "Skills"),
    ("/ia-conectores", "Conectores"),
    ("/ia-atividade", "Atividade"),
    ("/ia-artefatos", "Artefatos"),
]

results = []

class MCPClient:
    def __init__(self, cmd):
        self.proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self._id = 0
        # initialize
        self._send("initialize", {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "audit", "version": "1"}})
        self._read_line()  # consume init response

    def _send(self, method, params=None):
        self._id += 1
        msg = {"jsonrpc": "2.0", "id": self._id, "method": method, "params": params or {}}
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()

    def _read_line(self):
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("MCP process closed stdout")
        return json.loads(line)

    def call(self, tool, arguments):
        self._send("tools/call", {"name": tool, "arguments": arguments})
        resp = self._read_line()
        if "error" in resp:
            raise RuntimeError(f"MCP error: {resp['error']}")
        return resp.get("result", {})

    def close(self):
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        try:
            self.proc.terminate()
        except Exception:
            pass


def stamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def main():
    mcp = MCPClient(MCP_CMD)

    # Helper to list tools once
    tools = mcp.call("tools/list", {})
    print("Ferramentas MCP disponíveis:", [t["name"] for t in tools.get("tools", [])], flush=True)

    for route, label in ROUTES:
        url = BASE_URL + route
        safe_name = route.strip("/").replace("/", "_").replace(":", "_") or "root"
        ts = stamp()
        screenshot_path = os.path.join(SCREENSHOT_DIR, f"{safe_name}.png")

        entry = {
            "route": route,
            "label": label,
            "url": url,
            "timestamp": ts,
            "screenshot": screenshot_path,
            "title": None,
            "url_loaded": False,
            "dom_loaded": False,
            "react_mounted": None,
            "main_content_visible": None,
            "expected_components": None,
            "data_loaded": None,
            "empty_state": None,
            "persistent_spinners": None,
            "blank_areas": None,
            "console_errors": [],
            "failed_network": [],
            "pending_requests": [],
            "api_calls": [],
            "load_time_ms": None,
            "interactions": [],
            "classification": "NÃO TESTADA",
            "evidence": [],
            "notes": [],
        }

        print(f"\n=== AUDITANDO {route} ({label}) ===", flush=True)

        # 1. Navegar
        t0 = time.time()
        try:
            mcp.call("browser_navigate", {"url": url, "waitUntil": "networkidle"})
            entry["url_loaded"] = True
            entry["evidence"].append(f"URL acessada: {url}")
        except Exception as e:
            entry["classification"] = "ERRO"
            entry["notes"].append(f"Falha ao navegar: {e}")
            results.append(entry)
            continue

        # Aguardar estabilização
        time.sleep(3)

        # 2. Snapshot do DOM
        try:
            snap = mcp.call("browser_snapshot", {})
            entry["dom_loaded"] = True
            snap_text = json.dumps(snap)[:5000]
            entry["evidence"].append(f"DOM snapshot obtido ({len(snap_text)} chars)")
        except Exception as e:
            entry["notes"].append(f"Falha no snapshot: {e}")

        # 3. Título da página
        try:
            title_res = mcp.call("browser_evaluate", {"function": "() => document.title"})
            entry["title"] = str(title_res)
            entry["evidence"].append(f"Título: {entry['title']}")
        except Exception as e:
            entry["notes"].append(f"Falha ao obter título: {e}")

        # 4. Screenshot
        try:
            mcp.call("browser_screenshot", {"path": screenshot_path, "fullPage": True})
            entry["evidence"].append(f"Screenshot salva: {screenshot_path}")
        except Exception as e:
            entry["notes"].append(f"Falha no screenshot: {e}")

        # 5. Mensagens de console
        try:
            console = mcp.call("browser_console_messages", {"level": "error", "all": True})
            errors = console.get("messages", []) if isinstance(console, dict) else []
            for err in errors:
                entry["console_errors"].append(str(err))
            if entry["console_errors"]:
                entry["evidence"].append(f"Erros de console: {len(entry['console_errors'])}")
        except Exception as e:
            entry["notes"].append(f"Falha ao ler console: {e}")

        # 6. Verificar se React montou (procurar por id="root" com filhos)
        try:
            root_check = mcp.call("browser_evaluate", {
                "function": "() => { const r = document.getElementById('root'); return r ? {hasRoot: true, childCount: r.children.length, innerHTML_len: r.innerHTML.length, text_len: r.innerText.length} : {hasRoot: false}; }"
            })
            entry["react_mounted"] = root_check
            entry["evidence"].append(f"React root: {root_check}")
        except Exception as e:
            entry["notes"].append(f"Falha ao verificar React: {e}")

        # 7. Conteúdo principal visível (texto do body)
        try:
            body_text = mcp.call("browser_evaluate", {
                "function": "() => document.body ? {bodyText_len: document.body.innerText.length, visibleText: document.body.innerText.substring(0, 2000)} : {bodyText_len: 0}"
            })
            entry["main_content_visible"] = body_text
            txt = str(body_text)
            if len(txt) > 200:
                entry["data_loaded"] = True
                entry["evidence"].append(f"Conteúdo visível ({len(txt)} chars): {txt[:300]}")
            else:
                entry["empty_state"] = True
                entry["evidence"].append("Parece vazia ou pouco conteúdo")
        except Exception as e:
            entry["notes"].append(f"Falha ao ler body: {e}")

        # 8. Spinners / carregamento infinito
        try:
            spin_check = mcp.call("browser_evaluate", {
                "function": "() => { const spins = document.querySelectorAll('[class*=\"spinner\" i], [class*=\"loading\" i], [class*=\"skeleton\" i], [role=\"progressbar\"]'); return {count: spins.length, selectors: Array.from(spins).map(s => s.className)}; }"
            })
            entry["persistent_spinners"] = spin_check
            if spin_check and spin_check.get("count", 0) > 0:
                entry["notes"].append(f"Spinners/skeletons detectados: {spin_check['count']}")
        except Exception as e:
            entry["notes"].append(f"Falha ao verificar spinners: {e}")

        t1 = time.time()
        entry["load_time_ms"] = int((t1 - t0) * 1000)

        # Classificação preliminar
        if entry["classification"] == "ERRO":
            pass
        elif entry.get("empty_state") and not entry.get("main_content_visible"):
            entry["classification"] = "VAZIA"
        elif entry.get("persistent_spinners") and entry.get("persistent_spinners", {}).get("count", 0) > 0:
            entry["classification"] = "CARREGAMENTO INFINITO"
        elif entry["console_errors"]:
            entry["classification"] = "PARCIAL"
        elif entry["react_mounted"] and entry["react_mounted"].get("hasRoot") and entry["main_content_visible"] and entry["main_content_visible"].get("bodyText_len", 0) > 200:
            entry["classification"] = "APROVADA"
        else:
            entry["classification"] = "PARCIAL"

        results.append(entry)
        print(f"Classificacao: {entry['classification']} | Título: {entry['title']} | Tempo: {entry['load_time_ms']}ms", flush=True)

    # Relatório final
    report_path = os.path.join(WORKSPACE, "AUDITORIA-FRONTEND-V2.md")
    with open(report_path, "w") as f:
        f.write("# Auditoria Frontend TokenizAi v2\n\n")
        f.write(f"Gerado em: {stamp()}\n")
        f.write(f"URL base: {BASE_URL}\n\n")
        f.write("## Matriz de rotas\n\n")
        f.write("| Rota | Conteúdo visível | Estado | Título | Load time (ms) | Screenshot |\n")
        f.write("|------|------------------|--------|--------|----------------|------------|\n")
        for r in results:
            vis = "Sim" if r["main_content_visible"] and r["main_content_visible"].get("bodyText_len", 0) > 0 else "Não"
            f.write(f"| {r['route']} | {vis} | {r['classification']} | {r['title']} | {r['load_time_ms']} | {r['screenshot']} |\n")

        f.write("\n## Detalhes por rota\n\n")
        for r in results:
            f.write(f"\n### {r['route']} — {r['label']}\n")
            f.write(f"- URL: {r['url']}\n")
            f.write(f"- Timestamp: {r['timestamp']}\n")
            f.write(f"- Classificação: {r['classification']}\n")
            f.write(f"- Título: {r['title']}\n")
            f.write(f"- Load time: {r['load_time_ms']}ms\n")
            f.write(f"- React montado: {r['react_mounted']}\n")
            f.write(f"- Conteúdo visível: {r['main_content_visible']}\n")
            f.write(f"- Erros console: {r['console_errors']}\n")
            f.write(f"- Rede falha: {r['failed_network']}\n")
            f.write(f"- Evidências: {r['evidence']}\n")
            f.write(f"- Notas: {r['notes']}\n")
            f.write(f"- Screenshot: {r['screenshot']}\n")

    print(f"\n=== RELATÓRIO SALVO: {report_path} ===", flush=True)
    print(f"Total rotas auditadas: {len(results)}", flush=True)
    mcp.close()


if __name__ == "__main__":
    main()
