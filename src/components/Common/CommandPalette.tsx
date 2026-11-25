import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { AGENCY_SPECIALISTS } from '../../data/agencyCatalog';
import type {
  EnterpriseDataState,
  HermesTaskDto,
  HermesProjectDto,
  HermesBotDto,
  NavSectionId,
} from '../../types/platform';
import { NAV_ITEMS } from '../Layout/AppShell';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  enterprise: EnterpriseDataState;
  bots: HermesBotDto[];
  tasks?: HermesTaskDto[];
  projects?: HermesProjectDto[];
  onNavigate: (section: NavSectionId) => void;
}

interface SearchHit {
  id: string;
  label: string;
  context: string;
  section: NavSectionId;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  enterprise,
  bots,
  tasks = [],
  projects = [],
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    const list: SearchHit[] = [];

    for (const nav of NAV_ITEMS) {
      if (!q || nav.label.toLowerCase().includes(q) || nav.group.toLowerCase().includes(q)) {
        list.push({
          id: `nav-${nav.id}`,
          label: nav.label,
          context: `Navegação · ${nav.group}`,
          section: nav.id,
        });
      }
    }

    if (q) {
      for (const p of enterprise.projects) {
        if (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)) {
          list.push({
            id: p.id,
            label: `${p.code} · ${p.name}`,
            context: `Projeto · ${p.clientName}`,
            section: 'projetos',
          });
        }
      }

      for (const c of enterprise.clients) {
        if (c.name.toLowerCase().includes(q) || c.segment.toLowerCase().includes(q)) {
          list.push({
            id: c.id,
            label: c.name,
            context: `Cliente · ${c.segment}`,
            section: 'clientes',
          });
        }
      }

      for (const d of enterprise.deals) {
        if (d.title.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q)) {
          list.push({
            id: d.id,
            label: d.title,
            context: `Comercial · ${d.stage}`,
            section: 'comercial',
          });
        }
      }

      for (const bot of bots) {
        if (
          bot.name.toLowerCase().includes(q) ||
          (bot.title || '').toLowerCase().includes(q) ||
          bot.role?.toLowerCase().includes(q)
        ) {
          list.push({
            id: `h-bot-${bot.id}`,
            label: bot.title || bot.name,
            context: `Agente Hermes · ${bot.role}`,
            section: 'ia-agentes',
          });
        }
      }

      for (const task of tasks) {
        if (
          task.title.toLowerCase().includes(q) ||
          task.id.toLowerCase().includes(q)
        ) {
          list.push({
            id: `h-task-${task.id}`,
            label: task.title,
            context: `Tarefa Hermes · ${task.status}`,
            section: 'ia-tarefas',
          });
        }
      }

      for (const hProj of projects) {
        if (hProj.name.toLowerCase().includes(q)) {
          list.push({
            id: `h-proj-${hProj.id}`,
            label: hProj.name,
            context: `Projeto Operacional Hermes · ${hProj.status || 'Ativo'}`,
            section: 'ia-visao',
          });
        }
      }

      for (const sp of AGENCY_SPECIALISTS) {
        if (sp.name.toLowerCase().includes(q) || sp.division.toLowerCase().includes(q)) {
          list.push({
            id: sp.id,
            label: sp.name,
            context: `Biblioteca Agency · ${sp.division}`,
            section: 'biblioteca',
          });
        }
      }
    }

    return list.slice(0, 12);
  }, [query, enterprise, bots, tasks, projects]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
      <div className="fixed inset-0 bg-slate-950/55 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisa rápida"
        className="relative z-10 w-full max-w-xl rounded-2xl nc-glow-panel overflow-hidden shadow-2xl"
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line">
          <Search className="w-4 h-4 text-accent dark:text-cyan-300 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar módulos, projetos, clientes, diretorias, agentes ou especialistas..."
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none border-none shadow-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="p-1 rounded-md text-ink-subtle hover:text-ink cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[56vh] overflow-y-auto divide-y divide-line">
          {hits.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-ink-subtle">
              Nenhum resultado encontrado para "{query}".
            </div>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => {
                  onNavigate(hit.section);
                  onClose();
                }}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{hit.label}</div>
                  <div className="text-xs text-ink-subtle truncate">{hit.context}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-ink-subtle shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
